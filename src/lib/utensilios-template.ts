import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";
const STORAGE_BASE = `${SUPABASE_URL}/storage/v1/object/public/budget-assets`;

/**
 * Template data for the "Utensílios para o Hóspede" section.
 * Cloned from budget b1c60fcdbab1 (section bede5e56-...).
 */
const TEMPLATE_SECTION = {
  title: "Utensílios para o Hóspede",
  section_price: 1840,
  is_optional: false,
};

const TEMPLATE_ITEMS = [
  { title: "Kit de Panelas Indução – Alta Performance", description: "Kit de Panelas Indução – Alta Performance", internal_total: 1840, order_index: 0 },
  { title: "Utensílios Soft Touch (Kit 19 peças em Silicone)", order_index: 1 },
  { title: "Trio de Tábuas Gourmet (3 un)", order_index: 2 },
  { title: "Kit Trinchante Chef (Facas + Garfo)", order_index: 3 },
  { title: "Estação Clean de Pia (Dispenser + Suporte)", order_index: 4 },
  { title: "Lixeira Compacta de Bancada – 2,5L", order_index: 5 },
  { title: 'Rodinho de Pia "Seca Tudo" – 16 cm', order_index: 6 },
  { title: "Organizador Modular de Talheres (Gaveta Ajustável)", order_index: 7 },
  { title: "Escorredor Compacto Smart (Louças + Talheres)", order_index: 8 },
  { title: 'Mesa Completa "Dia a Dia" (Aparelho de Jantar)', order_index: 9 },
  { title: "Faqueiro Essencial (24 peças)", order_index: 10 },
  { title: "Jogo de Copos Linha Dubai (6 un)", order_index: 11 },
  { title: "Jogos Americanos Dupla (2 un – 45×36 cm)", order_index: 12 },
  { title: "Conjunto de Taças para Vinho (6 un)", order_index: 13 },
  { title: "Abridor Pro Bar (Saca-Rolhas)", order_index: 14 },
  { title: "Kit Banheiro Spa Bambu (4 peças)", order_index: 15 },
  { title: "Rodo Mágico Giratório – Cabo 140 cm", order_index: 16 },
  { title: "Kit Cabides Velvet (20 un)", order_index: 17 },
  { title: "Vaporizador Portátil de Roupas (Steamer)", order_index: 18 },
];

/** Image URLs keyed by item title for auto-fill */
const TEMPLATE_IMAGES: Record<string, string> = {
  "Kit de Panelas Indução – Alta Performance": `${STORAGE_BASE}/ebc41d79-3447-428d-b7d8-9d98271c0607/items/6dfb738b-2550-4930-b568-48ca3a5263d0.png`,
  "Utensílios Soft Touch (Kit 19 peças em Silicone)": `${STORAGE_BASE}/ebc41d79-3447-428d-b7d8-9d98271c0607/items/8f23c690-6396-4035-a64b-c078114ee627.png`,
  "Trio de Tábuas Gourmet (3 un)": `${STORAGE_BASE}/ebc41d79-3447-428d-b7d8-9d98271c0607/items/f72af729-fde7-4c77-821f-627762a142dc.png`,
  "Kit Trinchante Chef (Facas + Garfo)": `${STORAGE_BASE}/ebc41d79-3447-428d-b7d8-9d98271c0607/items/081c23ea-627e-4032-9b3a-b9620b37f602.png`,
  "Estação Clean de Pia (Dispenser + Suporte)": `${STORAGE_BASE}/ebc41d79-3447-428d-b7d8-9d98271c0607/items/0c37255c-1842-4a61-8098-7edf0f50e673.png`,
  "Lixeira Compacta de Bancada – 2,5L": `${STORAGE_BASE}/ebc41d79-3447-428d-b7d8-9d98271c0607/items/822e6ed4-8e65-408d-959e-d688e93808c6.png`,
  'Rodinho de Pia "Seca Tudo" – 16 cm': `${STORAGE_BASE}/ebc41d79-3447-428d-b7d8-9d98271c0607/items/1fa15d7b-fcfc-4d7b-a99d-a014c103c09c.png`,
  "Organizador Modular de Talheres (Gaveta Ajustável)": `${STORAGE_BASE}/ebc41d79-3447-428d-b7d8-9d98271c0607/items/69ceef03-f751-4e22-b69b-c12ffa6373a6.png`,
  "Escorredor Compacto Smart (Louças + Talheres)": `${STORAGE_BASE}/ebc41d79-3447-428d-b7d8-9d98271c0607/items/4b38cbb1-91b2-4c41-860b-9e5ce2d75855.png`,
  'Mesa Completa "Dia a Dia" (Aparelho de Jantar)': `${STORAGE_BASE}/ebc41d79-3447-428d-b7d8-9d98271c0607/items/366c1b4d-fc65-47ce-b926-0e7e09acfc32.png`,
  "Faqueiro Essencial (24 peças)": `${STORAGE_BASE}/ebc41d79-3447-428d-b7d8-9d98271c0607/items/3f2d565a-6e51-4483-ab41-de0cf61db60f.png`,
  "Jogo de Copos Linha Dubai (6 un)": `${STORAGE_BASE}/ebc41d79-3447-428d-b7d8-9d98271c0607/items/38133067-befa-48a4-b867-3b8c3452a004.png`,
  "Jogos Americanos Dupla (2 un – 45×36 cm)": `${STORAGE_BASE}/ebc41d79-3447-428d-b7d8-9d98271c0607/items/1da41a94-adc9-4fd6-9318-461def8553b9.png`,
  "Conjunto de Taças para Vinho (6 un)": `${STORAGE_BASE}/ebc41d79-3447-428d-b7d8-9d98271c0607/items/947fda73-28a3-49bf-b379-b77be1f78f69.png`,
  "Abridor Pro Bar (Saca-Rolhas)": `${STORAGE_BASE}/ebc41d79-3447-428d-b7d8-9d98271c0607/items/a67194c4-3ec1-4297-838f-e101775aa31e.png`,
  "Kit Banheiro Spa Bambu (4 peças)": `${STORAGE_BASE}/ebc41d79-3447-428d-b7d8-9d98271c0607/items/23bf5568-c00c-41bb-840a-20815edf00fd.png`,
  "Rodo Mágico Giratório – Cabo 140 cm": `${STORAGE_BASE}/ebc41d79-3447-428d-b7d8-9d98271c0607/items/1f63079a-c0c6-4cad-9029-464b88654516.png`,
  "Kit Cabides Velvet (20 un)": `${STORAGE_BASE}/ebc41d79-3447-428d-b7d8-9d98271c0607/items/9a4e7607-6e6e-4d4c-b2e6-e7336fe0c3c1.png`,
  "Vaporizador Portátil de Roupas (Steamer)": `${STORAGE_BASE}/ebc41d79-3447-428d-b7d8-9d98271c0607/items/4bb96aef-7b3d-4840-9695-f33cc728ff40.png`,
};

/**
 * Appends the "Utensílios para o Hóspede" template section to a budget.
 * @param budgetId - The budget to append to
 * @param startOrderIndex - The order_index for the new section (should be after existing sections)
 */
export async function appendUtensiliosTemplate(budgetId: string, startOrderIndex: number): Promise<void> {
  // 1. Create section
  const { data: section, error: secErr } = await supabase
    .from("sections")
    .insert({
      budget_id: budgetId,
      title: TEMPLATE_SECTION.title,
      section_price: TEMPLATE_SECTION.section_price,
      is_optional: TEMPLATE_SECTION.is_optional,
      order_index: startOrderIndex,
    })
    .select("id")
    .single();

  if (secErr || !section) {
    console.error("[UtensiliosTemplate] Failed to create section:", secErr);
    return;
  }

  // 2. Create items
  const itemInserts = TEMPLATE_ITEMS.map((item) => ({
    section_id: section.id,
    title: item.title,
    description: item.description || null,
    internal_total: item.internal_total || null,
    order_index: item.order_index,
  }));

  const { data: createdItems, error: itemsErr } = await supabase
    .from("items")
    .insert(itemInserts)
    .select("id, title");

  if (itemsErr || !createdItems) {
    console.error("[UtensiliosTemplate] Failed to create items:", itemsErr);
    return;
  }

  // 3. Create item images
  const imageInserts = createdItems
    .filter((item) => TEMPLATE_IMAGES[item.title])
    .map((item) => ({
      item_id: item.id,
      url: TEMPLATE_IMAGES[item.title],
      is_primary: true,
    }));

  if (imageInserts.length > 0) {
    const { error: imgErr } = await supabase.from("item_images").insert(imageInserts);
    if (imgErr) {
      console.error("[UtensiliosTemplate] Failed to create images:", imgErr);
    }
  }
}