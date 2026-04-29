// Exporta um orçamento completo (com TODOS os valores abertos: custo, BDI,
// margem, totais por seção e total global) para um arquivo .xlsx.
//
// Disponível para qualquer papel autenticado a partir do detalhe do cliente.
// Lê apenas via cliente Supabase autenticado — RLS já restringe o acesso aos
// orçamentos visíveis ao usuário, então não há vazamento de dados sensíveis
// para fora da base de usuários autorizados.

import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

interface BudgetHeader {
  id: string;
  sequential_code: string | null;
  project_name: string;
  client_name: string;
  condominio: string | null;
  bairro: string | null;
  city: string | null;
  metragem: string | null;
  date: string | null;
  validity_days: number | null;
  internal_status: string;
  status: string;
  manual_total: number | null;
  internal_cost: number | null;
  versao: string | null;
  version_number: number | null;
  created_at: string | null;
  updated_at: string | null;
}

interface SectionRow {
  id: string;
  title: string | null;
  subtitle: string | null;
  order_index: number;
  qty: number | null;
  section_price: number | null;
  is_optional: boolean | null;
  notes: string | null;
}

interface ItemRow {
  id: string;
  section_id: string;
  title: string | null;
  description: string | null;
  order_index: number;
  qty: number | null;
  unit: string | null;
  internal_unit_price: number | null;
  internal_total: number | null;
  bdi_percentage: number | null;
}

interface AdjustmentRow {
  id: string;
  label: string;
  amount: number;
  sign: number;
}

const fmtBR = (n: number | null | undefined): number | null =>
  n === null || n === undefined || Number.isNaN(Number(n)) ? null : Number(n);

const sanitizeFileName = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "orcamento";

/**
 * Gera e dispara o download do .xlsx do orçamento.
 * Lança erro caso a query falhe — chame de dentro de try/catch e use toast.
 */
export async function exportBudgetToXlsx(budgetId: string): Promise<void> {
  // 1) Cabeçalho do orçamento
  const { data: budget, error: budgetErr } = await supabase
    .from("budgets")
    .select(
      "id, sequential_code, project_name, client_name, condominio, bairro, city, metragem, date, validity_days, internal_status, status, manual_total, internal_cost, versao, version_number, created_at, updated_at",
    )
    .eq("id", budgetId)
    .maybeSingle();

  if (budgetErr) throw new Error(`Erro ao carregar orçamento: ${budgetErr.message}`);
  if (!budget) throw new Error("Orçamento não encontrado ou sem permissão.");
  const b = budget as unknown as BudgetHeader;

  // 2) Seções
  const { data: sectionsRaw, error: secErr } = await supabase
    .from("sections")
    .select("id, title, subtitle, order_index, qty, section_price, is_optional, notes")
    .eq("budget_id", budgetId)
    .order("order_index", { ascending: true });
  if (secErr) throw new Error(`Erro ao carregar seções: ${secErr.message}`);
  const sections = (sectionsRaw ?? []) as unknown as SectionRow[];

  // 3) Itens
  const sectionIds = sections.map((s) => s.id);
  let items: ItemRow[] = [];
  if (sectionIds.length > 0) {
    const { data: itemsData, error: itemsErr } = await supabase
      .from("items")
      .select(
        "id, section_id, title, description, order_index, qty, unit, internal_unit_price, internal_total, bdi_percentage",
      )
      .in("section_id", sectionIds)
      .order("order_index", { ascending: true });
    if (itemsErr) throw new Error(`Erro ao carregar itens: ${itemsErr.message}`);
    items = (itemsData ?? []) as unknown as ItemRow[];
  }

  // 4) Ajustes
  const { data: adjRaw, error: adjErr } = await supabase
    .from("adjustments")
    .select("id, label, amount, sign")
    .eq("budget_id", budgetId);
  if (adjErr) {
    // Não bloqueia o export se ajustes não puderem ser lidos.
    logger.error("[xlsx-export] adjustments load failed:", adjErr);
  }
  const adjustments = (adjRaw ?? []) as unknown as AdjustmentRow[];

  // ── Monta as planilhas ────────────────────────────────────────────────
  const wb = XLSX.utils.book_new();

  // Aba 1: Resumo
  const totalCusto = items.reduce(
    (acc, it) => acc + (Number(it.internal_total) || 0),
    0,
  );
  const totalVenda = items.reduce((acc, it) => {
    const cost = Number(it.internal_total) || 0;
    const bdi = Number(it.bdi_percentage) || 0;
    return acc + cost * (1 + bdi / 100);
  }, 0);
  const totalAjustes = adjustments.reduce(
    (acc, a) => acc + (Number(a.amount) || 0) * (Number(a.sign) || 1),
    0,
  );
  const margemPct = totalVenda > 0 ? ((totalVenda - totalCusto) / totalVenda) * 100 : 0;

  const resumoRows: (string | number | null)[][] = [
    ["Orçamento", b.sequential_code ?? b.id],
    ["Projeto", b.project_name ?? ""],
    ["Cliente", b.client_name ?? ""],
    ["Condomínio", b.condominio ?? ""],
    ["Bairro", b.bairro ?? ""],
    ["Cidade", b.city ?? ""],
    ["Metragem", b.metragem ?? ""],
    ["Versão", b.versao ?? (b.version_number ? `v${b.version_number}` : "")],
    ["Status interno", b.internal_status],
    ["Data", b.date ?? ""],
    ["Validade (dias)", fmtBR(b.validity_days)],
    [],
    ["TOTAIS (com valores abertos)", ""],
    ["Custo total (interno)", fmtBR(totalCusto)],
    ["Venda (custo + BDI por item)", fmtBR(totalVenda)],
    ["Ajustes globais", fmtBR(totalAjustes)],
    ["Total geral (venda + ajustes)", fmtBR(totalVenda + totalAjustes)],
    ["Margem média (%)", Number(margemPct.toFixed(2))],
    ["Total manual (orçamento)", fmtBR(b.manual_total)],
    ["Custo registrado no orçamento", fmtBR(b.internal_cost)],
  ];
  const wsResumo = XLSX.utils.aoa_to_sheet(resumoRows);
  wsResumo["!cols"] = [{ wch: 32 }, { wch: 38 }];
  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

  // Aba 2: Itens (com TODOS os valores abertos)
  const itensHeader = [
    "Seção",
    "Item",
    "Descrição",
    "Qtd",
    "Unidade",
    "Custo unitário (R$)",
    "Custo total (R$)",
    "BDI (%)",
    "Margem unitária (R$)",
    "Venda unitária (R$)",
    "Venda total (R$)",
  ];
  const itensRows: (string | number | null)[][] = [itensHeader];
  for (const sec of sections) {
    const secItems = items.filter((i) => i.section_id === sec.id);
    if (secItems.length === 0) {
      itensRows.push([
        sec.title ?? "(sem título)",
        "(seção sem itens)",
        sec.subtitle ?? "",
        fmtBR(sec.qty),
        "",
        null,
        fmtBR(sec.section_price),
        null,
        null,
        null,
        fmtBR(sec.section_price),
      ]);
      continue;
    }
    for (const it of secItems) {
      const cost = Number(it.internal_total) || 0;
      const bdi = Number(it.bdi_percentage) || 0;
      const venda = cost * (1 + bdi / 100);
      const margem = venda - cost;
      const qty = Number(it.qty) || 0;
      const unitCost = it.internal_unit_price !== null
        ? Number(it.internal_unit_price)
        : (qty > 0 ? cost / qty : null);
      const unitVenda = qty > 0 ? venda / qty : null;
      const unitMargem = unitVenda !== null && unitCost !== null ? unitVenda - unitCost : null;
      itensRows.push([
        sec.title ?? "",
        it.title ?? "",
        it.description ?? "",
        fmtBR(it.qty),
        it.unit ?? "",
        unitCost !== null ? Number(unitCost.toFixed(2)) : null,
        Number(cost.toFixed(2)),
        Number(bdi.toFixed(2)),
        unitMargem !== null ? Number(unitMargem.toFixed(2)) : null,
        unitVenda !== null ? Number(unitVenda.toFixed(2)) : null,
        Number(venda.toFixed(2)),
      ]);
    }
  }
  const wsItens = XLSX.utils.aoa_to_sheet(itensRows);
  wsItens["!cols"] = [
    { wch: 28 }, { wch: 30 }, { wch: 40 }, { wch: 8 }, { wch: 10 },
    { wch: 18 }, { wch: 18 }, { wch: 10 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(wb, wsItens, "Itens");

  // Aba 3: Seções (subtotais)
  const secHeader = ["#", "Seção", "Subtítulo", "Qtd", "Itens", "Custo (R$)", "Venda (R$)", "Margem (%)", "Opcional"];
  const secRows: (string | number | null | boolean)[][] = [secHeader];
  sections.forEach((sec, idx) => {
    const secItems = items.filter((i) => i.section_id === sec.id);
    const cost = secItems.reduce((acc, it) => acc + (Number(it.internal_total) || 0), 0);
    const venda = secItems.reduce((acc, it) => {
      const c = Number(it.internal_total) || 0;
      const bdi = Number(it.bdi_percentage) || 0;
      return acc + c * (1 + bdi / 100);
    }, 0);
    const margem = venda > 0 ? ((venda - cost) / venda) * 100 : 0;
    secRows.push([
      idx + 1,
      sec.title ?? "",
      sec.subtitle ?? "",
      fmtBR(sec.qty),
      secItems.length,
      Number(cost.toFixed(2)),
      Number(venda.toFixed(2)),
      Number(margem.toFixed(2)),
      sec.is_optional ? "Sim" : "Não",
    ]);
  });
  const wsSec = XLSX.utils.aoa_to_sheet(secRows);
  wsSec["!cols"] = [
    { wch: 5 }, { wch: 28 }, { wch: 28 }, { wch: 8 }, { wch: 8 },
    { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(wb, wsSec, "Seções");

  // Aba 4: Ajustes
  if (adjustments.length > 0) {
    const adjHeader = ["Descrição", "Sinal", "Valor (R$)", "Efetivo (R$)"];
    const adjRows: (string | number | null)[][] = [adjHeader];
    for (const a of adjustments) {
      const sign = Number(a.sign) || 1;
      const amount = Number(a.amount) || 0;
      adjRows.push([
        a.label || "(sem descrição)",
        sign >= 0 ? "+" : "-",
        Number(amount.toFixed(2)),
        Number((amount * sign).toFixed(2)),
      ]);
    }
    const wsAdj = XLSX.utils.aoa_to_sheet(adjRows);
    wsAdj["!cols"] = [{ wch: 36 }, { wch: 8 }, { wch: 16 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, wsAdj, "Ajustes");
  }

  // Nome do arquivo
  const codePart = b.sequential_code || b.id.slice(0, 8);
  const namePart = sanitizeFileName(b.project_name || b.client_name || "orcamento");
  const fileName = `${codePart}_${namePart}.xlsx`;

  XLSX.writeFile(wb, fileName);
}
