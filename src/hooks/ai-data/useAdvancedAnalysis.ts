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
import { analyze } from "@/lib/data-analysis";
import { analyzeQuality } from "@/lib/data-quality";
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

  // 1) cálculo síncrono determinístico
  const computed = useMemo(() => {
    if (!dataset) return { analysis: null, quality: null, error: null as string | null };
    const sizeCheck = checkDatasetSize(dataset);
    if (!sizeCheck.ok) {
      return { analysis: null, quality: null, error: sizeCheck.reason ?? "Dataset acima do limite" };
    }
    try {
      const analysis = analyze({
        dataset,
        question,
        options: { enableForecast },
      });
      const quality = analyzeQuality(dataset);
      return { analysis, quality, error: null };
    } catch (e) {
      return {
        analysis: null,
        quality: null,
        error: e instanceof Error ? e.message : "Falha no cálculo",
      };
    }
    // tick força recompute manual via refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset, question, enableForecast, tick]);

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
    loading: false, // cálculo síncrono — não há loading
    interpretationLoading: interpretQ.isLoading,
    error: computed.error,
    piiBlocked,
    refresh: () => setTick((t) => t + 1),
  };
}
