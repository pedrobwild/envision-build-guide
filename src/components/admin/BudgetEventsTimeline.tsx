import { useMemo } from "react";
import { format, formatDistanceStrict, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, MessageSquare, Activity, Clock } from "lucide-react";
import { INTERNAL_STATUSES, type InternalStatus } from "@/lib/role-constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface TimelineEvent {
  id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  note: string | null;
  user_id: string | null;
  created_at: string;
}

interface BudgetEventsTimelineProps {
  events: TimelineEvent[];
  getProfileName: (id: string | null) => string;
}

function getInitials(name: string): string {
  if (!name || name === "—") return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

function getStatusInfo(key: string | null) {
  if (!key) return null;
  return INTERNAL_STATUSES[key as InternalStatus] ?? null;
}

/**
 * Visual timeline of budget events grouped by day.
 * Shows status transitions (from → to), comments, and time elapsed between consecutive events.
 */
export function BudgetEventsTimeline({ events, getProfileName }: BudgetEventsTimelineProps) {
  // Sort newest first for display
  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [events]
  );

  // Group by day for the date headers
  const groups = useMemo(() => {
    const out: { date: Date; items: TimelineEvent[] }[] = [];
    sortedEvents.forEach((ev) => {
      const d = new Date(ev.created_at);
      const last = out[out.length - 1];
      if (last && isSameDay(last.date, d)) {
        last.items.push(ev);
      } else {
        out.push({ date: d, items: [ev] });
      }
    });
    return out;
  }, [sortedEvents]);

  if (sortedEvents.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Linha do tempo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground font-body text-center py-6">
            Nenhum evento registrado ainda.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-display flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Linha do tempo
          <span className="text-xs text-muted-foreground font-body font-normal ml-1">
            ({sortedEvents.length} {sortedEvents.length === 1 ? "evento" : "eventos"})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-6">
          {groups.map((group, gi) => (
            <div key={gi}>
              {/* Day header */}
              <div className="flex items-center gap-2 mb-3 sticky top-0 bg-card/95 backdrop-blur py-1 -mx-1 px-1 z-10">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[10px] font-body font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  {format(group.date, "EEE, dd 'de' MMM yyyy", { locale: ptBR })}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* Events */}
              <ol className="relative space-y-3">
                {group.items.map((ev, idx) => {
                  const isLastInGroup = idx === group.items.length - 1;
                  const isVeryLast = isLastInGroup && gi === groups.length - 1;

                  // Time elapsed between this event and the next older one (chronologically previous)
                  // Since list is newest-first, the "previous" event chronologically is the one AFTER in the array.
                  const olderEvent = group.items[idx + 1] ?? groups[gi + 1]?.items[0];
                  const elapsed = olderEvent
                    ? formatDistanceStrict(new Date(ev.created_at), new Date(olderEvent.created_at), {
                        locale: ptBR,
                      })
                    : null;

                  return (
                    <TimelineRow
                      key={ev.id}
                      event={ev}
                      isLast={isVeryLast}
                      elapsedFromPrev={elapsed}
                      getProfileName={getProfileName}
                    />
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TimelineRow({
  event,
  isLast,
  elapsedFromPrev,
  getProfileName,
}: {
  event: TimelineEvent;
  isLast: boolean;
  elapsedFromPrev: string | null;
  getProfileName: (id: string | null) => string;
}) {
  const isStatusChange = event.event_type === "status_change";
  const isComment = event.event_type === "comment";
  const fromStatus = getStatusInfo(event.from_status);
  const toStatus = getStatusInfo(event.to_status);
  const userName = getProfileName(event.user_id);
  const initials = getInitials(userName);

  return (
    <li className="relative flex gap-3 group">
      {/* Vertical line + dot */}
      <div className="flex flex-col items-center shrink-0">
        <div
          className={`relative h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-mono font-semibold border-2 ${
            isStatusChange
              ? "bg-primary/10 border-primary text-primary"
              : isComment
              ? "bg-muted border-muted-foreground/30 text-muted-foreground"
              : "bg-card border-border text-muted-foreground"
          }`}
          title={userName}
        >
          {isComment ? <MessageSquare className="h-3 w-3" /> : initials}
        </div>
        {!isLast && <div className="w-px flex-1 bg-border min-h-[20px] my-1" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-1">
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <p className="text-xs font-body text-foreground leading-snug">
            <span className="font-semibold">{userName}</span>{" "}
            {isStatusChange ? (
              <span className="text-muted-foreground">moveu de</span>
            ) : isComment ? (
              <span className="text-muted-foreground">comentou</span>
            ) : (
              <span className="text-muted-foreground">— {event.event_type}</span>
            )}
          </p>
          <time
            className="text-[10px] font-mono tabular-nums text-muted-foreground/70 shrink-0"
            dateTime={event.created_at}
            title={format(new Date(event.created_at), "dd/MM/yyyy HH:mm:ss")}
          >
            {format(new Date(event.created_at), "HH:mm")}
          </time>
        </div>

        {isStatusChange && (
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            {fromStatus ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-body bg-muted text-muted-foreground border border-border">
                {fromStatus.icon} {fromStatus.label}
              </span>
            ) : (
              <span className="text-[10px] font-body text-muted-foreground italic">início</span>
            )}
            <ArrowRight className="h-3 w-3 text-muted-foreground/60" />
            {toStatus ? (
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-body border ${toStatus.color}`}
              >
                {toStatus.icon} {toStatus.label}
              </span>
            ) : (
              <span className="text-[10px] font-body text-muted-foreground italic">—</span>
            )}
          </div>
        )}

        {event.note && (
          <p
            className={`text-xs font-body mt-1.5 leading-relaxed ${
              isComment
                ? "text-foreground bg-muted/50 rounded-md px-2 py-1.5 border border-border/50"
                : "text-muted-foreground italic"
            }`}
          >
            {isComment ? event.note : `"${event.note}"`}
          </p>
        )}

        {elapsedFromPrev && (
          <p className="mt-1 flex items-center gap-1 text-[10px] font-body text-muted-foreground/60">
            <Clock className="h-2.5 w-2.5" />
            {elapsedFromPrev} depois
          </p>
        )}
      </div>
    </li>
  );
}
