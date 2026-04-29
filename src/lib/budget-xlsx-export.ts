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

  // ── Helpers de formatação ─────────────────────────────────────────────
  // Formatos BR nativos do Excel (vírgula decimal, ponto de milhar).
  const FMT = {
    BRL: 'R$ #,##0.00;[Red]-R$ #,##0.00;"—"',
    BRL_BOLD: 'R$ #,##0.00;[Red]-R$ #,##0.00;"—"',
    PCT: '0.00%;[Red]-0.00%;"—"',
    QTY: "#,##0.##",
    INT: "#,##0",
    DATE: "dd/mm/yyyy",
  } as const;

  // Tradução amigável de status interno.
  const STATUS_LABEL: Record<string, string> = {
    draft: "Em elaboração",
    in_progress: "Em andamento",
    waiting_info: "Aguardando informações",
    sent: "Enviado",
    review_requested: "Revisão solicitada",
    approved: "Aprovado",
    closed: "Fechado",
    won: "Ganho",
    lost: "Perdido",
    delivered: "Entregue",
    finished: "Finalizado",
    archived: "Arquivado",
  };
  const statusLabel = (s: string) =>
    STATUS_LABEL[s] ?? s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  // Converte string ISO/Date em Date para Excel; null se inválido.
  const toExcelDate = (v: string | null | undefined): Date | null => {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  // Aplica formato de número/data a uma célula (cria a célula se preciso).
  const setCellFormat = (
    ws: XLSX.WorkSheet,
    addr: string,
    fmt: string,
    type: "n" | "d" = "n",
  ) => {
    const cell = ws[addr] as XLSX.CellObject | undefined;
    if (!cell) return;
    cell.t = type;
    cell.z = fmt;
  };

  // Estilo simples de cabeçalho (negrito) — funciona com xlsx-js-style. O
  // xlsx oficial ignora `s`, mas não quebra; mantemos para futura troca.
  const HEADER_STYLE = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "0F172A" } },
    alignment: { vertical: "center", horizontal: "center", wrapText: true },
  };
  const styleHeaderRow = (ws: XLSX.WorkSheet, row: number, lastCol: number) => {
    for (let c = 0; c < lastCol; c++) {
      const addr = XLSX.utils.encode_cell({ r: row, c });
      const cell = ws[addr] as XLSX.CellObject | undefined;
      if (cell) (cell as XLSX.CellObject & { s?: unknown }).s = HEADER_STYLE;
    }
  };

  // ── Totais ────────────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new();
  wb.Props = {
    Title: `Orçamento ${b.sequential_code ?? b.id.slice(0, 8)}`,
    Subject: b.project_name ?? "Orçamento",
    Author: "BWild Engine",
    CreatedDate: new Date(),
  };

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
  const margemRatio = totalVenda > 0 ? (totalVenda - totalCusto) / totalVenda : 0;

  // ── Aba 1: Resumo ─────────────────────────────────────────────────────
  // Coluna A = rótulo, Coluna B = valor (já no tipo correto).
  const dataDoc = toExcelDate(b.date) ?? toExcelDate(b.created_at);
  const dataAtualizado = toExcelDate(b.updated_at);
  const versaoTxt = b.versao ?? (b.version_number ? `v${b.version_number}` : "");

  type ResumoEntry =
    | { label: string; value: string | number | Date | null; fmt?: string; isHeader?: false }
    | { label: string; isHeader: true };

  const resumoEntries: ResumoEntry[] = [
    { label: "INFORMAÇÕES DO ORÇAMENTO", isHeader: true },
    { label: "Código do orçamento", value: b.sequential_code ?? b.id.slice(0, 8) },
    { label: "Projeto", value: b.project_name ?? "" },
    { label: "Cliente", value: b.client_name ?? "" },
    { label: "Condomínio", value: b.condominio ?? "" },
    { label: "Bairro", value: b.bairro ?? "" },
    { label: "Cidade", value: b.city ?? "" },
    { label: "Metragem", value: b.metragem ?? "" },
    { label: "Versão", value: versaoTxt },
    { label: "Status", value: statusLabel(b.internal_status) },
    { label: "Data do orçamento", value: dataDoc, fmt: FMT.DATE },
    { label: "Última atualização", value: dataAtualizado, fmt: FMT.DATE },
    { label: "Validade (dias)", value: b.validity_days ?? null, fmt: FMT.INT },
    { label: "RESUMO FINANCEIRO", isHeader: true },
    { label: "Custo total (interno)", value: totalCusto, fmt: FMT.BRL },
    { label: "Venda (custo + BDI por item)", value: totalVenda, fmt: FMT.BRL },
    { label: "Ajustes globais", value: totalAjustes, fmt: FMT.BRL },
    { label: "Total geral", value: totalVenda + totalAjustes, fmt: FMT.BRL },
    { label: "Margem média", value: margemRatio, fmt: FMT.PCT },
    { label: "Total manual (orçamento)", value: b.manual_total ?? null, fmt: FMT.BRL },
    { label: "Custo registrado", value: b.internal_cost ?? null, fmt: FMT.BRL },
  ];

  const resumoAoa: (string | number | Date | null)[][] = resumoEntries.map((e) =>
    e.isHeader ? [e.label, ""] : [e.label, e.value as string | number | Date | null],
  );
  const wsResumo = XLSX.utils.aoa_to_sheet(resumoAoa, { cellDates: true });
  wsResumo["!cols"] = [{ wch: 34 }, { wch: 36 }];
  // Aplica formato em B
  resumoEntries.forEach((e, idx) => {
    if (e.isHeader) {
      // Marca a linha de header (opcional: mescla A:B)
      const addrA = XLSX.utils.encode_cell({ r: idx, c: 0 });
      const cellA = wsResumo[addrA] as XLSX.CellObject | undefined;
      if (cellA) (cellA as XLSX.CellObject & { s?: unknown }).s = HEADER_STYLE;
      const addrB = XLSX.utils.encode_cell({ r: idx, c: 1 });
      const cellB = wsResumo[addrB] as XLSX.CellObject | undefined;
      if (cellB) (cellB as XLSX.CellObject & { s?: unknown }).s = HEADER_STYLE;
      wsResumo["!merges"] = wsResumo["!merges"] ?? [];
      wsResumo["!merges"].push({ s: { r: idx, c: 0 }, e: { r: idx, c: 1 } });
      return;
    }
    if (!e.fmt) return;
    const addr = XLSX.utils.encode_cell({ r: idx, c: 1 });
    setCellFormat(wsResumo, addr, e.fmt, e.value instanceof Date ? "d" : "n");
  });
  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

  // ── Aba 2: Itens (com TODOS os valores abertos) ───────────────────────
  const itensHeader = [
    "Seção",
    "Item",
    "Descrição",
    "Quantidade",
    "Unidade",
    "Custo unitário",
    "Custo total",
    "BDI",
    "Margem unitária",
    "Venda unitária",
    "Venda total",
  ];
  const itensRows: (string | number | null)[][] = [itensHeader];
  for (const sec of sections) {
    const secItems = items.filter((i) => i.section_id === sec.id);
    if (secItems.length === 0) {
      itensRows.push([
        sec.title ?? "(sem título)",
        "(seção sem itens)",
        sec.subtitle ?? "",
        sec.qty != null ? Number(sec.qty) : null,
        "",
        null,
        sec.section_price != null ? Number(sec.section_price) : null,
        null,
        null,
        null,
        sec.section_price != null ? Number(sec.section_price) : null,
      ]);
      continue;
    }
    for (const it of secItems) {
      const cost = Number(it.internal_total) || 0;
      const bdi = Number(it.bdi_percentage) || 0;
      const venda = cost * (1 + bdi / 100);
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
        it.qty != null ? Number(it.qty) : null,
        it.unit ?? "",
        unitCost,
        cost,
        bdi / 100, // armazenado como ratio para formato %
        unitMargem,
        unitVenda,
        venda,
      ]);
    }
  }
  const wsItens = XLSX.utils.aoa_to_sheet(itensRows);
  wsItens["!cols"] = [
    { wch: 28 }, { wch: 30 }, { wch: 40 }, { wch: 12 }, { wch: 10 },
    { wch: 16 }, { wch: 16 }, { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
  ];
  wsItens["!freeze"] = { xSplit: 0, ySplit: 1 };
  wsItens["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: itensRows.length - 1, c: itensHeader.length - 1 },
    }),
  };
  styleHeaderRow(wsItens, 0, itensHeader.length);
  // Formatos por coluna a partir da linha 2
  for (let r = 1; r < itensRows.length; r++) {
    setCellFormat(wsItens, XLSX.utils.encode_cell({ r, c: 3 }), FMT.QTY); // Qtd
    setCellFormat(wsItens, XLSX.utils.encode_cell({ r, c: 5 }), FMT.BRL); // Custo unit
    setCellFormat(wsItens, XLSX.utils.encode_cell({ r, c: 6 }), FMT.BRL); // Custo total
    setCellFormat(wsItens, XLSX.utils.encode_cell({ r, c: 7 }), FMT.PCT); // BDI
    setCellFormat(wsItens, XLSX.utils.encode_cell({ r, c: 8 }), FMT.BRL); // Margem unit
    setCellFormat(wsItens, XLSX.utils.encode_cell({ r, c: 9 }), FMT.BRL); // Venda unit
    setCellFormat(wsItens, XLSX.utils.encode_cell({ r, c: 10 }), FMT.BRL); // Venda total
  }
  XLSX.utils.book_append_sheet(wb, wsItens, "Itens");

  // ── Aba 3: Seções (subtotais) ─────────────────────────────────────────
  const secHeader = [
    "#",
    "Seção",
    "Subtítulo",
    "Quantidade",
    "Itens",
    "Custo",
    "Venda",
    "Margem",
    "Opcional",
  ];
  const secRows: (string | number | null)[][] = [secHeader];
  sections.forEach((sec, idx) => {
    const secItems = items.filter((i) => i.section_id === sec.id);
    const cost = secItems.reduce((acc, it) => acc + (Number(it.internal_total) || 0), 0);
    const venda = secItems.reduce((acc, it) => {
      const c = Number(it.internal_total) || 0;
      const bdi = Number(it.bdi_percentage) || 0;
      return acc + c * (1 + bdi / 100);
    }, 0);
    const margem = venda > 0 ? (venda - cost) / venda : 0;
    secRows.push([
      idx + 1,
      sec.title ?? "",
      sec.subtitle ?? "",
      sec.qty != null ? Number(sec.qty) : null,
      secItems.length,
      cost,
      venda,
      margem,
      sec.is_optional ? "Sim" : "Não",
    ]);
  });
  const wsSec = XLSX.utils.aoa_to_sheet(secRows);
  wsSec["!cols"] = [
    { wch: 5 }, { wch: 28 }, { wch: 28 }, { wch: 12 }, { wch: 8 },
    { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 10 },
  ];
  wsSec["!freeze"] = { xSplit: 0, ySplit: 1 };
  styleHeaderRow(wsSec, 0, secHeader.length);
  for (let r = 1; r < secRows.length; r++) {
    setCellFormat(wsSec, XLSX.utils.encode_cell({ r, c: 0 }), FMT.INT);
    setCellFormat(wsSec, XLSX.utils.encode_cell({ r, c: 3 }), FMT.QTY);
    setCellFormat(wsSec, XLSX.utils.encode_cell({ r, c: 4 }), FMT.INT);
    setCellFormat(wsSec, XLSX.utils.encode_cell({ r, c: 5 }), FMT.BRL);
    setCellFormat(wsSec, XLSX.utils.encode_cell({ r, c: 6 }), FMT.BRL);
    setCellFormat(wsSec, XLSX.utils.encode_cell({ r, c: 7 }), FMT.PCT);
  }
  XLSX.utils.book_append_sheet(wb, wsSec, "Seções");

  // ── Aba 4: Ajustes ────────────────────────────────────────────────────
  if (adjustments.length > 0) {
    const adjHeader = ["Descrição", "Sinal", "Valor", "Efetivo"];
    const adjRows: (string | number | null)[][] = [adjHeader];
    for (const a of adjustments) {
      const sign = Number(a.sign) || 1;
      const amount = Number(a.amount) || 0;
      adjRows.push([
        a.label || "(sem descrição)",
        sign >= 0 ? "+" : "−",
        amount,
        amount * sign,
      ]);
    }
    const wsAdj = XLSX.utils.aoa_to_sheet(adjRows);
    wsAdj["!cols"] = [{ wch: 36 }, { wch: 8 }, { wch: 16 }, { wch: 16 }];
    wsAdj["!freeze"] = { xSplit: 0, ySplit: 1 };
    styleHeaderRow(wsAdj, 0, adjHeader.length);
    for (let r = 1; r < adjRows.length; r++) {
      setCellFormat(wsAdj, XLSX.utils.encode_cell({ r, c: 2 }), FMT.BRL);
      setCellFormat(wsAdj, XLSX.utils.encode_cell({ r, c: 3 }), FMT.BRL);
    }
    XLSX.utils.book_append_sheet(wb, wsAdj, "Ajustes");
  }

  // Nome do arquivo
  const codePart = b.sequential_code || b.id.slice(0, 8);
  const namePart = sanitizeFileName(b.project_name || b.client_name || "orcamento");
  const fileName = `${codePart}_${namePart}.xlsx`;

  XLSX.writeFile(wb, fileName);
}

