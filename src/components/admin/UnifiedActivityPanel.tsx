import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Activity,
  MessageSquare,
  CheckCircle2,
  Clock,
  Video,
  ArrowRight,
  Search,
  Filter,
  MessageCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { INTERNAL_STATUSES, type InternalStatus } from "@/lib/role-constants";
import { cn } from "@/lib/utils";

type Kind = "event" | "comment" | "activity" | "meeting" | "message";

interface UnifiedItem {
  id: string;
  kind: Kind;
  created_at: string;
  user_id: string | null;
  title: string;
  detail?: string | null;
  meta?: {
    from_status?: string | null;
    to_status?: string | null;
    completed?: boolean;
    scheduled_for?: string | null;
    direction?: string | null;
  };
}

const KIND_LABEL: Record<Kind, string> = {
  event: "Status",
  comment: "Notas",
  activity: "Tarefas",
  meeting: "Reuniões",
  message: "Mensagens",
};

const KIND_ICON: Record<Kind, React.ReactNode> = {
  event: <Activity className="h-3 w-3" />,
  comment: <MessageSquare className="h-3 w-3" />,
  activity: <Clock className="h-3 w-3" />,
  meeting: <Video className="h-3 w-3" />,
  message: <MessageCircle className="h-3 w-3" />,
};

const KIND_COLOR: Record<Kind, string> = {
  event: "bg-primary/10 text-primary border-primary/30",
  comment: "bg-muted text-muted-foreground border-border",
  activity: "bg-warning/10 text-warning border-warning/30",
  meeting: "bg-violet-500/10 text-violet-600 border-violet-500/30",
  message: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
};

interface Props {
  budgetId: string;
  getProfileName: (id: string | null) => string;
}

/**
 * Timeline cronológica unificada que mistura TODA interação de um orçamento:
 * eventos de status, notas internas, atividades agendadas, reuniões IA e
 * mensagens de WhatsApp/canais. Inclui filtros por tipo e busca textual.
 */
export function UnifiedActivityPanel({ budgetId, getProfileName }: Props) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Set<Kind>>(
    new Set(["event", "comment", "activity", "meeting", "message"]),
  );

  const { data, isLoading } = useQuery({
    queryKey: ["unified_timeline", budgetId],
    enabled: !!budgetId,
    queryFn: async (): Promise<UnifiedItem[]> => {
      const [eventsRes, commentsRes, activitiesRes, meetingsRes, conversationsRes] =
        await Promise.all([
          supabase
            .from("budget_events")
            .select("id, event_type, from_status, to_status, note, user_id, created_at")
            .eq("budget_id", budgetId)
            .order("created_at", { ascending: false })
            .limit(200),
          supabase
            .from("budget_comments")
            .select("id, body, user_id, created_at")
            .eq("budget_id", budgetId)
            .order("created_at", { ascending: false })
            .limit(200),
          supabase
            .from("budget_activities")
            .select(
              "id, type, title, description, scheduled_for, completed_at, owner_id, created_at",
            )
            .eq("budget_id", budgetId)
            .order("created_at", { ascending: false })
            .limit(200),
          supabase
            .from("budget_meetings")
            .select("id, title, summary, started_at, duration_seconds, created_at")
            .eq("budget_id", budgetId)
            .order("created_at", { ascending: false })
            .limit(50),
          supabase
            .from("budget_conversations")
            .select("id")
            .eq("budget_id", budgetId),
        ]);

      const unified: UnifiedItem[] = [];

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
          title: "Nota interna",
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
          title: m.title || "Reunião gravada",
          detail: m.summary,
        });
      }

      // Mensagens via budget_conversation_messages
      const convIds = (conversationsRes.data ?? []).map((c) => c.id);
      if (convIds.length > 0) {
        const { data: msgs } = await supabase
          .from("budget_conversation_messages")
          .select("id, body, author_name, direction, created_at, conversation_id")
          .in("conversation_id", convIds)
          .order("created_at", { ascending: false })
          .limit(200);
        for (const msg of msgs ?? []) {
          unified.push({
            id: `msg-${msg.id}`,
            kind: "message",
            created_at: msg.created_at,
            user_id: null,
            title: msg.direction === "outbound" ? "Mensagem enviada" : "Mensagem recebida",
            detail: msg.body,
            meta: { direction: msg.direction },
          });
        }
      }

      return unified.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    },
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.filter((item) => {
      if (!filters.has(item.kind)) return false;
      if (!q) return true;
      const haystack = `${item.title} ${item.detail ?? ""} ${getProfileName(item.user_id)}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [data, filters, search, getProfileName]);

  // Agrupa por dia
  const groups = useMemo(() => {
    const out: { date: Date; items: UnifiedItem[] }[] = [];
    filtered.forEach((it) => {
      const d = new Date(it.created_at);
      const last = out[out.length - 1];
      if (last && isSameDay(last.date, d)) {
        last.items.push(it);
      } else {
        out.push({ date: d, items: [it] });
      }
    });
    return out;
  }, [filtered]);

  function toggleFilter(kind: Kind) {
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      // Sempre garante ao menos um ativo
      if (next.size === 0) return prev;
      return next;
    });
  }

  const counts = useMemo(() => {
    const c: Record<Kind, number> = {
      event: 0,
      comment: 0,
      activity: 0,
      meeting: 0,
      message: 0,
    };
    (data ?? []).forEach((item) => {
      c[item.kind]++;
    });
    return c;
  }, [data]);

  return (
    <div className="space-y-4">
      {/* Filtros + busca */}
      <div className="space-y-2.5 sticky top-0 bg-background/95 backdrop-blur z-10 -mx-1 px-1 pb-2 pt-1">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por palavra, pessoa, status..."
            className="h-9 pl-8 text-xs font-body"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter className="h-3 w-3 text-muted-foreground shrink-0" />
          {(Object.keys(KIND_LABEL) as Kind[]).map((kind) => {
            const active = filters.has(kind);
            return (
              <Button
                key={kind}
                size="sm"
                variant={active ? "default" : "outline"}
                className={cn(
                  "h-7 px-2 gap-1 text-[10px] font-body",
                  !active && "opacity-60",
                )}
                onClick={() => toggleFilter(kind)}
              >
                {KIND_ICON[kind]}
                {KIND_LABEL[kind]}
                <span className="font-mono tabular-nums opacity-80">
                  {counts[kind]}
                </span>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Timeline */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-12 text-xs text-muted-foreground font-body">
          {search ? "Nenhum resultado para a busca." : "Nenhuma interação registrada ainda."}
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((group, gi) => (
            <div key={gi}>
              <div className="flex items-center gap-2 mb-2.5">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[10px] font-body font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  {format(group.date, "EEE, dd 'de' MMM yyyy", { locale: ptBR })}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <ol className="space-y-2.5">
                {group.items.map((item, idx) => (
                  <TimelineRow
                    key={item.id}
                    item={item}
                    isLast={
                      idx === group.items.length - 1 && gi === groups.length - 1
                    }
                    getProfileName={getProfileName}
                  />
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getStatusInfo(key: string | null | undefined) {
  if (!key) return null;
  return INTERNAL_STATUSES[key as InternalStatus] ?? null;
}

function TimelineRow({
  item,
  isLast,
  getProfileName,
}: {
  item: UnifiedItem;
  isLast: boolean;
  getProfileName: (id: string | null) => string;
}) {
  const userName = getProfileName(item.user_id);
  const fromStatus = getStatusInfo(item.meta?.from_status);
  const toStatus = getStatusInfo(item.meta?.to_status);
  const completed = item.meta?.completed;

  const colorClass =
    item.kind === "activity" && completed
      ? "bg-success/10 text-success border-success/30"
      : KIND_COLOR[item.kind];

  return (
    <li className="flex gap-3 relative">
      <div className="flex flex-col items-center shrink-0">
        <div
          className={cn(
            "h-7 w-7 rounded-full border-2 flex items-center justify-center",
            colorClass,
          )}
        >
          {item.kind === "activity" && completed ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : (
            KIND_ICON[item.kind]
          )}
        </div>
        {!isLast && <div className="w-px flex-1 bg-border min-h-[16px] my-1" />}
      </div>
      <div className="flex-1 min-w-0 pb-1.5">
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <p className="text-xs font-body font-semibold text-foreground leading-snug">
            {item.title}
          </p>
          <time
            className="text-[10px] font-mono tabular-nums text-muted-foreground/70 shrink-0"
            title={format(new Date(item.created_at), "dd/MM/yyyy HH:mm:ss")}
          >
            {formatDistanceToNow(new Date(item.created_at), {
              locale: ptBR,
              addSuffix: true,
            })}
          </time>
        </div>

        {item.kind === "event" && (fromStatus || toStatus) && (
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            {fromStatus && (
              <Badge
                variant="outline"
                className="text-[9px] py-0 px-1.5 h-4 font-body"
              >
                {fromStatus.icon} {fromStatus.label}
              </Badge>
            )}
            <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/60" />
            {toStatus && (
              <Badge
                variant="outline"
                className={cn(
                  "text-[9px] py-0 px-1.5 h-4 font-body",
                  toStatus.color,
                )}
              >
                {toStatus.icon} {toStatus.label}
              </Badge>
            )}
          </div>
        )}

        {item.detail && (
          <p
            className={cn(
              "text-[11px] font-body mt-1 leading-relaxed",
              item.kind === "comment"
                ? "text-foreground bg-muted/40 rounded-md px-2 py-1 border border-border/50"
                : item.kind === "message"
                  ? "text-foreground bg-emerald-500/5 rounded-md px-2 py-1 border border-emerald-500/20 line-clamp-4"
                  : "text-muted-foreground italic line-clamp-3",
            )}
          >
            {item.detail}
          </p>
        )}

        {item.meta?.scheduled_for && !completed && (
          <p className="text-[10px] font-mono text-warning mt-1">
            Agendado:{" "}
            {format(new Date(item.meta.scheduled_for), "dd/MM HH:mm", {
              locale: ptBR,
            })}
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
