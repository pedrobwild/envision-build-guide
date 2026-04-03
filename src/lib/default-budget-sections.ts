import { supabase } from "@/integrations/supabase/client";

/**
 * Tax rate applied to "Impostos e despesas administrativas"
 */
export const TAX_RATE = 0.06;

/**
 * Canonical title used to identify the tax item for auto-calculation.
 */
export const TAX_ITEM_TITLE = "Impostos e despesas administrativas";

/**
 * Canonical title used to identify the tax section.
 */
export const TAX_SECTION_TITLE = "Administração e gestão de obras";

interface DefaultItem {
  title: string;
  description?: string;
  order_index: number;
}

interface DefaultSection {
  title: string;
  order_index: number;
  items: DefaultItem[];
}

const DEFAULT_SECTIONS: DefaultSection[] = [
  {
    title: "Arquitetura e documentações",
    order_index: 0,
    items: [
      { title: "Projeto de arquitetura de interiores", order_index: 0 },
      { title: "Projeto executivo detalhado", order_index: 1 },
      { title: "Projeto elétrico e luminotécnico", order_index: 2 },
      { title: "Projeto hidráulico", order_index: 3 },
      { title: "Projeto de ar-condicionado", order_index: 4 },
      { title: "Documentação e aprovações", order_index: 5 },
    ],
  },
  {
    title: TAX_SECTION_TITLE,
    order_index: 1,
    items: [
      { title: "Coordenação e gestão de obra", order_index: 0 },
      { title: "Engenheiro responsável", order_index: 1 },
      { title: "Logística e transporte", order_index: 2 },
      {
        title: TAX_ITEM_TITLE,
        description: "Calculado automaticamente (6% do total do orçamento)",
        order_index: 3,
      },
    ],
  },
];

/**
 * Seed default sections and items for a newly created budget.
 * Returns the created sections (with nested items) for immediate use.
 */
export async function seedDefaultSections(budgetId: string) {
  for (const sectionDef of DEFAULT_SECTIONS) {
    const { data: section } = await supabase
      .from("sections")
      .insert({
        budget_id: budgetId,
        title: sectionDef.title,
        order_index: sectionDef.order_index,
      })
      .select("id")
      .single();

    if (!section) continue;

    for (const itemDef of sectionDef.items) {
      await supabase.from("items").insert({
        section_id: section.id,
        title: itemDef.title,
        description: itemDef.description || null,
        order_index: itemDef.order_index,
      });
    }
  }
}
