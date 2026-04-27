import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, ExternalLink, Phone, Copy, Activity, MessageSquare, ArrowRight, CheckCircle2, Clock } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { INTERNAL_STATUSES, type InternalStatus } from "@/lib/role-constants";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budgetId: string | null;
  /** Dados básicos pré-carregados do card. */
  budget?: {
    id: string;
    client_name: string;
    project_name: string;
    client_phone?: string | null;
    sequential_code?: string | null;
    public_id?: string | null;
  } | null;
  getProfileName: (id: string | null) => string;
}

interface UnifiedEvent {
  id: string;
  kind: "event" | "comment" | "activity" | "meeting";
  created_at: string;
  user_id: string | null;
  title: string;
  detail?: string | null;
  meta?: {
    from_status?: string | null;
    to_status?: string | null;
    completed?: boolean;
    scheduled_for?: string | null;
  };
}

function getStatusInfo(key: string | null | undefined) {
  if (!key) return null;
  return INTERNAL_STATUSES[key as InternalStatus] ?? null;
}

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.length === 0) return null;
  if (digits.length >= 12 && digits.startsWith("55")) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

function buildWhatsAppUrl(phone: string, message: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

/**
 * Drawer com timeline unificada do negócio (eventos + comentários + atividades + reuniões)
 * e ações rápidas de comunicação (WhatsApp, copiar link público).
 */
export function BudgetCommunicationDrawer({
  open,
  onOpenChange,
  budgetId,
  budget,
  getProfileName,
}: Props) {
  const enabled = open && !!budgetId;

  const { data, isLoading } = useQuery({
    queryKey: ["budget_communication_timeline", budgetId],
    enabled,
    queryFn: async (): Promise<UnifiedEvent[]> => {
      if (!budgetId) return [];

      const [eventsRes, commentsRes, activitiesRes, meetingsRes] = await Promise.all([
        supabase
          .from("budget_events")
          .select("id, event_type, from_status, to_status, note, user_id, created_at")
          .eq("budget_id", budgetId)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("budget_comments")
          .select("id, body, user_id, created_at")
          .eq("budget_id", budgetId)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("budget_activities")
          .select("id, type, title, description, scheduled_for, completed_at, owner_id, created_at")
          .eq("budget_id", budgetId)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("budget_meetings")
          .select("id, title, summary, started_at, duration_seconds, created_at")
          .eq("budget_id", budgetId)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      const unified: UnifiedEvent[] = [];

      for (const e of eventsRes.data ?? []) {
        unified.push({
          id: `e-${e.id}`,
          kind: "event",
          created_at: e.created_at,
          user_id: e.user_id,
          title: e.event_type === "status_change" ? "Mudança de etapa" : e.event_type,
          detail: e.note,
          meta: { from_status: e.from_status, to_status: e.to_status },
        });
      }
      for (const c of commentsRes.data ?? []) {
        unified.push({
          id: `c-${c.id}`,
          kind: "comment",
          created_at: c.created_at,
          user_id: c.user_id,
          title: "Comentário",
          detail: c.body,
        });
      }
      for (const a of activitiesRes.data ?? []) {
        unified.push({
          id: `a-${a.id}`,
          kind: "activity",
          created_at: a.created_at,
          user_id: a.owner_id,
          title: a.title,
          detail: a.description,
          meta: { completed: !!a.completed_at, scheduled_for: a.scheduled_for },
        });
      }
      for (const m of meetingsRes.data ?? []) {
        unified.push({
          id: `m-${m.id}`,
          kind: "meeting",
          created_at: m.created_at,
          user_id: null,
          title: m.title || "Reunião",
          detail: m.summary,
        });
      }

      return unified.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
  });

  const phone = useMemo(() => normalizePhone(budget?.client_phone), [budget?.client_phone]);

  const whatsappMessage = useMemo(() => {
    const greeting = budget?.client_name ? `Olá ${budget.client_name.split(" ")[0]}!` : "Olá!";
    const code = budget?.sequential_code ? ` (${budget.sequential_code})` : "";
    return `${greeting} Sou da BWild Engenharia, passando para acompanhar seu projeto${code}. Posso te ajudar?`;
  }, [budget?.client_name, budget?.sequential_code]);

  function handleCopyLink() {
    if (!budget?.public_id) {
      toast.error("Orçamento sem link público");
      return;
    }
    const url = `${window.location.origin}/orcamento/${budget.public_id}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-5 py-4 border-b border-border/60 shrink-0">
          <SheetTitle className="text-base font-display flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Comunicação
          </SheetTitle>
          {budget && (
            <SheetDescription className="text-xs font-body text-muted-foreground">
              {budget.sequential_code && (
                <span className="font-mono mr-1">{budget.sequential_code}</span>
              )}
              {budget.client_name} · {budget.project_name}
            </SheetDescription>
          )}
        </SheetHeader>

        {/* Quick actions */}
        <div className="px-5 py-3 border-b border-border/60 grid grid-cols-3 gap-2 shrink-0">
          {phone ? (
            <Button
              size="sm"
              variant="default"
              className="h-9 gap-1.5 bg-success hover:bg-success/90 text-success-foreground"
              onClick={() => window.open(buildWhatsAppUrl(phone, whatsappMessage), "_blank", "noopener,noreferrer")}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              WhatsApp
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="h-9 gap-1.5" disabled title="Sem telefone">
              <Phone className="h-3.5 w-3.5" />
              Sem fone
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={handleCopyLink}>
            <Copy className="h-3.5 w-3.5" />
            Link
          </Button>
          {budget?.public_id ? (
            <Button
              size="sm"
              variant="outline"
              className="h-9 gap-1.5"
              onClick={() => window.open(`/orcamento/${budget.public_id}`, "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Abrir
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="h-9 gap-1.5" disabled>
              <ExternalLink className="h-3.5 w-3.5" />
              Abrir
            </Button>
          )}
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !data || data.length === 0 ? (
            <div className="text-center py-12 text-xs text-muted-foreground font-body">
              Nenhuma interação registrada ainda.
            </div>
          ) : (
            <ol className="space-y-3 relative">
              {data.map((ev, idx) => (
                <TimelineItem
                  key={ev.id}
                  event={ev}
                  isLast={idx === data.length - 1}
                  getProfileName={getProfileName}
                />
              ))}
            </ol>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function TimelineItem({
  event,
  isLast,
  getProfileName,
}: {
  event: UnifiedEvent;
  isLast: boolean;
  getProfileName: (id: string | null) => string;
}) {
  const userName = getProfileName(event.user_id);
  const fromStatus = getStatusInfo(event.meta?.from_status);
  const toStatus = getStatusInfo(event.meta?.to_status);

  const iconMap: Record<UnifiedEvent["kind"], React.ReactNode> = {
    event: <Activity className="h-3 w-3" />,
    comment: <MessageSquare className="h-3 w-3" />,
    activity: event.meta?.completed ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />,
    meeting: <MessageCircle className="h-3 w-3" />,
  };
  const colorMap: Record<UnifiedEvent["kind"], string> = {
    event: "bg-primary/10 text-primary border-primary/30",
    comment: "bg-muted text-muted-foreground border-border",
    activity: event.meta?.completed
      ? "bg-success/10 text-success border-success/30"
      : "bg-warning/10 text-warning border-warning/30",
    meeting: "bg-violet-500/10 text-violet-600 border-violet-500/30",
  };

  return (
    <li className="flex gap-3 relative">
      <div className="flex flex-col items-center shrink-0">
        <div
          className={`h-6 w-6 rounded-full border-2 flex items-center justify-center ${colorMap[event.kind]}`}
        >
          {iconMap[event.kind]}
        </div>
        {!isLast && <div className="w-px flex-1 bg-border min-h-[16px] my-1" />}
      </div>
      <div className="flex-1 min-w-0 pb-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs font-body font-medium text-foreground leading-snug truncate">
            {event.title}
          </p>
          <time
            className="text-[10px] font-mono tabular-nums text-muted-foreground/70 shrink-0"
            title={format(new Date(event.created_at), "dd/MM/yyyy HH:mm")}
          >
            {formatDistanceToNow(new Date(event.created_at), { locale: ptBR, addSuffix: true })}
          </time>
        </div>
        {event.kind === "event" && (fromStatus || toStatus) && (
          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            {fromStatus && (
              <Badge variant="outline" className="text-[9px] py-0 px-1.5 h-4 font-body">
                {fromStatus.icon} {fromStatus.label}
              </Badge>
            )}
            <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/60" />
            {toStatus && (
              <Badge variant="outline" className={`text-[9px] py-0 px-1.5 h-4 font-body ${toStatus.color}`}>
                {toStatus.icon} {toStatus.label}
              </Badge>
            )}
          </div>
        )}
        {event.detail && (
          <p
            className={`text-[11px] font-body mt-1 leading-relaxed ${
              event.kind === "comment"
                ? "text-foreground bg-muted/40 rounded-md px-2 py-1 border border-border/50"
                : "text-muted-foreground italic line-clamp-3"
            }`}
          >
            {event.detail}
          </p>
        )}
        {event.meta?.scheduled_for && !event.meta.completed && (
          <p className="text-[10px] font-mono text-warning mt-1">
            Agendado: {format(new Date(event.meta.scheduled_for), "dd/MM HH:mm", { locale: ptBR })}
          </p>
        )}
        {userName && userName !== "—" && (
          <p className="text-[10px] font-body text-muted-foreground/70 mt-0.5">
            por {userName}
          </p>
        )}
      </div>
    </li>
  );
}
