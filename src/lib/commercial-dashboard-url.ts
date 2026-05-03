/**
 * URL ⇄ estado do CommercialDashboard.
 *
 * Extraído para um módulo puro para facilitar testes unitários e garantir
 * que cliques na Home Comercial (que apenas montam querystrings) sejam
 * resolvidos no mesmo formato esperado pelo dashboard, sem cair na
 * "primeira etapa" por engano.
 */

import type { DueFilter } from "@/components/commercial/KanbanBoard";

export type SortOption = "urgente" | "recente" | "prazo";
export type ViewMode = "list" | "kanban";
export type QueueFilter = "prontos" | "sem-vis" | "esfriando" | null;

export type ParsedFilters = {
  queueFilter: QueueFilter;
  statusFilter: string;
  dueFilter: DueFilter;
  sortBy: SortOption;
  viewMode: ViewMode;
  search: string;
  commercialFilter: string;
  pipelineFilter: string;
};

/**
 * Chaves válidas de PIPELINE_SECTIONS no CommercialDashboard. Mantida em
 * sincronia manualmente; se mudar lá, atualizar aqui (e os testes pegam).
 */
export const PIPELINE_SECTION_KEYS = [
  "mql",
  "qualificacao",
  "lead",
  "validacao_briefing",
  "solicitado",
  "em_elaboracao",
  "revisao_solicitada",
  "entregue",
  "em_revisao",
  "enviado",
  "minuta",
  "fechado",
  "perdido",
] as const;

/**
 * Stages agregados usados na Home Comercial e em outros dashboards de
 * cabeçalho. Cada um mapeia para 1 combinação concreta de
 * (statusFilter, dueFilter) entendida pelo CommercialDashboard.
 */
export type CommercialWorkflowStage =
  | "action_needed"
  | "overdue"
  | "em_elaboracao"
  | "revisao_solicitada"
  | "enviado"
  | "solicitado"
  | "advanced"
  | "closed";

export const STAGE_TO_FILTER: Record<CommercialWorkflowStage, { status?: string; due?: DueFilter }> = {
  action_needed: { status: "entregue" },
  solicitado: { status: "solicitado" },
  em_elaboracao: { status: "em_elaboracao" },
  revisao_solicitada: { status: "revisao_solicitada" },
  enviado: { status: "enviado" },
  advanced: { status: "minuta" },
  overdue: { status: "all", due: "overdue" },
  closed: { status: "fechado" },
};

export const COMMERCIAL_DASHBOARD_PATH = "/admin/comercial";

/** True se a chave é um stage agregado conhecido. */
export function isCommercialWorkflowStage(v: string): v is CommercialWorkflowStage {
  return v in STAGE_TO_FILTER;
}

/** True se a chave é um status válido do pipeline (ou "all"). */
export function isPipelineStatus(v: string): boolean {
  return v === "all" || PIPELINE_SET.has(v);
}

/** True se a chave de fila é válida. */
export function isQueueFilter(v: string): v is NonNullable<QueueFilter> {
  return v === "prontos" || v === "sem-vis" || v === "esfriando";
}

/* ───────────── Builders de URL — única fonte de verdade ───────────── */

export function buildDashboardUrlForStage(stage: CommercialWorkflowStage): string {
  return `${COMMERCIAL_DASHBOARD_PATH}?stage=${stage}`;
}

export function buildDashboardUrlForStatus(status: string): string {
  if (!isPipelineStatus(status) || status === "all") return COMMERCIAL_DASHBOARD_PATH;
  return `${COMMERCIAL_DASHBOARD_PATH}?status=${status}`;
}

export function buildDashboardUrlForQueue(queue: NonNullable<QueueFilter>): string {
  return `${COMMERCIAL_DASHBOARD_PATH}?fila=${queue}`;
}


const PIPELINE_SET = new Set<string>(PIPELINE_SECTION_KEYS);

export function parseDashboardSearch(searchStr: string): ParsedFilters {
  const p = new URLSearchParams(searchStr);

  const filaRaw = p.get("fila");
  const queueFilter: QueueFilter =
    filaRaw === "prontos" || filaRaw === "sem-vis" || filaRaw === "esfriando" ? filaRaw : null;

  const stage = p.get("stage");
  const stageMap = stage ? STAGE_TO_FILTER[stage] : undefined;

  let status = p.get("status") ?? stageMap?.status ?? "all";
  if (status !== "all" && !PIPELINE_SET.has(status)) status = "all";

  const dueRaw = (p.get("due") ?? stageMap?.due ?? "all") as DueFilter;
  const due: DueFilter =
    dueRaw === "overdue" || dueRaw === "due_soon" || dueRaw === "all" ? dueRaw : "all";

  const sortRaw = p.get("sort");
  const sortBy: SortOption =
    sortRaw === "urgente" || sortRaw === "recente" || sortRaw === "prazo" ? sortRaw : "recente";

  const viewRaw = p.get("view");
  const viewMode: ViewMode =
    queueFilter || stage
      ? "list"
      : viewRaw === "list" || viewRaw === "kanban"
      ? viewRaw
      : "kanban";

  return {
    queueFilter,
    statusFilter: queueFilter ? "all" : status,
    dueFilter: queueFilter ? "all" : due,
    sortBy,
    viewMode,
    search: p.get("q") ?? "",
    commercialFilter: p.get("com") ?? "all",
    pipelineFilter: p.get("pipe") ?? "all",
  };
}

export function serializeDashboardFilters(f: Omit<ParsedFilters, never>): string {
  const p = new URLSearchParams();
  if (f.queueFilter) {
    p.set("fila", f.queueFilter);
  } else {
    if (f.statusFilter && f.statusFilter !== "all") p.set("status", f.statusFilter);
    if (f.dueFilter && f.dueFilter !== "all") p.set("due", f.dueFilter);
  }
  if (f.search) p.set("q", f.search);
  if (f.commercialFilter && f.commercialFilter !== "all") p.set("com", f.commercialFilter);
  if (f.pipelineFilter && f.pipelineFilter !== "all") p.set("pipe", f.pipelineFilter);
  if (f.sortBy && f.sortBy !== "recente") p.set("sort", f.sortBy);
  if (f.viewMode && f.viewMode !== "kanban") p.set("view", f.viewMode);
  return p.toString();
}
