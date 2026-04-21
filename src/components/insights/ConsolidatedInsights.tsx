import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2, Users, RefreshCw, Sparkles, CalendarRange, Database,
  Brain, ShieldAlert, MessageCircleQuestion, Eye, Target, UserX,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import InsightsDashboard from "./InsightsDashboard";
import QualitativeHighlights from "./QualitativeHighlights";
import ExecutiveSummary from "./ExecutiveSummary";

interface ConsolidatedData {
  totalMeetings: number;
  totalDurationMinutes: number;
  consultoresCount: number;
  latestMeeting: string | null;
  dashboard: any;
  cached: boolean;
  cacheAge?: number;
  noShowCount: number;
  scheduledCount: number;
  noShowRate: number;
}

export default function ConsolidatedInsights() {
  const [data, setData] = useState<ConsolidatedData | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadFromCache();
  }, []);

  const loadFromCache = async () => {
    try {
      const { data: caches, error } = await (supabase as any)
        .from("elephant_insights_cache")
        .select("*")
        .like("cache_key", "user_%");

      if (error || !caches?.length) {
        setData(null);
        setInitialLoad(false);
        return;
      }

      // Todos os consultores BWild já são filtrados no backend por domínio @bwild.com.br.
      const merged = mergeCacheEntries(caches);
      setData(merged);

      // Auto-refresh if qualitative data is missing (AI failed on previous run)
      const d = merged.dashboard;
      const hasQualitative = d && (
        (Array.isArray(d.personalityProfiles) && d.personalityProfiles.length > 0) ||
        (Array.isArray(d.objections) && d.objections.length > 0) ||
        (Array.isArray(d.topQuestions) && d.topQuestions.length > 0)
      );
      if (!hasQualitative && merged.totalMeetings > 0) {
        console.log("Qualitative data missing from cache, auto-refreshing...");
        // Don't await — let it run in background while showing metrics
        fetchFresh();
      }
    } catch {
      setData(null);
    } finally {
      setInitialLoad(false);
    }
  };

  const fetchFresh = async () => {
    setLoading(true);
    try {
      const { data: usersRes, error: usersErr } = await supabase.functions.invoke(
        "elephant-insights",
        { body: { action: "list-users" } }
      );
      if (usersErr || !usersRes?.success) throw new Error("Erro ao listar consultores");

      const consultores = usersRes.users || [];
      if (!consultores.length) throw new Error("Nenhum consultor BWild encontrado (verifique se há usuários @bwild.com.br no Elephan).");

      // Processa todos os consultores em paralelo
      const results = await Promise.allSettled(
        consultores.map((user: any) =>
          supabase.functions.invoke("elephant-insights", {
            body: { userId: user.id, refresh: "true" },
          })
        )
      );

      const failures = results.filter((r) => r.status === "rejected");
      if (failures.length === consultores.length) {
        throw new Error("Falha ao processar todos os consultores");
      }
      if (failures.length > 0) {
        console.warn(`${failures.length}/${consultores.length} consultores falharam`);
      }

      await loadFromCache();
      toast({ title: "Insights consolidados atualizados", description: `${consultores.length} consultores processados.` });
    } catch (err: any) {
      console.error("Consolidated fetch error:", err);
      toast({ title: "Erro ao atualizar", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <Badge variant="outline" className="mb-3 text-primary border-primary/30">
            <Sparkles className="h-3 w-3 mr-1" />
            Inteligência Comercial via IA
          </Badge>
          <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground">
            Visão Consolidada
          </h2>
          <p className="text-muted-foreground mt-1 max-w-xl">
            Insights extraídos de todas as reuniões com investidores: perfis, objeções, argumentos que convertem e sinais de compra.
          </p>
        </div>
        <div className="flex items-end gap-3 shrink-0">
          {data && (
            <Button onClick={fetchFresh} disabled={loading} variant="outline" size="lg" className="min-h-[48px]">
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Forçar atualização
            </Button>
          )}
          {!data && !loading && !initialLoad && (
            <Button onClick={fetchFresh} disabled={loading} size="lg" className="min-h-[48px]">
              <Users className="mr-2 h-4 w-4" />
              Gerar insights consolidados
            </Button>
          )}
        </div>
      </div>

      {!data && !loading && !initialLoad && (
        <Card className="border-dashed border-2 border-border/60">
          <CardContent className="py-16 text-center">
            <Users className="h-10 w-10 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-muted-foreground font-medium mb-1">Nenhum insight consolidado disponível</p>
            <p className="text-sm text-muted-foreground/70 max-w-md mx-auto">
              Clique em "Gerar insights consolidados" para processar todas as reuniões e gerar a visão geral.
            </p>
          </CardContent>
        </Card>
      )}

      {(loading || initialLoad) && !data && (
        <Card className="border-border/60">
          <CardContent className="py-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">
              {initialLoad ? "Carregando dados…" : "Processando reuniões de todos os consultores…"}
            </p>
            {!initialLoad && (
              <p className="text-sm text-muted-foreground/60 mt-1">Pode levar até 1 minuto.</p>
            )}
          </CardContent>
        </Card>
      )}

      {data && (
        <div className="space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Card className="border-border/60">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-primary tabular-nums">{data.totalMeetings}</p>
                <p className="text-xs text-muted-foreground mt-1">reuniões analisadas</p>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-foreground tabular-nums">
                  {data.totalDurationMinutes > 60
                    ? `${Math.round(data.totalDurationMinutes / 60)}h ${data.totalDurationMinutes % 60}m`
                    : `${data.totalDurationMinutes}m`}
                </p>
                <p className="text-xs text-muted-foreground mt-1">tempo total gravado</p>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-foreground tabular-nums">{data.consultoresCount}</p>
                <p className="text-xs text-muted-foreground mt-1">consultores</p>
              </CardContent>
            </Card>
            {data.scheduledCount > 0 && (
              <Card className="border-border/60">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-amber-600 tabular-nums flex items-center justify-center gap-1.5">
                    <UserX className="h-5 w-5" />
                    {data.noShowRate}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    no-show ({data.noShowCount}/{data.scheduledCount})
                  </p>
                </CardContent>
              </Card>
            )}
            {data.latestMeeting && (
              <Card className="border-border/60">
                <CardContent className="p-4 text-center">
                  <p className="text-sm font-semibold text-foreground flex items-center justify-center gap-1.5">
                    <CalendarRange className="h-4 w-4 text-muted-foreground" />
                    {new Date(data.latestMeeting).toLocaleDateString("pt-BR")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">última reunião</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* AI Executive Summary */}
          {data.dashboard && <ExecutiveSummary dashboardData={data.dashboard} />}

          {/* Qualitative Intelligence Highlights */}
          {data.dashboard && <QualitativeHighlights data={data.dashboard} />}

          {/* Full Detailed Dashboard */}
          {data.dashboard && <InsightsDashboard data={data.dashboard} scopeLabel="consolidado" />}
        </div>
      )}
    </div>
  );
}

/** Deduplicate items by a key, keeping the first occurrence */
function deduplicateByKey<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyFn(item).toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Merge multiple cache entries into a consolidated view */
function mergeCacheEntries(caches: any[]): ConsolidatedData {
  let totalMeetings = 0;
  let totalDuration = 0;
  let latestMeeting: string | null = null;
  let oldestUpdate: Date | null = null;
  let noShowCount = 0;
  let scheduledCount = 0;

  const allLeads: any[] = [];
  const sentimentTotals: Record<string, number[]> = {};
  const allReasonsByType: Record<string, { count: number; examples: any[] }> = {};
  const allCompetitors: Record<string, number> = {};
  const allAnswerScores: Record<string, { scores: number[]; count: number }> = {};

  // Qualitative data collectors
  const allProfiles: any[] = [];
  const allObjections: any[] = [];
  const allHiddenObjections: any[] = [];
  const allQuestions: any[] = [];
  const allBuyingSignals: any[] = [];
  const allClosingArguments: any[] = [];
  const allActionItems: any[] = [];
  const buyerPersonas: any[] = [];
  const sentimentSummaries: string[] = [];

  // Trend aggregation across all consultores
  const trendAgg: Record<30 | 60 | 90, { meetingsTotal: number; scoreSum: number; scoreCount: number; positiveSum: number; positiveCount: number; objections: Record<string, number> }> = {
    30: { meetingsTotal: 0, scoreSum: 0, scoreCount: 0, positiveSum: 0, positiveCount: 0, objections: {} },
    60: { meetingsTotal: 0, scoreSum: 0, scoreCount: 0, positiveSum: 0, positiveCount: 0, objections: {} },
    90: { meetingsTotal: 0, scoreSum: 0, scoreCount: 0, positiveSum: 0, positiveCount: 0, objections: {} },
  };
  const deltaAgg = { meetings: 0, scoreSum: 0, scoreCount: 0, positiveSum: 0, positiveCount: 0 };
  // Weekly aggregation: weekStart -> { label, meetings, scoreSum (weighted by meetings) }
  const weeklyAgg = new Map<string, { label: string; meetings: number; scoreSum: number }>();

  for (const cache of caches) {
    totalMeetings += cache.total_meetings;
    totalDuration += cache.total_duration_minutes;

    if (cache.latest_meeting && (!latestMeeting || cache.latest_meeting > latestMeeting)) {
      latestMeeting = cache.latest_meeting;
    }

    const updated = new Date(cache.updated_at);
    if (!oldestUpdate || updated < oldestUpdate) oldestUpdate = updated;

    const d = cache.charts_data;
    if (!d) continue;

    // No-show aggregation
    if (typeof d.metrics?.noShowCount === "number") noShowCount += d.metrics.noShowCount;
    if (typeof d.metrics?.scheduledCount === "number") scheduledCount += d.metrics.scheduledCount;

    // Trends aggregation
    if (d.trends?.windows && Array.isArray(d.trends.windows)) {
      for (const w of d.trends.windows) {
        const bucket = trendAgg[w.windowDays as 30 | 60 | 90];
        if (!bucket) continue;
        bucket.meetingsTotal += w.meetings || 0;
        if (w.meetings > 0) {
          // Weight averages by meeting count for fair aggregation
          bucket.scoreSum += (w.avgScore || 0) * w.meetings;
          bucket.scoreCount += w.meetings;
          bucket.positiveSum += (w.positiveSentimentPct || 0) * w.meetings;
          bucket.positiveCount += w.meetings;
        }
        for (const o of w.topObjections || []) {
          bucket.objections[o.objection] = (bucket.objections[o.objection] || 0) + (o.count || 1);
        }
      }
    }
    if (d.trends?.delta30vs60) {
      deltaAgg.meetings += d.trends.delta30vs60.meetings || 0;
      // Deltas: simple sum is misleading; track contribution weighted by recent meetings count
      const w30 = d.trends.windows?.find((w: any) => w.windowDays === 30);
      const recentWeight = (w30?.meetings || 0) || 1;
      deltaAgg.scoreSum += (d.trends.delta30vs60.avgScore || 0) * recentWeight;
      deltaAgg.scoreCount += recentWeight;
      deltaAgg.positiveSum += (d.trends.delta30vs60.positiveSentimentPct || 0) * recentWeight;
      deltaAgg.positiveCount += recentWeight;
    }

    // Weekly evolution aggregation (sum meetings, weighted score by meetings)
    if (Array.isArray(d.trends?.weekly)) {
      for (const wk of d.trends.weekly) {
        if (!wk?.weekStart) continue;
        const existing = weeklyAgg.get(wk.weekStart) || { label: wk.label || wk.weekStart, meetings: 0, scoreSum: 0 };
        existing.meetings += wk.meetings || 0;
        existing.scoreSum += (wk.avgScore || 0) * (wk.meetings || 0);
        weeklyAgg.set(wk.weekStart, existing);
      }
    }

    // Quantitative
    if (Array.isArray(d.leadScores)) allLeads.push(...d.leadScores);
    if (d.metrics?.avgSentiment) {
      for (const [key, val] of Object.entries(d.metrics.avgSentiment)) {
        if (!sentimentTotals[key]) sentimentTotals[key] = [];
        sentimentTotals[key].push(val as number);
      }
    }
    if (d.metrics?.reasonsByType) {
      for (const [type, data] of Object.entries(d.metrics.reasonsByType) as any) {
        if (!allReasonsByType[type]) allReasonsByType[type] = { count: 0, examples: [] };
        allReasonsByType[type].count += data.count || 0;
        if (data.examples) allReasonsByType[type].examples.push(...data.examples);
      }
    }
    if (Array.isArray(d.metrics?.competitors)) {
      for (const c of d.metrics.competitors) {
        allCompetitors[c.name] = (allCompetitors[c.name] || 0) + c.mentions;
      }
    }
    if (Array.isArray(d.metrics?.answerScores)) {
      for (const s of d.metrics.answerScores) {
        if (!allAnswerScores[s.question]) allAnswerScores[s.question] = { scores: [], count: 0 };
        allAnswerScores[s.question].scores.push(s.avg);
        allAnswerScores[s.question].count += s.count;
      }
    }

    // Qualitative - collect from ALL caches
    if (Array.isArray(d.personalityProfiles)) allProfiles.push(...d.personalityProfiles);
    if (Array.isArray(d.objections)) allObjections.push(...d.objections);
    if (Array.isArray(d.hiddenObjections)) allHiddenObjections.push(...d.hiddenObjections);
    if (Array.isArray(d.topQuestions)) allQuestions.push(...d.topQuestions);
    if (Array.isArray(d.buyingSignals)) allBuyingSignals.push(...d.buyingSignals);
    if (Array.isArray(d.closingArguments)) allClosingArguments.push(...d.closingArguments);
    if (Array.isArray(d.actionItems)) allActionItems.push(...d.actionItems);
    if (d.buyerPersona) buyerPersonas.push(d.buyerPersona);
    if (d.sentimentSummary) sentimentSummaries.push(d.sentimentSummary);
  }

  // Build merged trends payload
  const mergedWeekly = Array.from(weeklyAgg.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([weekStart, agg]) => ({
      weekStart,
      label: agg.label,
      meetings: agg.meetings,
      avgScore: agg.meetings > 0 ? Math.round(agg.scoreSum / agg.meetings) : 0,
    }));

  const mergedTrends = {
    windows: ([30, 60, 90] as const).map((days) => {
      const b = trendAgg[days];
      const topObjections = Object.entries(b.objections)
        .map(([objection, count]) => ({ objection, count }))
        .sort((a, b2) => b2.count - a.count)
        .slice(0, 3);
      return {
        windowDays: days,
        meetings: b.meetingsTotal,
        avgScore: b.scoreCount > 0 ? Math.round(b.scoreSum / b.scoreCount) : 0,
        positiveSentimentPct: b.positiveCount > 0 ? Math.round(b.positiveSum / b.positiveCount) : 0,
        topObjections,
      };
    }),
    delta30vs60: {
      meetings: deltaAgg.meetings,
      avgScore: deltaAgg.scoreCount > 0 ? Math.round(deltaAgg.scoreSum / deltaAgg.scoreCount) : 0,
      positiveSentimentPct: deltaAgg.positiveCount > 0 ? Math.round(deltaAgg.positiveSum / deltaAgg.positiveCount) : 0,
    },
    weekly: mergedWeekly,
  };

  // Build merged metrics
  const avgSentiment: Record<string, number> = {};
  for (const [key, vals] of Object.entries(sentimentTotals)) {
    avgSentiment[key] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }

  const competitors = Object.entries(allCompetitors)
    .map(([name, mentions]) => ({ name, mentions }))
    .sort((a, b) => b.mentions - a.mentions);

  const answerScores = Object.entries(allAnswerScores)
    .map(([question, { scores, count }]) => ({
      question,
      avg: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  for (const type of Object.values(allReasonsByType)) {
    type.examples = type.examples.slice(0, 5);
  }

  // Deduplicate qualitative data
  const personalityProfiles = deduplicateByKey(allProfiles, (p) => p.type || "");
  const objections = deduplicateByKey(allObjections, (o) => o.objection || "");
  const hiddenObjections = deduplicateByKey(allHiddenObjections, (h) => h.objection || "");
  const topQuestions = deduplicateByKey(allQuestions, (q) => q.question || "");
  const buyingSignals = deduplicateByKey(allBuyingSignals, (s) => s.signal || "");
  const closingArguments = deduplicateByKey(allClosingArguments, (a) => a.argument || "");
  const actionItems = deduplicateByKey(allActionItems, (a) => a.action || "");

  // Pick the richest buyer persona
  const buyerPersona = buyerPersonas.sort((a, b) =>
    (Array.isArray(b.motivations) ? b.motivations.length : 0) -
    (Array.isArray(a.motivations) ? a.motivations.length : 0)
  )[0] || null;

  const mergedDashboard = {
    personalityProfiles,
    objections,
    hiddenObjections,
    topQuestions,
    buyingSignals,
    closingArguments,
    actionItems,
    buyerPersona,
    sentimentSummary: sentimentSummaries[0] || null,
    metrics: { avgSentiment, reasonsByType: allReasonsByType, competitors, answerScores },
    leadScores: allLeads.sort((a, b) => b.score - a.score),
    trends: mergedTrends,
  };

  const cacheAge = oldestUpdate
    ? Math.round((Date.now() - oldestUpdate.getTime()) / 60000)
    : undefined;

  const noShowRate = scheduledCount > 0 ? Math.round((noShowCount / scheduledCount) * 100) : 0;

  return {
    totalMeetings,
    totalDurationMinutes: totalDuration,
    consultoresCount: caches.length,
    latestMeeting,
    dashboard: mergedDashboard,
    cached: true,
    cacheAge,
    noShowCount,
    scheduledCount,
    noShowRate,
  };
}
