import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow, isPast, differenceInHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CheckCircle2,
  Circle,
  Clock,
  Calendar,
  Phone,
  Mail,
  Users,
  FileText,
  Loader2,
  AlertTriangle,
  Trash2,
  RotateCcw,
  Send,
  CalendarClock,
  History,
  MessageSquare,
  User,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/hooks/useConfirm";

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  call: Phone,
  email: Mail,
  meeting: Users,
  followup: Clock,
  task: FileText,
  visit: Users,
};

const TYPE_LABEL: Record<string, string> = {
  task: "Tarefa",
  call: "Ligação",
  email: "E-mail",
  meeting: "Reunião",
  followup: "Follow-up",
  visit: "Visita",
};

interface ActivityDetail {
  id: string;
  budget_id: string;
  type: string;
  title: string;
  description: string | null;
  scheduled_for: string | null;
  completed_at: string | null;
  outcome: string | null;
  owner_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface TimelineEntry {
  id: string;
  kind: "created" | "updated" | "completed" | "reopened" | "rescheduled" | "comment";
  at: string;
  label: string;
  detail?: string | null;
  authorId?: string | null;
}

interface Comment {
  id: string;
  body: string;
  user_id: string;
  created_at: string;
}

interface Props {
  activityId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  getProfileName: (id: string | null) => string;
}

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ActivityDetailDrawer({ activityId, open, onOpenChange, getProfileName }: Props) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editType, setEditType] = useState("task");
  const [editScheduled, setEditScheduled] = useState("");
  const [outcomeText, setOutcomeText] = useState("");
  const [newComment, setNewComment] = useState("");

  // ---- Fetch activity ----
  const { data: activity, isLoading } = useQuery({
    queryKey: ["activity_detail", activityId],
    enabled: !!activityId && open,
    queryFn: async (): Promise<ActivityDetail | null> => {
      if (!activityId) return null;
      const { data, error } = await supabase
        .from("budget_activities")
        .select(
          "id, budget_id, type, title, description, scheduled_for, completed_at, outcome, owner_id, created_by, created_at, updated_at",
        )
        .eq("id", activityId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as ActivityDetail | null;
    },
    staleTime: 5_000,
  });

  // ---- Fetch budget comments (filter by activity reference in body — soft scope) ----
  const { data: comments = [], isLoading: loadingComments } = useQuery({
    queryKey: ["activity_comments", activityId],
    enabled: !!activity?.budget_id && open,
    queryFn: async (): Promise<Comment[]> => {
      if (!activity?.budget_id) return [];
      const { data, error } = await supabase
        .from("budget_comments")
        .select("id, body, user_id, created_at")
        .eq("budget_id", activity.budget_id)
        .ilike("body", `%[ação:${activityId}]%`)
        .order("created_at", { ascending: true })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as Comment[];
    },
    staleTime: 10_000,
  });

  // Sincroniza form quando carrega/troca atividade
  useEffect(() => {
    if (!activity) return;
    setEditTitle(activity.title);
    setEditDescription(activity.description ?? "");
    setEditType(activity.type);
    setEditScheduled(
      activity.scheduled_for ? toLocalInput(new Date(activity.scheduled_for)) : "",
    );
    setOutcomeText(activity.outcome ?? "");
  }, [activity?.id]);

  // ---- Build timeline ----
  const timeline = useMemo<TimelineEntry[]>(() => {
    if (!activity) return [];
    const entries: TimelineEntry[] = [];
    entries.push({
      id: `${activity.id}-created`,
      kind: "created",
      at: activity.created_at,
      label: "Ação criada",
      detail: activity.title,
      authorId: activity.created_by,
    });
    if (
      activity.updated_at &&
      activity.updated_at !== activity.created_at &&
      (!activity.completed_at || activity.updated_at !== activity.completed_at)
    ) {
      entries.push({
        id: `${activity.id}-updated`,
        kind: "updated",
        at: activity.updated_at,
        label: "Ação atualizada",
      });
    }
    if (activity.completed_at) {
      entries.push({
        id: `${activity.id}-completed`,
        kind: "completed",
        at: activity.completed_at,
        label: "Ação concluída",
        detail: activity.outcome,
      });
    }
    for (const c of comments) {
      entries.push({
        id: `comment-${c.id}`,
        kind: "comment",
        at: c.created_at,
        label: "Comentário",
        detail: c.body.replace(/\s*\[ação:[a-f0-9-]+\]\s*$/i, "").trim(),
        authorId: c.user_id,
      });
    }
    entries.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    return entries;
  }, [activity, comments]);

  // ---- Mutations ----
  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ["activity_detail", activityId] });
    qc.invalidateQueries({ queryKey: ["activity_comments", activityId] });
    if (activity?.budget_id) {
      qc.invalidateQueries({ queryKey: ["budget_tasks", activity.budget_id] });
      qc.invalidateQueries({ queryKey: ["unified_timeline", activity.budget_id] });
    }
    qc.invalidateQueries({ queryKey: ["budget_activities"] });
  }

  const saveDetails = useMutation({
    mutationFn: async () => {
      if (!activityId) return;
      const { error } = await supabase
        .from("budget_activities")
        .update({
          title: editTitle.trim() || activity?.title,
          description: editDescription.trim() || null,
          type: editType,
          scheduled_for: editScheduled ? new Date(editScheduled).toISOString() : null,
        })
        .eq("id", activityId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success("Ação atualizada");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });

  const completeMut = useMutation({
    mutationFn: async () => {
      if (!activityId) return;
      const { error } = await supabase
        .from("budget_activities")
        .update({
          completed_at: new Date().toISOString(),
          outcome: outcomeText.trim() || null,
        })
        .eq("id", activityId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success("Ação concluída");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const reopenMut = useMutation({
    mutationFn: async () => {
      if (!activityId) return;
      const { error } = await supabase
        .from("budget_activities")
        .update({ completed_at: null, outcome: null })
        .eq("id", activityId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success("Ação reaberta");
    },
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      if (!activityId) return;
      const { error } = await supabase
        .from("budget_activities")
        .delete()
        .eq("id", activityId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success("Ação removida");
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const addComment = useMutation({
    mutationFn: async () => {
      if (!activity?.budget_id || !newComment.trim()) return;
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Não autenticado");
      const body = `${newComment.trim()} [ação:${activity.id}]`;
      const { error } = await supabase
        .from("budget_comments")
        .insert({ budget_id: activity.budget_id, user_id: userId, body });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewComment("");
      invalidateAll();
      toast.success("Comentário adicionado");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao comentar"),
  });

  // Quick reschedule helpers
  function quickReschedule(offsetHours: number, hour?: number) {
    const d = new Date();
    d.setHours(d.getHours() + offsetHours);
    if (typeof hour === "number") d.setHours(hour, 0, 0, 0);
    setEditScheduled(toLocalInput(d));
  }

  const TypeIcon = activity ? TYPE_ICON[activity.type] ?? FileText : FileText;
  const completed = !!activity?.completed_at;
  const due = activity?.scheduled_for ? new Date(activity.scheduled_for) : null;
  const overdue = !completed && due && isPast(due);
  const dueSoon =
    !completed && due && !overdue && differenceInHours(due, new Date()) <= 24;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg p-0 flex flex-col gap-0"
      >
        {/* Header */}
        <SheetHeader className="px-5 py-4 border-b border-border/60 space-y-2">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                completed
                  ? "bg-success/10 text-success"
                  : overdue
                    ? "bg-destructive/10 text-destructive"
                    : dueSoon
                      ? "bg-warning/10 text-warning"
                      : "bg-primary/10 text-primary",
              )}
            >
              <TypeIcon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-sm font-display font-semibold leading-tight truncate text-left">
                {isLoading ? "Carregando..." : activity?.title ?? "Ação"}
              </SheetTitle>
              <SheetDescription className="text-[11px] text-muted-foreground font-body flex items-center gap-1.5 mt-0.5">
                <Badge variant="outline" className="h-4 px-1.5 text-[9.5px] font-medium">
                  {activity ? TYPE_LABEL[activity.type] ?? activity.type : "—"}
                </Badge>
                {completed && (
                  <span className="text-success font-medium">· Concluída</span>
                )}
                {overdue && (
                  <span className="text-destructive font-medium">· Atrasada</span>
                )}
                {dueSoon && (
                  <span className="text-warning font-medium">· Vence em 24h</span>
                )}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {isLoading || !activity ? (
          <div className="p-5 space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* Detalhes editáveis */}
            <section className="space-y-3">
              <h3 className="text-[10px] font-body font-semibold uppercase tracking-wider text-muted-foreground">
                Detalhes
              </h3>
              <div className="space-y-2">
                <div>
                  <label className="text-[10.5px] font-body text-muted-foreground mb-1 block">
                    Título
                  </label>
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10.5px] font-body text-muted-foreground mb-1 block">
                      Tipo
                    </label>
                    <Select value={editType} onValueChange={setEditType}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(TYPE_LABEL).map(([v, l]) => (
                          <SelectItem key={v} value={v} className="text-xs">
                            {l}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[10.5px] font-body text-muted-foreground mb-1 block">
                      Prazo
                    </label>
                    <Input
                      type="datetime-local"
                      value={editScheduled}
                      onChange={(e) => setEditScheduled(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
                {/* Quick reschedule */}
                <div className="flex flex-wrap gap-1">
                  {[
                    { label: "Hoje 18h", h: 0, t: 18 },
                    { label: "Amanhã 9h", h: 24, t: 9 },
                    { label: "+2 dias", h: 48, t: 9 },
                    { label: "+1 semana", h: 168, t: 9 },
                  ].map((q) => (
                    <button
                      key={q.label}
                      type="button"
                      onClick={() => quickReschedule(q.h, q.t)}
                      className="text-[10px] font-body px-2 h-6 rounded border border-border/60 bg-card text-muted-foreground hover:text-foreground hover:border-border transition-colors inline-flex items-center gap-1"
                    >
                      <CalendarClock className="h-2.5 w-2.5" />
                      {q.label}
                    </button>
                  ))}
                </div>
                <div>
                  <label className="text-[10.5px] font-body text-muted-foreground mb-1 block">
                    Descrição
                  </label>
                  <Textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={3}
                    className="text-xs resize-none"
                    placeholder="Contexto, próximos passos..."
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => saveDetails.mutate()}
                  disabled={saveDetails.isPending}
                  className="h-8 text-xs gap-1.5 w-full"
                >
                  {saveDetails.isPending && (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  )}
                  Salvar alterações
                </Button>
              </div>
            </section>

            {/* Status / Conclusão */}
            <section className="space-y-2">
              <h3 className="text-[10px] font-body font-semibold uppercase tracking-wider text-muted-foreground">
                Status
              </h3>
              {!completed ? (
                <div className="rounded-lg border border-border/60 bg-card p-3 space-y-2">
                  <label className="text-[10.5px] font-body text-muted-foreground block">
                    Resultado (opcional)
                  </label>
                  <Input
                    value={outcomeText}
                    onChange={(e) => setOutcomeText(e.target.value)}
                    placeholder="Ex.: Cliente confirmou visita para sexta às 14h"
                    className="h-8 text-xs"
                  />
                  <Button
                    size="sm"
                    onClick={() => completeMut.mutate()}
                    disabled={completeMut.isPending}
                    className="h-8 text-xs gap-1.5 w-full"
                  >
                    {completeMut.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    Marcar como concluída
                  </Button>
                </div>
              ) : (
                <div className="rounded-lg border border-success/30 bg-success/[0.04] p-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] text-success font-body font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Concluída{" "}
                    {formatDistanceToNow(new Date(activity.completed_at!), {
                      locale: ptBR,
                      addSuffix: true,
                    })}
                  </div>
                  {activity.outcome && (
                    <p className="text-[11px] text-muted-foreground font-body italic">
                      → {activity.outcome}
                    </p>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => reopenMut.mutate()}
                    disabled={reopenMut.isPending}
                    className="h-7 text-[11px] gap-1.5 w-full"
                  >
                    {reopenMut.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3 w-3" />
                    )}
                    Reabrir ação
                  </Button>
                </div>
              )}
            </section>

            {/* Timeline */}
            <section className="space-y-2">
              <h3 className="text-[10px] font-body font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <History className="h-3 w-3" />
                Histórico
              </h3>
              {timeline.length === 0 ? (
                <p className="text-[11px] text-muted-foreground font-body italic">
                  Sem eventos.
                </p>
              ) : (
                <ol className="relative border-l border-border/60 ml-1.5 space-y-3 pl-4">
                  {timeline.map((e) => {
                    const dotTone =
                      e.kind === "completed"
                        ? "bg-success"
                        : e.kind === "comment"
                          ? "bg-primary"
                          : e.kind === "reopened"
                            ? "bg-warning"
                            : "bg-muted-foreground/40";
                    return (
                      <li key={e.id} className="relative">
                        <span
                          className={cn(
                            "absolute -left-[21px] top-1.5 h-2 w-2 rounded-full ring-2 ring-background",
                            dotTone,
                          )}
                        />
                        <div className="text-[11px] font-body">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-foreground">
                              {e.label}
                            </span>
                            <span className="text-muted-foreground/70 text-[10px] tabular-nums">
                              · {format(new Date(e.at), "dd/MM HH:mm", { locale: ptBR })}
                            </span>
                            {e.authorId && (
                              <span className="text-muted-foreground/70 text-[10px] inline-flex items-center gap-0.5">
                                <User className="h-2.5 w-2.5" />
                                {getProfileName(e.authorId)}
                              </span>
                            )}
                          </div>
                          {e.detail && (
                            <p className="text-muted-foreground mt-0.5 leading-snug">
                              {e.detail}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>

            {/* Comentários */}
            <section className="space-y-2">
              <h3 className="text-[10px] font-body font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <MessageSquare className="h-3 w-3" />
                Comentários ({comments.length})
              </h3>
              <div className="space-y-2">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={2}
                  className="text-xs resize-none"
                  placeholder="Adicionar comentário sobre esta ação..."
                />
                <Button
                  size="sm"
                  onClick={() => addComment.mutate()}
                  disabled={!newComment.trim() || addComment.isPending}
                  className="h-7 text-[11px] gap-1.5"
                >
                  {addComment.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Send className="h-3 w-3" />
                  )}
                  Enviar
                </Button>
              </div>
            </section>
          </div>
        )}

        {/* Footer com ação destrutiva */}
        {activity && (
          <div className="px-5 py-3 border-t border-border/60 bg-muted/20">
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                const ok = await confirm({
                  title: "Remover ação",
                  description: "Remover esta ação permanentemente? Esta operação não pode ser desfeita.",
                  confirmText: "Remover",
                  destructive: true,
                });
                if (ok) deleteMut.mutate();
              }}
              disabled={deleteMut.isPending}
              className="h-7 text-[11px] gap-1.5 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
              Remover ação
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
