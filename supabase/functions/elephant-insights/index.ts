import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ELEPHAN_BASE = "https://api.elephan.dev/v1";
const CACHE_TTL_HOURS = 6;

// ─── Simple in-memory rate limiter ──────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

// ─── Input validation ───────────────────────────────────────────
const VALID_ACTIONS = new Set(["list-users", "executive-summary", null]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getSupabaseAdmin() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

async function elephanFetch(path: string, apiKey: string) {
  const res = await fetch(`${ELEPHAN_BASE}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Elephan ${res.status}: ${await res.text()}`);
  return res.json();
}

// ─── Normalization (shared with frontend src/lib/insights/normalize.ts) ──
function normalizeKey(s: string): string {
  if (!s || typeof s !== "string") return "";
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function frequencyBand(pct: number): "alta" | "média" | "baixa" {
  if (pct >= 0.4) return "alta";
  if (pct >= 0.15) return "média";
  return "baixa";
}

// ─── DATA EXTRACTION ─────────────────────────────────────────────

interface SentimentEntry { sentimental: string; perc: number; total: number; }

function extractDominantSentiment(sentimentData: unknown): string {
  if (typeof sentimentData === "string") return sentimentData;
  if (!Array.isArray(sentimentData)) return "unknown";
  const sorted = [...sentimentData].sort((a: SentimentEntry, b: SentimentEntry) => b.perc - a.perc);
  return sorted[0]?.sentimental?.toLowerCase() || "unknown";
}

function extractSentimentBreakdown(sentimentData: unknown): Record<string, number> {
  if (!Array.isArray(sentimentData)) return {};
  const result: Record<string, number> = {};
  for (const entry of sentimentData) {
    if (entry.sentimental && typeof entry.perc === "number") {
      result[entry.sentimental.toLowerCase()] = entry.perc;
    }
  }
  return result;
}

function extractReasonsByType(reasons: any[]): Record<string, any[]> {
  const grouped: Record<string, any[]> = {};
  for (const r of reasons || []) {
    const type = r.type || "other";
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push({
      description: r.description || "",
      details: r.details || null,
    });
  }
  return grouped;
}

function extractAnswerMetrics(answers: any[]): { scoreQuestions: any[]; yesNoQuestions: any[]; openQuestions: any[]; avgScore: number | null } {
  const scoreQuestions: any[] = [];
  const yesNoQuestions: any[] = [];
  const openQuestions: any[] = [];
  const scores: number[] = [];

  for (const a of answers || []) {
    if (typeof a.score === "number") {
      scoreQuestions.push({ question: a.question, score: a.score });
      scores.push(a.score);
    } else if (a.yesNo !== undefined) {
      yesNoQuestions.push({ question: a.question, yesNo: a.yesNo === "yes" || a.yesNo === true });
    } else {
      openQuestions.push({ question: a.question });
    }
  }

  return {
    scoreQuestions,
    yesNoQuestions,
    openQuestions,
    avgScore: scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null,
  };
}

interface TranscribeEntry {
  title?: string;
  duration?: number;
  dateIncluded?: string;
  summary?: string;
  sentimentAnalysis?: { totalSentiment?: unknown };
  reasons?: ReasonEntry[];
  competitors?: CompetitorEntry[];
  answers?: AnswerEntry[];
  deal?: { crmUrl?: string; id?: string };
}
interface ReasonEntry { type?: string; description?: string; details?: unknown; }
interface CompetitorEntry { word?: string; name?: string; count?: number; }
interface AnswerEntry { question?: string; score?: number; yesNo?: string | boolean; }

// ─── LEAD SCORE WITH BREAKDOWN ───────────────────────────────────

export type ScoreFactorCategory = "sentiment" | "duration" | "reasons" | "competitors" | "answers";
export interface ScoreFactor { label: string; delta: number; category: ScoreFactorCategory; }

const BASE_SCORE = 50;

export function computeLeadScore(t: TranscribeEntry): { score: number; breakdown: ScoreFactor[] } {
  const breakdown: ScoreFactor[] = [];
  let score = BASE_SCORE;

  // Sentiment
  const dominant = extractDominantSentiment(t.sentimentAnalysis?.totalSentiment);
  if (dominant === "positive") {
    score += 20;
    breakdown.push({ label: "Sentimento positivo dominante", delta: 20, category: "sentiment" });
  } else if (dominant === "negative") {
    score -= 15;
    breakdown.push({ label: "Sentimento negativo dominante", delta: -15, category: "sentiment" });
  } else if (dominant === "neutral") {
    score += 5;
    breakdown.push({ label: "Sentimento neutro", delta: 5, category: "sentiment" });
  }

  // Duration
  const durationMin = Math.round((t.duration || 0) / 60);
  if (durationMin >= 30) {
    score += 10;
    breakdown.push({ label: `Reunião longa (${durationMin}min)`, delta: 10, category: "duration" });
  } else if (durationMin >= 15) {
    score += 5;
    breakdown.push({ label: `Reunião de tamanho médio (${durationMin}min)`, delta: 5, category: "duration" });
  } else if (durationMin > 0 && durationMin < 5) {
    score -= 10;
    breakdown.push({ label: `Reunião muito curta (${durationMin}min)`, delta: -10, category: "duration" });
  }
  // durationMin === 0 (no-show / sem dado): não penaliza — é tratado separadamente como no-show KPI

  // Reasons
  const reasons = t.reasons || [];
  const objections = reasons.filter((r) => r.type === "objection").length;
  const positivePoints = reasons.filter((r) => r.type === "positive_point").length;
  const potentialLoss = reasons.filter((r) => r.type === "potential_loss").length;
  if (objections > 0) {
    const d = -objections * 5;
    score += d;
    breakdown.push({ label: `${objections} objeç${objections > 1 ? "ões" : "ão"} levantada${objections > 1 ? "s" : ""}`, delta: d, category: "reasons" });
  }
  if (positivePoints > 0) {
    const d = positivePoints * 4;
    score += d;
    breakdown.push({ label: `${positivePoints} ponto${positivePoints > 1 ? "s" : ""} positivo${positivePoints > 1 ? "s" : ""}`, delta: d, category: "reasons" });
  }
  if (potentialLoss > 0) {
    const d = -potentialLoss * 8;
    score += d;
    breakdown.push({ label: `${potentialLoss} sinal${potentialLoss > 1 ? "is" : ""} de risco de perda`, delta: d, category: "reasons" });
  }

  // Competitors
  const competitors = (t.competitors || []).reduce((s: number, c) => s + (c.count || 1), 0);
  if (competitors > 0) {
    const d = -competitors * 3;
    score += d;
    breakdown.push({ label: `${competitors} menç${competitors > 1 ? "ões" : "ão"} a concorrentes`, delta: d, category: "competitors" });
  }

  // Answers
  const answers = extractAnswerMetrics(t.answers || []);
  const yesCount = answers.yesNoQuestions.filter((q) => q.yesNo).length;
  const noCount = answers.yesNoQuestions.filter((q) => !q.yesNo).length;
  if (yesCount > 0) {
    const d = yesCount * 4;
    score += d;
    breakdown.push({ label: `${yesCount} resposta${yesCount > 1 ? "s" : ""} "sim"`, delta: d, category: "answers" });
  }
  if (noCount > 0) {
    const d = -noCount * 3;
    score += d;
    breakdown.push({ label: `${noCount} resposta${noCount > 1 ? "s" : ""} "não"`, delta: d, category: "answers" });
  }
  if (answers.avgScore !== null) {
    const d = Math.round((answers.avgScore - 5) * 2);
    if (d !== 0) {
      score += d;
      breakdown.push({
        label: `Score médio das respostas: ${answers.avgScore}/10`,
        delta: d,
        category: "answers",
      });
    }
  }

  const finalScore = Math.max(0, Math.min(100, score));
  return { score: finalScore, breakdown };
}

// ─── TREND ANALYSIS (30/60/90d) ──────────────────────────────────

interface TrendWindow {
  windowDays: 30 | 60 | 90;
  meetings: number;
  avgScore: number;
  positiveSentimentPct: number;
  topObjections: { objection: string; count: number }[];
}

interface WeeklyPoint {
  weekStart: string; // ISO date YYYY-MM-DD (UTC Monday of the week)
  label: string;     // Short DD/MMM label, e.g. "14/Apr"
  meetings: number;
  avgScore: number;
}

interface TrendsPayload {
  windows: TrendWindow[];
  // Deltas comparing 30d vs preceding 30d (i.e., 30d window vs days 31-60)
  delta30vs60: {
    meetings: number;
    avgScore: number;
    positiveSentimentPct: number;
  };
  // Last 12 weeks of evolution, oldest → newest, anchored to UTC Monday
  weekly: WeeklyPoint[];
}

// Returns the UTC Monday (00:00:00) of the week containing the given date.
function getUtcMonday(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const diff = (day + 6) % 7; // days since Monday
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function formatWeekLabel(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${dd}/${MONTH_ABBR[d.getUTCMonth()]}`;
}

export function buildTrends(transcribes: any[]): TrendsPayload {
  const now = Date.now();
  const dayMs = 86_400_000;

  const inWindow = (t: any, days: number) => {
    if (!t.dateIncluded) return false;
    const ts = new Date(t.dateIncluded).getTime();
    if (Number.isNaN(ts)) return false;
    return now - ts <= days * dayMs;
  };

  const inRange = (t: any, fromDays: number, toDays: number) => {
    if (!t.dateIncluded) return false;
    const ts = new Date(t.dateIncluded).getTime();
    if (Number.isNaN(ts)) return false;
    const age = now - ts;
    return age > fromDays * dayMs && age <= toDays * dayMs;
  };

  const computeWindow = (subset: any[], windowDays: 30 | 60 | 90): TrendWindow => {
    if (subset.length === 0) {
      return { windowDays, meetings: 0, avgScore: 0, positiveSentimentPct: 0, topObjections: [] };
    }

    let totalScore = 0;
    let positiveTotal = 0;
    let positiveCount = 0;
    const objectionCount: Record<string, number> = {};

    for (const t of subset) {
      const { score } = computeLeadScore(t);
      totalScore += score;
      const breakdown = extractSentimentBreakdown(t.sentimentAnalysis?.totalSentiment);
      if (typeof breakdown.positive === "number") {
        positiveTotal += breakdown.positive;
        positiveCount++;
      }
      for (const r of t.reasons || []) {
        if (r.type === "objection" && r.description) {
          const key = r.description.substring(0, 80);
          objectionCount[key] = (objectionCount[key] || 0) + 1;
        }
      }
    }

    const topObjections = Object.entries(objectionCount)
      .map(([objection, count]) => ({ objection, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    return {
      windowDays,
      meetings: subset.length,
      avgScore: Math.round(totalScore / subset.length),
      positiveSentimentPct: positiveCount > 0 ? Math.round(positiveTotal / positiveCount) : 0,
      topObjections,
    };
  };

  const win30 = transcribes.filter((t) => inWindow(t, 30));
  const win60 = transcribes.filter((t) => inWindow(t, 60));
  const win90 = transcribes.filter((t) => inWindow(t, 90));
  const prev30 = transcribes.filter((t) => inRange(t, 30, 60));

  const w30 = computeWindow(win30, 30);
  const w60 = computeWindow(win60, 60);
  const w90 = computeWindow(win90, 90);
  const wPrev = computeWindow(prev30, 30);

  // ── Weekly evolution (last 12 weeks, oldest → newest) ─────────
  const currentMonday = getUtcMonday(new Date(now));
  const weekly: WeeklyPoint[] = [];
  // Pre-build 12 buckets keyed by ISO week-start
  const bucketByKey = new Map<string, { meetings: number; scoreSum: number }>();
  for (let i = 11; i >= 0; i--) {
    const wk = new Date(currentMonday);
    wk.setUTCDate(wk.getUTCDate() - i * 7);
    const key = wk.toISOString().slice(0, 10);
    bucketByKey.set(key, { meetings: 0, scoreSum: 0 });
    weekly.push({ weekStart: key, label: formatWeekLabel(wk), meetings: 0, avgScore: 0 });
  }
  for (const t of transcribes) {
    if (!t.dateIncluded) continue;
    const ts = new Date(t.dateIncluded);
    if (Number.isNaN(ts.getTime())) continue;
    const monday = getUtcMonday(ts);
    const key = monday.toISOString().slice(0, 10);
    const b = bucketByKey.get(key);
    if (!b) continue; // outside 12-week range
    const { score } = computeLeadScore(t);
    b.meetings += 1;
    b.scoreSum += score;
  }
  for (const w of weekly) {
    const b = bucketByKey.get(w.weekStart)!;
    w.meetings = b.meetings;
    w.avgScore = b.meetings > 0 ? Math.round(b.scoreSum / b.meetings) : 0;
  }

  return {
    windows: [w30, w60, w90],
    delta30vs60: {
      meetings: w30.meetings - wPrev.meetings,
      avgScore: w30.avgScore - wPrev.avgScore,
      positiveSentimentPct: w30.positiveSentimentPct - wPrev.positiveSentimentPct,
    },
    weekly,
  };
}

function processMeetings(transcribes: any[]) {
  const sentimentTotals: Record<string, number> = {};
  let totalDuration = 0;
  const allReasons: Record<string, any[]> = {};
  const allCompetitors: Record<string, number> = {};
  const scoreDistribution = { high: [] as any[], medium: [] as any[], low: [] as any[] };
  const questionScoreMap: Record<string, number[]> = {};

  const leads = transcribes.map((t: any) => {
    totalDuration += t.duration || 0;

    const breakdown = extractSentimentBreakdown(t.sentimentAnalysis?.totalSentiment);
    for (const [key, val] of Object.entries(breakdown)) {
      sentimentTotals[key] = (sentimentTotals[key] || 0) + val;
    }

    const grouped = extractReasonsByType(t.reasons);
    for (const [type, items] of Object.entries(grouped)) {
      if (!allReasons[type]) allReasons[type] = [];
      allReasons[type].push(...items);
    }

    for (const c of t.competitors || []) {
      const name = c.word || c.name || "unknown";
      allCompetitors[name] = (allCompetitors[name] || 0) + (c.count || 1);
    }

    const answers = extractAnswerMetrics(t.answers);
    for (const sq of answers.scoreQuestions) {
      if (!questionScoreMap[sq.question]) questionScoreMap[sq.question] = [];
      questionScoreMap[sq.question].push(sq.score);
    }

    const { score, breakdown: scoreBreakdown } = computeLeadScore(t);
    const dominant = extractDominantSentiment(t.sentimentAnalysis?.totalSentiment);
    const durationMin = Math.round((t.duration || 0) / 60);

    const lead = {
      title: t.title || "Reunião sem título",
      date: t.dateIncluded || null,
      durationMinutes: durationMin,
      sentiment: dominant,
      sentimentBreakdown: breakdown,
      score,
      scoreBreakdown,
      objectionCount: (t.reasons || []).filter((r: any) => r.type === "objection").length,
      positivePoints: (t.reasons || []).filter((r: any) => r.type === "positive_point").length,
      competitorMentions: (t.competitors || []).reduce((s: number, c: any) => s + (c.count || 1), 0),
      summary: t.summary ? t.summary.replace(/<[^>]*>/g, "").substring(0, 300) : null,
      dealUrl: t.deal?.crmUrl && t.deal.id !== "null" ? t.deal.crmUrl : null,
      avgAnswerScore: answers.avgScore,
      yesCount: answers.yesNoQuestions.filter((q: any) => q.yesNo).length,
      noCount: answers.yesNoQuestions.filter((q: any) => !q.yesNo).length,
    };

    if (score >= 75) scoreDistribution.high.push(lead);
    else if (score >= 50) scoreDistribution.medium.push(lead);
    else scoreDistribution.low.push(lead);

    return lead;
  }).sort((a: any, b: any) => b.score - a.score);

  const meetingCount = transcribes.length;
  const avgSentiment: Record<string, number> = {};
  for (const [key, val] of Object.entries(sentimentTotals)) {
    avgSentiment[key] = Math.round(val / meetingCount);
  }

  const allAnswerScores: { question: string; scores: number[] }[] = [];
  for (const [question, scores] of Object.entries(questionScoreMap)) {
    allAnswerScores.push({ question, scores });
  }

  return {
    leads,
    totalDurationMinutes: Math.round(totalDuration / 60),
    latestMeeting: transcribes[0]?.dateIncluded || null,
    avgSentiment,
    reasonsByType: Object.fromEntries(
      Object.entries(allReasons).map(([type, items]) => [type, { count: items.length, examples: items.slice(0, 3) }])
    ),
    competitors: Object.entries(allCompetitors)
      .map(([name, count]) => ({ name, mentions: count }))
      .sort((a, b) => b.mentions - a.mentions),
    scoreDistribution: {
      hot: scoreDistribution.high.length,
      warm: scoreDistribution.medium.length,
      cold: scoreDistribution.low.length,
    },
    answerScores: allAnswerScores.map(({ question, scores }) => ({
      question: question.length > 80 ? question.substring(0, 77) + "…" : question,
      avg: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
      count: scores.length,
    })).slice(0, 10),
  };
}

// ─── AI PROMPT (now requires evidence) ──────────────────────────

const STRUCTURED_PROMPT = `Você é um Head of Sales Intelligence da BWild — empresa de reformas de studios para investimento (Airbnb/short stay). Sua expertise: extrair padrões acionáveis de reuniões com investidores, identificar objeções reais e ocultas, mapear sinais de compra que convertem.

MISSÃO
Analise as transcrições e devolva inteligência comercial estruturada em JSON. Esta análise alimenta o playbook que os consultores usam diariamente.

REGRAS CRÍTICAS DE QUALIDADE
1. EVIDÊNCIA LITERAL OBRIGATÓRIA — para cada objeção, pergunta, objeção oculta e sinal de compra, INCLUA \`evidence\`: array com 1+ trechos LITERAIS extraídos das reuniões. JAMAIS invente citações. Use o título exato da reunião.
2. ESPECIFICIDADE — "Preço alto" é raso. "Preço alto comparado ao Airbnb antigo dele" é específico. SEMPRE traga o contexto.
3. ACIONABILIDADE — \`rebuttal\`, \`approach\`, \`action\` devem ser scripts USÁVEIS pelo consultor na próxima reunião. Verbo no imperativo, exemplo concreto.
4. PRIORIZE PADRÕES REAIS — se uma objeção apareceu 5x, ela importa MUITO mais que uma que apareceu 1x. Reflita isso na ordem.
5. DIFERENCIE OBJEÇÃO ABERTA × OCULTA — aberta = cliente verbalizou ("é caro"). Oculta = cliente NÃO verbalizou mas o consultor deveria identificar (silêncio, evasiva, mudança de assunto, comparação implícita).
6. SINAIS DE COMPRA — sinais comportamentais reais, não óbvios. "Perguntou sobre prazo" > "Perguntou sobre o investimento". Detalhe exatamente o que fazer NA HORA.
7. ARGUMENTOS DE FECHAMENTO — só inclua os que TÊM evidência de funcionar (o consultor usou e cliente avançou).

Formato JSON OBRIGATÓRIO (RETORNE APENAS O JSON, sem markdown, sem backticks):

{
  "buyerPersona": {
    "summary": "3-4 frases sobre o perfil típico, citando dores e motivações específicas",
    "ageRange": "Faixa etária observada",
    "professions": ["Prof1 (com freq)", "Prof2"],
    "motivations": ["Mot1 específica", "Mot2 específica"],
    "avgTicket": "Ex: R$ 60k - R$ 80k",
    "decisionStyle": "Como decidem (analítico/emocional/social/avesso a risco)"
  },
  "personalityProfiles": [
    {"type": "Nome do perfil", "description": "Comportamento observável em 1-2 frases", "frequency": "alta/média/baixa", "approachStrategy": "Script/abordagem específica", "pitfalls": "Erro fatal a evitar"}
  ],
  "topQuestions": [
    {"question": "Pergunta literal mais comum", "idealAnswer": "Resposta-modelo de 2-3 frases que move a venda", "context": "Em qual momento da reunião surge", "evidence": [{"meetingTitle": "...", "quote": "..."}]}
  ],
  "objections": [
    {"objection": "Objeção verbalizada", "rebuttal": "Script de resposta acionável (2-3 frases, verbo no imperativo)", "evidence": [{"meetingTitle": "...", "quote": "..."}]}
  ],
  "hiddenObjections": [
    {"objection": "O que o cliente realmente está pensando", "signals": "3+ sinais comportamentais para identificar", "approach": "Pergunta-chave para fazer + como conduzir", "evidence": [{"meetingTitle": "...", "quote": "..."}]}
  ],
  "closingArguments": [
    {"argument": "Argumento que funcionou", "effectiveness": "alta/média", "context": "Quando exatamente usar"}
  ],
  "buyingSignals": [
    {"signal": "Sinal comportamental específico", "action": "O que fazer NA HORA (script)", "evidence": [{"meetingTitle": "...", "quote": "..."}]}
  ],
  "actionItems": [
    {"action": "Ação concreta para o time comercial", "priority": "alta/média/baixa", "impact": "Métrica que melhora"}
  ],
  "sentimentSummary": "Resumo qualitativo de 2-3 frases citando padrões emocionais observados"
}

QUOTAS MÍNIMAS
- 3+ objeções abertas (priorize as recorrentes)
- 3+ argumentos de fechamento
- 3+ sinais de compra
- 3+ perguntas frequentes
- 2+ perfis de personalidade
- 2+ objeções ocultas (com sinais claros)
- 4+ action items priorizados

Português do Brasil. Direto, sem jargão de consultoria. Foque em ACIONABILIDADE.`;

// ─── EVIDENCE POST-PROCESSING ───────────────────────────────────

interface ItemWithEvidence {
  evidence?: Array<{ meetingTitle?: string; quote?: string }>;
  frequency?: string;
  frequencyPct?: number;
  evidenceCount?: number;
}

/**
 * Normaliza evidências, calcula frequência real, dropa itens sem evidência.
 * Sobrescreve `frequency` declarado pelo LLM com banda calculada.
 */
function annotateWithEvidence<T extends ItemWithEvidence>(
  items: T[] | undefined,
  totalMeetings: number,
  validTitles: Set<string>,
): T[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      const evidence = (item.evidence || [])
        .filter((e) => e && typeof e.quote === "string" && e.quote.trim().length > 0)
        .map((e) => ({
          meetingTitle: typeof e.meetingTitle === "string" ? e.meetingTitle.substring(0, 200) : "",
          quote: e.quote!.substring(0, 220).trim(),
        }))
        // Soft validation: if title doesn't match any real meeting, keep the quote but blank the title.
        .map((e) => ({
          meetingTitle: e.meetingTitle && validTitles.has(normalizeKey(e.meetingTitle)) ? e.meetingTitle : (e.meetingTitle || ""),
          quote: e.quote,
        }));
      const count = evidence.length;
      const pct = totalMeetings > 0 ? count / totalMeetings : 0;
      return {
        ...item,
        evidence,
        evidenceCount: count,
        frequencyPct: Math.round(pct * 100),
        frequency: frequencyBand(pct),
      };
    })
    .filter((item) => (item.evidence?.length || 0) > 0);
}

/** Dedupe items by a normalized key */
function dedupeByKey<T>(items: T[], keyFn: (it: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((it) => {
    const k = normalizeKey(keyFn(it));
    if (!k) return false;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ─── MAIN HANDLER ───────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!checkRateLimit(clientIp)) {
      return new Response(JSON.stringify({ success: false, error: "Rate limit exceeded. Try again in 1 minute." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const url = new URL(req.url);
    let bodyParams: Record<string, string> = {};
    if (req.method === "POST") {
      try {
        const raw = await req.json();
        bodyParams = raw || {};
      } catch { /* no body */ }
    }

    const action = url.searchParams.get("action") || bodyParams.action || null;
    const forceRefresh = (url.searchParams.get("refresh") || bodyParams.refresh) === "true";
    const userId = url.searchParams.get("userId") || bodyParams.userId || null;

    if (action !== null && !VALID_ACTIONS.has(action)) {
      return new Response(JSON.stringify({ success: false, error: "Invalid action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (userId && !UUID_RE.test(userId) && userId.length > 100) {
      return new Response(JSON.stringify({ success: false, error: "Invalid userId format" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sb = getSupabaseAdmin();
    const apiKey = Deno.env.get("ASKELEPHANT_API_KEY") || Deno.env.get("ELEPHAN_API_KEY");
    if (!apiKey) return new Response(JSON.stringify({ success: false, error: "ELEPHAN_API_KEY (ou ASKELEPHANT_API_KEY) não configurado" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Domínio interno — apenas consultores BWild aparecem no painel.
    const INTERNAL_EMAIL_DOMAIN = "@bwild.com.br";
    const isConsultant = (u: any): boolean =>
      (u?.email || "").toLowerCase().endsWith(INTERNAL_EMAIL_DOMAIN);

    // ─── LIST USERS ──────────────────────────────────────────────
    if (action === "list-users") {
      const usersResult = await elephanFetch("/users?limit=100", apiKey);
      const users = (usersResult.data || [])
        .filter(isConsultant)
        .map((u: any) => ({
          id: u.id,
          name: u.name || u.email || "Sem nome",
          email: u.email || null,
        }));
      return new Response(JSON.stringify({ success: true, users }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── EXECUTIVE SUMMARY ───────────────────────────────────────
    if (action === "executive-summary") {
      const lovableKey = Deno.env.get("LOVABLE_API_KEY");
      if (!lovableKey) return new Response(JSON.stringify({ success: false, error: "LOVABLE_API_KEY not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const dashboardData = bodyParams.dashboardData;
      if (!dashboardData) return new Response(JSON.stringify({ success: false, error: "dashboardData is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const summaryPrompt = `Você é Head of Sales Intelligence da BWild — empresa de reformas de studios para investimento (Airbnb/short stay).

Com base nos dados consolidados de reuniões com investidores, gere EXATAMENTE 3 takeaways executivos — os insights mais importantes e acionáveis para o time comercial nesta SEMANA.

RETORNE APENAS um JSON array com 3 objetos, sem markdown, sem backticks:
[
  {"icon": "brain|shield|target|eye|sparkles", "title": "Título curto e específico (max 8 palavras)", "insight": "Insight acionável em 2-3 frases citando número/padrão concreto + ação imediata"}
]

REGRAS DE QUALIDADE
1. ESPECIFICIDADE — cada takeaway cita um número, percentual ou nome de padrão. "Objeção de preço apareceu em 7 das últimas 12 reuniões" > "preço é uma preocupação".
2. CRUZAMENTO — combine ao menos duas dimensões (ex: "objeção × perfil", "sinal × momento").
3. AÇÃO IMEDIATA — última frase tem verbo no imperativo, escopo desta semana.
4. NÃO REPITA o que já é óbvio nas métricas (sentimento positivo predominante etc).

ÍCONES
- "brain" → perfil/comportamento do investidor
- "shield" → objeções/riscos
- "target" → oportunidades de fechamento
- "eye" → sinais de compra observáveis
- "sparkles" → recomendação de processo/script

Português do Brasil, direto, sem jargão de consultoria. APENAS o JSON array, nada mais.`;

      const dataStr = typeof dashboardData === "string" ? dashboardData : JSON.stringify(dashboardData);

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [
            { role: "system", content: summaryPrompt },
            { role: "user", content: `Dados consolidados:\n${dataStr.substring(0, 12000)}` },
          ],
        }),
      });

      if (!aiResponse.ok) {
        const status = aiResponse.status;
        if (status === 429) return new Response(JSON.stringify({ success: false, error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ success: false, error: "Credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        return new Response(JSON.stringify({ success: false, error: "AI error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const aiData = await aiResponse.json();
      let rawContent = aiData.choices?.[0]?.message?.content || "";
      rawContent = rawContent.replace(/^```json?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

      let takeaways = [];
      try { takeaways = JSON.parse(rawContent); } catch { takeaways = []; }

      return new Response(JSON.stringify({ success: true, takeaways }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── INSIGHTS ENDPOINT ───────────────────────────────────────
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) return new Response(JSON.stringify({ success: false, error: "LOVABLE_API_KEY not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    let targetUserId: string;
    let targetUserName: string;
    if (userId) {
      const usersResult = await elephanFetch("/users?limit=100", apiKey);
      const users = usersResult.data || [];
      const found = users.find((u: any) => u.id === userId);
      if (!found) return new Response(JSON.stringify({ success: false, error: "Consultor não encontrado." }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (!isConsultant(found)) {
        return new Response(JSON.stringify({ success: false, error: "Usuário não é um consultor BWild (email fora do domínio @bwild.com.br)." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      targetUserId = found.id;
      targetUserName = found.name || found.email || "Consultor";
    } else {
      const usersResult = await elephanFetch("/users?limit=100", apiKey);
      const users = usersResult.data || [];
      const firstConsultant = users.find(isConsultant);
      if (!firstConsultant) return new Response(JSON.stringify({ success: false, error: "Nenhum consultor BWild encontrado (email @bwild.com.br)." }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      targetUserId = firstConsultant.id;
      targetUserName = firstConsultant.name || firstConsultant.email || "Consultor";
    }

    const cacheKey = `user_${targetUserId}`;

    if (!forceRefresh) {
      const { data: cached } = await sb.from("elephant_insights_cache").select("*").eq("cache_key", cacheKey).single();
      if (cached) {
        const ageHours = (Date.now() - new Date(cached.updated_at).getTime()) / 3600000;
        if (ageHours < CACHE_TTL_HOURS) {
          return new Response(JSON.stringify({
            success: true, cached: true, cacheAge: Math.round(ageHours * 60),
            consultantName: cached.consultant_name,
            amandaName: cached.consultant_name, // compatibilidade
            totalMeetings: cached.total_meetings,
            totalDurationMinutes: cached.total_duration_minutes,
            positiveSentimentPct: cached.positive_sentiment_pct,
            latestMeeting: cached.latest_meeting,
            chartsData: cached.charts_data,
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
    }

    // Fetch all transcribes
    const allTranscribes: any[] = [];
    let page = 1, hasNext = true;
    while (hasNext) {
      const result = await elephanFetch(`/transcribes?userId=${targetUserId}&limit=100&page=${page}`, apiKey);
      allTranscribes.push(...(result.data || []));
      hasNext = result.pagination?.hasNext === true;
      page++;
    }

    // Filter: no-show (duration === 0). Contamos no-shows separadamente para expor como KPI.
    const noShows: any[] = [];
    const filteredTranscribes = allTranscribes.filter((t: any) => {
      if ((t.duration || 0) === 0) {
        noShows.push(t);
        return false;
      }
      return true;
    });

    const scheduledCount = filteredTranscribes.length + noShows.length;
    const noShowCount = noShows.length;
    const noShowRate = scheduledCount > 0 ? Math.round((noShowCount / scheduledCount) * 100) : 0;

    if (filteredTranscribes.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        consultantName: targetUserName,
        amandaName: targetUserName, // compatibilidade com UI antiga
        totalMeetings: 0,
        chartsData: { metrics: { noShowCount, noShowRate, scheduledCount } },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── EXTRACT REAL METRICS ───────────────────────────────────
    const metrics = processMeetings(filteredTranscribes);

    // Build set of valid meeting titles for evidence validation
    const validTitles = new Set<string>(
      filteredTranscribes.map((t: any) => normalizeKey(t.title || ""))
    );

    // ─── AI ANALYSIS ────────────────────────────────────────────
    const meetingSummaries = filteredTranscribes.slice(0, 50).map((t: any) => {
      const reasons = (t.reasons || []).map((r: any) => `[${r.type}] ${r.description}`).join("; ");
      const dominant = extractDominantSentiment(t.sentimentAnalysis?.totalSentiment);
      return `[${t.dateIncluded || "?"}] TÍTULO: "${t.title || "?"}" | ${Math.round((t.duration || 0) / 60)}min | Sent:${dominant}\nResumo: ${(t.summary || "").replace(/<[^>]*>/g, "").substring(0, 400)}\nObjeções/Pontos: ${reasons || "—"}`;
    }).join("\n---\n");

    let aiDashboard: any = null;
    try {
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [
            { role: "system", content: STRUCTURED_PROMPT },
            { role: "user", content: `${filteredTranscribes.length} transcrições de ${targetUserName}. Use o TÍTULO exato de cada reunião ao gerar evidence:\n\n${meetingSummaries}` },
          ],
        }),
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        let rawContent = aiData.choices?.[0]?.message?.content || "";
        rawContent = rawContent.replace(/^```json?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
        try { aiDashboard = JSON.parse(rawContent); } catch { console.error("AI JSON parse failed"); }
      } else if (aiResponse.status === 429) {
        console.warn("AI rate limited, returning metrics-only dashboard");
      } else if (aiResponse.status === 402) {
        console.warn("AI credits insufficient, returning metrics-only dashboard");
      }
    } catch (err) {
      console.error("AI analysis failed, continuing with metrics:", err);
    }

    // Pós-processa evidence: sobrescreve frequency com banda calculada,
    // descarta itens sem evidência, normaliza dedupe.
    const totalForFrequency = filteredTranscribes.length;
    if (aiDashboard) {
      aiDashboard.objections = dedupeByKey(
        annotateWithEvidence(aiDashboard.objections, totalForFrequency, validTitles),
        (o: any) => o.objection || ""
      );
      aiDashboard.topQuestions = dedupeByKey(
        annotateWithEvidence(aiDashboard.topQuestions, totalForFrequency, validTitles),
        (q: any) => q.question || ""
      );
      aiDashboard.hiddenObjections = dedupeByKey(
        annotateWithEvidence(aiDashboard.hiddenObjections, totalForFrequency, validTitles),
        (h: any) => h.objection || ""
      );
      aiDashboard.buyingSignals = dedupeByKey(
        annotateWithEvidence(aiDashboard.buyingSignals, totalForFrequency, validTitles),
        (s: any) => s.signal || ""
      );
    }

    // ─── BUILD COMBINED DASHBOARD ───────────────────────────────
    const trends = buildTrends(filteredTranscribes);
    const dashboard = {
      metrics: {
        avgSentiment: metrics.avgSentiment,
        reasonsByType: metrics.reasonsByType,
        competitors: metrics.competitors,
        scoreDistribution: metrics.scoreDistribution,
        answerScores: metrics.answerScores,
        noShowCount,
        noShowRate,
        scheduledCount,
        totalForFrequency,
      },
      trends,
      leadScores: metrics.leads,
      ...(aiDashboard || {}),
    };

    const positivePct = metrics.avgSentiment.positive || null;

    const responseData = {
      success: true, cached: false,
      consultantName: targetUserName,
      amandaName: targetUserName, // compatibilidade com UI antiga
      totalMeetings: filteredTranscribes.length,
      totalDurationMinutes: metrics.totalDurationMinutes,
      positiveSentimentPct: positivePct,
      latestMeeting: metrics.latestMeeting,
      chartsData: dashboard,
    };

    await sb.from("elephant_insights_cache").upsert({
      cache_key: cacheKey,
      insights: JSON.stringify(aiDashboard),
      consultant_name: targetUserName,
      total_meetings: filteredTranscribes.length,
      total_duration_minutes: metrics.totalDurationMinutes,
      positive_sentiment_pct: positivePct,
      latest_meeting: metrics.latestMeeting,
      charts_data: dashboard,
      updated_at: new Date().toISOString(),
    }, { onConflict: "cache_key" });

    return new Response(JSON.stringify(responseData), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("elephant-insights error:", error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
