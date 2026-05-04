import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { BudgetSummary, BudgetMeta, ScopeCategory, ScopeItem } from "@/lib/orcamento-types";
import { mockBudget } from "@/lib/orcamento-mock-data";
import { format, addDays } from "date-fns";
import { PUBLIC_SECTION_SELECT, PUBLIC_ITEM_SELECT } from "@/lib/public-columns";

interface PublicBudgetRow {
  id: string;
  project_name: string;
  client_name: string;
  metragem: string | null;
  versao: string | null;
  date: string | null;
  validity_days: number | null;
  consultora_comercial: string | null;
  public_id: string | null;
  status: string | null;
}

interface PublicSectionRow {
  id: string;
  title: string;
  subtitle: string | null;
  notes: string | null;
  included_bullets: string[] | null;
}

interface PublicItemRow {
  id: string;
  section_id: string;
  title: string;
  description: string | null;
  qty: number | null;
  unit: string | null;
  included_rooms: string[] | null;
}

/**
 * Fetch a public budget by its short, shareable public_id.
 * Uses the SECURITY DEFINER RPC `get_public_budget`, which only returns
 * budgets in `published` or `minuta_solicitada` status — preventing
 * accidental disclosure of drafts via the public route.
 */
async function fetchOrcamentoBudget(publicId: string): Promise<BudgetSummary> {
  const { data: rpcData, error: rpcError } = await supabase.rpc("get_public_budget", {
    p_public_id: publicId,
  });

  if (rpcError) throw new Error(`Erro ao carregar orçamento: ${rpcError.message}`);
  if (!rpcData) throw new Error("Orçamento não encontrado");

  const budget = rpcData as unknown as PublicBudgetRow;
  if (!budget?.id) throw new Error("Orçamento não encontrado");

  // Fetch sections — RLS allows SELECT only when parent budget is published
  const { data: sectionsRaw, error: sectionsError } = await supabase
    .from("sections")
    .select(PUBLIC_SECTION_SELECT)
    .eq("budget_id", budget.id)
    .order("order_index", { ascending: true });

  if (sectionsError) throw new Error(`Erro ao carregar seções: ${sectionsError.message}`);
  const sections = (sectionsRaw ?? []) as unknown as PublicSectionRow[];

  // Fetch all items for these sections
  const sectionIds = sections.map((s) => s.id);
  let items: PublicItemRow[] = [];
  if (sectionIds.length > 0) {
    const { data: itemsData, error: itemsError } = await supabase
      .from("items")
      .select(PUBLIC_ITEM_SELECT)
      .in("section_id", sectionIds)
      .order("order_index", { ascending: true });

    if (itemsError) throw new Error(`Erro ao carregar itens: ${itemsError.message}`);
    items = (itemsData ?? []) as unknown as PublicItemRow[];
  }

  // Map to BudgetMeta
  const validUntilDate = budget.date && budget.validity_days
    ? format(addDays(new Date(budget.date), budget.validity_days), "yyyy-MM-dd")
    : budget.date ?? "";

  const meta: BudgetMeta = {
    projectId: budget.public_id ?? budget.id,
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

  // Static institutional content stays from the mock catalogue
  // (services, journey, portalTabs, included). Scope, however, must reflect
  // real data — never fall back to mock scope, which would mislead the client.
  return {
    meta,
    included: mockBudget.included,
    services: mockBudget.services,
    journey: mockBudget.journey,
    scope,
    portalTabs: mockBudget.portalTabs,
  };
}

export const ORCAMENTO_MAX_RETRIES = 3;

export function useOrcamentoBudget(publicId: string | undefined) {
  return useQuery({
    queryKey: ["orcamento-budget", publicId],
    queryFn: () => fetchOrcamentoBudget(publicId!),
    enabled: !!publicId,
    // Exponential backoff: 1s, 2s, 4s (capped at 8s)
    retry: ORCAMENTO_MAX_RETRIES,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    staleTime: 5 * 60 * 1000,
  });
}
