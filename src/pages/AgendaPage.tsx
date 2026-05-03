import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Phone,
  Mail,
  Users,
  FileText,
  ArrowRight,
  Filter,
  AlertTriangle,
  Plus,
} from "lucide-react";
import { format, isPast, isToday, isTomorrow, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  useUpcomingActivities,
  useCompleteActivity,
  type BudgetActivity,
} from "@/hooks/useBudgetActivities";
import { NewActivityDialog } from "@/components/agenda/NewActivityDialog";

const TYPE_ICONS: Record<string, React.ElementType> = {
  call: Phone,
  email: Mail,
  meeting: Users,
  task: FileText,
  visit: Users,
  followup: Clock,
};

function getDayBucket(dateIso: string): string {
  const date = new Date(dateIso);
  if (isPast(date) && !isToday(date)) return "overdue";
  if (isToday(date)) return "today";
  if (isTomorrow(date)) return "tomorrow";
  return startOfDay(date).toISOString();
}

function formatBucketLabel(bucketKey: string): string {
  if (bucketKey === "overdue") return "Atrasadas";
  if (bucketKey === "today") return "Hoje";
  if (bucketKey === "tomorrow") return "Amanhã";
  return format(new Date(bucketKey), "EEEE, dd 'de' MMM", { locale: ptBR });
}

export default function AgendaPage() {
  const navigate = useNavigate();
  const [includeOverdue, setIncludeOverdue] = useState(true);
  const [newOpen, setNewOpen] = useState(false);
  const { data: activities = [], isLoading } = useUpcomingActivities({
    days: 14,
    includeOverdue,
  });
  const completeMut = useCompleteActivity();

  // Atalho "A" abre o dialog de nova atividade quando estamos na Agenda
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable)) return;
      if (e.key.toLowerCase() === "a" && !newOpen) {
        e.preventDefault();
        setNewOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [newOpen]);

  const grouped = useMemo(() => {
    const buckets = new Map<string, BudgetActivity[]>();
    for (const a of activities) {
      if (!a.scheduled_for) continue;
      const key = getDayBucket(a.scheduled_for);
      const arr = buckets.get(key) ?? [];
      arr.push(a);
      buckets.set(key, arr);
    }
    const order = (k: string) => {
      if (k === "overdue") return -2;
      if (k === "today") return -1;
      if (k === "tomorrow") return 0;
      return new Date(k).getTime();
    };
    return [...buckets.entries()].sort((a, b) => order(a[0]) - order(b[0]));
  }, [activities]);

  // Agrupamento por negócio dentro de uma lista de atividades
  function groupByBudget(items: BudgetActivity[]) {
    const map = new Map<string, BudgetActivity[]>();
    for (const a of items) {
      const arr = map.get(a.budget_id) ?? [];
      arr.push(a);
      map.set(a.budget_id, arr);
    }
    return [...map.entries()];
  }

  // "Zona de Foco" = Atrasadas + Hoje
  const focusItems = useMemo(
    () =>
      activities.filter((a) => {
        if (!a.scheduled_for) return false;
        const d = new Date(a.scheduled_for);
        return isToday(d) || (isPast(d) && !isToday(d));
      }),
    [activities],
  );

  const overdueCount = activities.filter(
    (a) => a.scheduled_for && isPast(new Date(a.scheduled_for)) && !isToday(new Date(a.scheduled_for)),
  ).length;
  const todayCount = activities.filter(
    (a) => a.scheduled_for && isToday(new Date(a.scheduled_for)),
  ).length;

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight text-foreground">
            Agenda
          </h1>
          <p className="text-sm text-muted-foreground font-body mt-0.5">
            Próximos compromissos e tarefas dos seus negócios
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-body text-muted-foreground cursor-pointer select-none">
            <Filter className="h-3.5 w-3.5" />
            Incluir atrasadas
            <Switch checked={includeOverdue} onCheckedChange={setIncludeOverdue} />
          </label>
          <Button size="sm" onClick={() => setNewOpen(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Nova atividade
            <kbd className="ml-1 hidden sm:inline-flex items-center rounded border border-border/40 bg-muted/50 px-1 font-mono text-[10px] font-medium text-muted-foreground">
              A
            </kbd>
          </Button>
        </div>
      </header>

      <NewActivityDialog open={newOpen} onOpenChange={setNewOpen} />

      {/* Summary chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {overdueCount > 0 && (
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 gap-1">
            <AlertTriangle className="h-3 w-3" />
            {overdueCount} atrasada{overdueCount !== 1 ? "s" : ""}
          </Badge>
        )}
        <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 gap-1">
          <Clock className="h-3 w-3" />
          {todayCount} hoje
        </Badge>
        <Badge variant="outline" className="gap-1">
          <Calendar className="h-3 w-3" />
          {activities.length} total nos próximos 14 dias
        </Badge>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <Card className="p-12 text-center">
          <CheckCircle2 className="h-10 w-10 mx-auto text-success/60 mb-3" />
          <h3 className="font-display font-semibold text-foreground">Tudo em dia</h3>
          <p className="text-sm text-muted-foreground font-body mt-1">
            Nenhum compromisso pendente nos próximos 14 dias.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Zona de Foco — Atrasadas + Hoje agrupadas por negócio */}
          {focusItems.length > 0 && (
            <Card className="border-l-4 border-l-destructive bg-gradient-to-br from-destructive/[0.03] to-warning/[0.03] p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <h2 className="font-display font-bold text-foreground text-sm">Zona de Foco</h2>
                  <p className="text-[11px] text-muted-foreground font-body">
                    {overdueCount > 0 && `${overdueCount} atrasada${overdueCount !== 1 ? "s" : ""}`}
                    {overdueCount > 0 && todayCount > 0 && " · "}
                    {todayCount > 0 && `${todayCount} para hoje`}
                  </p>
                </div>
                <Badge variant="outline" className="bg-background/60 font-mono text-xs">
                  {focusItems.length}
                </Badge>
              </div>
              <div className="space-y-3">
                {groupByBudget(focusItems).map(([budgetId, items]) => {
                  const ctx = items[0];
                  return (
                    <div key={budgetId} className="rounded-lg bg-background/60 ring-1 ring-border/40 p-2.5">
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/demanda/${budgetId}`)}
                        className="flex items-center gap-1.5 text-xs font-display font-semibold text-foreground hover:text-primary transition-colors mb-1.5 w-full text-left"
                      >
                        <FileText className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {ctx.budget_sequential_code ? `${ctx.budget_sequential_code} · ` : ""}
                          {ctx.budget_project_name || ctx.budget_client_name || "Negócio"}
                        </span>
                        <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4 ml-auto">
                          {items.length}
                        </Badge>
                      </button>
                      <div className="space-y-1">
                        {items.map((a) => {
                          const Icon = TYPE_ICONS[a.type] ?? FileText;
                          const time = a.scheduled_for ? format(new Date(a.scheduled_for), "HH:mm") : "—";
                          const isOverdue =
                            a.scheduled_for &&
                            isPast(new Date(a.scheduled_for)) &&
                            !isToday(new Date(a.scheduled_for));
                          return (
                            <div
                              key={a.id}
                              className={cn(
                                "flex items-center gap-2 px-2 py-1.5 rounded-md group/item hover:bg-muted/50 transition-colors",
                                isOverdue && "bg-destructive/[0.04]",
                              )}
                            >
                              <Icon
                                className={cn(
                                  "h-3 w-3 shrink-0",
                                  isOverdue ? "text-destructive" : "text-muted-foreground",
                                )}
                              />
                              <span className="font-body text-xs text-foreground truncate flex-1">
                                {a.title}
                              </span>
                              <span
                                className={cn(
                                  "text-[10px] font-mono tabular-nums shrink-0",
                                  isOverdue ? "text-destructive font-semibold" : "text-muted-foreground",
                                )}
                              >
                                {isOverdue ? format(new Date(a.scheduled_for!), "dd/MM") : time}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-label="Marcar como concluída"
                                className="h-9 w-9 sm:h-6 sm:w-auto sm:px-1.5 text-[10px] gap-1 opacity-100 sm:opacity-0 sm:group-hover/item:opacity-100 transition-opacity shrink-0"
                                onClick={() => completeMut.mutate({ id: a.id })}
                              >
                                <CheckCircle2 className="h-4 w-4 sm:h-3 sm:w-3" />
                                <span className="hidden sm:inline">OK</span>
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {grouped
            .filter(([k]) => k !== "overdue" && k !== "today")
            .map(([bucketKey, items]) => {
            const isOverdueBucket = bucketKey === "overdue";
            return (
              <section key={bucketKey}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <h2
                    className={cn(
                      "text-sm font-body font-semibold uppercase tracking-wide",
                      isOverdueBucket && "text-destructive",
                      bucketKey === "today" && "text-warning",
                      !isOverdueBucket && bucketKey !== "today" && "text-muted-foreground",
                    )}
                  >
                    {formatBucketLabel(bucketKey)}
                  </h2>
                  <span className="text-xs text-muted-foreground font-body">
                    · {items.length} atividade{items.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="space-y-2">
                  {items.map((a) => {
                    const Icon = TYPE_ICONS[a.type] ?? FileText;
                    const time = a.scheduled_for
                      ? format(new Date(a.scheduled_for), "HH:mm")
                      : "—";
                    const isOverdue =
                      a.scheduled_for &&
                      isPast(new Date(a.scheduled_for)) &&
                      !isToday(new Date(a.scheduled_for));

                    return (
                      <Card
                        key={a.id}
                        className={cn(
                          "p-3 hover:shadow-md transition-shadow group",
                          isOverdue && "border-l-4 border-l-destructive",
                          !isOverdue && bucketKey === "today" && "border-l-4 border-l-warning",
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              "h-9 w-9 shrink-0 rounded-lg flex items-center justify-center",
                              isOverdue
                                ? "bg-destructive/10 text-destructive"
                                : "bg-primary/10 text-primary",
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-display font-semibold text-sm text-foreground">
                                {a.title}
                              </span>
                              <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4">
                                {a.type}
                              </Badge>
                              <span className="text-xs font-mono tabular-nums text-muted-foreground">
                                {time}
                              </span>
                            </div>
                            {a.description && (
                              <p className="text-xs text-muted-foreground font-body mt-1 line-clamp-2">
                                {a.description}
                              </p>
                            )}
                            <button
                              type="button"
                              onClick={() => navigate(`/admin/demanda/${a.budget_id}`)}
                              className="mt-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary font-body transition-colors"
                            >
                              <FileText className="h-3 w-3" />
                              {a.budget_sequential_code ? `${a.budget_sequential_code} · ` : ""}
                              {a.budget_project_name || a.budget_client_name || "Negócio"}
                              <ArrowRight className="h-3 w-3" />
                            </button>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label="Marcar atividade como concluída"
                              className="h-9 w-9 sm:h-7 sm:w-auto sm:px-3 text-xs gap-1"
                              onClick={() => completeMut.mutate({ id: a.id })}
                            >
                              <CheckCircle2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                              <span className="hidden sm:inline">Concluir</span>
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
