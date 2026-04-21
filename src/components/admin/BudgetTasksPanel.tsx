import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow, isPast, differenceInHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus,
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  Calendar,
  Phone,
  Mail,
  Users,
  FileText,
  Loader2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { NewBudgetActivityDialog } from "./NewBudgetActivityDialog";
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

interface Activity {
  id: string;
  type: string;
  title: string;
  description: string | null;
  scheduled_for: string | null;
  completed_at: string | null;
  outcome: string | null;
  owner_id: string | null;
  created_by: string | null;
  created_at: string;
}

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  call: Phone,
  email: Mail,
  meeting: Users,
  followup: Clock,
  task: FileText,
  visit: Users,
};

interface Props {
  budgetId: string;
  getProfileName: (id: string | null) => string;
}

/**
 * Painel de Ações & Tarefas: criar, agendar prazo, marcar concluído,
 * sinalizar atrasos e visualizar pendências separadas das concluídas.
 */
type TaskFilter = "all" | "pending" | "overdue" | "due_soon" | "completed";

export function BudgetTasksPanel({ budgetId, getProfileName }: Props) {
  const qc = useQueryClient();
  const [openNew, setOpenNew] = useState(false);
  const [filter, setFilter] = useState<TaskFilter>("pending");
  const [outcomeId, setOutcomeId] = useState<string | null>(null);
  const [outcomeText, setOutcomeText] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["budget_tasks", budgetId],
    enabled: !!budgetId,
    queryFn: async (): Promise<Activity[]> => {
      const { data, error } = await supabase
        .from("budget_activities")
        .select("id, type, title, description, scheduled_for, completed_at, outcome, owner_id, created_by, created_at")
        .eq("budget_id", budgetId)
        .order("scheduled_for", { ascending: true, nullsFirst: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Activity[];
    },
    staleTime: 15_000,
  });

  const complete = useMutation({
    mutationFn: async ({ id, outcome }: { id: string; outcome?: string }) => {
      const { error } = await supabase
        .from("budget_activities")
        .update({
          completed_at: new Date().toISOString(),
          outcome: outcome ?? null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budget_tasks", budgetId] });
      qc.invalidateQueries({ queryKey: ["unified_timeline", budgetId] });
      qc.invalidateQueries({ queryKey: ["budget_activities"] });
      toast.success("Ação concluída");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro"),
  });

  const reopen = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("budget_activities")
        .update({ completed_at: null, outcome: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budget_tasks", budgetId] });
      qc.invalidateQueries({ queryKey: ["unified_timeline", budgetId] });
      toast.success("Ação reaberta");
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("budget_activities")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budget_tasks", budgetId] });
      qc.invalidateQueries({ queryKey: ["unified_timeline", budgetId] });
      toast.success("Ação removida");
      setDeleteId(null);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro"),
  });

  const { pending, completed, overdueCount, dueSoonCount } = useMemo(() => {
    const all = data ?? [];
    const pending = all.filter((a) => !a.completed_at);
    const completed = all.filter((a) => !!a.completed_at)
      .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime());
    const now = new Date();
    let overdueCount = 0;
    let dueSoonCount = 0;
    for (const a of pending) {
      if (!a.scheduled_for) continue;
      const due = new Date(a.scheduled_for);
      if (due < now) overdueCount++;
      else if (differenceInHours(due, now) <= 24) dueSoonCount++;
    }
    return { pending, completed, overdueCount, dueSoonCount };
  }, [data]);

  function submitOutcome() {
    if (!outcomeId) return;
    complete.mutate({ id: outcomeId, outcome: outcomeText.trim() || undefined });
    setOutcomeId(null);
    setOutcomeText("");
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-display text-sm font-semibold tracking-tight">
            Ações & Tarefas
          </h3>
          {overdueCount > 0 && (
            <Badge variant="destructive" className="h-5 text-[10px] gap-1 px-1.5">
              <AlertTriangle className="h-2.5 w-2.5" />
              {overdueCount} atrasada{overdueCount > 1 ? "s" : ""}
            </Badge>
          )}
          {dueSoonCount > 0 && (
            <Badge className="h-5 text-[10px] gap-1 px-1.5 bg-warning/15 text-warning border-warning/30 hover:bg-warning/20">
              <Clock className="h-2.5 w-2.5" />
              {dueSoonCount} em 24h
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          onClick={() => setOpenNew(true)}
          className="h-8 gap-1.5 text-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          Nova ação
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : pending.length === 0 && completed.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-border rounded-lg">
          <Circle className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground font-body mb-3">
            Nenhuma ação criada ainda. Comece organizando o follow-up.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setOpenNew(true)}
            className="h-7 gap-1 text-[11px]"
          >
            <Plus className="h-3 w-3" />
            Criar primeira ação
          </Button>
        </div>
      ) : (
        <>
          {/* Pendentes */}
          {pending.length > 0 && (
            <ul className="space-y-2">
              {pending.map((a) => (
                <TaskRow
                  key={a.id}
                  activity={a}
                  ownerName={getProfileName(a.owner_id ?? a.created_by)}
                  onComplete={() => {
                    setOutcomeId(a.id);
                    setOutcomeText("");
                  }}
                  onDelete={() => setDeleteId(a.id)}
                />
              ))}
            </ul>
          )}

          {/* Concluídas (colapsável) */}
          {completed.length > 0 && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowCompleted((v) => !v)}
                className="text-[10px] font-body uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                <CheckCircle2 className="h-3 w-3" />
                {completed.length} concluída{completed.length > 1 ? "s" : ""}
                <span className="opacity-60">({showCompleted ? "ocultar" : "ver"})</span>
              </button>
              {showCompleted && (
                <ul className="space-y-1.5 opacity-75">
                  {completed.map((a) => (
                    <TaskRow
                      key={a.id}
                      activity={a}
                      ownerName={getProfileName(a.owner_id ?? a.created_by)}
                      onReopen={() => reopen.mutate(a.id)}
                      onDelete={() => setDeleteId(a.id)}
                    />
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      {/* Modal: nova ação */}
      <NewBudgetActivityDialog
        budgetId={budgetId}
        open={openNew}
        onOpenChange={setOpenNew}
      />

      {/* Modal: outcome ao concluir */}
      <AlertDialog open={!!outcomeId} onOpenChange={(v) => !v && setOutcomeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Concluir ação</AlertDialogTitle>
            <AlertDialogDescription>
              Registre o resultado obtido (opcional). Isso ficará na timeline.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={outcomeText}
            onChange={(e) => setOutcomeText(e.target.value)}
            placeholder="Ex.: Cliente confirmou visita para sexta às 14h"
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={submitOutcome} disabled={complete.isPending}>
              {complete.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Concluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal: deletar */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover ação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação será removida permanentemente do histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && remove.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TaskRow({
  activity,
  ownerName,
  onComplete,
  onReopen,
  onDelete,
}: {
  activity: Activity;
  ownerName: string;
  onComplete?: () => void;
  onReopen?: () => void;
  onDelete?: () => void;
}) {
  const Icon = TYPE_ICON[activity.type] ?? FileText;
  const completed = !!activity.completed_at;
  const due = activity.scheduled_for ? new Date(activity.scheduled_for) : null;
  const now = new Date();
  const isOverdue = !completed && due && due < now;
  const isDueSoon =
    !completed && due && !isOverdue && differenceInHours(due, now) <= 24;

  return (
    <li
      className={cn(
        "group rounded-lg border bg-card p-2.5 transition-colors",
        completed && "border-border/40",
        isOverdue && "border-destructive/40 bg-destructive/[0.03]",
        isDueSoon && "border-warning/40 bg-warning/[0.03]",
        !completed && !isOverdue && !isDueSoon && "border-border hover:border-border/80",
      )}
    >
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          onClick={completed ? onReopen : onComplete}
          className={cn(
            "shrink-0 mt-0.5 transition-transform hover:scale-110",
            completed ? "text-success" : "text-muted-foreground hover:text-primary",
          )}
          title={completed ? "Reabrir" : "Marcar como concluída"}
        >
          {completed ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <Circle className="h-4 w-4" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
              <p
                className={cn(
                  "text-xs font-body font-medium leading-snug truncate",
                  completed && "line-through text-muted-foreground",
                )}
              >
                {activity.title}
              </p>
            </div>
            <button
              type="button"
              onClick={onDelete}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
              title="Remover"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>

          {activity.description && (
            <p className="text-[10.5px] text-muted-foreground font-body mt-0.5 line-clamp-2 leading-relaxed">
              {activity.description}
            </p>
          )}

          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {due && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-[10px] font-mono tabular-nums",
                  isOverdue && "text-destructive font-semibold",
                  isDueSoon && "text-warning font-semibold",
                  !isOverdue && !isDueSoon && "text-muted-foreground",
                )}
                title={format(due, "dd/MM/yyyy HH:mm")}
              >
                {isOverdue ? (
                  <AlertTriangle className="h-2.5 w-2.5" />
                ) : (
                  <Calendar className="h-2.5 w-2.5" />
                )}
                {isOverdue ? "Atrasada · " : ""}
                {format(due, "dd/MM HH:mm", { locale: ptBR })}
                {!completed && (
                  <span className="opacity-60">
                    ({formatDistanceToNow(due, { locale: ptBR, addSuffix: true })})
                  </span>
                )}
              </span>
            )}
            {ownerName && ownerName !== "—" && (
              <span className="text-[10px] text-muted-foreground/70 font-body">
                · {ownerName}
              </span>
            )}
            {completed && activity.outcome && (
              <span className="text-[10px] text-success font-body italic">
                → {activity.outcome}
              </span>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
