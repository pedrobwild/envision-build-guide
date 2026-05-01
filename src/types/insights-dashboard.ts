/**
 * Tipos compartilhados pelos componentes de `src/components/insights/*`.
 *
 * O `chartsData` que vem da edge function `elephant-insights` é
 * estruturalmente flexível (a função evolui mais rápido que os componentes
 * consumidores). Por isso os arrays usam `unknown[]` — os componentes
 * fazem narrowing localmente quando precisam ler campos específicos.
 *
 * Para arrays acessados por campos típicos (`leadScores[].score`,
 * `metrics.answerScores[].avg`) há tipos mais estreitos e exportados.
 */

export interface LeadScoreEntry {
  score: number;
  [key: string]: unknown;
}

export interface AnswerScoreEntry {
  avg: number;
  [key: string]: unknown;
}

export interface MetricsBlock {
  answerScores?: AnswerScoreEntry[];
  [key: string]: unknown;
}

/**
 * Forma agregada de `chartsData`. Todos os campos são opcionais — a edge
 * function pode adicionar/remover blocos sem quebrar consumidores que só
 * leem campos explícitos. Campos não mapeados vão pelo index signature.
 */
export interface InsightsDashboardData {
  personalityProfiles?: unknown[];
  objections?: unknown[];
  hiddenObjections?: unknown[];
  topQuestions?: unknown[];
  buyingSignals?: unknown[];
  closingArguments?: unknown[];
  buyerPersona?: unknown;
  sentimentSummary?: unknown;
  metrics?: MetricsBlock;
  leadScores?: LeadScoreEntry[];
  [key: string]: unknown;
}
