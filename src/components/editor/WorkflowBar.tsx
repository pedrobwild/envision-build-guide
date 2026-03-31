import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Calendar,
  User,
  AlertTriangle,
  Clock,
  CheckCircle2,
  PauseCircle,
  Send,
  FileText,
  AlertOctagon,
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

export function WorkflowBar({ budget, onBudgetUpdate }: WorkflowBarProps) {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);

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

  async function changeStatus(newStatus: InternalStatus) {
    const oldStatus = budget.internal_status;

    const { error } = await supabase
      .from("budgets")
      .update({ internal_status: newStatus, updated_at: new Date().toISOString() } as any)
      .eq("id", budget.id);

    if (error) {
      toast.error("Erro ao atualizar status.");
      return;
    }

    // Log event
    if (user) {
      await supabase.from("budget_events").insert({
        budget_id: budget.id,
        user_id: user.id,
        event_type: "status_change",
        from_status: oldStatus,
        to_status: newStatus,
      } as any);
    }

    onBudgetUpdate({ internal_status: newStatus });
    toast.success(`Status → ${INTERNAL_STATUSES[newStatus]?.label ?? newStatus}`);
  }

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
      <div className="flex items-center gap-3 flex-wrap">
        {/* Status badge + selector */}
        <div className="flex items-center gap-2">
          <Badge className={`${statusInfo.color} text-xs font-body`}>
            {statusInfo.icon} {statusInfo.label}
          </Badge>
          <Select
            value={internalStatus}
            onValueChange={(v) => changeStatus(v as InternalStatus)}
          >
            <SelectTrigger className="h-7 w-auto text-xs gap-1 border-dashed bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(INTERNAL_STATUSES).map(([key, { label, icon }]) => (
                <SelectItem key={key} value={key}>
                  {icon} {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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

        {/* Quick handoff actions */}
        <div className="flex items-center gap-1.5">
          {internalStatus !== "in_progress" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => changeStatus("in_progress")}
            >
              <Clock className="h-3 w-3" />
              Iniciar
            </Button>
          )}
          {internalStatus !== "waiting_info" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => changeStatus("waiting_info")}
            >
              <PauseCircle className="h-3 w-3" />
              Bloqueio
            </Button>
          )}
          {internalStatus !== "ready_for_review" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => changeStatus("ready_for_review")}
            >
              <CheckCircle2 className="h-3 w-3" />
              Revisão
            </Button>
          )}
          {internalStatus !== "delivered_to_sales" && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1 border-primary text-primary"
              onClick={() => changeStatus("delivered_to_sales")}
            >
              <Send className="h-3 w-3" />
              Entregar ao Comercial
            </Button>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() =>
                  window.open(`/admin/demanda/${budget.id}`, "_blank")
                }
              >
                <FileText className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Ver detalhes da demanda</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
