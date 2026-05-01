/**
 * Fixtures de orçamentos com seções "mistas" — seções com saldo POSITIVO
 * que contêm itens de desconto e/ou crédito embutidos.
 *
 * Este formato é o que historicamente quebrava o resumo mobile do orçamento
 * público: a antiga lógica de `PublicBudget.tsx` usava
 * `calculateSectionSubtotal(section)` e ignorava a seção inteira quando
 * `sub >= 0`, perdendo descontos/créditos embutidos. O resultado era:
 *
 * - Desktop (BudgetSummary)  →  mostrava o desconto (vinha de
 *   `aggregateAbatementsByLabel`).
 * - Mobile  (MobileInlineSummary) → mostrava `discount = 0` e
 *   `subtotal = total`.
 *
 * Estes fixtures existem para garantir, via testes automatizados, que esse
 * cenário continue cobrindo qualquer regressão futura nas duas superfícies.
 *
 * IMPORTANTE: Os fixtures retornam `BudgetSection[]` "viáveis" para serem
 * passados direto às funções utilitárias de cálculo
 * (`calculateBudgetTotal`, `aggregateAbatementsByLabel`, etc).
 */

import type { BudgetSection, BudgetItem } from "@/types/budget";

type ItemSeed = {
  id?: string;
  title?: string;
  qty?: number;
  unit?: string;
  internal_unit_price?: number;
  internal_total?: number | null;
  bdi_percentage?: number;
};

type SectionSeed = {
  id?: string;
  title?: string;
  items?: ItemSeed[];
};

let itemCounter = 0;
let sectionCounter = 0;

function makeItem(seed: ItemSeed): BudgetItem {
  itemCounter += 1;
  return {
    id: seed.id ?? `fx-item-${itemCounter}`,
    title: seed.title ?? "Item",
    description: null,
    qty: seed.qty ?? 1,
    unit: seed.unit ?? "un",
    internal_unit_price: seed.internal_unit_price ?? null,
    internal_total: seed.internal_total ?? null,
    bdi_percentage: seed.bdi_percentage ?? 0,
    coverage_type: "geral",
    included_rooms: [],
    addendum_action: null,
  } as BudgetItem;
}

function makeSection(seed: SectionSeed): BudgetSection {
  sectionCounter += 1;
  return {
    id: seed.id ?? `fx-sec-${sectionCounter}`,
    title: seed.title ?? "Seção",
    order_index: sectionCounter,
    qty: 1,
    section_price: null,
    notes: null,
    subtitle: null,
    included_bullets: null,
    addendum_action: null,
    items: (seed.items ?? []).map(makeItem),
  } as BudgetSection;
}

// ─── Fixture 1 ────────────────────────────────────────────────────────────
// Seção positiva com UM desconto embutido (caso clássico do bug).
export function fxMarcenariaComCortesia(): BudgetSection[] {
  return [
    makeSection({
      title: "Marcenaria",
      items: [
        { title: "Armário cozinha", qty: 1, internal_unit_price: 30000, bdi_percentage: 50 },
        { title: "Painel TV", qty: 1, internal_unit_price: 8000, bdi_percentage: 50 },
        // Item negativo embutido na MESMA seção positiva — o gatilho do bug.
        { title: "Cortesia projeto 3D", qty: 1, internal_unit_price: -2500, bdi_percentage: 0 },
      ],
    }),
  ];
}

// ─── Fixture 2 ────────────────────────────────────────────────────────────
// Múltiplas seções positivas, cada uma com seu próprio desconto embutido,
// rótulos diferentes que NÃO devem ser agregados juntos.
export function fxMultiplasSeçõesComDescontosEmbutidos(): BudgetSection[] {
  return [
    makeSection({
      title: "Marcenaria",
      items: [
        { title: "Armário", qty: 1, internal_unit_price: 25000, bdi_percentage: 50 },
        { title: "Cortesia 3D", qty: 1, internal_unit_price: -1500, bdi_percentage: 0 },
      ],
    }),
    makeSection({
      title: "Hidráulica",
      items: [
        { title: "Instalação", qty: 1, internal_unit_price: 12000, bdi_percentage: 40 },
        { title: "Bônus fidelidade", qty: 1, internal_unit_price: -800, bdi_percentage: 0 },
      ],
    }),
    makeSection({
      title: "Elétrica",
      items: [
        { title: "Pontos de luz", qty: 10, internal_unit_price: 500, bdi_percentage: 30 },
      ],
    }),
  ];
}

// ─── Fixture 3 ────────────────────────────────────────────────────────────
// Seção positiva com desconto embutido E uma seção dedicada "Descontos".
// Ambos os descontos com o MESMO rótulo precisam agregar em UMA linha só.
export function fxDescontosMistosComMesmoRotulo(): BudgetSection[] {
  return [
    makeSection({
      title: "Marcenaria",
      items: [
        { title: "Armário", qty: 1, internal_unit_price: 20000, bdi_percentage: 50 },
        { title: "Desconto promocional", qty: 1, internal_unit_price: -1000, bdi_percentage: 0 },
      ],
    }),
    makeSection({
      title: "Descontos",
      items: [
        { title: "Desconto promocional", qty: 1, internal_unit_price: -500, bdi_percentage: 0 },
        { title: "Indicação", qty: 1, internal_unit_price: -300, bdi_percentage: 0 },
      ],
    }),
  ];
}

// ─── Fixture 4 ────────────────────────────────────────────────────────────
// Seção positiva com crédito embutido (sem seção "Créditos" dedicada).
// Por compat histórica do `aggregateAbatementsByLabel`, abatimentos fora
// das seções dedicadas caem em "desconto" — mantemos isso e provamos que
// o comportamento é idêntico nas duas superfícies.
export function fxCreditoForaDeSecaoDedicada(): BudgetSection[] {
  return [
    makeSection({
      title: "Hidráulica",
      items: [
        { title: "Instalação", qty: 1, internal_unit_price: 15000, bdi_percentage: 40 },
        { title: "Crédito sinal", qty: 1, internal_unit_price: -3000, bdi_percentage: 0 },
      ],
    }),
  ];
}

// ─── Fixture 5 ────────────────────────────────────────────────────────────
// Cenário "Frankenstein" combinando tudo: seções positivas com abatimentos
// embutidos + seções dedicadas "Descontos" e "Créditos" + seção totalmente
// neutra. Serve como smoke test mais robusto.
export function fxOrçamentoCompletoMisto(): BudgetSection[] {
  return [
    makeSection({
      title: "Marcenaria",
      items: [
        { title: "Armário cozinha", qty: 1, internal_unit_price: 30000, bdi_percentage: 60 },
        { title: "Painel TV", qty: 1, internal_unit_price: 8000, bdi_percentage: 60 },
        { title: "Cortesia 3D", qty: 1, internal_unit_price: -2000, bdi_percentage: 0 },
      ],
    }),
    makeSection({
      title: "Hidráulica",
      items: [
        { title: "Instalação", qty: 1, internal_unit_price: 14000, bdi_percentage: 40 },
        { title: "Bônus fidelidade", qty: 1, internal_unit_price: -1200, bdi_percentage: 0 },
      ],
    }),
    makeSection({
      title: "Elétrica",
      items: [{ title: "Pontos de luz", qty: 12, internal_unit_price: 600, bdi_percentage: 30 }],
    }),
    makeSection({
      title: "Descontos",
      items: [
        { title: "Desconto promocional", qty: 1, internal_unit_price: -3500, bdi_percentage: 0 },
        { title: "Indicação", qty: 1, internal_unit_price: -700, bdi_percentage: 0 },
      ],
    }),
    makeSection({
      title: "Créditos",
      items: [{ title: "Crédito sinal", qty: 1, internal_unit_price: -5000, bdi_percentage: 0 }],
    }),
  ];
}

/** Catálogo nomeado — facilita iterar todos os fixtures em um único `it.each`. */
export const MIXED_SECTION_FIXTURES: ReadonlyArray<{
  name: string;
  build: () => BudgetSection[];
}> = [
  { name: "marcenaria + cortesia embutida", build: fxMarcenariaComCortesia },
  { name: "múltiplas seções com descontos embutidos", build: fxMultiplasSeçõesComDescontosEmbutidos },
  { name: "descontos mistos com mesmo rótulo", build: fxDescontosMistosComMesmoRotulo },
  { name: "crédito fora de seção dedicada", build: fxCreditoForaDeSecaoDedicada },
  { name: "orçamento completo misto", build: fxOrçamentoCompletoMisto },
];
