import { useState, useCallback, useEffect, useMemo } from "react";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
  RotateCcw,
  PackageCheck,
  Send,
  Handshake,
  Loader2,
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
import { RevisionRequestDialog } from "./RevisionRequestDialog";

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
  revision_requested: { label: "Iniciar Revisão", newStatus: "in_progress", roles: ["orcamentista", "admin"] },
};

export function WorkflowBar({ budget, onBudgetUpdate }: WorkflowBarProps) {
  const { user } = useAuth();
  const { profile, isAdmin, isComercial, isOrcamentista } = useUserProfile();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [blockingTarget, setBlockingTarget] = useState<"waiting_info" | "blocked" | null>(null);
  const [revisionModalOpen, setRevisionModalOpen] = useState(false);
  const [revisionInstructionsOpen, setRevisionInstructionsOpen] = useState(false);
  const [revisionInstructions, setRevisionInstructions] = useState<{ instructions: string; change_types: string[]; requested_by_name: string } | null>(null);
  const [loadingInstructions, setLoadingInstructions] = useState(false);

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
    const note = internalStatus === "revision_requested" ? "Revisão iniciada pelo orçamentista" : undefined;
    changeStatus(primaryTransition.newStatus, note);
    if (internalStatus === "revision_requested") {
      toast.success("Revisão iniciada. Realize as alterações e envie para revisão.");
    }
  }

  async function openRevisionInstructions() {
    setLoadingInstructions(true);
    setRevisionInstructionsOpen(true);
    const { data } = await supabase
      .from("budget_events")
      .select("metadata")
      .eq("budget_id", budget.id)
      .eq("event_type", "revision_requested")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (data?.metadata) {
      const m = data.metadata as any;
      setRevisionInstructions({
        instructions: m.instructions || "",
        change_types: m.change_types || [],
        requested_by_name: m.requested_by_name || "—",
      });
    }
    setLoadingInstructions(false);
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
              className={`h-7 text-xs gap-1.5 ${internalStatus === "revision_requested" ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}`}
              onClick={handlePrimaryClick}
            >
              {internalStatus === "revision_requested" && <RotateCcw className="h-3.5 w-3.5" />}
              {primaryTransition.label}
            </Button>
          )}

          {/* Revision request button — comercial/admin only, sent_to_client only */}
          {internalStatus === "sent_to_client" && (isComercial || isAdmin) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRevisionModalOpen(true)}
              className="h-7 text-xs border-orange-400 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 gap-2"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Solicitar Revisão
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
                {internalStatus === "revision_requested" && isAdmin && (
                  <>
                    <DropdownMenuItem onClick={openRevisionInstructions}>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Ver instruções da revisão
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
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


      <BlockingDialog
        open={!!blockingTarget}
        targetStatus={blockingTarget}
        onConfirm={handleBlockingConfirm}
        onCancel={() => setBlockingTarget(null)}
      />

      <RevisionRequestDialog
        open={revisionModalOpen}
        onOpenChange={setRevisionModalOpen}
        budgetId={budget.id}
        currentStatus={internalStatus}
        onSuccess={() => {
          setRevisionModalOpen(false);
          onBudgetUpdate({ internal_status: "revision_requested" });
        }}
      />

      <Dialog open={revisionInstructionsOpen} onOpenChange={(open) => {
        setRevisionInstructionsOpen(open);
        if (!open) setRevisionInstructions(null);
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-display">
              <RotateCcw className="h-4 w-4 text-orange-500" />
              Instruções da Revisão
            </DialogTitle>
            {revisionInstructions && (
              <DialogDescription className="text-xs font-body">
                Solicitada por {revisionInstructions.requested_by_name}
              </DialogDescription>
            )}
          </DialogHeader>
          {loadingInstructions ? (
            <div className="flex items-center justify-center py-8">
              <span className="text-sm text-muted-foreground">Carregando...</span>
            </div>
          ) : revisionInstructions ? (
            <div className="space-y-4">
              {revisionInstructions.change_types.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Tipo de alteração</p>
                  <div className="flex flex-wrap gap-1.5">
                    {revisionInstructions.change_types.map((t) => (
                      <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Instruções</p>
                <p className="text-sm whitespace-pre-wrap bg-muted/50 rounded-md p-3 border">
                  {revisionInstructions.instructions}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4">Nenhuma instrução encontrada.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
