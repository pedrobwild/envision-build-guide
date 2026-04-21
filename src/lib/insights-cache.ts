/**
 * Helpers tipados para acesso à tabela `elephant_insights_cache`.
 *
 * Centraliza:
 *  - Validação e geração de cache keys (`user_<uuid>`)
 *  - Leitura tipada (single/list) com normalização
 *  - Escrita (upsert) com payload validado
 *
 * Como a tabela ainda não está nos types gerados pelo Supabase
 * (`Database`), encapsulamos o cast `as any` em UM único lugar e
 * expomos APIs com tipos próprios (`ElephantInsightsCacheRow`).
 *
 * Componentes NÃO devem mais usar `(supabase as any).from("elephant_insights_cache")`.
 */

import { supabase } from "@/integrations/supabase/client";
import {
  type ElephantInsightsCacheRow,
  type ConsultorInsightData,
  type InsightChartsData,
  normalizeInsightsCache,
} from "@/types/insights";

const TABLE = "elephant_insights_cache";
const USER_KEY_PREFIX = "user_";
const USER_KEY_REGEX = /^user_[A-Za-z0-9_-]{1,128}$/;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

/** Constrói uma cache key padronizada para um consultor. */
export function buildUserCacheKey(userId: string): string {
  const id = userId?.trim();
  if (!id) {
    throw new Error("buildUserCacheKey: userId vazio");
  }
  const key = `${USER_KEY_PREFIX}${id}`;
  if (!isValidCacheKey(key)) {
    throw new Error(`buildUserCacheKey: cache key inválida (${key})`);
  }
  return key;
}

/** Valida se a cache key segue o formato esperado (`user_<id>`). */
export function isValidCacheKey(key: string): boolean {
  return typeof key === "string" && USER_KEY_REGEX.test(key);
}

/** Calcula a idade do cache em minutos. */
export function getCacheAgeMinutes(updatedAt: string | null | undefined): number {
  if (!updatedAt) return 0;
  const ts = new Date(updatedAt).getTime();
  if (Number.isNaN(ts)) return 0;
  return Math.max(0, Math.round((Date.now() - ts) / 60000));
}

/** Verifica se uma row de cache parece válida (tem o mínimo esperado). */
export function isValidCacheRow(row: unknown): row is ElephantInsightsCacheRow {
  if (!row || typeof row !== "object") return false;
  const r = row as Record<string, unknown>;
  return typeof r.cache_key === "string" && r.cache_key.length > 0;
}

/**
 * Busca uma única entrada de cache por chave já formatada.
 * Retorna `null` se não existir, lançar erro DB ou row inválida.
 */
export async function fetchCacheByKey(
  cacheKey: string,
): Promise<ElephantInsightsCacheRow | null> {
  if (!isValidCacheKey(cacheKey)) return null;

  const { data, error } = await (supabase as AnyClient)
    .from(TABLE)
    .select("*")
    .eq("cache_key", cacheKey)
    .maybeSingle();

  if (error || !isValidCacheRow(data)) return null;
  return data;
}

/** Açúcar: busca cache por `userId` e já normaliza para UI. */
export async function fetchUserInsight(
  userId: string,
): Promise<ConsultorInsightData | null> {
  let key: string;
  try {
    key = buildUserCacheKey(userId);
  } catch {
    return null;
  }

  const row = await fetchCacheByKey(key);
  if (!row) return null;

  return normalizeInsightsCache(row, {
    cached: true,
    cacheAge: getCacheAgeMinutes(row.updated_at),
  });
}

/**
 * Lista todas as entradas que combinem com um padrão `LIKE` (ex: `user_%`).
 * Filtra rows inválidas antes de devolver.
 */
export async function listCacheEntries(
  pattern = `${USER_KEY_PREFIX}%`,
): Promise<ElephantInsightsCacheRow[]> {
  const { data, error } = await (supabase as AnyClient)
    .from(TABLE)
    .select("*")
    .like("cache_key", pattern);

  if (error || !Array.isArray(data)) return [];
  return data.filter(isValidCacheRow);
}

/** Payload aceito pelo `upsertCacheEntry`. Espelha o schema mas com defaults. */
export interface InsightsCachePayload {
  cacheKey: string;
  consultantName?: string | null;
  totalMeetings?: number | null;
  totalDurationMinutes?: number | null;
  positiveSentimentPct?: number | null;
  latestMeeting?: string | null;
  chartsData?: InsightChartsData | null;
}

/**
 * Upsert seguro: valida a chave, normaliza campos numéricos e
 * grava `updated_at = now()` automaticamente.
 */
export async function upsertCacheEntry(
  payload: InsightsCachePayload,
): Promise<{ success: boolean; error?: string }> {
  if (!isValidCacheKey(payload.cacheKey)) {
    return { success: false, error: `cache_key inválida: ${payload.cacheKey}` };
  }

  const row: Record<string, unknown> = {
    cache_key: payload.cacheKey,
    consultant_name: payload.consultantName?.trim() || null,
    total_meetings: clampNonNegativeInt(payload.totalMeetings),
    total_duration_minutes: clampNonNegativeInt(payload.totalDurationMinutes),
    positive_sentiment_pct: clampPercent(payload.positiveSentimentPct),
    latest_meeting: payload.latestMeeting ?? null,
    charts_data: payload.chartsData ?? null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await (supabase as AnyClient)
    .from(TABLE)
    .upsert(row, { onConflict: "cache_key" });

  if (error) return { success: false, error: error.message };
  return { success: true };
}

function clampNonNegativeInt(value: number | null | undefined): number {
  if (value == null || Number.isNaN(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function clampPercent(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(value)) return null;
  return Math.min(100, Math.max(0, value));
}
