// Exporta um orçamento completo (com TODOS os valores abertos: custo, BDI,
// margem, totais por seção e total global) para um arquivo .pdf.
//
// Mesmo conteúdo do export .xlsx, formatado para impressão / leitura.
// Disponível para qualquer papel autenticado a partir do detalhe do cliente.
// Lê via cliente Supabase autenticado — RLS restringe o acesso aos orçamentos
// visíveis ao usuário.

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

/**
 * Disclaimer padrão impresso no rodapé do PDF quando o caller não passa
 * um texto customizado. Editável pelo usuário no diálogo de pré-visualização.
 */
export const DEFAULT_BUDGET_PDF_DISCLAIMER =
  "Este orçamento é uma estimativa baseada nas informações fornecidas e está sujeito " +
  "a alterações após visita técnica e validação de escopo. Os valores apresentados " +
  "incluem custos diretos, BDI e impostos aplicáveis e têm validade conforme o prazo " +
  "indicado no cabeçalho. A contratação dos serviços está condicionada à assinatura " +
  "de contrato específico entre as partes.";

export interface BuildBudgetPdfOptions {
  /**
   * Quando `true` (padrão), inclui o logo da Bwild no canto superior direito.
   * Pode ser desativado para versões "neutras" (white-label) do orçamento.
   */
  includeLogo?: boolean;
  /**
   * Texto livre exibido como disclaimer no rodapé do PDF. Quando `null`
   * ou string vazia, nada é impresso. Quando `undefined`, usa o
   * `DEFAULT_BUDGET_PDF_DISCLAIMER`.
   */
  disclaimer?: string | null;
}

// Carrega o logo dark da Bwild como dataURL para embutir no PDF sem
// depender de fetch externo na hora da exportação. Usa o mesmo asset já
// adotado em FinancialHistory/AppSidebar para manter consistência visual.
async function loadBwildLogoDataUrl(): Promise<string | null> {
  try {
    const mod = await import("@/assets/logo-bwild-dark.png");
    const url = mod.default as string;
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    logger.error("[pdf-export] failed to load logo:", e);
    return null;
  }
}

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

const brl = (n: number | null | undefined): string => {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  return Number(n).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const num = (n: number | null | undefined, digits = 2): string => {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  return Number(n).toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

const sanitizeFileName = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "orcamento";

/**
 * Constrói o .pdf do orçamento em memória e devolve `{ blob, fileName }`.
 * Não dispara download — útil para pré-visualização antes do save.
 * Lança erro caso a query falhe — chame de dentro de try/catch e use toast.
 */
export async function buildBudgetPdfBlob(
  budgetId: string,
): Promise<{ blob: Blob; fileName: string }> {
  // 1) Cabeçalho
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
    logger.error("[pdf-export] adjustments load failed:", adjErr);
  }
  const adjustments = (adjRaw ?? []) as unknown as AdjustmentRow[];

  // ── Totais ────────────────────────────────────────────────────────────
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

  // ── Documento ─────────────────────────────────────────────────────────
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 12;

  // Cabeçalho
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Orçamento — valores abertos", marginX, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110);
  const codeStr = b.sequential_code ? `#${b.sequential_code}` : `#${b.id.slice(0, 8)}`;
  const versionStr = b.versao ?? (b.version_number ? `v${b.version_number}` : "");
  doc.text(
    `${codeStr}${versionStr ? `  ·  ${versionStr}` : ""}  ·  Status: ${b.internal_status}`,
    marginX,
    19,
  );
  doc.setTextColor(0);

  // Resumo (duas colunas)
  const resumoLeft: [string, string][] = [
    ["Projeto", b.project_name ?? "—"],
    ["Cliente", b.client_name ?? "—"],
    ["Condomínio", b.condominio ?? "—"],
    ["Bairro", b.bairro ?? "—"],
    ["Cidade", b.city ?? "—"],
    ["Metragem", b.metragem ?? "—"],
    ["Data", b.date ?? "—"],
    ["Validade (dias)", b.validity_days != null ? String(b.validity_days) : "—"],
  ];
  const resumoRight: [string, string][] = [
    ["Custo total (interno)", brl(totalCusto)],
    ["Venda (custo + BDI)", brl(totalVenda)],
    ["Ajustes globais", brl(totalAjustes)],
    ["Total geral", brl(totalVenda + totalAjustes)],
    ["Margem média", `${num(margemPct, 2)}%`],
    ["Total manual (orçamento)", brl(b.manual_total)],
    ["Custo registrado", brl(b.internal_cost)],
  ];

  autoTable(doc, {
    startY: 24,
    margin: { left: marginX, right: pageWidth / 2 + 2 },
    body: resumoLeft,
    theme: "plain",
    styles: { fontSize: 8, cellPadding: 1.2, textColor: 30 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 36, textColor: 90 },
      1: { cellWidth: "auto" },
    },
  });
  autoTable(doc, {
    startY: 24,
    margin: { left: pageWidth / 2 + 2, right: marginX },
    body: resumoRight,
    theme: "plain",
    styles: { fontSize: 8, cellPadding: 1.2, textColor: 30 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 46, textColor: 90 },
      1: { cellWidth: "auto", halign: "right" },
    },
  });

  // ── Itens (com TODOS os valores abertos) ──────────────────────────────
  type ItemBodyRow = (string | { content: string; colSpan?: number; styles?: Record<string, unknown> })[];
  const itemBody: ItemBodyRow[] = [];

  for (const sec of sections) {
    const secItems = items.filter((i) => i.section_id === sec.id);
    // Linha de cabeçalho da seção
    itemBody.push([
      {
        content: `${sec.title ?? "(sem título)"}${sec.is_optional ? "  ·  opcional" : ""}${
          sec.subtitle ? `  —  ${sec.subtitle}` : ""
        }`,
        colSpan: 9,
        styles: {
          fontStyle: "bold",
          fillColor: [243, 244, 246],
          textColor: 30,
          halign: "left",
        },
      },
    ]);

    if (secItems.length === 0) {
      itemBody.push([
        { content: "(seção sem itens)", colSpan: 5, styles: { textColor: 140, fontStyle: "italic" } },
        "—",
        brl(sec.section_price),
        "—",
        brl(sec.section_price),
      ]);
      continue;
    }

    let secCost = 0;
    let secVenda = 0;
    for (const it of secItems) {
      const cost = Number(it.internal_total) || 0;
      const bdi = Number(it.bdi_percentage) || 0;
      const venda = cost * (1 + bdi / 100);
      const qty = Number(it.qty) || 0;
      const unitCost = it.internal_unit_price !== null
        ? Number(it.internal_unit_price)
        : (qty > 0 ? cost / qty : null);
      const unitVenda = qty > 0 ? venda / qty : null;
      secCost += cost;
      secVenda += venda;

      itemBody.push([
        it.title ?? "—",
        it.description ?? "",
        num(it.qty, 2),
        it.unit ?? "—",
        unitCost !== null ? brl(unitCost) : "—",
        brl(cost),
        `${num(bdi, 2)}%`,
        unitVenda !== null ? brl(unitVenda) : "—",
        brl(venda),
      ]);
    }
    const secMargem = secVenda > 0 ? ((secVenda - secCost) / secVenda) * 100 : 0;
    itemBody.push([
      {
        content: `Subtotal da seção  ·  margem ${num(secMargem, 2)}%`,
        colSpan: 5,
        styles: { fontStyle: "bold", halign: "right", textColor: 60 },
      },
      { content: brl(secCost), styles: { fontStyle: "bold", halign: "right" } },
      "",
      "",
      { content: brl(secVenda), styles: { fontStyle: "bold", halign: "right" } },
    ]);
  }

  autoTable(doc, {
    startY: Math.max(
      (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 50,
      50,
    ) + 4,
    margin: { left: marginX, right: marginX },
    head: [[
      "Item",
      "Descrição",
      "Qtd",
      "Un.",
      "Custo unit.",
      "Custo total",
      "BDI",
      "Venda unit.",
      "Venda total",
    ]],
    body: itemBody as unknown as (string | { content: string })[][],
    theme: "grid",
    styles: { fontSize: 7.5, cellPadding: 1.6, overflow: "linebreak", textColor: 30 },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: 255,
      fontSize: 7.5,
      halign: "center",
    },
    columnStyles: {
      0: { cellWidth: 38, fontStyle: "bold" },
      1: { cellWidth: 60 },
      2: { cellWidth: 14, halign: "right" },
      3: { cellWidth: 14, halign: "center" },
      4: { cellWidth: 24, halign: "right" },
      5: { cellWidth: 26, halign: "right" },
      6: { cellWidth: 16, halign: "right" },
      7: { cellWidth: 26, halign: "right" },
      8: { cellWidth: 28, halign: "right" },
    },
    didDrawPage: () => {
      const pageH = doc.internal.pageSize.getHeight();
      doc.setFontSize(7.5);
      doc.setTextColor(140);
      doc.text(
        `${codeStr}  ·  ${b.project_name ?? ""}  ·  ${b.client_name ?? ""}`,
        marginX,
        pageH - 6,
      );
      const pageNumber = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
      doc.text(
        `Página ${pageNumber}`,
        pageWidth - marginX,
        pageH - 6,
        { align: "right" },
      );
      doc.setTextColor(0);
    },
  });

  // ── Ajustes globais (se houver) ───────────────────────────────────────
  if (adjustments.length > 0) {
    autoTable(doc, {
      startY:
        ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ??
          80) + 6,
      margin: { left: marginX, right: marginX },
      head: [["Ajuste", "Sinal", "Valor", "Efetivo"]],
      body: adjustments.map((a) => {
        const sign = Number(a.sign) || 1;
        const amount = Number(a.amount) || 0;
        return [
          a.label || "(sem descrição)",
          sign >= 0 ? "+" : "-",
          brl(amount),
          brl(amount * sign),
        ];
      }),
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 1.6, textColor: 30 },
      headStyles: { fillColor: [15, 23, 42], textColor: 255 },
      columnStyles: {
        0: { cellWidth: "auto" },
        1: { cellWidth: 14, halign: "center" },
        2: { cellWidth: 30, halign: "right" },
        3: { cellWidth: 30, halign: "right" },
      },
    });
  }

  // ── Totais finais ─────────────────────────────────────────────────────
  autoTable(doc, {
    startY:
      ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 100) +
      4,
    margin: { left: pageWidth / 2, right: marginX },
    body: [
      ["Custo total", brl(totalCusto)],
      ["Venda (BDI)", brl(totalVenda)],
      ["Ajustes globais", brl(totalAjustes)],
      ["Margem média", `${num(margemPct, 2)}%`],
      [
        { content: "Total geral", styles: { fontStyle: "bold", textColor: 0 } } as unknown as string,
        { content: brl(totalVenda + totalAjustes), styles: { fontStyle: "bold", textColor: 0 } } as unknown as string,
      ],
    ],
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 1.4, textColor: 60 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 50 },
      1: { halign: "right" },
    },
  });

  // Nome do arquivo
  const codePart = b.sequential_code || b.id.slice(0, 8);
  const namePart = sanitizeFileName(b.project_name || b.client_name || "orcamento");
  const fileName = `${codePart}_${namePart}.pdf`;
  // `doc.output("blob")` devolve o mesmo conteúdo que `doc.save` gravaria,
  // permitindo pré-visualização em iframe antes do download.
  const blob = doc.output("blob");
  return { blob, fileName };
}

/**
 * Wrapper de compatibilidade — gera o PDF e dispara o download imediato.
 * Mantido para os call sites que ainda não usam a pré-visualização.
 */
export async function exportBudgetToPdf(budgetId: string): Promise<void> {
  const { blob, fileName } = await buildBudgetPdfBlob(budgetId);
  triggerBlobDownload(blob, fileName);
}

function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoga depois para garantir que o download começou.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
