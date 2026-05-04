/**
 * Painel "Inteligência IA v2" — equivalente funcional ao AiAnalysisPanel
 * legado, mas operando sobre a camada `data-analysis` genérica:
 *
 *  budgets → adapter → Dataset → useAdvancedAnalysis → AdvancedAnalysisPanel
 *
 * Quando o usuário pede interpretação por IA, e há PII no dataset,
 * abre PiiConfirmDialog para escolher mascarar ou enviar cru.
 *
 * Esse componente é intencionalmente fino: sem regra estatística,
 * sem fetch direto. Apenas orquestração + decisão de privacidade.
 */

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BudgetWithSections } from "@/types/budget-common";
import { budgetsToDataset } from "@/lib/data-analysis/adapters/budgets";
import { redactDataset, containsPii } from "@/lib/data-analysis-security/pii";
import { useAdvancedAnalysis } from "@/hooks/ai-data/useAdvancedAnalysis";
import { AdvancedAnalysisPanel } from "./AdvancedAnalysisPanel";
import { PiiConfirmDialog } from "./PiiConfirmDialog";
import type { Dataset } from "./types";

interface Props {
  budgets: BudgetWithSections[];
  profiles?: Record<string, string>;
  range: { from: Date; to: Date };
  loading?: boolean;
}

export function AiAnalysisPanelV2({ budgets, profiles, range, loading }: Props) {
  // Snapshot Dataset memoizado — só re-cria quando entradas mudam
  const baseDataset: Dataset | null = useMemo(() => {
    if (!budgets || budgets.length === 0) return null;
    return budgetsToDataset(budgets, { profiles, range });
  }, [budgets, profiles, range]);

  // Estado local para fluxo de IA + PII
  const [datasetForAi, setDatasetForAi] = useState<Dataset | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [allowRaw, setAllowRaw] = useState(false);

  const sampleKinds = useMemo(
    () => (baseDataset ? containsPii(baseDataset).sampleKinds : []),
    [baseDataset],
  );

  // Hook principal — usa o dataset apropriado (cru, redatado, ou nenhum)
  const {
    analysis,
    quality,
    interpretation,
    loading: computing,
    interpretationLoading,
    error,
    piiBlocked,
  } = useAdvancedAnalysis({
    dataset: datasetForAi ?? baseDataset,
    requestAiInterpretation: !!datasetForAi,
    allowInterpretWithPii: allowRaw,
  });

  function handleAskAi() {
    if (!baseDataset) return;
    if (sampleKinds.length === 0) {
      // sem PII — pode mandar direto
      setDatasetForAi(baseDataset);
      return;
    }
    setConfirmOpen(true);
  }

  function handleMaskAndSend() {
    if (!baseDataset) return;
    const r = redactDataset(baseDataset);
    setAllowRaw(true);
    setDatasetForAi(r.dataset);
    setConfirmOpen(false);
  }

  function handleSendRaw() {
    if (!baseDataset) return;
    setAllowRaw(true);
    setDatasetForAi(baseDataset);
    setConfirmOpen(false);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Análise calculada localmente. A IA, quando solicitada, apenas{" "}
          <span className="font-medium text-foreground">interpreta</span> os números —
          nunca recalcula.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          onClick={handleAskAi}
          disabled={
            !baseDataset || computing || interpretationLoading || !!datasetForAi
          }
        >
          {interpretationLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {datasetForAi ? "Interpretação solicitada" : "Pedir interpretação da IA"}
        </Button>
      </div>

      {/* PII alert quando bloqueado e ainda não pediu IA */}
      {piiBlocked && !datasetForAi && sampleKinds.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/[0.05] p-3 text-[12px] text-amber-700 dark:text-amber-400">
          Detectamos dados sensíveis no dataset. A interpretação por IA fica
          desativada até você confirmar como deseja prosseguir.
        </div>
      )}

      <AdvancedAnalysisPanel
        analysis={analysis}
        quality={quality}
        interpretation={interpretation}
        loading={loading || computing}
        error={error}
      />

      <PiiConfirmDialog
        open={confirmOpen}
        detectedKinds={sampleKinds}
        onCancel={() => setConfirmOpen(false)}
        onMaskAndSend={handleMaskAndSend}
        onSendRaw={handleSendRaw}
      />
    </motion.div>
  );
}
