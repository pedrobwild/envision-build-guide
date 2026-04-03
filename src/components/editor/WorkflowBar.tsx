import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Calendar,
  User,
  AlertTriangle,
  MoreHorizontal,
  FileText,
} from "lucide-react";
import {
  INTERNAL_STATUSES,
  PRIORITIES,
  type InternalStatus,
  type Priority,
} from "@/lib/role-constants";
import { differenceInCalendarDays, isPast, isToday, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { BlockingDialog } from "./BlockingDialog";

interface ProfileRow {
  id: string;
  full_name: string;
}

interface WorkflowBarProps {
  budget: any;
  onBudgetUpdate: (fields: Record<string, any>) => void;
}

// Status badge color mapping
function getStatusBadgeClass(status: InternalStatus): string {
  switch (status) {
    case "in_progress":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "ready_for_review":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "sent_to_client":
    case "delivered_to_sales":
      return "bg-purple-100 text-purple-800 border-purple-200";
    case "sent_to_client":
      return "bg-green-100 text-green-800 border-green-200";
    case "blocked":
    case "waiting_info":
      return "bg-red-100 text-red-800 border-red-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

// Transition map
type Transition = {
  label: string;
  newStatus: InternalStatus;
  roles: ("admin" | "comercial" | "orcamentista")[];
};

const PRIMARY_TRANSITIONS: Record<string, Transition> = {
  requested: { label: "Atribuir e Iniciar Produção", newStatus: "assigned", roles: ["admin"] },
  triage: { label: "Atribuir e Iniciar Produção", newStatus: "assigned", roles: ["admin"] },
  assigned: { label: "Iniciar Produção", newStatus: "in_progress", roles: ["orcamentista", "admin"] },
  in_progress: { label: "Enviar para Revisão", newStatus: "ready_for_review", roles: ["orcamentista", "admin"] },
  ready_for_review: { label: "Enviar ao Cliente", newStatus: "sent_to_client", roles: ["comercial", "admin"] },
};

export function WorkflowBar({ budget, onBudgetUpdate }: WorkflowBarProps) {
  const { user } = useAuth();
  const { profile, isAdmin, isComercial, isOrcamentista } = useUserProfile();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [blockingTarget, setBlockingTarget] = useState<"waiting_info" | "blocked" | null>(null);
  const [contractConfirmOpen, setContractConfirmOpen] = useState(false);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, full_name")
      .then(({ data }) => {
        if (data) setProfiles(data as ProfileRow[]);
      });
  }, []);

  const getProfileName = useCallback(
    (id: string | null) => {
      if (!id) return "—";
      return profiles.find((p) => p.id === id)?.full_name || "—";
    },
    [profiles]
  );

  const internalStatus = (budget.internal_status ?? "requested") as InternalStatus;
  const statusInfo = INTERNAL_STATUSES[internalStatus] ?? INTERNAL_STATUSES.requested;
  const prioInfo = PRIORITIES[(budget.priority ?? "normal") as Priority] ?? PRIORITIES.normal;

  const dueAt = budget.due_at ? new Date(budget.due_at) : null;
  const daysLeft = dueAt ? differenceInCalendarDays(dueAt, new Date()) : null;
  const overdue = dueAt ? isPast(dueAt) && !isToday(dueAt) : false;
  const dueToday = dueAt ? isToday(dueAt) : false;

  const userRoles = profile?.roles ?? [];

  async function changeStatus(newStatus: InternalStatus, note?: string) {
    const oldStatus = budget.internal_status;

    const { error } = await supabase
      .from("budgets")
      .update({ internal_status: newStatus, updated_at: new Date().toISOString() } as any)
      .eq("id", budget.id);

    if (error) {
      toast.error("Erro ao atualizar status.");
      return;
    }

    if (user) {
      await supabase.from("budget_events").insert({
        budget_id: budget.id,
        user_id: user.id,
        event_type: "status_change",
        from_status: oldStatus,
        to_status: newStatus,
        note: note || null,
      } as any);

      if (note) {
        await supabase.from("budget_comments").insert({
          budget_id: budget.id,
          user_id: user.id,
          body: `[${INTERNAL_STATUSES[newStatus]?.label ?? newStatus}] ${note}`,
        } as any);
      }
    }

    onBudgetUpdate({ internal_status: newStatus });
    toast.success(`Status → ${INTERNAL_STATUSES[newStatus]?.label ?? newStatus}`);
  }

  async function handleBlockingConfirm(status: InternalStatus, note: string) {
    await changeStatus(status, note);
    setBlockingTarget(null);
  }

  // Determine primary action
  const primaryTransition = PRIMARY_TRANSITIONS[internalStatus];
  const canDoPrimary = primaryTransition && primaryTransition.roles.some((r) => userRoles.includes(r));

  // Secondary actions
  const showSecondary = isAdmin || isComercial;
  const isBlockedOrWaiting = internalStatus === "blocked" || internalStatus === "waiting_info";

  function handlePrimaryClick() {
    if (!primaryTransition) return;
    changeStatus(primaryTransition.newStatus);
  }

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
      <div className="flex items-center gap-3 flex-wrap">
        {/* Read-only status badge */}
        <Badge className={`${getStatusBadgeClass(internalStatus)} text-xs font-body border`}>
          {statusInfo.icon} {statusInfo.label}
        </Badge>

        <div className="h-4 w-px bg-border hidden sm:block" />

        {/* Priority */}
        <Badge variant="outline" className={`${prioInfo.color} text-xs font-body`}>
          {prioInfo.label}
        </Badge>

        {/* Deadline */}
        {dueAt && (
          <>
            <div className="h-4 w-px bg-border hidden sm:block" />
            <span
              className={`inline-flex items-center gap-1 text-xs font-medium font-body px-2 py-0.5 rounded-full border ${
                overdue
                  ? "bg-destructive/10 text-destructive border-destructive/20"
                  : dueToday
                  ? "bg-warning/10 text-warning border-warning/20"
                  : daysLeft !== null && daysLeft <= 2
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "text-muted-foreground border-border"
              }`}
            >
              <Calendar className="h-3 w-3" />
              {overdue
                ? `${Math.abs(daysLeft!)}d atrasado`
                : dueToday
                ? "Vence hoje"
                : `${format(dueAt, "dd MMM", { locale: ptBR })} (${daysLeft}d)`}
            </span>
          </>
        )}

        <div className="h-4 w-px bg-border hidden sm:block" />

        {/* Ownership */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-body cursor-default">
              <User className="h-3 w-3" />
              {getProfileName(budget.commercial_owner_id)}
            </span>
          </TooltipTrigger>
          <TooltipContent>Comercial responsável</TooltipContent>
        </Tooltip>

        {budget.internal_notes && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-body cursor-default">
                <AlertTriangle className="h-3 w-3" />
                Obs. internas
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm">
              <p className="text-xs whitespace-pre-wrap">{budget.internal_notes}</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          {/* Primary action button */}
          {canDoPrimary && (
            <Button
              variant="default"
              size="sm"
              className="h-7 text-xs"
              onClick={handlePrimaryClick}
            >
              {primaryTransition.label}
            </Button>
          )}

          {/* Secondary overflow menu */}
          {showSecondary && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!isBlockedOrWaiting && (
                  <>
                    <DropdownMenuItem onClick={() => setBlockingTarget("blocked")}>
                      🚫 Bloquear
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setBlockingTarget("waiting_info")}>
                      ⏳ Aguardando Informação
                    </DropdownMenuItem>
                  </>
                )}
                {isBlockedOrWaiting && (
                  <DropdownMenuItem onClick={() => changeStatus("in_progress")}>
                    🔨 Reabrir
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => window.open(`/admin/demanda/${budget.id}`, "_blank")}
              >
                <FileText className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Ver detalhes da demanda</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Confirmation dialog for contract */}
      <AlertDialog open={contractConfirmOpen} onOpenChange={setContractConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Registrar contrato fechado?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação marca o orçamento como contrato fechado. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => changeStatus("contrato_fechado")}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BlockingDialog
        open={!!blockingTarget}
        targetStatus={blockingTarget}
        onConfirm={handleBlockingConfirm}
        onCancel={() => setBlockingTarget(null)}
      />
    </div>
  );
}
