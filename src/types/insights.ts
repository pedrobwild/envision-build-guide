/**
 * Tipagens compartilhadas para resultados de insights (Elephan.IA).
 *
 * A tabela `elephant_insights_cache` ainda não está presente nos types
 * gerados pelo Supabase, então definimos aqui o contrato esperado.
 * Todos os campos opcionais usam `| null` ou `?` para que o consumidor
 * trate ausências de forma segura via fallback (`?? 0` / `|| "..."`).
 */

// O dashboard vem do Edge Function com formato dinâmico/evolutivo.
// Mantemos `any` para preservar o consumo flexível dos componentes
// sem forçar refactors profundos em campos opcionais aninhados.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type InsightChartsData = any;

/**
 * Linha bruta retornada por `elephant_insights_cache`.
 * Espelha o schema esperado, mas com campos opcionais para resiliência.
 */
export interface ElephantInsightsCacheRow {
  cache_key: string;
  consultant_name?: string | null;
  total_meetings?: number | null;
  total_duration_minutes?: number | null;
  positive_sentiment_pct?: number | null;
  latest_meeting?: string | null;
  charts_data?: InsightChartsData | null;
  updated_at?: string | null;
  created_at?: string | null;
}

/** Estrutura usada pelos componentes de UI após normalização. */
export interface ConsultorInsightData {
  consultantName: string;
  totalMeetings: number;
  totalDurationMinutes: number;
  positiveSentimentPct: number | null;
  latestMeeting: string | null;
  cached?: boolean;
  cacheAge?: number;
  dashboard?: InsightChartsData;
}

/**
 * Normaliza uma linha de cache em `ConsultorInsightData`,
 * aplicando defaults seguros em todos os campos opcionais.
 */
export function normalizeInsightsCache(
  row: ElephantInsightsCacheRow,
  extras?: { cached?: boolean; cacheAge?: number },
): ConsultorInsightData {
  return {
    consultantName: row.consultant_name?.trim() || "Consultor",
    totalMeetings: row.total_meetings ?? 0,
    totalDurationMinutes: row.total_duration_minutes ?? 0,
    positiveSentimentPct: row.positive_sentiment_pct ?? null,
    latestMeeting: row.latest_meeting ?? null,
    dashboard: row.charts_data ?? undefined,
    cached: extras?.cached,
    cacheAge: extras?.cacheAge,
  };
}
