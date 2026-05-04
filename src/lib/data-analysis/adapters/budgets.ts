/**
 * Adapter: BudgetWithSections[] → Dataset.
 *
 * Achata o objeto rico em uma tabela linha-coluna analítica, calculando
 * o total já no flatten (usando o mesmo helper que o resto do app), de
 * forma que a camada genérica `data-analysis` possa rodar.
 *
 * Princípios:
 *  - Não modifica BudgetWithSections originais.
 *  - Não chama supabase.
 *  - Declara colunas com `kind`/`role` corretos para evitar inferência
 *    heurística (mais rápido + mais determinístico).
 */

import type {
  ColumnKind,
  ColumnRole,
  Dataset,
  DataColumn,
  DatasetRow,
} from "@/components/ai-analysis/types";
import type { BudgetWithSections } from "@/types/budget-common";
import { calculateSectionSubtotal } from "@/lib/supabase-helpers";

const COLUMN_DEFINITIONS: Array<{
  name: string;
  label: string;
  kind: ColumnKind;
  role: ColumnRole;
}> = [
  { name: "id", label: "ID", kind: "id", role: "identifier" },
  { name: "project_name", label: "Projeto", kind: "string", role: "dimension" },
  { name: "client_name", label: "Cliente", kind: "string", role: "dimension" },
  { name: "internal_status", label: "Status interno", kind: "categorical", role: "dimension" },
  { name: "pipeline_stage", label: "Etapa", kind: "categorical", role: "dimension" },
  { name: "lead_source", label: "Origem", kind: "categorical", role: "dimension" },
  { name: "city", label: "Cidade", kind: "categorical", role: "dimension" },
  { name: "bairro", label: "Bairro", kind: "categorical", role: "dimension" },
  { name: "property_type", label: "Tipo de imóvel", kind: "categorical", role: "dimension" },
  { name: "location_type", label: "Tipo de locação", kind: "categorical", role: "dimension" },
  { name: "priority", label: "Prioridade", kind: "categorical", role: "dimension" },
  { name: "owner_name", label: "Responsável", kind: "categorical", role: "dimension" },
  { name: "computed_total_brl", label: "Total computado", kind: "currency", role: "metric" },
  { name: "manual_total_brl", label: "Total manual", kind: "currency", role: "metric" },
  { name: "internal_cost_brl", label: "Custo interno", kind: "currency", role: "metric" },
  { name: "view_count", label: "Visualizações", kind: "integer", role: "metric" },
  { name: "is_addendum", label: "É aditivo", kind: "boolean", role: "dimension" },
  { name: "created_at", label: "Criado em", kind: "datetime", role: "time" },
  { name: "approved_at", label: "Aprovado em", kind: "datetime", role: "time" },
  { name: "closed_at", label: "Fechado em", kind: "datetime", role: "time" },
  { name: "due_at", label: "Prazo", kind: "datetime", role: "time" },
];

function totalOf(b: BudgetWithSections & { computed_total?: number | null }): number {
  if (typeof b.computed_total === "number" && Number.isFinite(b.computed_total)) {
    return b.computed_total;
  }
  if (typeof b.manual_total === "number" && Number.isFinite(b.manual_total) && b.manual_total > 0) {
    return b.manual_total;
  }
  const sectionsTotal = (b.sections ?? []).reduce(
    (acc, s) => acc + calculateSectionSubtotal(s),
    0,
  );
  const adj = (b.adjustments ?? []).reduce(
    (acc, a) => acc + (a.sign ?? 1) * Number(a.amount ?? 0),
    0,
  );
  return sectionsTotal + adj;
}

function distinctOf(values: readonly unknown[]): number {
  const set = new Set<string>();
  for (const v of values) {
    if (v === null || v === undefined) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    set.add(String(v));
  }
  return set.size;
}

export interface BudgetsDatasetOptions {
  id?: string;
  name?: string;
  description?: string;
  /** mapeamento opcional de owner_id → nome legível. */
  profiles?: Record<string, string>;
  /** filtros aplicados pelo caller (registrados como metadata). */
  range?: { from: Date; to: Date };
}

export function budgetsToDataset(
  budgets: readonly BudgetWithSections[],
  options: BudgetsDatasetOptions = {},
): Dataset {
  const profiles = options.profiles ?? {};
  const rows: DatasetRow[] = budgets.map((b) => {
    const computedTotal = totalOf(b);
    const ownerId =
      (b as { commercial_owner_id?: string | null }).commercial_owner_id ??
      (b as { estimator_owner_id?: string | null }).estimator_owner_id ??
      null;
    return {
      id: b.id,
      project_name: b.project_name ?? null,
      client_name: (b as { client_name?: string | null }).client_name ?? null,
      internal_status: b.internal_status ?? null,
      pipeline_stage: (b as { pipeline_stage?: string | null }).pipeline_stage ?? null,
      lead_source: (b as { lead_source?: string | null }).lead_source ?? null,
      city: (b as { city?: string | null }).city ?? null,
      bairro: (b as { bairro?: string | null }).bairro ?? null,
      property_type: (b as { property_type?: string | null }).property_type ?? null,
      location_type: (b as { location_type?: string | null }).location_type ?? null,
      priority: (b as { priority?: string | null }).priority ?? null,
      owner_name: ownerId ? profiles[ownerId] ?? null : null,
      computed_total_brl: computedTotal,
      manual_total_brl: typeof b.manual_total === "number" ? b.manual_total : null,
      internal_cost_brl: typeof b.internal_cost === "number" ? b.internal_cost : null,
      view_count: typeof (b as { view_count?: number | null }).view_count === "number"
        ? (b as { view_count?: number | null }).view_count
        : null,
      is_addendum: Boolean((b as { is_addendum?: boolean | null }).is_addendum),
      created_at: b.created_at ?? null,
      approved_at: (b as { approved_at?: string | null }).approved_at ?? null,
      closed_at: (b as { closed_at?: string | null }).closed_at ?? null,
      due_at: (b as { due_at?: string | null }).due_at ?? null,
    };
  });

  const columns: DataColumn[] = COLUMN_DEFINITIONS.map((def) => {
    const values = rows.map((r) => r[def.name]);
    const nonNullCount = values.filter(
      (v) => v !== null && v !== undefined && !(typeof v === "string" && v.trim() === ""),
    ).length;
    return {
      name: def.name,
      label: def.label,
      kind: def.kind,
      role: def.role,
      nonNullCount,
      nullCount: values.length - nonNullCount,
      distinctCount: distinctOf(values),
      declared: true,
    };
  });

  const id = options.id ?? `budgets-${budgets.length}`;
  const name =
    options.name ??
    `Orçamentos${
      options.range
        ? ` (${options.range.from.toISOString().slice(0, 10)} → ${options.range.to.toISOString().slice(0, 10)})`
        : ""
    }`;

  return {
    id,
    name,
    description:
      options.description ??
      "Snapshot achatado de orçamentos para análise estatística.",
    columns,
    rows,
    generatedAt: new Date().toISOString(),
    source: "table:budgets+helpers.calculateSectionSubtotal",
  };
}
