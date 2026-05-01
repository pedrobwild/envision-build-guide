import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  UserCheck, ShieldAlert, Target, Eye, Swords, Zap,
  ArrowRight, AlertTriangle, CheckCircle2, TrendingUp,
  HelpCircle, EyeOff, Brain, Ban, MessageCircleQuestion,
  BarChart3, ThumbsUp, ThumbsDown, Minus, Activity,
} from "lucide-react";
import ScriptBuilder from "./ScriptBuilder";
import LeadRanking from "./LeadRanking";
import EvidenceDialog from "./EvidenceDialog";
import TrendAnalysis from "./TrendAnalysis";
import PerformanceAlerts from "./PerformanceAlerts";

/** Render frequency badge: "alta · 7/23 (30%)" when count info is available */
function FrequencyBadge({ frequency, count, total, pct }: { frequency: string; count?: number; total?: number; pct?: number }) {
  const colorClass = freqColor[frequency] || "";
  if (count !== undefined && total !== undefined && total > 0) {
    return (
      <Badge variant="outline" className={`shrink-0 text-[10px] uppercase tracking-wider ${colorClass}`} title="Frequência calculada a partir de evidências literais">
        {frequency} · {count}/{total} ({pct ?? Math.round((count / total) * 100)}%)
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={`shrink-0 text-[10px] uppercase tracking-wider ${colorClass}`}>
      {frequency}
    </Badge>
  );
}

/** Safely convert any value to a renderable string */
function safeText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

const freqColor: Record<string, string> = {
  alta: "bg-red-500/10 text-red-700 border-red-200",
  média: "bg-amber-500/10 text-amber-700 border-amber-200",
  baixa: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
};

const priorityColor: Record<string, string> = {
  alta: "bg-red-500/10 text-red-700 border-red-200",
  média: "bg-amber-500/10 text-amber-700 border-amber-200",
  baixa: "bg-muted text-muted-foreground border-border",
};

const sentimentConfig: Record<string, { label: string; color: string; icon: typeof ThumbsUp }> = {
  positive: { label: "Positivo", color: "text-emerald-600", icon: ThumbsUp },
  neutral: { label: "Neutro", color: "text-muted-foreground", icon: Minus },
  negative: { label: "Negativo", color: "text-red-600", icon: ThumbsDown },
  mixed: { label: "Misto", color: "text-amber-600", icon: Activity },
};

interface AnswerScoreItem {
  question?: unknown;
  count?: number;
  avg: number;
}
interface CompetitorItem { name?: unknown; mentions?: number; }
interface ReasonExample { description?: unknown; [key: string]: unknown; }
interface ReasonsByTypeBucket { count: number; examples?: ReasonExample[]; }
interface MetricsBlock {
  avgSentiment?: Record<string, number>;
  reasonsByType?: Record<string, ReasonsByTypeBucket>;
  answerScores?: AnswerScoreItem[];
  competitors?: CompetitorItem[];
  noShowCount?: number;
  scheduledCount?: number;
  totalForFrequency?: number;
}
interface PersonalityProfileItem {
  type?: unknown;
  frequency?: unknown;
  description?: unknown;
  approachStrategy?: unknown;
  pitfalls?: unknown;
}
interface QuestionItem {
  question?: unknown;
  idealAnswer?: unknown;
  frequency?: unknown;
  evidenceCount?: number;
  frequencyPct?: number;
  evidence?: unknown[];
}
interface ObjectionItem {
  objection?: unknown;
  rebuttal?: unknown;
  frequency?: unknown;
  evidenceCount?: number;
  frequencyPct?: number;
  evidence?: unknown[];
}
interface HiddenObjectionItem {
  objection?: unknown;
  signals?: unknown;
  approach?: unknown;
  evidenceCount?: number;
  evidence?: unknown[];
}
interface ClosingArgumentItem { argument?: unknown; context?: unknown; }
interface BuyingSignalItem { signal?: unknown; action?: unknown; evidence?: unknown[]; }
interface ActionItem { priority?: unknown; [key: string]: unknown; }

interface InsightsDashboardViewData {
  metrics?: MetricsBlock;
  totalMeetings?: number;
  trends?: unknown;
  personalityProfiles?: PersonalityProfileItem[];
  topQuestions?: QuestionItem[];
  objections?: ObjectionItem[];
  hiddenObjections?: HiddenObjectionItem[];
  closingArguments?: ClosingArgumentItem[];
  buyingSignals?: BuyingSignalItem[];
  actionItems?: ActionItem[];
  [key: string]: unknown;
}

const reasonTypeLabels: Record<string, { label: string; color: string }> = {
  objection: { label: "Objeções", color: "bg-red-500" },
  positive_point: { label: "Pontos Positivos", color: "bg-emerald-500" },
  objection_handling: { label: "Contornos", color: "bg-blue-500" },
  potential_loss: { label: "Riscos de Perda", color: "bg-amber-500" },
  future_promise: { label: "Próximos Passos", color: "bg-violet-500" },
  score_conversion: { label: "Score de Conversão", color: "bg-primary" },
};

export default function InsightsDashboard({ data, scopeLabel }: { data: any; scopeLabel?: string }) {
  if (!data) return null;

  const metrics = data.metrics;
  // Total used as denominator for evidence-based frequency badges
  const totalForFrequency: number = metrics?.totalForFrequency ?? data.totalMeetings ?? 0;

  return (
    <div className="space-y-6">
      {/* ─── PERFORMANCE ALERTS (drops > 20%) ──────────────────────── */}
      <PerformanceAlerts trends={data.trends} />

      {/* ─── TEMPORAL TRENDS (30/60/90d) ───────────────────────────── */}
      <TrendAnalysis trends={data.trends} scopeLabel={scopeLabel} />

      {/* ─── REAL METRICS FROM API ─────────────────────────────────── */}

      {/* Sentiment Breakdown */}
      {metrics?.avgSentiment && Object.keys(metrics.avgSentiment).length > 0 && (
        <Card className="border-border/60 overflow-hidden">
          <CardHeader className="pb-3 bg-muted/30">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4.5 w-4.5 text-primary" />
              Sentimento Médio das Reuniões
              <Badge variant="outline" className="ml-auto text-xs font-normal">dados reais</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-2.5">
              {(Object.entries(metrics.avgSentiment) as Array<[string, number]>)
                .sort(([, a], [, b]) => b - a)
                .map(([key, pct]) => {
                  const config = sentimentConfig[key] || { label: key, color: "text-muted-foreground", icon: Minus };
                  const Icon = config.icon;
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 w-24 shrink-0">
                        <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                        <span className="text-xs font-medium text-foreground">{config.label}</span>
                      </div>
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${key === "positive" ? "bg-emerald-500" : key === "negative" ? "bg-red-400" : key === "mixed" ? "bg-amber-400" : "bg-muted-foreground/30"}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold tabular-nums text-foreground w-10 text-right">{pct}%</span>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reasons by Type */}
      {metrics?.reasonsByType && Object.keys(metrics.reasonsByType).length > 0 && (
        <Card className="border-border/60 overflow-hidden">
          <CardHeader className="pb-3 bg-muted/30">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4.5 w-4.5 text-primary" />
              Análise de Interações
              <Badge variant="outline" className="ml-auto text-xs font-normal">dados reais</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              {(Object.entries(metrics.reasonsByType) as Array<[string, ReasonsByTypeBucket]>)
                .sort(([, a], [, b]) => b.count - a.count)
                .map(([type, data]) => {
                  const config = reasonTypeLabels[type] || { label: type, color: "bg-muted-foreground" };
                  return (
                    <div key={type} className="rounded-lg border border-border/60 p-3 text-center">
                      <div className={`inline-block h-2 w-2 rounded-full ${config.color} mb-1.5`} />
                      <p className="text-xl font-bold tabular-nums text-foreground">{data.count}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{config.label}</p>
                    </div>
                  );
                })}
            </div>
            {/* Show top examples from objections */}
            {metrics.reasonsByType.objection?.examples?.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border/40">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">Top objeções reais</p>
                {metrics.reasonsByType.objection.examples!.map((ex, i: number) => (
                  <div key={i} className="flex items-start gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground leading-relaxed">{safeText(ex.description)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Answer Score Averages */}
      {metrics?.answerScores?.length > 0 && (
        <Card className="border-border/60 overflow-hidden">
          <CardHeader className="pb-3 bg-muted/30">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4.5 w-4.5 text-primary" />
              Performance por Critério
              <Badge variant="outline" className="ml-auto text-xs font-normal">média das reuniões</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {metrics.answerScores.map((item, i: number) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground leading-snug flex-1 min-w-0 truncate">{safeText(item.question)}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-muted-foreground/60">{item.count}x</span>
                    <span className={`text-sm font-bold tabular-nums ${item.avg >= 7 ? "text-emerald-600" : item.avg >= 5 ? "text-amber-600" : "text-red-600"}`}>
                      {item.avg}/10
                    </span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${item.avg >= 7 ? "bg-emerald-500" : item.avg >= 5 ? "bg-amber-400" : "bg-red-400"}`}
                    style={{ width: `${item.avg * 10}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Competitors from real data */}
      {metrics?.competitors?.length > 0 && (
        <Card className="border-border/60 overflow-hidden">
          <CardHeader className="pb-3 bg-muted/30">
            <CardTitle className="text-base flex items-center gap-2">
              <Swords className="h-4.5 w-4.5 text-primary" />
              Concorrentes Mencionados
              <Badge variant="outline" className="ml-auto text-xs font-normal">dados reais</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-2">
              {metrics.competitors.map((c, i: number) => (
                <Badge key={i} variant="secondary" className="text-xs gap-1.5 py-1.5 px-3">
                  {safeText(c.name)}
                  <span className="text-[10px] font-bold text-muted-foreground">{c.mentions}x</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── AI-GENERATED QUALITATIVE ANALYSIS ────────────────────── */}

      {/* Buyer Persona */}
      {data.buyerPersona && (
        <Card className="border-border/60 overflow-hidden">
          <CardHeader className="pb-3 bg-muted/30">
            <CardTitle className="text-base flex items-center gap-2">
              <UserCheck className="h-4.5 w-4.5 text-primary" />
              Perfil do Comprador Ideal
              <Badge variant="outline" className="ml-auto text-xs font-normal">análise IA</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">{safeText(data.buyerPersona.summary)}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-lg border border-border/60 p-3">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70 font-medium mb-1.5">Faixa Etária</p>
                <p className="text-sm font-semibold text-foreground">{safeText(data.buyerPersona.ageRange)}</p>
              </div>
              <div className="rounded-lg border border-border/60 p-3">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70 font-medium mb-1.5">Ticket Médio</p>
                <p className="text-sm font-semibold text-foreground">{safeText(data.buyerPersona.avgTicket)}</p>
              </div>
              <div className="rounded-lg border border-border/60 p-3">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70 font-medium mb-1.5">Profissões</p>
                <div className="flex flex-wrap gap-1">
                  {(Array.isArray(data.buyerPersona.professions) ? data.buyerPersona.professions : []).map((p: unknown, i: number) => (
                    <Badge key={i} variant="secondary" className="text-xs font-normal">{safeText(p)}</Badge>
                  ))}
                </div>
              </div>
            </div>
            {Array.isArray(data.buyerPersona.motivations) && data.buyerPersona.motivations.length > 0 && (
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70 font-medium mb-2">Motivações</p>
                <div className="flex flex-wrap gap-1.5">
                  {data.buyerPersona.motivations.map((m: unknown, i: number) => (
                    <span key={i} className="inline-flex items-center gap-1.5 text-xs rounded-full bg-primary/8 text-primary border border-primary/15 px-2.5 py-1">
                      <TrendingUp className="h-3 w-3" />{safeText(m)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Personality Profiles */}
      {Array.isArray(data.personalityProfiles) && data.personalityProfiles.length > 0 && (
        <Card className="border-border/60 overflow-hidden">
          <CardHeader className="pb-3 bg-muted/30">
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-4.5 w-4.5 text-primary" />
              Perfis de Personalidade
              <Badge variant="outline" className="ml-auto text-xs font-normal">{data.personalityProfiles.length} perfis</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {data.personalityProfiles!.map((p, i: number) => (
              <div key={i} className="rounded-lg border border-border/60 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">{safeText(p.type)}</p>
                  <Badge variant="outline" className={`shrink-0 text-[10px] uppercase tracking-wider ${freqColor[safeText(p.frequency)] || ""}`}>
                    {safeText(p.frequency)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{safeText(p.description)}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="rounded-md bg-emerald-500/5 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-emerald-700 font-medium mb-1.5 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Como atender
                    </p>
                    <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">{safeText(p.approachStrategy)}</p>
                  </div>
                  <div className="rounded-md bg-red-500/5 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-red-700 font-medium mb-1.5 flex items-center gap-1">
                      <Ban className="h-3 w-3" /> O que evitar
                    </p>
                    <p className="text-xs text-red-800 dark:text-red-300 leading-relaxed">{safeText(p.pitfalls)}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Script Builder */}
      {Array.isArray(data.personalityProfiles) && data.personalityProfiles.length > 0 && (
        <Card className="border-border/60 overflow-hidden border-dashed border-primary/20 bg-primary/[0.02]">
          <CardContent className="pt-5 pb-5">
            <ScriptBuilder profiles={data.personalityProfiles} dashboardData={data} />
          </CardContent>
        </Card>
      )}

      {/* Top Questions */}
      {Array.isArray(data.topQuestions) && data.topQuestions.length > 0 && (
        <Card className="border-border/60 overflow-hidden">
          <CardHeader className="pb-3 bg-muted/30">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageCircleQuestion className="h-4.5 w-4.5 text-primary" />
              Perguntas Frequentes
              <Badge variant="outline" className="ml-auto text-xs font-normal">{data.topQuestions.length} perguntas</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {data.topQuestions!.map((q, i: number) => (
              <div key={i} className="rounded-lg border border-border/60 p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <HelpCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-sm font-medium text-foreground leading-snug">"{safeText(q.question)}"</p>
                  </div>
                  <FrequencyBadge
                    frequency={safeText(q.frequency)}
                    count={q.evidenceCount}
                    total={totalForFrequency}
                    pct={q.frequencyPct}
                  />
                </div>
                <div className="ml-6 space-y-2">
                  <div className="rounded-md bg-emerald-500/5 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-emerald-700 font-medium mb-1">Resposta recomendada</p>
                    <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">{safeText(q.idealAnswer)}</p>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">Quando surge:</span> {safeText(q.context)}
                    </p>
                    <EvidenceDialog
                      title={safeText(q.question)}
                      evidence={q.evidence || []}
                      totalMeetings={totalForFrequency}
                    />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Objections */}
      {Array.isArray(data.objections) && data.objections.length > 0 && (
        <Card className="border-border/60 overflow-hidden">
          <CardHeader className="pb-3 bg-muted/30">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="h-4.5 w-4.5 text-primary" />
              Objeções e Contornos
              <Badge variant="outline" className="ml-auto text-xs font-normal">{data.objections.length} objeções</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {data.objections!.map((o, i: number) => (
              <div key={i} className="rounded-lg border border-border/60 p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-sm font-medium text-foreground leading-snug">{safeText(o.objection)}</p>
                  </div>
                  <FrequencyBadge
                    frequency={safeText(o.frequency)}
                    count={o.evidenceCount}
                    total={totalForFrequency}
                    pct={o.frequencyPct}
                  />
                </div>
                <div className="flex items-start gap-2.5 bg-emerald-500/5 rounded-md p-3 ml-6">
                  <ArrowRight className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-emerald-800 dark:text-emerald-300 leading-relaxed">{safeText(o.rebuttal)}</p>
                </div>
                <div className="flex justify-end ml-6">
                  <EvidenceDialog
                    title={safeText(o.objection)}
                    evidence={o.evidence || []}
                    totalMeetings={totalForFrequency}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Hidden Objections */}
      {Array.isArray(data.hiddenObjections) && data.hiddenObjections.length > 0 && (
        <Card className="border-border/60 overflow-hidden">
          <CardHeader className="pb-3 bg-muted/30">
            <CardTitle className="text-base flex items-center gap-2">
              <EyeOff className="h-4.5 w-4.5 text-primary" />
              Objeções Ocultas
              <Badge variant="outline" className="ml-auto text-xs font-normal">{data.hiddenObjections.length} detectadas</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {data.hiddenObjections!.map((h, i: number) => (
              <div key={i} className="rounded-lg border border-border/60 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">{safeText(h.objection)}</p>
                  {h.evidenceCount > 0 && totalForFrequency > 0 && (
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {h.evidenceCount}/{totalForFrequency}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="rounded-md bg-amber-500/5 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-amber-700 font-medium mb-1.5 flex items-center gap-1">
                      <Eye className="h-3 w-3" /> Como identificar
                    </p>
                    <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">{safeText(h.signals)}</p>
                  </div>
                  <div className="rounded-md bg-emerald-500/5 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-emerald-700 font-medium mb-1.5 flex items-center gap-1">
                      <Target className="h-3 w-3" /> Como abordar
                    </p>
                    <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">{safeText(h.approach)}</p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <EvidenceDialog
                    title={safeText(h.objection)}
                    evidence={h.evidence || []}
                    totalMeetings={totalForFrequency}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Closing Arguments */}
        {Array.isArray(data.closingArguments) && data.closingArguments.length > 0 && (
          <Card className="border-border/60 overflow-hidden">
            <CardHeader className="pb-3 bg-muted/30">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4.5 w-4.5 text-primary" />
                Argumentos que Fecham
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {data.closingArguments!.map((a, i: number) => (
                <div key={i} className="rounded-lg border border-border/60 p-3 space-y-1.5">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-sm font-medium text-foreground">{safeText(a.argument)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6 leading-relaxed">
                    <span className="font-medium">Quando usar:</span> {safeText(a.context)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Buying Signals */}
        {Array.isArray(data.buyingSignals) && data.buyingSignals.length > 0 && (
          <Card className="border-border/60 overflow-hidden">
            <CardHeader className="pb-3 bg-muted/30">
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="h-4.5 w-4.5 text-primary" />
                Sinais de Compra
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {data.buyingSignals!.map((s, i: number) => (
                <div key={i} className="rounded-lg border border-border/60 p-3 space-y-1.5">
                  <p className="text-sm font-medium text-foreground flex items-start gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    {safeText(s.signal)}
                  </p>
                  <p className="text-xs text-muted-foreground ml-4 leading-relaxed">
                    <span className="font-medium">→ Ação:</span> {safeText(s.action)}
                  </p>
                  {s.evidence?.length > 0 && (
                    <div className="ml-4 pt-1">
                      <EvidenceDialog
                        title={safeText(s.signal)}
                        evidence={s.evidence}
                        totalMeetings={totalForFrequency}
                      />
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Action Items */}
      {Array.isArray(data.actionItems) && data.actionItems.length > 0 && (
        <Card className="border-border/60 overflow-hidden">
          <CardHeader className="pb-3 bg-muted/30">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4.5 w-4.5 text-primary" />
              Plano de Ação Comercial
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-2">
            {data.actionItems!.map((a, i: number) => (
              <div key={i} className="flex items-start gap-3 rounded-lg border border-border/60 p-3.5">
                <Badge variant="outline" className={`shrink-0 text-[10px] uppercase tracking-wider mt-0.5 ${priorityColor[safeText(a.priority)] || ""}`}>
                  {safeText(a.priority)}
                </Badge>
                <div className="space-y-0.5 min-w-0">
                  <p className="text-sm font-medium text-foreground">{safeText(a.action)}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{safeText(a.impact)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Lead Ranking */}
      {data.leadScores && <LeadRanking leads={data.leadScores} />}

      {/* Sentiment Summary */}
      {data.sentimentSummary && (
        <div className="rounded-lg bg-muted/40 border border-border/60 px-5 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">Sentimento Geral:</span>{" "}
            {safeText(data.sentimentSummary)}
          </p>
        </div>
      )}
    </div>
  );
}
