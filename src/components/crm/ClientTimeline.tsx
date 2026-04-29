import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  ArrowRight,
  Phone,
  Calendar,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Sparkles,
  FileText,
  GitBranch,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { INTERNAL_STATUSES } from "@/lib/role-constants";
import { deriveCommercialStage, deriveProductionStage } from "@/lib/pipeline-stages";
import { cn } from "@/lib/utils";
import { useClientTimeline, type ClientTimelineEvent } from "@/hooks/useClientTimeline";

const COMMERCIAL_LABELS: Record<string, string> = {
  lead: "Lead",
  briefing: "Briefing",
  visita: "Visita",
  proposta: "Proposta",
  negociacao: "Negociação",
  fechado: "Fechado",
  perdido: "Perdido",
};

const PRODUCTION_LABELS: Record<string, string> = {
  aguardando: "Aguardando",
  em_producao: "Em produção",
  revisao: "Revisão",
  entregue: "Entregue",
  encerrado: "Encerrado",
};

function statusLabel(s: string | null | undefined) {
  if (!s) return "—";
  const cfg = INTERNAL_STATUSES[s as keyof typeof INTERNAL_STATUSES];
  return cfg?.label ?? s;
}

function iconFor(ev: ClientTimelineEvent) {
  switch (ev.source) {
    case "budget_created":
      return FileText;
    case "status_change":
      return ArrowRight;
    case "pipeline_event":
      return GitBranch;
    case "lost_reason":
      return XCircle;
    case "comment":
      return MessageSquare;
    case "activity":
      switch (ev.activity_type) {
        case "call":
          return Phone;
        case "meeting":
        case "visit":
          return Calendar;
        case "task":
          return CheckCircle2;
        default:
          return Sparkles;
      }
    default:
      return Sparkles;
  }
}

function accentFor(ev: ClientTimelineEvent): string {
  if (ev.source === "lost_reason") return "bg-destructive/10 text-destructive ring-destructive/20";
  if (ev.source === "budget_created") return "bg-primary/10 text-primary ring-primary/20";
  if (ev.source === "comment") return "bg-muted text-foreground/70 ring-border";
  if (ev.source === "pipeline_event") return "bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/20";
  if (ev.source === "status_change") {
    const stage = deriveCommercialStage(ev.to_status ?? "");
    if (stage === "fechado") return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20";
    if (stage === "perdido") return "bg-destructive/10 text-destructive ring-destructive/20";
    return "bg-primary/10 text-primary ring-primary/20";
  }
  if (ev.source === "activity") {
    if (ev.outcome === "won") return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20";
    if (ev.outcome === "lost") return "bg-destructive/10 text-destructive ring-destructive/20";
    return "bg-sky-500/10 text-sky-700 dark:text-sky-400 ring-sky-500/20";
  }
  return "bg-muted text-foreground/70 ring-border";
}

function pipelineBadge(internalStatus: string | null | undefined) {
  if (!internalStatus) return null;
  const c = deriveCommercialStage(internalStatus);
  const p = deriveProductionStage(internalStatus);
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Badge variant="outline" className="font-normal text-[10px] uppercase tracking-wide gap-1">
        💼 {COMMERCIAL_LABELS[c] ?? c}
      </Badge>
      <Badge variant="outline" className="font-normal text-[10px] uppercase tracking-wide gap-1">
        ⚙ {PRODUCTION_LABELS[p] ?? p}
      </Badge>
    </div>
  );
}

export function ClientTimeline({ clientId }: { clientId: string }) {
  const { data: events = [], isLoading, isError } = useClientTimeline(clientId);

  if (isLoading) {
    return (
      <Card className="p-8 flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="p-5">
        <p className="text-sm text-destructive">Não foi possível carregar a timeline.</p>
      </Card>
    );
  }

  if (events.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Sparkles className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">
          Sem atividades ainda. Eventos do pipeline comercial e de orçamentos aparecerão aqui.
        </p>
      </Card>
    );
  }

  // agrupa por dia
  const groups = new Map<string, ClientTimelineEvent[]>();
  for (const ev of events) {
    const day = format(new Date(ev.at), "yyyy-MM-dd");
    const arr = groups.get(day) ?? [];
    arr.push(ev);
    groups.set(day, arr);
  }
  const days = Array.from(groups.keys());

  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-3 border-b flex items-center justify-between">
        <div>
          <h3 className="text-xs font-display font-bold uppercase tracking-wider text-muted-foreground">
            Linha do tempo do cliente
          </h3>
          <p className="text-[11px] text-muted-foreground/70 mt-0.5">
            Comercial e produção em ordem cronológica · {events.length} eventos
          </p>
        </div>
      </div>
      <ScrollArea className="max-h-[600px]">
        <div className="p-5 space-y-6">
          {days.map((day, di) => {
            const dayEvents = groups.get(day)!;
            const dayDate = new Date(day);
            return (
              <div key={day}>
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-[11px] font-display font-bold uppercase tracking-wider text-muted-foreground">
                    {format(dayDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                  <Separator className="flex-1" />
                  <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                    {dayEvents.length} {dayEvents.length === 1 ? "evento" : "eventos"}
                  </span>
                </div>

                <ol className="relative space-y-4 ml-2">
                  <span
                    aria-hidden
                    className="absolute left-[15px] top-2 bottom-2 w-px bg-border"
                  />
                  {dayEvents.map((ev) => {
                    const Icon = iconFor(ev);
                    return (
                      <li key={ev.id} className="relative pl-10">
                        <span
                          className={cn(
                            "absolute left-0 top-0 h-8 w-8 rounded-full ring-2 flex items-center justify-center bg-background",
                            accentFor(ev),
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </span>

                        <div className="flex flex-col gap-1.5">
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className="text-sm font-medium">{ev.title}</span>
                            <span className="text-[11px] text-muted-foreground tabular-nums">
                              {format(new Date(ev.at), "HH:mm")}
                              {" · "}
                              {formatDistanceToNow(new Date(ev.at), {
                                locale: ptBR,
                                addSuffix: true,
                              })}
                            </span>
                          </div>

                          {ev.source === "status_change" && (
                            <div className="flex flex-wrap items-center gap-1.5 text-xs">
                              <Badge variant="outline" className="font-normal text-[10px]">
                                {statusLabel(ev.from_status)}
                              </Badge>
                              <ArrowRight className="h-3 w-3 text-muted-foreground" />
                              <Badge variant="outline" className="font-normal text-[10px]">
                                {statusLabel(ev.to_status)}
                              </Badge>
                              {pipelineBadge(ev.to_status)}
                            </div>
                          )}

                          {ev.description && (
                            <p className="text-xs text-muted-foreground font-body leading-relaxed whitespace-pre-wrap">
                              {ev.description}
                            </p>
                          )}

                          {ev.body && (
                            <p className="text-xs text-foreground/80 font-body leading-relaxed whitespace-pre-wrap rounded-md bg-muted/50 px-3 py-2 border border-border/50">
                              {ev.body}
                            </p>
                          )}

                          <div className="flex items-center gap-2 mt-1">
                            {ev.budget_code && (
                              <Button
                                asChild
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                              >
                                <Link to={`/admin/budget/${ev.budget_id}`}>
                                  <span className="font-mono tracking-wider">{ev.budget_code}</span>
                                  {ev.budget_project && (
                                    <span className="truncate max-w-[180px]">· {ev.budget_project}</span>
                                  )}
                                  <ExternalLink className="h-3 w-3" />
                                </Link>
                              </Button>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>

                {di < days.length - 1 && <div className="h-2" />}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </Card>
  );
}
