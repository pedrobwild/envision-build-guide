import { useState, useCallback, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BudgetRow, ProfileRow } from "@/types/budget-common";
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
import { publishVersion, ensureVersionGroup } from "@/lib/budget-versioning";
import { sendBudgetPublishedNotification } from "@/lib/digisac-notify";

import { logger } from "@/lib/logger";

interface WorkflowBarProps {
  budget: BudgetRow;
  onBudgetUpdate: (fields: Record<string, unknown>) => void;
}

// Status badge color mapping
function getStatusBadgeClass(status: InternalStatus): string {
  switch (status) {
    case "in_progress":
      return "bg-primary/10 text-primary border-primary/20";
    case "ready_for_review":
      return "bg-warning/10 text-warning border-warning/20";
    case "delivered_to_sales":
      return "bg-accent text-accent-foreground border-border";
    case "sent_to_client":
      return "bg-success/10 text-success border-success/20";
    case "revision_requested":
      return "bg-warning/10 text-warning border-warning/20";
    case "minuta_solicitada":
      return "bg-accent text-accent-foreground border-border";
    case "contrato_fechado":
      return "bg-success/10 text-success border-success/20";
    case "waiting_info":
      return "bg-destructive/10 text-destructive border-destructive/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

// Transition map
type Transition = {
  label: string;
  newStatus: InternalStatus;
  roles: ("admin" | "comercial" | "orcamentista")[];
  confirmRequired?: boolean;
  confirmMessage?: string;
};

const PRIMARY_TRANSITIONS: Record<string, Transition> = {
  requested: { label: "Atribuir e Iniciar Produção", newStatus: "assigned", roles: ["admin"] },
  triage: { label: "Atribuir e Iniciar Produção", newStatus: "assigned", roles: ["admin"] },
  assigned: { label: "Iniciar Produção", newStatus: "in_progress", roles: ["orcamentista", "admin"] },
  in_progress: { label: "Enviar para Revisão", newStatus: "ready_for_review", roles: ["orcamentista", "admin"] },
  ready_for_review: { label: "Entregar ao Comercial", newStatus: "delivered_to_sales", roles: ["orcamentista", "admin"] },
  delivered_to_sales: {
    label: "Enviar ao Cliente",
    newStatus: "sent_to_client",
    roles: ["comercial", "admin"],
    confirmRequired: true,
  },
  revision_requested: { label: "Iniciar Revisão", newStatus: "in_progress", roles: ["orcamentista", "admin"] },
  minuta_solicitada: {
    label: "Registrar Contrato Fechado",
    newStatus: "contrato_fechado",
    roles: ["comercial", "admin"],
    confirmRequired: true,
    confirmMessage: "Confirmar contrato fechado? Esta ação marca o orçamento como convertido.",
  },
};

export function WorkflowBar({ budget, onBudgetUpdate }: WorkflowBarProps) {
  const { user } = useAuth();
  const { profile, isAdmin, isComercial, isOrcamentista } = useUserProfile();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [blockingTarget, setBlockingTarget] = useState<"waiting_info" | null>(null);
  const [revisionModalOpen, setRevisionModalOpen] = useState(false);
  const [revisionInstructionsOpen, setRevisionInstructionsOpen] = useState(false);
  const [revisionInstructions, setRevisionInstructions] = useState<{ instructions: string; change_types: string[]; requested_by_name: string } | null>(null);
  const [loadingInstructions, setLoadingInstructions] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("profiles")
      .select("id, full_name")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) logger.error('Failed to load profiles:', error.message);
        if (data) setProfiles(data as ProfileRow[]);
      });
    return () => { cancelled = true; };
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
      .update({ internal_status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", budget.id);

    if (error) {
      const msg = error.message || "";
      if (/jwt|sub claim|token|401|403/i.test(msg)) {
        toast.error("Sessão expirada. Recarregue a página e faça login novamente.");
      } else if (/row-level security|permission/i.test(msg)) {
        toast.error("Você não tem permissão para alterar este orçamento.");
      } else {
        toast.error(`Erro ao atualizar status: ${msg}`);
      }
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
      });

      if (note) {
        await supabase.from("budget_comments").insert({
          budget_id: budget.id,
          user_id: user.id,
          body: `[${INTERNAL_STATUSES[newStatus]?.label ?? newStatus}] ${note}`,
        });
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
  const isWaiting = internalStatus === "waiting_info";

  async function ensurePublishedSilently(): Promise<string | null> {
    try {
      let publishedPublicId = budget.public_id;
      if (!budget.is_published_version) {
        const groupId = await ensureVersionGroup(budget.id);
        publishedPublicId = budget.public_id || crypto.randomUUID().slice(0, 12);
        await publishVersion(budget.id, groupId, publishedPublicId, user?.id);
        onBudgetUpdate({ is_published_version: true, public_id: publishedPublicId, status: "published" });
      }
      return publishedPublicId ?? null;
    } catch (err) {
      logger.error("Erro ao publicar (silencioso):", err);
      toast.error("Erro ao publicar o orçamento.");
      return null;
    }
  }

  async function handlePrimaryClick() {
    if (!primaryTransition) return;
    if (primaryTransition.confirmRequired) {
      setConfirmDialogOpen(true);
      return;
    }

    // Ao "Entregar ao Comercial": publica automaticamente (sem notificar o cliente)
    // para que o link público fique disponível ao time comercial.
    if (internalStatus === "ready_for_review" && primaryTransition.newStatus === "delivered_to_sales") {
      const publicId = await ensurePublishedSilently();
      if (!publicId) return;
      await changeStatus(primaryTransition.newStatus);
      toast.success("Entregue ao comercial. Link público disponível.");
      return;
    }

    const note = internalStatus === "revision_requested" ? "Revisão iniciada pelo orçamentista" : undefined;
    changeStatus(primaryTransition.newStatus, note);
    if (internalStatus === "revision_requested") {
      toast.success("Revisão iniciada. Realize as alterações e envie para revisão.");
    }
  }

  async function handleConfirmedTransition() {
    if (!primaryTransition) return;
    setConfirmLoading(true);

    // delivered_to_sales → sent_to_client: garante publicação + notifica cliente
    if (internalStatus === "delivered_to_sales" && primaryTransition.newStatus === "sent_to_client") {
      const publishedPublicId = await ensurePublishedSilently();
      if (!publishedPublicId) {
        setConfirmLoading(false);
        setConfirmDialogOpen(false);
        return;
      }
      void sendBudgetPublishedNotification({
        budgetId: budget.id,
        clientName: budget.client_name,
        clientPhone: (budget as { client_phone?: string | null }).client_phone,
        publicId: publishedPublicId,
      }).then((res) => {
        if (res.success) toast.info("WhatsApp enviado ao cliente.");
      });
    }

    await changeStatus(primaryTransition.newStatus);
    setConfirmLoading(false);
    setConfirmDialogOpen(false);
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
      .maybeSingle();
    if (data?.metadata) {
      const m = data.metadata as { instructions?: string; change_types?: string[]; requested_by_name?: string } | null;
      setRevisionInstructions({
        instructions: m?.instructions || "",
        change_types: m?.change_types || [],
        requested_by_name: m?.requested_by_name || "—",
      });
    }
    setLoadingInstructions(false);
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card px-3 sm:px-4 py-2.5 sm:py-3 shadow-sm">
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        {/* Read-only status badge */}
        <Badge className={`${getStatusBadgeClass(internalStatus)} text-[10px] sm:text-xs font-body border`}>
          {statusInfo.icon} <span className="hidden sm:inline">{statusInfo.label}</span>
        </Badge>

        <div className="h-4 w-px bg-border hidden sm:block" />

        {/* Priority */}
        <Badge variant="outline" className={`${prioInfo.color} text-[10px] sm:text-xs font-body hidden sm:inline-flex`}>
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
                  ? "bg-muted text-muted-foreground border-border"
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

        <div className="h-4 w-px bg-border/60 hidden sm:block" />

        {/* Ownership */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground font-body cursor-default">
              <User className="h-3 w-3" />
              {getProfileName(budget.commercial_owner_id)}
            </span>
          </TooltipTrigger>
          <TooltipContent>Comercial responsável</TooltipContent>
        </Tooltip>

        {budget.internal_notes && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="hidden sm:inline-flex items-center gap-1 text-xs text-warning font-body cursor-default">
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

        {/* Actions — em mobile usamos h-9 (≥36px) para tap target confortável; em ≥sm voltamos a h-7. */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {/* Primary action button */}
          {canDoPrimary && (
            <Button
              data-workflow-primary
              variant="default"
              size="sm"
              className={`h-9 sm:h-7 px-3 text-[11px] sm:text-xs gap-1 sm:gap-1.5 ${
                internalStatus === "revision_requested" ? "bg-warning hover:bg-warning/90 text-warning-foreground" :
                internalStatus === "minuta_solicitada" ? "bg-success hover:bg-success/90 text-success-foreground" :
                internalStatus === "delivered_to_sales" ? "bg-success hover:bg-success/90 text-success-foreground" :
                ""
              }`}
              onClick={handlePrimaryClick}
              aria-label={primaryTransition.label}
            >
              {internalStatus === "revision_requested" && <RotateCcw className="h-3.5 w-3.5" />}
              {internalStatus === "ready_for_review" && <PackageCheck className="h-3.5 w-3.5" />}
              {internalStatus === "delivered_to_sales" && <Send className="h-3.5 w-3.5" />}
              {internalStatus === "minuta_solicitada" && <Handshake className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{primaryTransition.label}</span>
              <span className="sm:hidden">Avançar</span>
            </Button>
          )}

          {/* Revision request button — comercial/admin only, sent_to_client only */}
          {internalStatus === "sent_to_client" && (isComercial || isAdmin) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRevisionModalOpen(true)}
              className="h-9 sm:h-7 px-3 text-[11px] sm:text-xs border-warning/40 text-warning hover:bg-warning/5 gap-1 sm:gap-2"
              aria-label="Solicitar revisão"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Solicitar Revisão</span>
              <span className="sm:hidden">Revisão</span>
            </Button>
          )}

          {/* Secondary overflow menu */}
          {showSecondary && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-7 sm:w-7" aria-label="Mais ações">
                  <MoreHorizontal className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
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
                {!isWaiting && (
                  <DropdownMenuItem onClick={() => setBlockingTarget("waiting_info")}>
                    ⏳ Marcar como Aguardando
                  </DropdownMenuItem>
                )}
                {isWaiting && (
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
                className="h-9 w-9 sm:h-7 sm:w-7"
                aria-label="Ver detalhes da demanda"
                onClick={() => window.open(`/admin/demanda/${budget.id}`, "_blank", "noopener,noreferrer")}
              >
                <FileText className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
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
              <DialogDescription>
                Solicitada por {revisionInstructions.requested_by_name}
              </DialogDescription>
            )}
          </DialogHeader>
          {loadingInstructions ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : revisionInstructions ? (
            <div className="space-y-4">
              {revisionInstructions.change_types.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Tipos de alteração:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {revisionInstructions.change_types.map((type) => (
                      <Badge key={type} variant="secondary" className="text-[10px]">{type}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {revisionInstructions.instructions && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Instruções:</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap bg-muted/50 rounded-lg p-3 border border-border/50">
                    {revisionInstructions.instructions}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4">Nenhuma instrução encontrada.</p>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar ação</AlertDialogTitle>
            <AlertDialogDescription>
              {primaryTransition?.confirmMessage || `Deseja avançar para "${INTERNAL_STATUSES[primaryTransition?.newStatus ?? "requested"]?.label}"?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmedTransition} disabled={confirmLoading}>
              {confirmLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
