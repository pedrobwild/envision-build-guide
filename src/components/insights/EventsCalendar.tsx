import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CalendarDays, TrendingUp, Loader2, RefreshCw, Users,
  Music, Trophy, Briefcase, Palette, Cpu, PartyPopper, Zap,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EventItem {
  name: string;
  category: string;
  dateRange: string;
  expectedAudience: string;
  dailyRateImpact: string;
  estimatedDailyRate: string;
  normalDailyRate: string;
  occupancyImpact: string;
  description: string;
  durationDays: number;
  recurring: boolean;
  confidence: string;
}

interface EventsData {
  events: EventItem[];
  baselineDaily: string;
  annualHighlights: string;
  topMonths: string[];
  estimatedAnnualBoost: string;
  citations?: string[];
}

const categoryConfig: Record<string, { icon: typeof Music; label: string; color: string }> = {
  música: { icon: Music, label: "Música", color: "bg-purple-500/10 text-purple-700 border-purple-200" },
  esporte: { icon: Trophy, label: "Esporte", color: "bg-emerald-500/10 text-emerald-700 border-emerald-200" },
  negócios: { icon: Briefcase, label: "Negócios", color: "bg-blue-500/10 text-blue-700 border-blue-200" },
  cultura: { icon: Palette, label: "Cultura", color: "bg-rose-500/10 text-rose-700 border-rose-200" },
  tech: { icon: Cpu, label: "Tech", color: "bg-cyan-500/10 text-cyan-700 border-cyan-200" },
  fórmula1: { icon: Zap, label: "Fórmula 1", color: "bg-red-500/10 text-red-700 border-red-200" },
  carnaval: { icon: PartyPopper, label: "Carnaval", color: "bg-amber-500/10 text-amber-700 border-amber-200" },
  outros: { icon: CalendarDays, label: "Outros", color: "bg-muted text-muted-foreground border-border" },
};

function getImpactColor(impact: string) {
  const num = parseInt(impact.replace(/[^0-9]/g, ""));
  if (num >= 80) return "text-red-600 bg-red-500/10";
  if (num >= 50) return "text-amber-600 bg-amber-500/10";
  if (num >= 30) return "text-emerald-600 bg-emerald-500/10";
  return "text-blue-600 bg-blue-500/10";
}

export default function EventsCalendar({ onDataLoaded }: { onDataLoaded?: (data: EventsData) => void }) {
  const [data, setData] = useState<EventsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();

  const fetchEvents = async (refresh = false) => {
    setLoading(true);
    try {
      const fnName = refresh ? "sp-events?refresh=true" : "sp-events";
      const { data: res, error } = await supabase.functions.invoke(fnName);
      if (error) throw error;
      if (!res?.success) throw new Error(res?.error || "Erro ao buscar eventos");
      setData(res.events);
      onDataLoaded?.(res.events);
      toast({
        title: res.cached ? "Eventos carregados do cache" : "Eventos atualizados",
        description: res.cached
          ? `Cache de ${res.cacheAgeHours}h atrás.`
          : "Pesquisa concluída com dados atualizados.",
      });
    } catch (err: any) {
      console.error("Events error:", err);
      toast({
        title: "Erro ao buscar eventos",
        description: err.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const visibleEvents = expanded ? data?.events : data?.events?.slice(0, 5);

  return (
    <section className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <Badge variant="outline" className="mb-3 text-primary border-primary/30">
            <CalendarDays className="h-3 w-3 mr-1" />
            Calendário de Eventos SP
          </Badge>
          <h2 className="font-display text-xl md:text-2xl font-bold text-foreground">
            Grandes Eventos × Impacto nas Diárias
          </h2>
          <p className="text-muted-foreground text-sm mt-1 max-w-xl">
            Eventos confirmados e previstos em São Paulo (2025–2027) e quanto cada um impacta o valor da diária na região do Urban Flex.
          </p>
        </div>
        <Button
          onClick={() => fetchEvents(!data)}
          disabled={loading}
          size="lg"
          className="min-h-[48px] shrink-0"
        >
          {loading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Pesquisando…</>
          ) : data ? (
            <><RefreshCw className="mr-2 h-4 w-4" />Atualizar</>
          ) : (
            <><CalendarDays className="mr-2 h-4 w-4" />Pesquisar eventos</>
          )}
        </Button>
      </div>

      {!data && !loading && (
        <Card className="border-dashed border-2 border-border/60">
          <CardContent className="py-16 text-center">
            <CalendarDays className="h-10 w-10 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-muted-foreground font-medium mb-1">Nenhum evento carregado</p>
            <p className="text-sm text-muted-foreground/70 max-w-md mx-auto">
              Clique em "Pesquisar eventos" para ver os grandes eventos de SP e o impacto nas diárias da região.
            </p>
          </CardContent>
        </Card>
      )}

      {loading && !data && (
        <Card className="border-border/60">
          <CardContent className="py-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">Pesquisando eventos em São Paulo…</p>
            <p className="text-sm text-muted-foreground/60 mt-1">Consultando fontes atualizadas. Pode levar até 20s.</p>
          </CardContent>
        </Card>
      )}

      {data && (
        <div className="space-y-5">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="border-border/60">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-primary tabular-nums">{data.events?.length || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">eventos mapeados</p>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="p-4 text-center">
                <p className="text-lg font-bold text-foreground">{data.baselineDaily}</p>
                <p className="text-xs text-muted-foreground mt-1">diária base (normal)</p>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-emerald-600 tabular-nums">{data.estimatedAnnualBoost}</p>
                <p className="text-xs text-muted-foreground mt-1">receita extra com eventos</p>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="p-4 text-center">
                <div className="flex flex-wrap items-center justify-center gap-1">
                  {data.topMonths?.map((m, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{m}</Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">meses mais lucrativos</p>
              </CardContent>
            </Card>
          </div>

          {/* Highlights */}
          {data.annualHighlights && (
            <Card className="border-border/60 bg-primary/[0.02]">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground leading-relaxed flex items-start gap-2">
                  <TrendingUp className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  {data.annualHighlights}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Events List */}
          <Card className="border-border/60 overflow-hidden">
            <CardHeader className="pb-3 bg-muted/30">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarDays className="h-4.5 w-4.5 text-primary" />
                Eventos por Impacto na Diária
                <Badge variant="outline" className="ml-auto text-xs font-normal">
                  {data.events?.length} eventos
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-2.5">
              {visibleEvents?.map((event, i) => {
                const cat = categoryConfig[event.category] || categoryConfig.outros;
                const CatIcon = cat.icon;

                return (
                  <div
                    key={i}
                    className="rounded-lg border border-border/60 p-4 space-y-3 transition-colors hover:bg-muted/20"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`shrink-0 rounded-md p-2 ${cat.color.split(" ")[0]}`}>
                          <CatIcon className={`h-4 w-4 ${cat.color.split(" ")[1]}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground leading-snug">{event.name}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <Badge variant="outline" className={`text-[10px] ${cat.color}`}>
                              {cat.label}
                            </Badge>
                            <span className="text-[11px] text-muted-foreground">{event.dateRange}</span>
                            {event.durationDays > 0 && (
                              <span className="text-[11px] text-muted-foreground">· {event.durationDays} dias</span>
                            )}
                            {event.recurring && (
                              <Badge variant="secondary" className="text-[10px]">Recorrente</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className={`shrink-0 rounded-md px-3 py-1.5 text-center ${getImpactColor(event.dailyRateImpact)}`}>
                        <p className="text-lg font-bold tabular-nums leading-none">{event.dailyRateImpact}</p>
                        <p className="text-[10px] mt-0.5 opacity-70">na diária</p>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">{event.description}</p>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="rounded-md bg-muted/40 p-2.5">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">Público</p>
                        <p className="text-xs font-semibold text-foreground mt-0.5 flex items-center gap-1">
                          <Users className="h-3 w-3 text-muted-foreground" />
                          {event.expectedAudience}
                        </p>
                      </div>
                      <div className="rounded-md bg-muted/40 p-2.5">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">Diária evento</p>
                        <p className="text-xs font-semibold text-emerald-700 mt-0.5">{event.estimatedDailyRate}</p>
                      </div>
                      <div className="rounded-md bg-muted/40 p-2.5">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">Diária normal</p>
                        <p className="text-xs font-semibold text-foreground mt-0.5">{event.normalDailyRate}</p>
                      </div>
                      <div className="rounded-md bg-muted/40 p-2.5">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">Ocupação</p>
                        <p className="text-xs font-semibold text-foreground mt-0.5">{event.occupancyImpact}</p>
                      </div>
                    </div>
                  </div>
                );
              })}

              {data.events?.length > 5 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpanded(!expanded)}
                  className="w-full text-muted-foreground"
                >
                  {expanded ? (
                    <><ChevronUp className="h-4 w-4 mr-1.5" />Mostrar menos</>
                  ) : (
                    <><ChevronDown className="h-4 w-4 mr-1.5" />Ver todos os {data.events.length} eventos</>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Citations */}
          {(data.citations?.length ?? 0) > 0 && (
            <p className="text-[10px] text-muted-foreground/50">
              Fontes: {data.citations!.slice(0, 5).map((c, i) => (
                <a key={i} href={c} target="_blank" rel="noopener noreferrer" className="underline hover:text-muted-foreground mr-2">
                  [{i + 1}]
                </a>
              ))}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
