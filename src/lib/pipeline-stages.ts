// Espelho frontend de `public.derive_pipeline_stage` (Postgres) e do
// fluxo de produção do orçamentista. Usado para exibir, no card de um
// pipeline, em que etapa o negócio está no OUTRO pipeline — sem mudar
// dados, apenas como visibilidade cruzada.

import type { InternalStatus } from "./role-constants";

// ── Pipeline Comercial (negócio) ─────────────────────────────────────
export type CommercialStage =
  | "lead"
  | "briefing"
  | "visita"
  | "proposta"
  | "negociacao"
  | "fechado"
  | "perdido";

export const COMMERCIAL_STAGES: Record<
  CommercialStage,
  { label: string; color: string; icon: string }
> = {
  lead:       { label: "Lead",       color: "bg-sky-100 text-sky-700",         icon: "👤" },
  briefing:   { label: "Briefing",   color: "bg-indigo-100 text-indigo-700",   icon: "📝" },
  visita:     { label: "Visita",     color: "bg-amber-100 text-amber-700",     icon: "📍" },
  proposta:   { label: "Proposta",   color: "bg-teal-100 text-teal-700",       icon: "📄" },
  negociacao: { label: "Negociação", color: "bg-violet-100 text-violet-700",   icon: "🤝" },
  fechado:    { label: "Fechado",    color: "bg-emerald-100 text-emerald-700", icon: "✅" },
  perdido:    { label: "Perdido",    color: "bg-gray-100 text-gray-600",       icon: "❌" },
};

export function deriveCommercialStage(internalStatus: string | null | undefined): CommercialStage {
  switch (internalStatus) {
    case "mql":
    case "lead":
    case "novo":
    case "requested":
    case "qualificacao":
      return "lead";
    case "triage":
    case "assigned":
    case "validacao_briefing":
    case "em_analise":
      return "briefing";
    case "in_progress":
    case "waiting_info":
    case "aguardando_info":
      return "visita";
    case "ready_for_review":
    case "em_revisao":
    case "revision_requested":
    case "delivered_to_sales":
    case "sent_to_client":
    case "published":
      return "proposta";
    case "minuta_solicitada":
      return "negociacao";
    case "contrato_fechado":
      return "fechado";
    case "lost":
    case "perdido":
    case "archived":
      return "perdido";
    default:
      return "lead";
  }
}

// ── Pipeline de Produção (orçamentista) ──────────────────────────────
// Agrupa internal_status em fases de produção legíveis para o time
// comercial entender em que pé está o orçamento.
export type ProductionStage =
  | "aguardando"
  | "em_producao"
  | "revisao"
  | "entregue"
  | "encerrado";

export const PRODUCTION_STAGES: Record<
  ProductionStage,
  { label: string; color: string; icon: string }
> = {
  aguardando:  { label: "Aguardando produção", color: "bg-slate-100 text-slate-700",   icon: "⏳" },
  em_producao: { label: "Em produção",         color: "bg-yellow-100 text-yellow-800", icon: "🔨" },
  revisao:     { label: "Em revisão",          color: "bg-orange-100 text-orange-800", icon: "📋" },
  entregue:    { label: "Entregue",            color: "bg-emerald-100 text-emerald-700", icon: "📤" },
  encerrado:   { label: "Encerrado",           color: "bg-gray-100 text-gray-600",     icon: "🔒" },
};

export function deriveProductionStage(internalStatus: string | null | undefined): ProductionStage {
  switch (internalStatus as InternalStatus) {
    case "novo":
    case "requested":
    case "triage":
    case "assigned":
      return "aguardando";
    case "in_progress":
    case "waiting_info":
    case "revision_requested":
      return "em_producao";
    case "ready_for_review":
      return "revisao";
    case "delivered_to_sales":
    case "sent_to_client":
    case "minuta_solicitada":
      return "entregue";
    case "contrato_fechado":
    case "lost":
    case "archived":
      return "encerrado";
    default:
      return "aguardando";
  }
}
