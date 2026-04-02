import jsPDF from "jspdf";
import { calculateSectionSubtotal } from "@/lib/supabase-helpers";
import type { BudgetData, BudgetSection, BudgetAdjustment } from "@/types/budget";

const A4_W = 210;
const A4_H = 297;
const M = 12; // margin
const CW = A4_W - M * 2; // content width

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Export budget as a clean table-based PDF.
 * Hero header at top, then a table: Código | Item | Descrição | Qtd. | R$ Total
 * Section rows show number + title + subtotal.
 * Item rows show sub-number + title + description + qty (no price).
 */
export async function exportBudgetPdf(_elementId: string, filename: string, budget?: BudgetData) {
  if (!budget) throw new Error("Budget data is required for PDF export");

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // ── Hero Header ──
  let y = drawHeroHeader(pdf, budget);

  // ── Table ──
  y = drawTable(pdf, budget, y);

  // ── Adjustments + Total ──
  y = drawFooter(pdf, budget, y);

  pdf.save(filename);
}

function drawHeroHeader(pdf: jsPDF, budget: BudgetData): number {
  let y = M;

  // Title
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.setTextColor(33, 33, 33);
  pdf.text("Orçamento", M, y + 6);
  y += 12;

  // Project info
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(100, 100, 100);

  const infoParts: string[] = [];
  if (budget.project_name) infoParts.push(budget.project_name);
  if (budget.client_name) infoParts.push(`Cliente: ${budget.client_name}`);
  if (budget.metragem) infoParts.push(`${budget.metragem}`);
  if (budget.versao || budget.version_number) {
    const v = budget.versao || `v${budget.version_number}`;
    infoParts.push(v);
  }
  if (budget.date) {
    const d = new Date(budget.date);
    infoParts.push(
      d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
    );
  }

  if (infoParts.length > 0) {
    pdf.text(infoParts.join("  •  "), M, y + 4);
    y += 8;
  }

  // Divider line
  y += 2;
  pdf.setDrawColor(200, 200, 200);
  pdf.setLineWidth(0.3);
  pdf.line(M, y, A4_W - M, y);
  y += 4;

  return y;
}

// Column widths (total = CW = 186mm)
const COL_CODE = 18;
const COL_ITEM = 82;
const COL_DESC = 44;
const COL_QTY = 16;
const COL_TOTAL = CW - COL_CODE - COL_ITEM - COL_DESC - COL_QTY; // 26

function drawTable(pdf: jsPDF, budget: BudgetData, startY: number): number {
  let y = startY;

  // Table header
  y = drawTableHeader(pdf, y);

  const sections = budget.sections || [];

  sections.forEach((section, sIdx) => {
    const sectionNum = sIdx + 1;
    const subtotal = calculateSectionSubtotal(section);

    // Check if we need a new page
    if (y > A4_H - M - 10) {
      pdf.addPage();
      y = M;
      y = drawTableHeader(pdf, y);
    }

    // Section row (bold, light background)
    const sectionRowH = 7;
    pdf.setFillColor(240, 240, 240);
    pdf.rect(M, y, CW, sectionRowH, "F");
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.2);
    pdf.rect(M, y, CW, sectionRowH, "S");

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(33, 33, 33);

    const sy = y + 5;
    pdf.text(String(sectionNum), M + COL_CODE - 2, sy, { align: "right" });
    pdf.text(section.title, M + COL_CODE + 2, sy);
    // R$ Total for section (right-aligned in last column)
    pdf.text(
      fmtBRL(subtotal),
      M + CW - 2,
      sy,
      { align: "right" }
    );

    y += sectionRowH;

    // Item rows
    const items = section.items || [];
    items.forEach((item, iIdx) => {
      const itemNum = `${sectionNum}.${iIdx + 1}`;

      // Calculate row height based on text wrapping
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      const titleLines = pdf.splitTextToSize(item.title || "", COL_ITEM - 4);
      const descLines = item.description
        ? pdf.splitTextToSize(item.description, COL_DESC - 4)
        : [];
      const lineCount = Math.max(titleLines.length, descLines.length, 1);
      const rowH = Math.max(6, lineCount * 4 + 2);

      // Page break check
      if (y + rowH > A4_H - M - 5) {
        pdf.addPage();
        y = M;
        y = drawTableHeader(pdf, y);
      }

      // Row border
      pdf.setDrawColor(220, 220, 220);
      pdf.setLineWidth(0.15);
      pdf.rect(M, y, CW, rowH, "S");

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      pdf.setTextColor(60, 60, 60);

      const iy = y + 4;

      // Code
      pdf.text(itemNum, M + COL_CODE - 2, iy, { align: "right" });

      // Item title
      let x = M + COL_CODE + 2;
      pdf.text(titleLines, x, iy);

      // Description
      if (descLines.length > 0) {
        x = M + COL_CODE + COL_ITEM + 2;
        pdf.text(descLines, x, iy);
      }

      // Qty
      if (item.qty) {
        const qtyX = M + COL_CODE + COL_ITEM + COL_DESC + COL_QTY / 2;
        pdf.text(String(item.qty), qtyX, iy, { align: "center" });
      }

      // No price for items — only sections show R$ Total

      y += rowH;
    });
  });

  return y;
}

function drawTableHeader(pdf: jsPDF, y: number): number {
  const headerH = 7;
  pdf.setFillColor(50, 50, 50);
  pdf.rect(M, y, CW, headerH, "F");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(255, 255, 255);

  const hy = y + 5;
  let x = M + 2;
  pdf.text("Código", x, hy);
  x = M + COL_CODE + 2;
  pdf.text("Item", x, hy);
  x = M + COL_CODE + COL_ITEM + 2;
  pdf.text("Descrição", x, hy);
  x = M + COL_CODE + COL_ITEM + COL_DESC + COL_QTY / 2;
  pdf.text("Qtd.", x, hy, { align: "center" });
  pdf.text("R$ Total", M + CW - 2, hy, { align: "right" });

  y += headerH;
  return y;
}

function drawFooter(pdf: jsPDF, budget: BudgetData, startY: number): number {
  let y = startY + 4;

  const sections = budget.sections || [];
  const adjustments = budget.adjustments || [];

  // Page break check
  if (y > A4_H - M - 30) {
    pdf.addPage();
    y = M;
  }

  // Adjustments
  if (adjustments.length > 0) {
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.3);
    pdf.line(M, y, A4_W - M, y);
    y += 5;

    adjustments.forEach((adj) => {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(80, 80, 80);
      pdf.text(adj.label, M, y + 3);
      const sign = adj.sign > 0 ? "+" : "−";
      pdf.text(`${sign} R$ ${fmtBRL(Math.abs(adj.amount))}`, A4_W - M, y + 3, { align: "right" });
      y += 6;
    });
  }

  // Total
  const total = sections.reduce((s, sec) => s + calculateSectionSubtotal(sec), 0) +
    adjustments.reduce((s, a) => s + a.amount * a.sign, 0);

  y += 2;
  pdf.setFillColor(240, 245, 250);
  pdf.rect(M, y, CW, 10, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(33, 33, 33);
  pdf.text("Investimento Total", M + 4, y + 7);
  pdf.text(`R$ ${fmtBRL(total)}`, A4_W - M - 4, y + 7, { align: "right" });

  y += 14;

  // Generated date
  if (budget.generated_at || budget.date) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(150, 150, 150);
    const dateStr = budget.generated_at || budget.date || "";
    if (dateStr) {
      const d = new Date(dateStr);
      pdf.text(
        `Gerado em ${d.toLocaleDateString("pt-BR")}`,
        A4_W / 2,
        y,
        { align: "center" }
      );
    }
  }

  return y;
}
