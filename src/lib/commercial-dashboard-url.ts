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

export const STAGE_TO_FILTER: Record<string, { status?: string; due?: DueFilter }> = {
  action_needed: { status: "entregue" },
  solicitado: { status: "solicitado" },
  em_elaboracao: { status: "em_elaboracao" },
  revisao_solicitada: { status: "revisao_solicitada" },
  enviado: { status: "enviado" },
  advanced: { status: "minuta" },
  overdue: { status: "all", due: "overdue" },
  closed: { status: "fechado" },
};

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
