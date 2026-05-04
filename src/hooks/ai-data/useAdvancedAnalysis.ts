/**
 * Hook que integra:
 *  - cálculo determinístico (analyze) sobre Dataset
 *  - relatório de qualidade (analyzeQuality)
 *  - chamada opcional à edge function ai-data-analyst para interpretação
 *
 * A IA NUNCA recebe o dataset cru — só o AnalysisResult já calculado +
 * metadata. Isso garante que números nunca são inventados.
 *
 * Privacidade: se `containsPii(dataset)` retornar true, a interpretação
 * fica desabilitada por default; caller deve explicitamente passar
 * `allowInterpretWithPii: true` (idealmente após confirmação do usuário)
 * ou enviar o dataset já redatado.
 */

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { runAnalysis } from "@/lib/data-analysis/worker";
import { containsPii } from "@/lib/data-analysis-security/pii";
import {
  checkDatasetSize,
  truncateLongStrings,
} from "@/lib/data-analysis-security/payload-limits";
import { AiInterpretationSchema } from "@/components/ai-analysis/schemas";
import type {
  AdvancedInsight,
  AiInterpretation,
  AnalysisResult,
  Dataset,
  DataQualityReport,
} from "@/components/ai-analysis/types";

interface Params {
  dataset: Dataset | null;
  question?: string;
  /** se true, calcula forecast quando viável. */
  enableForecast?: boolean;
  /** se true, ignora aviso de PII e envia para o LLM. Default false. */
  allowInterpretWithPii?: boolean;
  /** se true, dispara chamada à edge function. Default false (offline-first). */
  requestAiInterpretation?: boolean;
}

interface UseAdvancedAnalysisResult {
  analysis: AnalysisResult | null;
  quality: DataQualityReport | null;
  interpretation: AiInterpretation | null;
  loading: boolean;
  interpretationLoading: boolean;
  error: string | null;
  /** Se true, há PII no dataset; interpretação por LLM bloqueada por default. */
  piiBlocked: boolean;
  refresh: () => void;
  /** "worker" | "main" | null — diagnóstico de onde a análise rodou. */
  ranIn: "worker" | "main" | null;
}

export function useAdvancedAnalysis(params: Params): UseAdvancedAnalysisResult {
  const {
    dataset,
    question,
    enableForecast,
    allowInterpretWithPii = false,
    requestAiInterpretation = false,
  } = params;
  const [tick, setTick] = useState(0);

  // 1) Tamanho — checagem síncrona antes de enfileirar pro worker
  const sizeError = useMemo<string | null>(() => {
    if (!dataset) return null;
    const c = checkDatasetSize(dataset);
    return c.ok ? null : c.reason ?? "Dataset acima do limite";
  }, [dataset]);

  // 2) Análise pelo worker (ou síncrono pra datasets pequenos / SSR)
  const analysisQ = useQuery({
    queryKey: [
      "data-analysis",
      "compute",
      dataset?.id ?? null,
      dataset?.generatedAt ?? null,
      question ?? "",
      enableForecast ?? false,
      tick,
    ],
    enabled: !!dataset && !sizeError,
    staleTime: 30_000,
    queryFn: async () => {
      if (!dataset) throw new Error("dataset ausente");
      return runAnalysis(dataset, { question, enableForecast });
    },
  });

  const computed = useMemo(
    () => ({
      analysis: (analysisQ.data?.analysis ?? null) as AnalysisResult | null,
      quality: (analysisQ.data?.quality ?? null) as DataQualityReport | null,
      error:
        sizeError ??
        (analysisQ.error instanceof Error
          ? analysisQ.error.message
          : analysisQ.error
          ? String(analysisQ.error)
          : null),
      ranIn: analysisQ.data?.ranIn ?? null,
    }),
    [analysisQ.data, analysisQ.error, sizeError],
  );

  // 2) PII gate
  const piiBlocked = useMemo(() => {
    if (!dataset) return false;
    if (allowInterpretWithPii) return false;
    return containsPii(dataset).found;
  }, [dataset, allowInterpretWithPii]);

  // 3) chamada à edge (opcional)
  const interpretQ = useQuery({
    queryKey: [
      "ai-data-analyst",
      dataset?.id ?? null,
      computed.analysis?.generatedAt ?? null,
      question ?? "",
      piiBlocked,
    ],
    enabled: !!(
      requestAiInterpretation &&
      computed.analysis &&
      dataset &&
      !piiBlocked
    ),
    staleTime: 60_000,
    queryFn: async (): Promise<AiInterpretation> => {
      const ds = truncateLongStrings(dataset!);
      const insights: AdvancedInsight[] = computed.analysis!.insights;
      const payload = {
        datasetMeta: {
          id: ds.dataset.id,
          name: ds.dataset.name,
          rowCount: ds.dataset.rows.length,
          columnCount: ds.dataset.columns.length,
        },
        question,
        result: {
          confidence: computed.analysis!.confidence,
          insights: insights.map((i) => ({
            id: i.id,
            title: i.title,
            description: i.description,
            nature: i.nature,
            confidence: i.confidence,
            severity: i.severity,
            evidence: i.evidence,
            provenance: i.provenance,
          })),
          qualityIssues: (computed.quality?.issues ?? []).map((q) => ({
            kind: q.kind,
            severity: q.severity,
            message: q.message,
          })),
          limitations: computed.analysis!.limitations,
        },
      };
      const { data, error } = await supabase.functions.invoke("ai-data-analyst", {
        body: payload,
      });
      if (error) throw error;
      const parsed = AiInterpretationSchema.safeParse(
        (data as { interpretation: unknown })?.interpretation,
      );
      if (!parsed.success) {
        throw new Error("Resposta da IA fora do schema esperado.");
      }
      return parsed.data;
    },
    retry: 1,
  });

  // ressincroniza quando edge termina
  useEffect(() => {
    if (!interpretQ.isLoading) setTick((t) => t);
  }, [interpretQ.isLoading]);

  return {
    analysis: computed.analysis,
    quality: computed.quality,
    interpretation: interpretQ.data ?? null,
    loading: analysisQ.isLoading,
    interpretationLoading: interpretQ.isLoading,
    error: computed.error,
    piiBlocked,
    refresh: () => setTick((t) => t + 1),
    /** "worker" | "main" | null — diagnóstico de onde rodou. */
    ranIn: computed.ranIn,
  };
}
