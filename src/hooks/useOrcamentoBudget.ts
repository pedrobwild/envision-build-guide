import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { BudgetSummary, BudgetMeta, ScopeCategory, ScopeItem } from "@/lib/orcamento-types";
import { mockBudget } from "@/lib/orcamento-mock-data";
import { format, addDays } from "date-fns";
import { PUBLIC_BUDGET_SELECT, PUBLIC_SECTION_SELECT, PUBLIC_ITEM_SELECT } from "@/lib/public-columns";

async function fetchOrcamentoBudget(projectId: string): Promise<BudgetSummary> {
  // Fetch budget — public-safe columns only
  const { data: budget, error: budgetError } = await supabase
    .from("budgets")
    .select(PUBLIC_BUDGET_SELECT)
    .eq("id", projectId)
    .single() as { data: any; error: any };

  if (budgetError) throw new Error(`Erro ao carregar orçamento: ${budgetError.message}`);
  if (!budget) throw new Error("Orçamento não encontrado");

  // Fetch sections ordered — public-safe columns only
  const { data: sections, error: sectionsError } = await supabase
    .from("sections")
    .select(PUBLIC_SECTION_SELECT)
    .eq("budget_id", projectId)
    .order("order_index", { ascending: true }) as { data: any[]; error: any };

  if (sectionsError) throw new Error(`Erro ao carregar seções: ${sectionsError.message}`);

  // Fetch all items for these sections
  const sectionIds = (sections ?? []).map((s) => s.id);
  let items: any[] = [];
  if (sectionIds.length > 0) {
    const { data: itemsData, error: itemsError } = await supabase
      .from("items")
      .select("*")
      .in("section_id", sectionIds)
      .order("order_index", { ascending: true });

    if (itemsError) throw new Error(`Erro ao carregar itens: ${itemsError.message}`);
    items = itemsData ?? [];
  }

  // Map to BudgetMeta
  const validUntilDate = budget.date && budget.validity_days
    ? format(addDays(new Date(budget.date), budget.validity_days), "yyyy-MM-dd")
    : budget.date ?? "";

  const meta: BudgetMeta = {
    projectId: budget.id,
    clientName: budget.client_name,
    projectName: budget.project_name,
    area: budget.metragem ?? "—",
    version: budget.versao ?? "v1",
    validUntil: validUntilDate,
    architect: budget.consultora_comercial ?? "—",
    engineer: "—",
  };

  // Map sections + items to ScopeCategory[]
  const scope: ScopeCategory[] = (sections ?? []).map((section) => {
    const sectionItems = items.filter((i) => i.section_id === section.id);
    const scopeItems: ScopeItem[] = sectionItems.map((item) => ({
      title: item.title || "Item",
      summary: item.description || "",
      bullets: Array.isArray(item.included_rooms)
        ? (item.included_rooms as string[]).length > 0
          ? (item.included_rooms as string[])
          : [item.unit ? `${item.qty ?? ""} ${item.unit}`.trim() : "Incluso"]
        : [item.description || "Incluso"],
    }));

    // If section has included_bullets, use those as items too
    if (scopeItems.length === 0 && section.included_bullets) {
      const bullets = section.included_bullets as string[];
      if (bullets.length > 0) {
        scopeItems.push({
          title: section.subtitle || section.title,
          summary: section.notes || "",
          bullets,
        });
      }
    }

    return {
      id: section.id,
      title: section.title || "Seção",
      items: scopeItems,
    };
  }).filter((cat) => cat.items.length > 0);

  // Static content stays from mock (services, journey, portalTabs, included)
  return {
    meta,
    included: mockBudget.included,
    services: mockBudget.services,
    journey: mockBudget.journey,
    scope: scope.length > 0 ? scope : mockBudget.scope,
    portalTabs: mockBudget.portalTabs,
  };
}

export function useOrcamentoBudget(projectId: string | undefined) {
  return useQuery({
    queryKey: ["orcamento-budget", projectId],
    queryFn: () => fetchOrcamentoBudget(projectId!),
    enabled: !!projectId,
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });
}
