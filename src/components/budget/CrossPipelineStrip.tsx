import { Briefcase, Target, Calendar, ExternalLink, User } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  COMMERCIAL_STAGES,
  deriveCommercialStage,
  type CommercialStage,
} from "@/lib/pipeline-stages";
import { formatBRL } from "@/lib/formatBRL";

interface CrossPipelineStripProps {
  internalStatus: string;
  pipelineStage: string | null;
  winProbability: number | null;
  expectedCloseAt: string | null;
  totalDisplay: number;
  commercialOwnerName: string;
  onOpenComercial: () => void;
}

/**
 * Faixa fina exibida no topo do detalhe do orçamento que mostra o
 * contexto do negócio no Pipeline Comercial — sem alterar dados.
 *
 * Objetivo: dar ao orçamentista visibilidade da etapa comercial atual
 * e atalho para o Kanban do Comercial filtrado neste negócio.
 */
export function CrossPipelineStrip({
  internalStatus,
  pipelineStage,
  winProbability,
  expectedCloseAt,
  totalDisplay,
  commercialOwnerName,
  onOpenComercial,
}: CrossPipelineStripProps) {
  // Confiamos primeiro no pipeline_stage do banco; cai no derivador se ausente.
  const stage: CommercialStage =
    (pipelineStage as CommercialStage) in COMMERCIAL_STAGES
      ? (pipelineStage as CommercialStage)
      : deriveCommercialStage(internalStatus);

  const stageMeta = COMMERCIAL_STAGES[stage];
  const expectedLabel = expectedCloseAt
    ? format(new Date(expectedCloseAt), "dd MMM yyyy", { locale: ptBR })
    : null;

  return (
    <div className="border-b border-border bg-muted/20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 flex items-center gap-2 sm:gap-3 text-xs font-body overflow-x-auto">
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 shrink-0">
          <Briefcase className="h-3 w-3" />
          Comercial
        </span>

        <span
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-md ring-1 ring-border/40 font-medium shrink-0",
            stageMeta.color,
          )}
          title={`Etapa atual no Pipeline Comercial: ${stageMeta.label}`}
        >
          {stageMeta.icon} {stageMeta.label}
        </span>

        {typeof winProbability === "number" && (
          <span
            className="inline-flex items-center gap-1 text-muted-foreground shrink-0"
            title="Probabilidade de fechamento"
          >
            <Target className="h-3 w-3" />
            <span className="font-semibold text-foreground">{winProbability}%</span>
          </span>
        )}

        {totalDisplay > 0 && (
          <span
            className="inline-flex items-center gap-1 text-muted-foreground shrink-0 font-mono"
            title="Valor potencial do negócio"
          >
            <span className="font-semibold text-foreground">{formatBRL(totalDisplay)}</span>
          </span>
        )}

        {expectedLabel && (
          <span
            className="inline-flex items-center gap-1 text-muted-foreground shrink-0"
            title="Data prevista de fechamento"
          >
            <Calendar className="h-3 w-3" />
            {expectedLabel}
          </span>
        )}

        {commercialOwnerName && commercialOwnerName !== "—" && (
          <span
            className="inline-flex items-center gap-1 text-muted-foreground shrink-0 truncate min-w-0"
            title="Responsável comercial"
          >
            <User className="h-3 w-3" />
            <span className="truncate">{commercialOwnerName}</span>
          </span>
        )}

        <button
          type="button"
          onClick={onOpenComercial}
          className="ml-auto inline-flex items-center gap-1 text-primary hover:text-primary/80 font-medium shrink-0 transition-colors"
        >
          Ver no comercial
          <ExternalLink className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
