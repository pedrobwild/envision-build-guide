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
  Sparkles,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { NewBudgetActivityDialog } from "./NewBudgetActivityDialog";
import type { ActivityInitialValues } from "./NewBudgetActivityDialog";
import {
  ACTIVITY_TEMPLATES,
  TEMPLATE_GROUP_ORDER,
} from "@/lib/activity-templates";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
  const [initialValues, setInitialValues] = useState<ActivityInitialValues | null>(null);
  const [filter, setFilter] = useState<TaskFilter>("pending");
  const [outcomeId, setOutcomeId] = useState<string | null>(null);
  const [outcomeText, setOutcomeText] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function openWithTemplate(values: ActivityInitialValues | null) {
    setInitialValues(values);
    setOpenNew(true);
  }

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

  const { pending, completed, overdue, dueSoon, counts, visible } = useMemo(() => {
    const all = data ?? [];
    const pending = all.filter((a) => !a.completed_at);
    const completed = all
      .filter((a) => !!a.completed_at)
      .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime());
    const now = new Date();
    const overdue: Activity[] = [];
    const dueSoon: Activity[] = [];
    for (const a of pending) {
      if (!a.scheduled_for) continue;
      const due = new Date(a.scheduled_for);
      if (due < now) overdue.push(a);
      else if (differenceInHours(due, now) <= 24) dueSoon.push(a);
    }
    const counts = {
      all: all.length,
      pending: pending.length,
      overdue: overdue.length,
      due_soon: dueSoon.length,
      completed: completed.length,
    };
    let visible: Activity[] = [];
    switch (filter) {
      case "all":
        visible = [...pending, ...completed];
        break;
      case "pending":
        visible = pending;
        break;
      case "overdue":
        visible = overdue;
        break;
      case "due_soon":
        visible = dueSoon;
        break;
      case "completed":
        visible = completed;
        break;
    }
    return { pending, completed, overdue, dueSoon, counts, visible };
  }, [data, filter]);

  function submitOutcome() {
    if (!outcomeId) return;
    complete.mutate({ id: outcomeId, outcome: outcomeText.trim() || undefined });
    setOutcomeId(null);
    setOutcomeText("");
  }

  const FILTERS: { key: TaskFilter; label: string; icon: React.ComponentType<{ className?: string }>; tone: string }[] = [
    { key: "pending", label: "Pendentes", icon: Circle, tone: "data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:border-primary/30" },
    { key: "overdue", label: "Atrasadas", icon: AlertTriangle, tone: "data-[active=true]:bg-destructive/10 data-[active=true]:text-destructive data-[active=true]:border-destructive/30" },
    { key: "due_soon", label: "Em 24h", icon: Clock, tone: "data-[active=true]:bg-warning/15 data-[active=true]:text-warning data-[active=true]:border-warning/30" },
    { key: "completed", label: "Concluídas", icon: CheckCircle2, tone: "data-[active=true]:bg-success/10 data-[active=true]:text-success data-[active=true]:border-success/30" },
    { key: "all", label: "Todas", icon: FileText, tone: "data-[active=true]:bg-muted data-[active=true]:text-foreground data-[active=true]:border-border" },
  ];

  return (
    <div className="space-y-3.5">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-display text-sm font-semibold tracking-tight">
          Ações & Tarefas
        </h3>
        <div className="flex items-center gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                <Sparkles className="h-3.5 w-3.5" />
                Templates
                <ChevronDown className="h-3 w-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Ações pré-configuradas
              </DropdownMenuLabel>
              {TEMPLATE_GROUP_ORDER.map((group, gi) => {
                const items = ACTIVITY_TEMPLATES.filter((t) => t.group === group);
                if (!items.length) return null;
                return (
                  <div key={group}>
                    {gi > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuLabel className="text-[10px] font-body font-medium text-muted-foreground/80 uppercase tracking-wide pt-2">
                      {group}
                    </DropdownMenuLabel>
                    {items.map((tpl) => {
                      const TIcon = tpl.icon;
                      return (
                        <DropdownMenuItem
                          key={tpl.id}
                          onSelect={() => openWithTemplate(tpl.values)}
                          className="gap-2.5 py-2 cursor-pointer items-start"
                        >
                          <TIcon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-body font-medium leading-tight">
                              {tpl.label}
                            </p>
                            <p className="text-[10.5px] text-muted-foreground font-body mt-0.5 leading-snug">
                              {tpl.description}
                            </p>
                          </div>
                        </DropdownMenuItem>
                      );
                    })}
                  </div>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            size="sm"
            onClick={() => openWithTemplate(null)}
            className="h-8 gap-1.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Nova ação
          </Button>
        </div>
      </div>

      {/* Filter chips */}
      {(counts.all > 0 || isLoading) && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTERS.map((f) => {
            const FIcon = f.icon;
            const active = filter === f.key;
            const count = counts[f.key];
            const disabled = !isLoading && count === 0 && f.key !== "pending";
            return (
              <button
                key={f.key}
                type="button"
                data-active={active}
                disabled={disabled}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-[11px] font-body font-medium transition-all",
                  "border-border bg-card text-muted-foreground hover:text-foreground hover:border-border/80",
                  "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-muted-foreground",
                  f.tone,
                )}
              >
                <FIcon className="h-3 w-3" />
                {f.label}
                <span
                  className={cn(
                    "tabular-nums font-mono text-[10px] px-1 rounded",
                    active ? "bg-background/40" : "bg-muted/60",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : counts.all === 0 ? (
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
      ) : visible.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-border/60 rounded-lg">
          <p className="text-[11px] text-muted-foreground font-body">
            Nenhuma ação neste filtro.
          </p>
        </div>
      ) : (
        <ul className={cn("space-y-2", filter === "completed" && "opacity-80")}>
          {visible.map((a) => {
            const isCompleted = !!a.completed_at;
            return (
              <TaskRow
                key={a.id}
                activity={a}
                ownerName={getProfileName(a.owner_id ?? a.created_by)}
                onComplete={
                  isCompleted
                    ? undefined
                    : () => {
                        setOutcomeId(a.id);
                        setOutcomeText("");
                      }
                }
                onReopen={isCompleted ? () => reopen.mutate(a.id) : undefined}
                onDelete={() => setDeleteId(a.id)}
              />
            );
          })}
        </ul>
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
