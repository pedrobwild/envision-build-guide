// Exporta um orçamento completo (com TODOS os valores abertos: custo, BDI,
// margem, totais por seção e total global) para um arquivo .xlsx.
//
// Disponível para qualquer papel autenticado a partir do detalhe do cliente.
// Lê apenas via cliente Supabase autenticado — RLS já restringe o acesso aos
// orçamentos visíveis ao usuário, então não há vazamento de dados sensíveis
// para fora da base de usuários autorizados.

// Usamos `xlsx-js-style` (fork drop-in do `xlsx` oficial) porque o pacote
// `xlsx` puro IGNORA o atributo `s` das células — o que fazia o arquivo
// exportado sair sem cores, sem fonte em negrito e sem realces de seção/
// subtotal/total. Com o fork, mantemos a mesma API mas os estilos são
// efetivamente gravados no .xlsx.
import * as XLSX from "xlsx-js-style";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import {
  calcItemCostTotal,
  calcItemSaleTotal,
  calcSectionCostTotal,
  calcSectionSaleTotal,
  calcGrandTotals,
  isCreditSection,
  
  normalizeBudgetSections,
  validateBudgetCalcStructure,
  type CalcSection,
  type CalcItem,
} from "@/lib/budget-calc";

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

/**
 * Calcula os totais financeiros do orçamento exatamente como exibidos no Excel.
 * Função pura — espelha a lógica do editor (`budget-calc`) e é a fonte única
 * de verdade dos números mostrados na aba "Resumo" e nas linhas de TOTAIS da
 * aba "Detalhamento".
 *
 * Regras:
 *   - `cost` / `saleMargin` vêm de `calcGrandTotals` (excluem seções de Crédito).
 *   - `creditTotal` soma o valor das seções de Crédito (abatem o total final
 *     mas não impactam a margem).
 *   - `sale` = saleMargin + creditTotal (créditos têm sale negativo, então
 *     subtraem do total mostrado ao cliente).
 *   - `adjustments` = soma de `amount * sign` dos ajustes globais.
 *   - `grandTotal` = sale + adjustments (o que aparece como "Total geral").
 *   - `marginRatio` = `marginPercent` em fração [0,1].
 */
export interface BudgetXlsxSectionTotal {
  id: string;
  title: string;
  cost: number;
  sale: number;
  isCredit: boolean;
}

export interface BudgetXlsxTotals {
  cost: number;
  sale: number;
  saleMargin: number;
  creditTotal: number;
  adjustments: number;
  grandTotal: number;
  marginRatio: number;
  /** Subtotais por seção exatamente como usados no export — base do modo
   *  de auditoria do preview, que compara estes valores com o resumo
   *  exibido no editor. */
  sections: BudgetXlsxSectionTotal[];
  /** Avisos da auditoria de estrutura — operadores podem ter colocado um
   *  valor positivo numa seção de Desconto/Crédito, ou um item negativo
   *  numa seção produtiva. O export normaliza automaticamente, mas devolve
   *  os avisos para que a UI/log possa alertar. */
  warnings: ReturnType<typeof validateBudgetCalcStructure>;
}

export interface BudgetXlsxSectionInput {
  id: string;
  title: string | null;
  qty: number | null;
  section_price: number | null;
}

export interface BudgetXlsxItemInput {
  section_id: string;
  qty: number | null;
  internal_unit_price: number | null;
  internal_total: number | null;
  bdi_percentage: number | null;
  title?: string | null;
}

export interface BudgetXlsxAdjustmentInput {
  amount: number | null;
  sign: number | null;
}

export function computeBudgetXlsxTotals(
  sections: BudgetXlsxSectionInput[],
  items: BudgetXlsxItemInput[],
  adjustments: BudgetXlsxAdjustmentInput[],
): BudgetXlsxTotals {
  const rawCalcSections: CalcSection[] = sections.map((sec) => ({
    qty: sec.qty,
    section_price: sec.section_price,
    title: sec.title,
    items: items
      .filter((i) => i.section_id === sec.id)
      .map((it) => ({
        qty: it.qty,
        internal_unit_price: it.internal_unit_price,
        internal_total: it.internal_total,
        bdi_percentage: it.bdi_percentage,
        title: it.title,
      })),
  }));

  // 1) Auditoria sobre os dados ORIGINAIS — devolve a lista exata de
  //    inconsistências encontradas (ex.: desconto positivo, item negativo
  //    em seção produtiva). Não bloqueia o export.
  const warnings = validateBudgetCalcStructure(rawCalcSections);

  // 2) Normalização: força sinal negativo em itens de Desconto/Crédito e
  //    zera BDI em créditos. Isso garante que mesmo com erros de operação
  //    o cálculo final reflita a INTENÇÃO da seção.
  const calcSections = normalizeBudgetSections(rawCalcSections);

  const grand = calcGrandTotals(calcSections);
  const creditTotal = calcSections
    .filter((s) => isCreditSection(s))
    .reduce((acc, s) => acc + calcSectionSaleTotal(s), 0);
  const sale = grand.sale + creditTotal;
  const adjustmentsTotal = adjustments.reduce(
    (acc, a) => acc + (Number(a.amount) || 0) * (Number(a.sign) || 1),
    0,
  );
  const sectionTotals: BudgetXlsxSectionTotal[] = calcSections.map((s, idx) => ({
    id: sections[idx].id,
    title: (s.title ?? sections[idx].title ?? "Sem título").trim() || "Sem título",
    cost: calcSectionCostTotal(s),
    sale: calcSectionSaleTotal(s),
    isCredit: isCreditSection(s),
  }));
  return {
    cost: grand.cost,
    sale,
    saleMargin: grand.sale,
    creditTotal,
    adjustments: adjustmentsTotal,
    grandTotal: sale + adjustmentsTotal,
    marginRatio: grand.marginPercent / 100,
    sections: sectionTotals,
    warnings,
  };
}

// (helpers de formato BR ficam definidos dentro de exportBudgetToXlsx)


const sanitizeFileName = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "orcamento";

/**
 * Constrói o .xlsx do orçamento em memória e devolve `{ blob, fileName, workbook }`.
 * Não dispara download — o `workbook` é exposto para que a UI de pré-visualização
 * possa renderizar cada planilha como tabela HTML sem reler o arquivo.
 * Lança erro caso a query falhe.
 */
export interface BuildXlsxOptions {
  /**
   * Quando `true`, gera um arquivo "compatível" — sem cores, bordas,
   * mesclagens, wrapText ou estilos avançados. Mantém apenas valores,
   * formatos numéricos/data e larguras de coluna. Útil para versões
   * antigas do Excel ou visualizadores que renderizam estilos errado.
   */
  simple?: boolean;
}

export async function buildBudgetXlsxBlob(
  budgetId: string,
  options: BuildXlsxOptions = {},
): Promise<{ blob: Blob; fileName: string; workbook: XLSX.WorkBook; totals: BudgetXlsxTotals }> {
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

  // Estilos base — agora efetivamente aplicados graças ao `xlsx-js-style`.
  const FONT_BASE = { name: "Calibri", sz: 11 };
  const THIN_BORDER = {
    top: { style: "thin", color: { rgb: "D1D5DB" } },
    bottom: { style: "thin", color: { rgb: "D1D5DB" } },
    left: { style: "thin", color: { rgb: "D1D5DB" } },
    right: { style: "thin", color: { rgb: "D1D5DB" } },
  };
  const HEADER_STYLE = {
    font: { ...FONT_BASE, bold: true, color: { rgb: "FFFFFF" } },
    fill: { patternType: "solid", fgColor: { rgb: "0F172A" } },
    alignment: { vertical: "center", horizontal: "center", wrapText: true },
    border: THIN_BORDER,
  };
  const styleHeaderRow = (ws: XLSX.WorkSheet, row: number, lastCol: number) => {
    for (let c = 0; c < lastCol; c++) {
      const addr = XLSX.utils.encode_cell({ r: row, c });
      const cell = ws[addr] as XLSX.CellObject | undefined;
      if (cell) (cell as XLSX.CellObject & { s?: unknown }).s = HEADER_STYLE;
    }
  };
  // Aplica borda + fonte base a todas as células de uma faixa retangular.
  // Também garante `wrapText: true` no alinhamento para que textos longos
  // quebrem dentro da célula em vez de ficarem cortados.
  const applyBaseGrid = (
    ws: XLSX.WorkSheet,
    startRow: number,
    endRow: number,
    startCol: number,
    endCol: number,
  ) => {
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr] as (XLSX.CellObject & { s?: Record<string, unknown> }) | undefined;
        if (!cell) continue;
        const existing = (cell.s ?? {}) as Record<string, unknown>;
        const existingAlign = (existing.alignment as Record<string, unknown> | undefined) ?? {};
        cell.s = {
          font: { ...FONT_BASE, ...((existing.font as object) ?? {}) },
          border: THIN_BORDER,
          ...existing,
          alignment: {
            vertical: "center",
            wrapText: true,
            ...existingAlign,
            // Força wrapText mesmo se o existing.alignment vier sem ele.
            ...(existingAlign && (existingAlign as { wrapText?: boolean }).wrapText === false
              ? {}
              : { wrapText: true }),
          },
        };
      }
    }
  };

  // Calcula largura ideal por coluna a partir do conteúdo real do AOA.
  // - Considera a maior linha de cada célula (após split em "\n") para evitar
  //   superdimensionar colunas que contenham textos com quebras.
  // - Aplica min/max por coluna para evitar colunas estreitas demais
  //   (cabeçalhos cortados) ou largas demais (rolagem horizontal).
  // - Datas e números formatados ficam com largura mínima maior.
  const autoFitColumns = (
    aoa: (string | number | Date | null | undefined)[][],
    opts?: { min?: number[]; max?: number[]; defaultMin?: number; defaultMax?: number },
  ): { wch: number }[] => {
    const defaultMin = opts?.defaultMin ?? 8;
    const defaultMax = opts?.defaultMax ?? 60;
    const colCount = aoa.reduce((m, row) => Math.max(m, row.length), 0);
    const widths: number[] = new Array(colCount).fill(0);
    for (const row of aoa) {
      for (let c = 0; c < row.length; c++) {
        const v = row[c];
        if (v == null || v === "") continue;
        const text = v instanceof Date ? "00/00/0000" : String(v);
        // Considera só a maior linha quando há \n (texto multi-linha).
        const longest = text.split(/\r?\n/).reduce((m, l) => Math.max(m, l.length), 0);
        if (longest > widths[c]) widths[c] = longest;
      }
    }
    return widths.map((w, c) => {
      const min = opts?.min?.[c] ?? defaultMin;
      const max = opts?.max?.[c] ?? defaultMax;
      // +2 de folga para padding/borda; clamp em [min, max].
      const wch = Math.min(Math.max(w + 2, min), max);
      return { wch };
    });
  };

  // Calcula altura sugerida da linha quando há texto que pode quebrar
  // (descrição longa, título de seção mesclado, etc.). Isso evita que o
  // wrapText "esconda" linhas porque a altura padrão é 15pt.
  const autoFitRowHeights = (
    ws: XLSX.WorkSheet,
    aoa: (string | number | Date | null | undefined)[][],
    cols: { wch: number }[],
    opts?: { mergedRows?: Set<number>; mergedTotalWidth?: number },
  ) => {
    const rows: { hpt: number }[] = [];
    for (let r = 0; r < aoa.length; r++) {
      const row = aoa[r];
      let maxLines = 1;
      const isMerged = opts?.mergedRows?.has(r);
      for (let c = 0; c < row.length; c++) {
        const v = row[c];
        if (v == null || v === "") continue;
        const text = String(v);
        const explicit = text.split(/\r?\n/).length;
        // Largura disponível: célula isolada → wch da coluna; mesclada →
        // soma de todas as colunas (passada via mergedTotalWidth).
        const widthChars = isMerged
          ? (opts?.mergedTotalWidth ?? cols.reduce((s, k) => s + (k.wch || 0), 0))
          : (cols[c]?.wch ?? 10);
        const longestLine = text
          .split(/\r?\n/)
          .reduce((m, l) => Math.max(m, l.length), 0);
        const wrapped = Math.max(1, Math.ceil(longestLine / Math.max(widthChars - 1, 1)));
        const lines = Math.max(explicit, wrapped);
        if (lines > maxLines) maxLines = lines;
      }
      // 15pt é a altura padrão de uma linha; ~14pt por linha extra.
      const hpt = Math.min(Math.max(15, maxLines * 15), 220);
      rows.push({ hpt });
    }
    ws["!rows"] = rows;
  };

  // ── Totais ────────────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new();
  wb.Props = {
    Title: `Orçamento ${b.sequential_code ?? b.id.slice(0, 8)}`,
    Subject: b.project_name ?? "Orçamento",
    Author: "BWild Engine",
    CreatedDate: new Date(),
  };

  // Estrutura canônica reusada para subtotais por seção mais abaixo.
  // IMPORTANTE: aplicamos `normalizeBudgetSections` para que subtotais por
  // seção e linhas de Detalhamento usem os MESMOS valores normalizados que
  // alimentam os totais globais (descontos/créditos forçados a negativos,
  // BDI zerado em créditos). Sem isso, o Subtotal exibido divergiria do
  // Total geral quando houvesse erro de digitação no editor.
  const calcSectionsAll: (CalcSection & { __id: string })[] = normalizeBudgetSections(
    sections.map((sec) => ({
      qty: sec.qty,
      section_price: sec.section_price,
      title: sec.title,
      items: items
        .filter((i) => i.section_id === sec.id)
        .map((it) => ({
          qty: it.qty,
          internal_unit_price: it.internal_unit_price,
          internal_total: it.internal_total,
          bdi_percentage: it.bdi_percentage,
          title: it.title,
        })),
    })),
  ).map((sec, idx) => ({ ...sec, __id: sections[idx].id }));

  // Fonte única dos números globais — mesma função coberta pelos testes.
  const totals = computeBudgetXlsxTotals(
    sections.map((s) => ({
      id: s.id,
      title: s.title,
      qty: s.qty,
      section_price: s.section_price,
    })),
    items.map((i) => ({
      section_id: i.section_id,
      qty: i.qty,
      internal_unit_price: i.internal_unit_price,
      internal_total: i.internal_total,
      bdi_percentage: i.bdi_percentage,
      title: i.title,
    })),
    adjustments,
  );
  const totalCusto = totals.cost;
  const totalVenda = totals.sale;
  const totalAjustes = totals.adjustments;
  const margemRatio = totals.marginRatio;
  // Mirror PublicBudget/BudgetInternalDetail: prefer manual_total when defined.
  const computedGrandTotal = totalVenda + totalAjustes;
  const manualTotalNum = b.manual_total != null && Number.isFinite(Number(b.manual_total))
    ? Number(b.manual_total)
    : null;
  const effectiveGrandTotal = manualTotalNum ?? computedGrandTotal;
  const totalGeralLabel = manualTotalNum != null ? "Total geral (manual)" : "Total geral";

  // Loga avisos de auditoria — não bloqueia o export, mas deixa rastro
  // para que o time identifique seções de Desconto/Crédito mal preenchidas.
  if (totals.warnings.length > 0) {
    logger.warn(
      `[xlsx-export] ${totals.warnings.length} aviso(s) de estrutura no orçamento ${b.sequential_code ?? b.id}:`,
      totals.warnings,
    );
  }

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
    { label: totalGeralLabel, value: effectiveGrandTotal, fmt: FMT.BRL },
    { label: "Margem média", value: margemRatio, fmt: FMT.PCT },
    { label: "Total manual (orçamento)", value: b.manual_total ?? null, fmt: FMT.BRL },
    { label: "Custo registrado", value: b.internal_cost ?? null, fmt: FMT.BRL },
  ];

  const resumoAoa: (string | number | Date | null)[][] = resumoEntries.map((e) =>
    e.isHeader ? [e.label, ""] : [e.label, e.value as string | number | Date | null],
  );
  const wsResumo = XLSX.utils.aoa_to_sheet(resumoAoa, { cellDates: true });
  wsResumo["!cols"] = autoFitColumns(resumoAoa, {
    min: [28, 24],
    max: [50, 60],
  });
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
  // Bordas + fonte base em todo o bloco do Resumo.
  applyBaseGrid(wsResumo, 0, resumoEntries.length - 1, 0, 1);
  // Coluna A em negrito para diferenciar dos valores.
  resumoEntries.forEach((e, idx) => {
    if (e.isHeader) return;
    const addr = XLSX.utils.encode_cell({ r: idx, c: 0 });
    const cell = wsResumo[addr] as (XLSX.CellObject & { s?: Record<string, unknown> }) | undefined;
    if (!cell) return;
    const existing = (cell.s ?? {}) as Record<string, unknown>;
    cell.s = {
      ...existing,
      font: { ...FONT_BASE, bold: true },
      alignment: { vertical: "center", wrapText: true },
    };
  });
  // Header rows do Resumo são mescladas A:B; passa o set para o cálculo
  // considerar a largura combinada das duas colunas.
  const resumoMergedRows = new Set<number>(
    (wsResumo["!merges"] ?? []).map((m) => m.s.r),
  );
  const resumoCols = wsResumo["!cols"] as { wch: number }[];
  autoFitRowHeights(wsResumo, resumoAoa, resumoCols, {
    mergedRows: resumoMergedRows,
    mergedTotalWidth: resumoCols.reduce((s, k) => s + (k.wch || 0), 0),
  });
  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

  // ── Aba 2: Detalhamento (mesma estrutura visual da página do cliente) ─
  // Cada seção aparece como um bloco: cabeçalho da seção (mesclado),
  // linhas de itens com unitários abertos, e subtotal da seção.
  // Ao final, linhas de TOTAIS (subtotal de seções, ajustes, total geral
  // e margem média) — refletindo o resumo financeiro da página.
  // Mesmas colunas do PDF (sem "Margem unitária").
  const detHeader = [
    "Item",
    "Descrição",
    "Qtd",
    "Un.",
    "Custo unit.",
    "Custo total",
    "BDI",
    "Venda unit.",
    "Venda total",
  ];
  const detLastCol = detHeader.length - 1; // 8

  type CellFmt = { fmt?: string; bold?: boolean; section?: boolean; subtotal?: boolean; total?: boolean; align?: "left" | "right" | "center" };
  const detRows: (string | number | null)[][] = [detHeader];
  const detRowMeta: CellFmt[][] = [
    detHeader.map(() => ({ bold: true } as CellFmt)),
  ];
  const detMerges: XLSX.Range[] = [];

  for (const sec of sections) {
    const secItems = items.filter((i) => i.section_id === sec.id);
    const calcSec = calcSectionsAll.find((s) => s.__id === sec.id) as CalcSection;
    const secCost = calcSectionCostTotal(calcSec);
    const secVenda = calcSectionSaleTotal(calcSec);
    // Margem da seção: créditos não têm margem própria (cost = sale = abatimento).
    const secMargem = !isCreditSection(calcSec) && secVenda > 0
      ? (secVenda - secCost) / secVenda
      : 0;
    const secQty = Number(sec.qty) || 1;

    // 1) Cabeçalho da seção (mesclado em toda a largura) — igual ao PDF
    const secTitle = `${sec.title ?? "(sem título)"}${sec.is_optional ? "  ·  opcional" : ""}${
      sec.subtitle ? `  —  ${sec.subtitle}` : ""
    }`;
    detRows.push([secTitle, ...Array(detLastCol).fill("")]);
    const secHeaderRowIdx = detRows.length - 1;
    detRowMeta.push(detHeader.map(() => ({ section: true } as CellFmt)));
    detMerges.push({
      s: { r: secHeaderRowIdx, c: 0 },
      e: { r: secHeaderRowIdx, c: detLastCol },
    });

    // 2) Itens da seção
    if (secItems.length === 0) {
      // Sem itens: o valor exibido na linha do "fallback" precisa bater
      // EXATAMENTE com o subtotal logo abaixo. Em vez de recomputar
      // (`section_price * sec.qty`), reusamos `secCost` / `secVenda` —
      // que já vêm de `calcSectionCostTotal` / `calcSectionSaleTotal`
      // sobre `calcSec` (estrutura canônica normalizada). Assim, qualquer
      // mudança em `sec.qty` ou na regra de fallback se propaga para
      // ambas as linhas sem risco de divergência.
      detRows.push([
        "(seção sem itens)",
        "",
        "",
        "",
        "",
        secCost || null,
        "",
        "",
        secVenda || null,
      ]);
      const emptyRowIdx = detRows.length - 1;
      detRowMeta.push([
        { },
        { },
        { },
        { },
        { },
        { fmt: FMT.BRL, align: "right" },
        { },
        { },
        { fmt: FMT.BRL, align: "right" },
      ]);
      detMerges.push({
        s: { r: emptyRowIdx, c: 0 },
        e: { r: emptyRowIdx, c: 4 },
      });
    } else {
      // Soma "bruta" dos itens (antes de multiplicar por sec.qty) — usada
      // apenas para a linha auxiliar abaixo, quando aplicável. O subtotal
      // oficial vem de calcSectionCostTotal/SaleTotal.
      let rawCostSum = 0;
      let rawSaleSum = 0;
      for (const it of secItems) {
        const calcItem: CalcItem = {
          qty: it.qty,
          internal_unit_price: it.internal_unit_price,
          internal_total: it.internal_total,
          bdi_percentage: it.bdi_percentage,
        };
        // Custo/venda do item respeitando unit_price * qty OU lump-sum.
        const cost = calcItemCostTotal(calcItem);
        const venda = calcItemSaleTotal(calcItem);
        rawCostSum += cost;
        rawSaleSum += venda;
        const bdi = Number(it.bdi_percentage) || 0;
        const unitPrice = Number(it.internal_unit_price) || 0;
        const qty = Number(it.qty) || 0;
        // Se há unit_price, mostra-o; senão deriva de cost/qty quando possível.
        const unitCost = unitPrice !== 0
          ? unitPrice
          : (qty > 0 ? cost / qty : null);
        const unitVenda = unitPrice !== 0
          ? unitPrice * (1 + bdi / 100)
          : (qty > 0 ? venda / qty : null);
        detRows.push([
          it.title ?? "",
          it.description ?? "",
          it.qty != null ? Number(it.qty) : null,
          it.unit ?? "",
          unitCost,
          cost,
          bdi / 100,
          unitVenda,
          venda,
        ]);
        detRowMeta.push([
          { bold: true },
          { },
          { fmt: FMT.QTY, align: "right" },
          { align: "center" },
          { fmt: FMT.BRL, align: "right" },
          { fmt: FMT.BRL, align: "right" },
          { fmt: FMT.PCT, align: "right" },
          { fmt: FMT.BRL, align: "right" },
          { fmt: FMT.BRL, align: "right" },
        ]);
      }

      // Quando sec.qty > 1, o subtotal canônico multiplica a soma dos
      // itens por sec.qty. Sem deixar isso explícito, a soma das linhas
      // acima parece divergir do subtotal logo abaixo. Inserimos uma
      // linha auxiliar "× N — quantidade da seção" mostrando a soma
      // bruta e o efeito do multiplicador. Os valores impressos vêm
      // exclusivamente das mesmas funções canônicas.
      if (secQty !== 1 && (rawCostSum !== 0 || rawSaleSum !== 0)) {
        const multLabel = `× ${secQty.toLocaleString("pt-BR", {
          maximumFractionDigits: 2,
        })}  ·  quantidade da seção`;
        detRows.push([
          multLabel,
          "",
          "",
          "",
          "",
          rawCostSum,
          "",
          "",
          rawSaleSum,
        ]);
        const multRowIdx = detRows.length - 1;
        detRowMeta.push([
          { bold: true, align: "right" },
          { },
          { },
          { },
          { },
          { fmt: FMT.BRL, align: "right" },
          { },
          { },
          { fmt: FMT.BRL, align: "right" },
        ]);
        detMerges.push({
          s: { r: multRowIdx, c: 0 },
          e: { r: multRowIdx, c: 4 },
        });
      }
    }

    // 3) Subtotal da seção (mesmo formato do PDF):
    //    "Subtotal da seção  ·  margem X%" mesclado A:E
    //    Custo total na col F, Venda total na col I (J no PDF = índice 8).
    const margemPct = secMargem * 100;
    const subtotalLabel = `Subtotal da seção  ·  margem ${margemPct.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}%`;
    detRows.push([
      subtotalLabel,
      "",
      "",
      "",
      "",
      secCost,
      "",
      "",
      secVenda,
    ]);
    const subtotalRowIdx = detRows.length - 1;
    detRowMeta.push([
      { subtotal: true, bold: true, align: "right" },
      { subtotal: true },
      { subtotal: true },
      { subtotal: true },
      { subtotal: true },
      { subtotal: true, bold: true, fmt: FMT.BRL, align: "right" },
      { subtotal: true },
      { subtotal: true },
      { subtotal: true, bold: true, fmt: FMT.BRL, align: "right" },
    ]);
    detMerges.push({
      s: { r: subtotalRowIdx, c: 0 },
      e: { r: subtotalRowIdx, c: 4 },
    });
    // Linha em branco após cada seção
    detRows.push(Array(detHeader.length).fill(""));
    detRowMeta.push(detHeader.map(() => ({} as CellFmt)));
  }

  // 4) Bloco final de TOTAIS (idêntico ao PDF)
  const totalsRows: { label: string; value: number; fmt: string }[] = [
    { label: "Custo total", value: totalCusto, fmt: FMT.BRL },
    { label: "Venda (BDI)", value: totalVenda, fmt: FMT.BRL },
    { label: "Ajustes globais", value: totalAjustes, fmt: FMT.BRL },
    { label: "Margem média", value: margemRatio, fmt: FMT.PCT },
    { label: totalGeralLabel, value: effectiveGrandTotal, fmt: FMT.BRL },
  ];
  for (const t of totalsRows) {
    const isFinal = t.label.startsWith("Total geral");
    detRows.push([t.label, "", "", "", "", "", "", "", t.value]);
    detRowMeta.push([
      { total: isFinal, bold: true, align: "right" },
      { total: isFinal }, { total: isFinal }, { total: isFinal }, { total: isFinal },
      { total: isFinal }, { total: isFinal }, { total: isFinal },
      { total: isFinal, bold: true, fmt: t.fmt, align: "right" },
    ]);
    // Mescla A:H (rótulo) deixando a coluna I com o valor
    detMerges.push({
      s: { r: detRows.length - 1, c: 0 },
      e: { r: detRows.length - 1, c: detLastCol - 1 },
    });
  }

  const wsDet = XLSX.utils.aoa_to_sheet(detRows);
  // Largura mínima por coluna garante que cabeçalhos e valores monetários
  // sempre apareçam por inteiro; máxima evita "Descrição" gigantesca.
  wsDet["!cols"] = autoFitColumns(detRows, {
    min: [24, 32, 8, 6, 14, 16, 8, 14, 16],
    max: [50, 70, 12, 10, 20, 22, 12, 20, 22],
  });
  wsDet["!freeze"] = { xSplit: 0, ySplit: 1 };
  wsDet["!merges"] = detMerges;

  // Estilos de seção/subtotal/total — `patternType: "solid"` é obrigatório
  // para que o Excel renderize a cor de fundo (sem isso, o `fgColor` é
  // ignorado mesmo no `xlsx-js-style`).
  const SECTION_STYLE = {
    font: { ...FONT_BASE, bold: true, color: { rgb: "0F172A" } },
    fill: { patternType: "solid", fgColor: { rgb: "E5E7EB" } },
    alignment: { vertical: "center", horizontal: "left", wrapText: true },
    border: THIN_BORDER,
  };
  const SUBTOTAL_STYLE = {
    font: { ...FONT_BASE, bold: true },
    fill: { patternType: "solid", fgColor: { rgb: "F3F4F6" } },
    alignment: { vertical: "center", wrapText: true },
    border: THIN_BORDER,
  };
  const TOTAL_STYLE = {
    font: { ...FONT_BASE, bold: true, color: { rgb: "FFFFFF" } },
    fill: { patternType: "solid", fgColor: { rgb: "0F172A" } },
    alignment: { vertical: "center", horizontal: "left", wrapText: true },
    border: THIN_BORDER,
  };

  for (let r = 0; r < detRowMeta.length; r++) {
    const meta = detRowMeta[r];
    for (let c = 0; c < meta.length; c++) {
      const m = meta[c];
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = wsDet[addr] as XLSX.CellObject | undefined;
      if (m.fmt && cell) {
        cell.t = "n";
        cell.z = m.fmt;
      }
      if (!cell) continue;
      const styled = cell as XLSX.CellObject & { s?: { alignment?: { horizontal?: string; vertical?: string; wrapText?: boolean } } };
      if (r === 0) {
        styled.s = HEADER_STYLE;
      } else if (m.section) {
        styled.s = SECTION_STYLE;
      } else if (m.total) {
        styled.s = TOTAL_STYLE;
      } else if (m.subtotal) {
        styled.s = { ...SUBTOTAL_STYLE };
      } else if (m.bold) {
        styled.s = { font: { bold: true } };
      }
      // Aplica alinhamento por célula sem perder demais propriedades.
      if (m.align) {
        const existing = (styled.s ?? {}) as { alignment?: { horizontal?: string; vertical?: string; wrapText?: boolean } };
        styled.s = {
          ...existing,
          alignment: { ...(existing.alignment ?? {}), horizontal: m.align, vertical: "center", wrapText: true },
        };
      }
    }
  }
  // Garante bordas em todas as células do Detalhamento (mantém estilos
  // específicos já aplicados acima — `applyBaseGrid` preserva `existing`).
  applyBaseGrid(wsDet, 0, detRows.length - 1, 0, detLastCol);
  // Linhas com cabeçalho de seção e subtotal são mescladas em A:E (ou A:H
  // nos totais); o auto-fit precisa considerar a largura combinada para
  // calcular quantas linhas a quebra de texto realmente ocupa.
  const detMergedRows = new Set<number>(detMerges.map((m) => m.s.r));
  const detColsArr = wsDet["!cols"] as { wch: number }[];
  const detMergedTotalWidth = detColsArr.reduce((s, k) => s + (k.wch || 0), 0);
  autoFitRowHeights(wsDet, detRows, detColsArr, {
    mergedRows: detMergedRows,
    mergedTotalWidth: detMergedTotalWidth,
  });
  XLSX.utils.book_append_sheet(wb, wsDet, "Detalhamento");

  // ── Aba 3: Resumo por seção ───────────────────────────────────────────
  // Réplica direta da tabela vista pelo cliente: uma linha por seção com
  // subtotais, e linha final com Total geral.
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
    const calcSec = calcSectionsAll.find((s) => s.__id === sec.id) as CalcSection;
    const cost = calcSectionCostTotal(calcSec);
    const venda = calcSectionSaleTotal(calcSec);
    const margem = !isCreditSection(calcSec) && venda > 0
      ? (venda - cost) / venda
      : 0;
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
  // Linhas de totais finais
  const secTotalsStartRow = secRows.length;
  secRows.push(["", "Subtotal das seções", "", "", "", totalCusto, totalVenda, margemRatio, ""]);
  if (totalAjustes !== 0) {
    secRows.push(["", "Ajustes globais", "", "", "", "", totalAjustes, "", ""]);
  }
  secRows.push(["", "Total geral", "", "", "", "", totalVenda + totalAjustes, "", ""]);

  const wsSec = XLSX.utils.aoa_to_sheet(secRows);
  wsSec["!cols"] = autoFitColumns(secRows, {
    min: [4, 22, 22, 10, 6, 14, 14, 10, 8],
    max: [6, 50, 50, 14, 10, 20, 20, 14, 12],
  });
  wsSec["!freeze"] = { xSplit: 0, ySplit: 1 };
  styleHeaderRow(wsSec, 0, secHeader.length);
  for (let r = 1; r < secTotalsStartRow; r++) {
    setCellFormat(wsSec, XLSX.utils.encode_cell({ r, c: 0 }), FMT.INT);
    setCellFormat(wsSec, XLSX.utils.encode_cell({ r, c: 3 }), FMT.QTY);
    setCellFormat(wsSec, XLSX.utils.encode_cell({ r, c: 4 }), FMT.INT);
    setCellFormat(wsSec, XLSX.utils.encode_cell({ r, c: 5 }), FMT.BRL);
    setCellFormat(wsSec, XLSX.utils.encode_cell({ r, c: 6 }), FMT.BRL);
    setCellFormat(wsSec, XLSX.utils.encode_cell({ r, c: 7 }), FMT.PCT);
  }
  // Estiliza as linhas de totais
  for (let r = secTotalsStartRow; r < secRows.length; r++) {
    setCellFormat(wsSec, XLSX.utils.encode_cell({ r, c: 5 }), FMT.BRL);
    setCellFormat(wsSec, XLSX.utils.encode_cell({ r, c: 6 }), FMT.BRL);
    setCellFormat(wsSec, XLSX.utils.encode_cell({ r, c: 7 }), FMT.PCT);
    const isFinal = r === secRows.length - 1;
    for (let c = 0; c < secHeader.length; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = wsSec[addr] as (XLSX.CellObject & { s?: unknown }) | undefined;
      if (!cell) continue;
      cell.s = isFinal ? TOTAL_STYLE : SUBTOTAL_STYLE;
    }
  }
  applyBaseGrid(wsSec, 0, secRows.length - 1, 0, secHeader.length - 1);
  autoFitRowHeights(wsSec, secRows, wsSec["!cols"] as { wch: number }[]);
  XLSX.utils.book_append_sheet(wb, wsSec, "Resumo por seção");


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
    wsAdj["!cols"] = autoFitColumns(adjRows, {
      min: [28, 6, 14, 14],
      max: [60, 8, 20, 20],
    });
    wsAdj["!freeze"] = { xSplit: 0, ySplit: 1 };
    styleHeaderRow(wsAdj, 0, adjHeader.length);
    for (let r = 1; r < adjRows.length; r++) {
      setCellFormat(wsAdj, XLSX.utils.encode_cell({ r, c: 2 }), FMT.BRL);
      setCellFormat(wsAdj, XLSX.utils.encode_cell({ r, c: 3 }), FMT.BRL);
    }
    applyBaseGrid(wsAdj, 0, adjRows.length - 1, 0, adjHeader.length - 1);
    autoFitRowHeights(wsAdj, adjRows, wsAdj["!cols"] as { wch: number }[]);
    XLSX.utils.book_append_sheet(wb, wsAdj, "Ajustes");
  }

  // Modo simples (compatibilidade): remove tudo que é "estilo" — cores,
  // bordas, mesclagens, freeze pane, alturas customizadas e wrapText.
  // Mantém valores, formatos numéricos/data e larguras de coluna, que
  // são suportados por qualquer leitor de .xlsx (inclusive Excel antigo,
  // Numbers, Google Sheets e visualizadores embarcados).
  if (options.simple) {
    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      if (!ws) continue;
      delete (ws as Record<string, unknown>)["!merges"];
      delete (ws as Record<string, unknown>)["!rows"];
      delete (ws as Record<string, unknown>)["!freeze"];
      const ref = ws["!ref"];
      if (!ref) continue;
      const range = XLSX.utils.decode_range(ref);
      for (let r = range.s.r; r <= range.e.r; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          const cell = ws[addr] as
            | (XLSX.CellObject & { s?: unknown })
            | undefined;
          if (cell && cell.s) delete cell.s;
        }
      }
    }
  }

  // Nome do arquivo — sufixo "_simples" deixa explícito qual versão foi
  // baixada quando o usuário gera as duas para comparar.
  const codePart = b.sequential_code || b.id.slice(0, 8);
  const namePart = sanitizeFileName(b.project_name || b.client_name || "orcamento");
  const suffix = options.simple ? "_simples" : "";
  const fileName = `${codePart}_${namePart}${suffix}.xlsx`;

  // `XLSX.write` em vez de `XLSX.writeFile`: gera o conteúdo em memória,
  // permitindo pré-visualização antes de oferecer o download.
  const arrayBuffer = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  return { blob, fileName, workbook: wb, totals };
}

/**
 * Wrapper de compatibilidade — gera o XLSX e dispara o download imediato.
 */
export async function exportBudgetToXlsx(
  budgetId: string,
  options: BuildXlsxOptions = {},
): Promise<void> {
  const { blob, fileName } = await buildBudgetXlsxBlob(budgetId, options);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

