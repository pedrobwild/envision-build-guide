import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Loader2,
  Calendar,
  User,
  Building2,
  Clock,
  FileText,
  ExternalLink,
  Send,
  AlertTriangle,
  PauseCircle,
  Link as LinkIcon,
  Edit3,
  MapPin,
  Ruler,
  AlertOctagon,
} from "lucide-react";
import {
  INTERNAL_STATUSES,
  PRIORITIES,
  type InternalStatus,
  type Priority,
} from "@/lib/role-constants";
import { format, differenceInCalendarDays, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { BlockingDialog } from "@/components/editor/BlockingDialog";
import { VersionHistoryPanel } from "@/components/editor/VersionHistoryPanel";

interface BudgetDetail {
  id: string;
  project_name: string;
  client_name: string;
  property_type: string | null;
  city: string | null;
  bairro: string | null;
  metragem: string | null;
  condominio: string | null;
  unit: string | null;
  internal_status: string;
  priority: string;
  due_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  commercial_owner_id: string | null;
  estimator_owner_id: string | null;
  briefing: string | null;
  demand_context: string | null;
  internal_notes: string | null;
  reference_links: string[] | null;
  notes: string | null;
  status: string;
  public_id: string | null;
}

interface EventRow {
  id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  note: string | null;
  user_id: string | null;
  created_at: string;
}

interface CommentRow {
  id: string;
  body: string;
  user_id: string;
  created_at: string;
}

interface ProfileRow {
  id: string;
  full_name: string;
}

export default function BudgetInternalDetail() {
  const { budgetId } = useParams<{ budgetId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [budget, setBudget] = useState<BudgetDetail | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [blockingTarget, setBlockingTarget] = useState<"waiting_info" | "blocked" | null>(null);

  const getProfileName = useCallback(
    (id: string | null) => {
      if (!id) return "—";
      return profiles.find((p) => p.id === id)?.full_name || id.slice(0, 8);
    },
    [profiles]
  );

  useEffect(() => {
    if (!budgetId || !user) return;
    loadAll();
  }, [budgetId, user]);

  async function loadAll() {
    setLoading(true);
    const [budgetRes, eventsRes, commentsRes, profilesRes] = await Promise.all([
      supabase
        .from("budgets")
        .select(
          "id, project_name, client_name, property_type, city, bairro, metragem, condominio, unit, internal_status, priority, due_at, created_at, updated_at, created_by, commercial_owner_id, estimator_owner_id, briefing, demand_context, internal_notes, reference_links, notes, status, public_id"
        )
        .eq("id", budgetId!)
        .single(),
      supabase
        .from("budget_events")
        .select("id, event_type, from_status, to_status, note, user_id, created_at")
        .eq("budget_id", budgetId!)
        .order("created_at", { ascending: true }),
      supabase
        .from("budget_comments")
        .select("id, body, user_id, created_at")
        .eq("budget_id", budgetId!)
        .order("created_at", { ascending: true }),
      supabase.from("profiles").select("id, full_name"),
    ]);

    if (budgetRes.data) setBudget(budgetRes.data as any);
    if (eventsRes.data) setEvents(eventsRes.data as EventRow[]);
    if (commentsRes.data) setComments(commentsRes.data as CommentRow[]);
    if (profilesRes.data) setProfiles(profilesRes.data as ProfileRow[]);
    setLoading(false);
  }

  async function changeStatus(newStatus: InternalStatus, note?: string) {
    if (!budget || !user) return;
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
    await supabase.from("budget_events").insert({
      budget_id: budget.id,
      user_id: user.id,
      event_type: "status_change",
      from_status: oldStatus,
      to_status: newStatus,
      note: note || null,
    } as any);

    // If note provided, also save as comment
    if (note) {
      const commentBody = `[${INTERNAL_STATUSES[newStatus]?.label ?? newStatus}] ${note}`;
      await supabase.from("budget_comments").insert({
        budget_id: budget.id,
        user_id: user.id,
        body: commentBody,
      } as any);
      setComments((prev) => [
        ...prev,
        { id: crypto.randomUUID(), body: commentBody, user_id: user.id, created_at: new Date().toISOString() },
      ]);
    }

    setBudget((prev) => prev ? { ...prev, internal_status: newStatus } : prev);
    setEvents((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        event_type: "status_change",
        from_status: oldStatus,
        to_status: newStatus,
        note: note || null,
        user_id: user.id,
        created_at: new Date().toISOString(),
      },
    ]);

    toast.success(`Status → ${INTERNAL_STATUSES[newStatus]?.label ?? newStatus}`);
  }

  async function handleBlockingConfirm(status: InternalStatus, note: string) {
    await changeStatus(status, note);
    setBlockingTarget(null);
  }

  async function addComment() {
    if (!newComment.trim() || !budget || !user) return;
    setSubmitting(true);

    const { error } = await supabase.from("budget_comments").insert({
      budget_id: budget.id,
      user_id: user.id,
      body: newComment.trim(),
    } as any);

    if (error) {
      toast.error("Erro ao salvar comentário.");
      setSubmitting(false);
      return;
    }

    // Also log as event
    await supabase.from("budget_events").insert({
      budget_id: budget.id,
      user_id: user.id,
      event_type: "comment",
      note: newComment.trim().slice(0, 200),
    } as any);

    setComments((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        body: newComment.trim(),
        user_id: user.id,
        created_at: new Date().toISOString(),
      },
    ]);
    setEvents((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        event_type: "comment",
        from_status: null,
        to_status: null,
        note: newComment.trim().slice(0, 200),
        user_id: user.id,
        created_at: new Date().toISOString(),
      },
    ]);
    setNewComment("");
    setSubmitting(false);
    toast.success("Comentário adicionado.");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!budget) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground font-body">Demanda não encontrada.</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          Voltar
        </Button>
      </div>
    );
  }

  const status = INTERNAL_STATUSES[budget.internal_status as InternalStatus] ?? INTERNAL_STATUSES.requested;
  const prio = PRIORITIES[budget.priority as Priority] ?? PRIORITIES.normal;
  const dueDate = budget.due_at ? new Date(budget.due_at) : null;
  const daysLeft = dueDate ? differenceInCalendarDays(dueDate, new Date()) : null;
  const overdue = dueDate ? isPast(dueDate) && !isToday(dueDate) : false;
  const dueToday = dueDate ? isToday(dueDate) : false;
  const links = (budget.reference_links ?? []).filter((l: any) => typeof l === "string" && l.trim());

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3 mb-2">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold font-display text-foreground truncate">
                {budget.project_name}
              </h1>
              <p className="text-sm text-muted-foreground font-body">
                {budget.client_name}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 shrink-0"
              onClick={() => navigate(`/admin/budget/${budget.id}`)}
            >
              <Edit3 className="h-3.5 w-3.5" />
              Editar orçamento
            </Button>
          </div>

          {/* Status bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <Badge className={`${status.color} text-xs font-body`}>
              {status.icon} {status.label}
            </Badge>
            <Badge variant="outline" className={`${prio.color} text-xs font-body`}>
              {prio.label}
            </Badge>
            {dueDate && (
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
                  : `${format(dueDate, "dd MMM", { locale: ptBR })} (${daysLeft}d)`}
              </span>
            )}

            {/* Quick status change */}
            <Select
              value={budget.internal_status}
              onValueChange={(v) => {
                const s = v as InternalStatus;
                if (s === "waiting_info" || s === "blocked") {
                  setBlockingTarget(s);
                } else {
                  changeStatus(s);
                }
              }}
            >
              <SelectTrigger className="h-7 w-auto text-xs gap-1 border-dashed">
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
        </div>
      </header>

      {/* Pending action banner */}
      {(budget.internal_status === "waiting_info" || budget.internal_status === "blocked") && (
        <div className={`border-b px-4 sm:px-6 py-3 ${
          budget.internal_status === "blocked"
            ? "bg-destructive/5 border-destructive/20"
            : "bg-amber-50 border-amber-200"
        }`}>
          <div className="max-w-6xl mx-auto flex items-center gap-3">
            {budget.internal_status === "blocked" ? (
              <AlertOctagon className="h-4 w-4 text-destructive shrink-0" />
            ) : (
              <PauseCircle className="h-4 w-4 text-amber-600 shrink-0" />
            )}
            <p className={`text-sm font-body font-medium flex-1 ${
              budget.internal_status === "blocked" ? "text-destructive" : "text-amber-800"
            }`}>
              {budget.internal_status === "blocked"
                ? "Esta demanda está bloqueada. Verifique as notas internas para detalhes."
                : "Aguardando informação. Verifique as notas internas para detalhes."}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs shrink-0"
              onClick={() => changeStatus("in_progress")}
            >
              Retomar produção
            </Button>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Briefing */}
            {budget.briefing && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-display flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    Briefing
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm font-body text-foreground whitespace-pre-wrap leading-relaxed">
                    {budget.briefing}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Demand Context */}
            {budget.demand_context && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-display flex items-center gap-2">
                    💬 Contexto da Demanda
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm font-body text-foreground whitespace-pre-wrap leading-relaxed">
                    {budget.demand_context}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Internal Notes */}
            {budget.internal_notes && (
              <Card className="border-amber-200 bg-amber-50/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-display flex items-center gap-2 text-amber-800">
                    <AlertTriangle className="h-4 w-4" />
                    Observações Internas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm font-body text-amber-900 whitespace-pre-wrap leading-relaxed">
                    {budget.internal_notes}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Reference Links */}
            {links.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-display flex items-center gap-2">
                    <LinkIcon className="h-4 w-4 text-primary" />
                    Links de Referência
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {links.map((link: string, i: number) => (
                    <a
                      key={i}
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-primary hover:underline font-body truncate"
                    >
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                      {link}
                    </a>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* No briefing/context empty state */}
            {!budget.briefing && !budget.demand_context && !budget.internal_notes && (
              <Card className="border-dashed">
                <CardContent className="py-10 flex flex-col items-center text-center">
                  <FileText className="h-8 w-8 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground font-body">
                    Nenhum briefing ou instrução cadastrada para esta demanda.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Comments section */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-display flex items-center gap-2">
                  💬 Notas Internas ({comments.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {comments.length === 0 && (
                  <p className="text-sm text-muted-foreground font-body text-center py-4">
                    Nenhuma nota interna ainda. Adicione a primeira abaixo.
                  </p>
                )}
                {comments.map((c) => (
                  <div key={c.id} className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium font-body text-foreground">
                          {getProfileName(c.user_id)}
                        </span>
                        <span className="text-xs text-muted-foreground font-body">
                          {format(new Date(c.created_at), "dd/MM HH:mm")}
                        </span>
                      </div>
                      <p className="text-sm font-body text-foreground whitespace-pre-wrap">
                        {c.body}
                      </p>
                    </div>
                  </div>
                ))}

                <Separator />

                {/* New comment form */}
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Escreva uma nota interna..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={2}
                    className="flex-1 text-sm"
                    maxLength={2000}
                  />
                  <Button
                    size="icon"
                    disabled={!newComment.trim() || submitting}
                    onClick={addComment}
                    className="shrink-0 self-end"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Property info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-display flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  Imóvel
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm font-body">
                {budget.property_type && (
                  <InfoRow icon={<Building2 className="h-3.5 w-3.5" />} label="Tipo" value={budget.property_type} />
                )}
                {(budget.bairro || budget.city) && (
                  <InfoRow
                    icon={<MapPin className="h-3.5 w-3.5" />}
                    label="Local"
                    value={[budget.bairro, budget.city].filter(Boolean).join(", ")}
                  />
                )}
                {budget.condominio && (
                  <InfoRow icon={<Building2 className="h-3.5 w-3.5" />} label="Condomínio" value={budget.condominio} />
                )}
                {budget.unit && (
                  <InfoRow icon={<Building2 className="h-3.5 w-3.5" />} label="Unidade" value={budget.unit} />
                )}
                {budget.metragem && (
                  <InfoRow icon={<Ruler className="h-3.5 w-3.5" />} label="Metragem" value={budget.metragem} />
                )}
                {!budget.property_type && !budget.bairro && !budget.city && !budget.metragem && (
                  <p className="text-muted-foreground text-xs">Sem dados do imóvel.</p>
                )}
              </CardContent>
            </Card>

            {/* Ownership */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-display flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  Responsáveis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm font-body">
                <InfoRow icon={<User className="h-3.5 w-3.5" />} label="Comercial" value={getProfileName(budget.commercial_owner_id)} />
                <InfoRow icon={<User className="h-3.5 w-3.5" />} label="Orçamentista" value={getProfileName(budget.estimator_owner_id)} />
                <InfoRow icon={<User className="h-3.5 w-3.5" />} label="Criado por" value={getProfileName(budget.created_by)} />
              </CardContent>
            </Card>

            {/* Dates */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-display flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  Datas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm font-body">
                {budget.created_at && (
                  <InfoRow
                    icon={<Calendar className="h-3.5 w-3.5" />}
                    label="Criado"
                    value={format(new Date(budget.created_at), "dd/MM/yyyy HH:mm")}
                  />
                )}
                {budget.updated_at && (
                  <InfoRow
                    icon={<Calendar className="h-3.5 w-3.5" />}
                    label="Atualizado"
                    value={format(new Date(budget.updated_at), "dd/MM/yyyy HH:mm")}
                  />
                )}
                {budget.due_at && (
                  <InfoRow
                    icon={<Calendar className="h-3.5 w-3.5" />}
                    label="Prazo"
                    value={format(new Date(budget.due_at), "dd/MM/yyyy")}
                  />
                )}
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-display flex items-center gap-2">
                  📋 Histórico ({events.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {events.length === 0 && (
                  <p className="text-xs text-muted-foreground font-body text-center py-4">
                    Nenhum evento registrado.
                  </p>
                )}
                <div className="space-y-0">
                  {events.map((ev, i) => {
                    const isLast = i === events.length - 1;
                    const statusTo = ev.to_status
                      ? INTERNAL_STATUSES[ev.to_status as InternalStatus]
                      : null;

                    return (
                      <div key={ev.id} className="flex gap-3">
                        {/* Timeline line */}
                        <div className="flex flex-col items-center">
                          <div
                            className={`h-2.5 w-2.5 rounded-full mt-1.5 shrink-0 ${
                              ev.event_type === "comment"
                                ? "bg-primary/60"
                                : "bg-primary"
                            }`}
                          />
                          {!isLast && (
                            <div className="w-px flex-1 bg-border min-h-[24px]" />
                          )}
                        </div>
                        <div className="pb-4 min-w-0">
                          <p className="text-xs font-body text-foreground leading-snug">
                            {ev.event_type === "status_change" && statusTo ? (
                              <>
                                <span className="font-medium">{getProfileName(ev.user_id)}</span>
                                {" alterou status para "}
                                <span className="font-medium">{statusTo.label}</span>
                              </>
                            ) : ev.event_type === "comment" ? (
                              <>
                                <span className="font-medium">{getProfileName(ev.user_id)}</span>
                                {" comentou"}
                              </>
                            ) : (
                              <>
                                <span className="font-medium">{getProfileName(ev.user_id)}</span>
                                {" — "}{ev.event_type}
                              </>
                            )}
                          </p>
                          {ev.note && ev.event_type === "comment" && (
                            <p className="text-xs text-muted-foreground font-body mt-0.5 truncate">
                              "{ev.note}"
                            </p>
                          )}
                          <p className="text-[11px] text-muted-foreground font-body mt-0.5">
                            {format(new Date(ev.created_at), "dd/MM HH:mm")}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Quick links */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-display">Ações Rápidas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2"
                  onClick={() => navigate(`/admin/budget/${budget.id}`)}
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Editar orçamento
                </Button>
                {budget.public_id && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2"
                    onClick={() => window.open(`/o/${budget.public_id}`, "_blank")}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Ver proposta pública
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <BlockingDialog
        open={!!blockingTarget}
        targetStatus={blockingTarget}
        onConfirm={handleBlockingConfirm}
        onCancel={() => setBlockingTarget(null)}
      />
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
      <div>
        <span className="text-xs text-muted-foreground">{label}</span>
        <p className="text-sm text-foreground">{value}</p>
      </div>
    </div>
  );
}
