import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2, UserCircle, RefreshCw, BarChart3, CalendarRange,
  TrendingUp, TrendingDown, Minus, ArrowUpDown, Flame, ShieldAlert, Brain,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import MultiBrokerWeeklySparkline from "./MultiBrokerWeeklySparkline";
import {
  type ConsultorInsightData,
  type ElephantInsightsCacheRow,
  normalizeInsightsCache,
} from "@/types/insights";

interface ConsultorUser {
  id: string;
  name: string;
  email: string | null;
}

type ConsultorData = ConsultorInsightData;

function DeltaIndicator({ a, b, suffix = "", invert = false }: { a: number; b: number; suffix?: string; invert?: boolean }) {
  const diff = a - b;
  const better = invert ? diff < 0 : diff > 0;
  if (diff === 0) return <Minus className="h-3 w-3 text-muted-foreground" />;
  return (
    <span className={`flex items-center gap-0.5 text-[10px] font-bold ${better ? "text-emerald-600" : "text-red-500"}`}>
      {better ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {diff > 0 ? "+" : ""}{diff}{suffix}
    </span>
  );
}

function KpiCard({ label, valueA, valueB, suffix = "" }: { label: string; valueA: string; valueB: string; suffix?: string }) {
  return (
    <div className="rounded-lg border border-border/60 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        <p className="text-lg font-bold text-primary tabular-nums">{valueA}{suffix}</p>
        <p className="text-lg font-bold text-foreground tabular-nums">{valueB}{suffix}</p>
      </div>
    </div>
  );
}

interface ConsultorComparisonProps {
  consultores: ConsultorUser[];
  loadingUsers: boolean;
}

export default function ConsultorComparison({ consultores, loadingUsers }: ConsultorComparisonProps) {
  const [consultorA, setConsultorA] = useState("");
  const [consultorB, setConsultorB] = useState("");
  const [dataA, setDataA] = useState<ConsultorData | null>(null);
  const [dataB, setDataB] = useState<ConsultorData | null>(null);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);
  const { toast } = useToast();

  // Auto-select first two consultores
  useEffect(() => {
    if (consultores.length >= 2 && !consultorA && !consultorB) {
      setConsultorA(consultores[0].id);
      setConsultorB(consultores[1].id);
    }
  }, [consultores]);

  const loadData = async (userId: string, setter: (d: ConsultorData | null) => void, setLoading: (b: boolean) => void) => {
    if (!userId) return;
    setLoading(true);
    try {
      // Try cache first
      const cacheKey = `user_${userId}`;
      const { data: cached } = await (supabase as any)
        .from("elephant_insights_cache")
        .select("*")
        .eq("cache_key", cacheKey)
        .single<ElephantInsightsCacheRow>();

      if (cached) {
        setter(normalizeInsightsCache(cached));
      } else {
        // Fetch from API
        const { data: res, error } = await supabase.functions.invoke("elephant-insights", { body: { userId } });
        if (error) throw error;
        if (!res?.success) throw new Error("Erro");
        setter({
          consultantName: res.consultantName,
          totalMeetings: res.totalMeetings,
          totalDurationMinutes: res.totalDurationMinutes || 0,
          positiveSentimentPct: res.positiveSentimentPct,
          latestMeeting: res.latestMeeting,
          dashboard: res.chartsData,
        });
      }
    } catch {
      setter(null);
      toast({ title: "Erro ao carregar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Load data when selection changes
  useEffect(() => { loadData(consultorA, setDataA, setLoadingA); }, [consultorA]);
  useEffect(() => { loadData(consultorB, setDataB, setLoadingB); }, [consultorB]);

  const nameA = consultores.find(c => c.id === consultorA)?.name || "Consultor A";
  const nameB = consultores.find(c => c.id === consultorB)?.name || "Consultor B";

  const isLoading = loadingA || loadingB;

  // Extract comparable metrics from dashboard data
  const getLeadStats = (data: ConsultorData | null) => {
    if (!data?.dashboard?.leadScores) return { hot: 0, warm: 0, cold: 0, avgScore: 0 };
    const leads = data.dashboard.leadScores as any[];
    const hot = leads.filter((l: any) => l.score >= 75).length;
    const warm = leads.filter((l: any) => l.score >= 50 && l.score < 75).length;
    const cold = leads.filter((l: any) => l.score < 50).length;
    const avgScore = leads.length ? Math.round(leads.reduce((s: number, l: any) => s + l.score, 0) / leads.length) : 0;
    return { hot, warm, cold, avgScore };
  };

  const getObjectionCount = (data: ConsultorData | null) => {
    return Array.isArray(data?.dashboard?.objections) ? data!.dashboard.objections.length : 0;
  };

  const getProfileCount = (data: ConsultorData | null) => {
    return Array.isArray(data?.dashboard?.personalityProfiles) ? data!.dashboard.personalityProfiles.length : 0;
  };

  const getAvgAnswerScore = (data: ConsultorData | null) => {
    const scores = data?.dashboard?.metrics?.answerScores;
    if (!Array.isArray(scores) || !scores.length) return 0;
    return +(scores.reduce((s: number, item: any) => s + item.avg, 0) / scores.length).toFixed(1);
  };

  const leadsA = getLeadStats(dataA);
  const leadsB = getLeadStats(dataB);

  return (
    <div className="space-y-6">
      {/* Selector Row */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-end">
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-wider text-primary font-medium flex items-center gap-1">
            <UserCircle className="h-3 w-3" />
            Consultor A
          </label>
          <Select value={consultorA} onValueChange={setConsultorA} disabled={loadingUsers || isLoading}>
            <SelectTrigger className="h-10 border-primary/30">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {consultores.filter(c => c.id !== consultorB).map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-center">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-wider text-foreground font-medium flex items-center gap-1">
            <UserCircle className="h-3 w-3" />
            Consultor B
          </label>
          <Select value={consultorB} onValueChange={setConsultorB} disabled={loadingUsers || isLoading}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {consultores.filter(c => c.id !== consultorA).map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <Card className="border-border/60">
          <CardContent className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Carregando dados para comparação…</p>
          </CardContent>
        </Card>
      )}

      {/* Comparison View */}
      {dataA && dataB && !isLoading && (
        <>
          {/* Header with names */}
          <div className="grid grid-cols-2 gap-4">
            <Badge className="bg-primary/10 text-primary border-primary/15 hover:bg-primary/10 text-sm py-1.5 px-4 justify-center">
              <UserCircle className="h-3.5 w-3.5 mr-1.5" />
              {dataA.consultantName}
            </Badge>
            <Badge variant="outline" className="text-sm py-1.5 px-4 justify-center">
              <UserCircle className="h-3.5 w-3.5 mr-1.5" />
              {dataB.consultantName}
            </Badge>
          </div>

          {/* Weekly evolution overlay */}
          <MultiBrokerWeeklySparkline
            series={[
              { name: dataA.consultantName, weekly: dataA.dashboard?.trends?.weekly },
              { name: dataB.consultantName, weekly: dataB.dashboard?.trends?.weekly },
            ]}
          />

          {/* KPI Comparison Grid */}
          <Card className="border-border/60 overflow-hidden">
            <CardHeader className="pb-3 bg-muted/30">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4.5 w-4.5 text-primary" />
                Métricas Comparativas
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-4">
                {/* Table header */}
                <div className="grid grid-cols-[1fr_80px_80px_60px] gap-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-2">
                  <span>Métrica</span>
                  <span className="text-center text-primary">{nameA.split(" ")[0]}</span>
                  <span className="text-center">{nameB.split(" ")[0]}</span>
                  <span className="text-center">Δ</span>
                </div>

                {/* Rows */}
                {[
                  { label: "Reuniões", a: dataA.totalMeetings, b: dataB.totalMeetings },
                  { label: "Tempo total (min)", a: dataA.totalDurationMinutes, b: dataB.totalDurationMinutes },
                  { label: "Score médio leads", a: leadsA.avgScore, b: leadsB.avgScore },
                  { label: "Leads quentes", a: leadsA.hot, b: leadsB.hot },
                  { label: "Leads frios", a: leadsA.cold, b: leadsB.cold, invert: true },
                  { label: "Objeções mapeadas", a: getObjectionCount(dataA), b: getObjectionCount(dataB) },
                  { label: "Perfis identificados", a: getProfileCount(dataA), b: getProfileCount(dataB) },
                  { label: "Nota média performance", a: getAvgAnswerScore(dataA), b: getAvgAnswerScore(dataB) },
                ].map((row, i) => (
                  <div
                    key={i}
                    className={`grid grid-cols-[1fr_80px_80px_60px] gap-2 items-center px-2 py-2 rounded-md ${i % 2 === 0 ? "bg-muted/20" : ""}`}
                  >
                    <span className="text-xs text-muted-foreground">{row.label}</span>
                    <span className="text-sm font-bold text-primary tabular-nums text-center">{row.a}</span>
                    <span className="text-sm font-bold text-foreground tabular-nums text-center">{row.b}</span>
                    <div className="flex justify-center">
                      <DeltaIndicator a={row.a} b={row.b} invert={row.invert} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Sentiment Comparison */}
          {dataA.dashboard?.metrics?.avgSentiment && dataB.dashboard?.metrics?.avgSentiment && (
            <Card className="border-border/60 overflow-hidden">
              <CardHeader className="pb-3 bg-muted/30">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4.5 w-4.5 text-primary" />
                  Sentimento Comparado
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                {["positive", "neutral", "negative", "mixed"].map(key => {
                  const pctA = dataA.dashboard?.metrics?.avgSentiment?.[key] || 0;
                  const pctB = dataB.dashboard?.metrics?.avgSentiment?.[key] || 0;
                  const labels: Record<string, string> = { positive: "Positivo", neutral: "Neutro", negative: "Negativo", mixed: "Misto" };
                  const colors: Record<string, string> = { positive: "bg-emerald-500", neutral: "bg-muted-foreground/40", negative: "bg-red-400", mixed: "bg-amber-400" };
                  if (pctA === 0 && pctB === 0) return null;
                  return (
                    <div key={key} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-foreground">{labels[key]}</span>
                        <div className="flex items-center gap-3 text-xs tabular-nums">
                          <span className="text-primary font-bold">{pctA}%</span>
                          <span className="text-muted-foreground">vs</span>
                          <span className="font-bold text-foreground">{pctB}%</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full ${colors[key]} opacity-80`} style={{ width: `${Math.min(pctA, 100)}%` }} />
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full ${colors[key]}`} style={{ width: `${Math.min(pctB, 100)}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Lead Score Distribution */}
          <Card className="border-border/60 overflow-hidden">
            <CardHeader className="pb-3 bg-muted/30">
              <CardTitle className="text-base flex items-center gap-2">
                <Flame className="h-4.5 w-4.5 text-primary" />
                Distribuição de Leads
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-6">
                {[{ name: nameA, leads: leadsA, primary: true }, { name: nameB, leads: leadsB, primary: false }].map(({ name, leads, primary }) => (
                  <div key={name} className="space-y-2">
                    <p className={`text-xs font-semibold ${primary ? "text-primary" : "text-foreground"}`}>{name}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-200">
                        {leads.hot} quente{leads.hot !== 1 ? "s" : ""}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 border-amber-200">
                        {leads.warm} morno{leads.warm !== 1 ? "s" : ""}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] bg-blue-400/10 text-blue-700 border-blue-200">
                        {leads.cold} frio{leads.cold !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                    {/* Visual bar */}
                    <div className="flex h-3 rounded-full overflow-hidden bg-muted">
                      {leads.hot > 0 && <div className="bg-emerald-500 h-full" style={{ width: `${(leads.hot / (leads.hot + leads.warm + leads.cold)) * 100}%` }} />}
                      {leads.warm > 0 && <div className="bg-amber-400 h-full" style={{ width: `${(leads.warm / (leads.hot + leads.warm + leads.cold)) * 100}%` }} />}
                      {leads.cold > 0 && <div className="bg-blue-400 h-full" style={{ width: `${(leads.cold / (leads.hot + leads.warm + leads.cold)) * 100}%` }} />}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Performance por Critério side by side */}
          {dataA.dashboard?.metrics?.answerScores?.length > 0 && dataB.dashboard?.metrics?.answerScores?.length > 0 && (
            <Card className="border-border/60 overflow-hidden">
              <CardHeader className="pb-3 bg-muted/30">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4.5 w-4.5 text-primary" />
                  Performance por Critério
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                {(() => {
                  const scoresA = dataA.dashboard.metrics.answerScores as any[];
                  const scoresB = dataB.dashboard.metrics.answerScores as any[];
                  // Merge by question
                  const allQuestions = [...new Set([...scoresA.map((s: any) => s.question), ...scoresB.map((s: any) => s.question)])];
                  return allQuestions.map((q, i) => {
                    const sA = scoresA.find((s: any) => s.question === q);
                    const sB = scoresB.find((s: any) => s.question === q);
                    const avgA = sA?.avg ?? 0;
                    const avgB = sB?.avg ?? 0;
                    return (
                      <div key={i} className="space-y-1.5">
                        <p className="text-xs text-muted-foreground truncate">{q}</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className={`h-full rounded-full ${avgA >= 7 ? "bg-emerald-500" : avgA >= 5 ? "bg-amber-400" : "bg-red-400"} opacity-80`}
                                style={{ width: `${avgA * 10}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold tabular-nums text-primary w-8">{avgA}/10</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className={`h-full rounded-full ${avgB >= 7 ? "bg-emerald-500" : avgB >= 5 ? "bg-amber-400" : "bg-red-400"}`}
                                style={{ width: `${avgB * 10}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold tabular-nums text-foreground w-8">{avgB}/10</span>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </CardContent>
            </Card>
          )}

          {/* Distribuição de Objeções compartilhadas */}
          {(() => {
            const objA = (dataA.dashboard?.objections as any[]) || [];
            const objB = (dataB.dashboard?.objections as any[]) || [];
            if (objA.length === 0 && objB.length === 0) return null;

            // Build map: objection text -> {a, b} counts (using evidenceCount as proxy)
            const map = new Map<string, { a: number; b: number; key: string }>();
            const norm = (s: string) => s.toLowerCase().trim().substring(0, 60);

            for (const o of objA) {
              const text = o.objection || "";
              if (!text) continue;
              const key = norm(text);
              map.set(key, { ...(map.get(key) || { a: 0, b: 0, key: text }), key: text, a: o.evidenceCount || 1 });
            }
            for (const o of objB) {
              const text = o.objection || "";
              if (!text) continue;
              const key = norm(text);
              const existing = map.get(key) || { a: 0, b: 0, key: text };
              map.set(key, { ...existing, key: text, b: o.evidenceCount || 1 });
            }

            const rows = Array.from(map.values())
              .sort((x, y) => (y.a + y.b) - (x.a + x.b))
              .slice(0, 8);

            if (rows.length === 0) return null;

            return (
              <Card className="border-border/60 overflow-hidden">
                <CardHeader className="pb-3 bg-muted/30">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldAlert className="h-4.5 w-4.5 text-primary" />
                    Distribuição de Objeções
                    <Badge variant="outline" className="ml-auto text-xs font-normal">top {rows.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-2.5">
                  {rows.map((row, i) => {
                    const exclusiveA = row.a > 0 && row.b === 0;
                    const exclusiveB = row.b > 0 && row.a === 0;
                    return (
                      <div key={i} className="flex items-start gap-3 p-2.5 rounded-md border border-border/40">
                        <p className="text-xs text-foreground leading-snug flex-1 min-w-0 line-clamp-2">{row.key}</p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge
                            variant="outline"
                            className={`text-[10px] tabular-nums ${exclusiveA ? "bg-primary/15 text-primary border-primary/30" : row.a > 0 ? "bg-primary/8 text-primary border-primary/20" : "opacity-40"}`}
                            title={`${nameA}: ${row.a} evidência(s)`}
                          >
                            {nameA.split(" ")[0]} · {row.a}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`text-[10px] tabular-nums ${exclusiveB ? "bg-foreground/10 text-foreground border-foreground/30" : row.b > 0 ? "border-border" : "opacity-40"}`}
                            title={`${nameB}: ${row.b} evidência(s)`}
                          >
                            {nameB.split(" ")[0]} · {row.b}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-[10px] text-muted-foreground/70 pt-1 leading-relaxed">
                    Cor sólida indica objeção exclusiva daquele consultor. Contagens baseadas em evidências literais extraídas das reuniões.
                  </p>
                </CardContent>
              </Card>
            );
          })()}

          {/* Trends Comparativos lado a lado */}
          {(dataA.dashboard?.trends && dataB.dashboard?.trends) && (
            <Card className="border-border/60 overflow-hidden">
              <CardHeader className="pb-3 bg-muted/30">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4.5 w-4.5 text-primary" />
                  Tendência (últimos 30 dias)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {(() => {
                  const tA = dataA.dashboard.trends.windows?.find((w: any) => w.windowDays === 30);
                  const tB = dataB.dashboard.trends.windows?.find((w: any) => w.windowDays === 30);
                  if (!tA || !tB) return <p className="text-xs text-muted-foreground">Sem dados nos últimos 30 dias.</p>;
                  return (
                    <div className="space-y-3">
                      {[
                        { label: "Reuniões", a: tA.meetings, b: tB.meetings },
                        { label: "Score médio", a: tA.avgScore, b: tB.avgScore },
                        { label: "Sentimento positivo", a: tA.positiveSentimentPct, b: tB.positiveSentimentPct, suffix: "%" },
                      ].map((row, i) => (
                        <div key={i} className="grid grid-cols-[1fr_80px_80px_60px] gap-2 items-center px-2">
                          <span className="text-xs text-muted-foreground">{row.label}</span>
                          <span className="text-sm font-bold text-primary tabular-nums text-center">{row.a}{row.suffix || ""}</span>
                          <span className="text-sm font-bold text-foreground tabular-nums text-center">{row.b}{row.suffix || ""}</span>
                          <div className="flex justify-center">
                            <DeltaIndicator a={row.a} b={row.b} suffix={row.suffix} />
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* No data state */}
      {!isLoading && (!dataA || !dataB) && consultorA && consultorB && (
        <Card className="border-dashed border-2 border-border/60">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground text-sm">
              {!dataA && !dataB
                ? "Nenhum dos consultores possui dados. Gere insights individualmente primeiro."
                : !dataA
                  ? `${nameA} não possui dados. Gere insights na aba individual primeiro.`
                  : `${nameB} não possui dados. Gere insights na aba individual primeiro.`
              }
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
