/**
 * Score composto de temperatura de negócio (quente / morno / frio)
 * + sugestão de próxima ação.
 *
 * Componentes:
 *  - Atividade recente (50%): dias desde a última atividade registrada
 *  - Tempo na etapa     (30%): dias parado na etapa atual
 *  - Valor estimado     (20%): manual_total relativo (anchor de R$ 200k)
 *
 * Resultado: score 0-100 onde >= 65 = quente, 35-64 = morno, < 35 = frio.
 */

export type DealTemperature = "hot" | "warm" | "cold";

export interface DealTemperatureInput {
  /** Dias desde a última atividade registrada (null = nunca houve atividade). */
  daysSinceLastActivity: number | null;
  /** Dias parado na etapa atual. */
  daysInStage: number | null;
  /** Valor estimado / manual_total do negócio em BRL. */
  manualTotal: number | null;
  /** Status interno (usado para mascarar negócios fechados/perdidos). */
  internalStatus?: string | null;
}

export interface DealTemperatureResult {
  temperature: DealTemperature;
  /** Score 0-100 (maior = mais quente). */
  score: number;
  /** Label curto: "Quente", "Morno", "Frio". */
  label: string;
  /** Componente que mais penalizou (para tooltips). */
  topReason: string;
}

const TERMINAL_STATUSES = new Set([
  "contrato_fechado",
  "lost",
  "perdido",
  "archived",
]);

const VALUE_ANCHOR = 200_000; // R$ 200k = score de valor 100

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Sub-score 0-100 para dias desde última atividade (menor = melhor). */
function activityScore(days: number | null): number {
  if (days === null) return 10; // nunca houve atividade — quase frio
  if (days <= 2) return 100;
  if (days <= 7) return 80;
  if (days <= 14) return 55;
  if (days <= 21) return 30;
  if (days <= 30) return 15;
  return 5;
}

/** Sub-score 0-100 para dias na etapa (menor = melhor). */
function stageScore(days: number | null): number {
  if (days === null) return 60;
  if (days <= 3) return 100;
  if (days <= 7) return 85;
  if (days <= 14) return 60;
  if (days <= 21) return 40;
  if (days <= 30) return 25;
  return 10;
}

/** Sub-score 0-100 para valor (maior = melhor). */
function valueScore(total: number | null): number {
  if (!total || total <= 0) return 40; // sem valor = neutro
  return clamp(Math.round((total / VALUE_ANCHOR) * 100), 10, 100);
}

export function computeDealTemperature(input: DealTemperatureInput): DealTemperatureResult {
  // Negócios fechados/perdidos não têm temperatura útil
  if (input.internalStatus && TERMINAL_STATUSES.has(input.internalStatus)) {
    return {
      temperature: "cold",
      score: 0,
      label: "Encerrado",
      topReason: "Negócio finalizado",
    };
  }

  const a = activityScore(input.daysSinceLastActivity);
  const s = stageScore(input.daysInStage);
  const v = valueScore(input.manualTotal);

  // Composição ponderada
  const score = Math.round(a * 0.5 + s * 0.3 + v * 0.2);

  let temperature: DealTemperature;
  let label: string;
  if (score >= 65) {
    temperature = "hot";
    label = "Quente";
  } else if (score >= 35) {
    temperature = "warm";
    label = "Morno";
  } else {
    temperature = "cold";
    label = "Frio";
  }

  // Identifica o componente que mais penalizou
  const components = [
    { key: "activity", weight: a * 0.5, raw: a, label: "Sem atividade recente" },
    { key: "stage", weight: s * 0.3, raw: s, label: "Parado há muito tempo" },
    { key: "value", weight: v * 0.2, raw: v, label: "Valor baixo" },
  ];
  const worst = components.reduce((min, c) => (c.raw < min.raw ? c : min), components[0]);
  const topReason = worst.raw >= 70 ? "Tudo em ordem" : worst.label;

  return { temperature, score, label, topReason };
}

// ─── Sugestão de próxima ação ────────────────────────────────────────────

export interface NextActionInput {
  internalStatus: string;
  daysSinceLastActivity: number | null;
  daysInStage: number | null;
  hasScheduledActivity: boolean;
}

export interface NextActionSuggestion {
  /** Texto curto exibido no card. Ex.: "Ligar — 5d sem contato". */
  label: string;
  /** Tipo sugerido para pré-preencher dialog de nova atividade. */
  type: "call" | "followup" | "meeting" | "task" | "email";
  /** Urgência visual: 'high' destaca em destructive, 'medium' em warning. */
  urgency: "high" | "medium" | "low" | "none";
}

/**
 * Sugere a próxima ação baseada no estado do negócio.
 * Retorna `null` quando tudo está em dia ou o negócio está finalizado.
 */
export function suggestNextAction(input: NextActionInput): NextActionSuggestion | null {
  if (TERMINAL_STATUSES.has(input.internalStatus)) return null;

  // Já tem algo agendado: não sugerir nada novo
  if (input.hasScheduledActivity) return null;

  const since = input.daysSinceLastActivity;
  const stage = input.daysInStage ?? 0;

  // Sem nenhuma atividade
  if (since === null) {
    if (input.internalStatus === "mql" || input.internalStatus === "qualificacao") {
      return { label: "Qualificar lead", type: "call", urgency: "high" };
    }
    if (input.internalStatus === "lead" || input.internalStatus === "validacao_briefing") {
      return { label: "Iniciar contato", type: "call", urgency: "high" };
    }
    // Sem atividade em outros status: não sugerir nada (evita ruído no card).
    return null;
  }

  // Atividade muito antiga
  if (since >= 14) {
    return { label: `Ligar — ${since}d sem contato`, type: "call", urgency: "high" };
  }
  if (since >= 7) {
    return { label: `Follow-up — ${since}d`, type: "followup", urgency: "medium" };
  }

  // Parado na etapa
  if (stage >= 21) {
    return { label: "Destravar etapa", type: "call", urgency: "high" };
  }
  if (stage >= 14) {
    return { label: "Acelerar negócio", type: "followup", urgency: "medium" };
  }

  // Sugestões por etapa específica
  if (input.internalStatus === "sent_to_client" && since >= 3) {
    return { label: "Confirmar leitura", type: "followup", urgency: "medium" };
  }
  if (input.internalStatus === "minuta_solicitada" && since >= 2) {
    return { label: "Acompanhar minuta", type: "followup", urgency: "medium" };
  }

  return null;
}
