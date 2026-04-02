import jsPDF from "jspdf";
import { calculateSectionSubtotal } from "@/lib/supabase-helpers";
import type { BudgetData, BudgetSection } from "@/types/budget";

const LOWERCASE_WORDS = new Set(["e", "de", "do", "da", "dos", "das", "em", "no", "na", "nos", "nas", "com", "por", "para", "ao", "aos"]);

function toTitleCase(str: string): string {
  if (!str) return str;
  return str
    .toLowerCase()
    .split(/\s+/)
    .map((word, i) => (i > 0 && LOWERCASE_WORDS.has(word)) ? word : word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const A4_W = 210;
const A4_H = 297;
const M = 12; // margin
const CW = A4_W - M * 2; // content width

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function sanitizeClientName(value: string): string {
  return value
    .replace(/\d{3}\.?\d{3}\.?\d{3}[-.]?\d{2}/g, "")
    .replace(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}[-.]?\d{2}/g, "")
    .replace(/\b\d{11,14}\b/g, "")
    .replace(/\b(?:n[ºo°]\s*)?\d{5,}\b/gi, "")
    .replace(/^\s*(?:nome\s+do\s+)?cliente\s*[:\-–]?\s*/i, "")
    .replace(/^\s*(?:orçamento|orcamento|proposta)\s*(?:n[ºo°]\s*\d+)?\s*(?:para|de)?\s*/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function formatName(str: string): string {
  return str.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

async function loadLogoAsDataUrl(): Promise<string | null> {
  try {
    const mod = await import("@/assets/logo-bwild-white.png");
    const url = mod.default as string;
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Export budget as a clean table-based PDF with dark hero header.
 */
export async function exportBudgetPdf(_elementId: string, filename: string, budget?: BudgetData) {
  if (!budget) throw new Error("Budget data is required for PDF export");

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const logoDataUrl = await loadLogoAsDataUrl();

  let y = drawHeroHeader(pdf, budget, logoDataUrl);
  y = drawTable(pdf, budget, y);
  y = drawFooter(pdf, budget, y);

  pdf.save(filename);
}

// ── Hero Header (dark background, matching the public budget hero) ──

function drawHeroHeader(pdf: jsPDF, budget: BudgetData, logoDataUrl: string | null): number {
  const headerH = 52;

  // Dark background
  pdf.setFillColor(30, 32, 38);
  pdf.rect(0, 0, A4_W, headerH, "F");

  let y = 8;

  // Logo
  if (logoDataUrl) {
    try {
      // Logo aspect ~383/128 ≈ 3:1, target height 8mm
      pdf.addImage(logoDataUrl, "PNG", M, y, 24, 8);
    } catch { /* skip logo on error */ }
  }
  y += 12;

  // Company info line
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(6.5);
  pdf.setTextColor(180, 180, 190);
  pdf.text(
    "CNPJ: 47.350.338/0001-37 · Responsável Técnico: Thiago Dantas do Amor · CAU: A162437-7",
    M,
    y
  );
  y += 8;

  // Client name
  const clientName = budget.client_name ? formatName(sanitizeClientName(budget.client_name)) : budget.project_name;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.setTextColor(255, 255, 255);
  pdf.text(clientName, M, y);
  y += 7;

  // Meta line: Condomínio · Bairro · Área · Versão · Elaboração
  const parts: string[] = [];
  if (budget.condominio) parts.push(`Condomínio  ${budget.condominio}`);
  if (budget.bairro) parts.push(`Bairro  ${budget.bairro}`);
  const rawArea = budget.metragem ? budget.metragem.toString().replace(/\s/g, "").replace(/m²?$/i, "") : "";
  if (rawArea) parts.push(`Área  ${rawArea}m²`);
  const vNum = budget.versao ? budget.versao.replace(/^v/i, "") : String(budget.version_number ?? "1");
  parts.push(`Versão  ${vNum}`);
  if (budget.date) {
    const d = new Date(budget.date);
    parts.push(`Elaboração  ${d.toLocaleDateString("pt-BR")}`);
  }

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(200, 200, 210);
  pdf.text(parts.join("  ·  "), M, y);
  y += 6;

  // Tagline
  pdf.setFontSize(7);
  pdf.setTextColor(150, 155, 165);
  pdf.text("Projeto personalizado · Gestão completa · Execução com garantia", M, y);

  return headerH + 6;
}

// ── Table ──

const COL_CODE = 18;
const COL_ITEM = 82;
const COL_DESC = 44;
const COL_QTY = 16;

function drawTable(pdf: jsPDF, budget: BudgetData, startY: number): number {
  let y = startY;
  y = drawTableHeader(pdf, y);

  const sections = budget.sections || [];

  sections.forEach((section, sIdx) => {
    const sectionNum = sIdx + 1;
    const subtotal = calculateSectionSubtotal(section);

    if (y > A4_H - M - 10) {
      pdf.addPage();
      y = M;
      y = drawTableHeader(pdf, y);
    }

    // Section row
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
    pdf.text(toTitleCase(section.title), M + COL_CODE + 2, sy);
    pdf.text(fmtBRL(subtotal), M + CW - 2, sy, { align: "right" });

    y += sectionRowH;

    // Items
    const items = section.items || [];
    items.forEach((item, iIdx) => {
      const itemNum = `${sectionNum}.${iIdx + 1}`;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      const titleLines = pdf.splitTextToSize(item.title || "", COL_ITEM - 4);
      const cleanDesc = item.description ? item.description.replace(/https?:\/\/\S+/gi, "").replace(/\s{2,}/g, " ").trim() : "";
      const descLines = cleanDesc ? pdf.splitTextToSize(cleanDesc, COL_DESC - 4) : [];
      const lineCount = Math.max(titleLines.length, descLines.length, 1);
      const rowH = Math.max(6, lineCount * 4 + 2);

      if (y + rowH > A4_H - M - 5) {
        pdf.addPage();
        y = M;
        y = drawTableHeader(pdf, y);
      }

      pdf.setDrawColor(220, 220, 220);
      pdf.setLineWidth(0.15);
      pdf.rect(M, y, CW, rowH, "S");

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      pdf.setTextColor(60, 60, 60);

      const iy = y + 4;
      pdf.text(itemNum, M + COL_CODE - 2, iy, { align: "right" });
      pdf.text(titleLines, M + COL_CODE + 2, iy);
      if (descLines.length > 0) {
        pdf.text(descLines, M + COL_CODE + COL_ITEM + 2, iy);
      }
      if (item.qty) {
        pdf.text(String(item.qty), M + COL_CODE + COL_ITEM + COL_DESC + COL_QTY / 2, iy, { align: "center" });
      }

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
  pdf.text("Código", M + 2, hy);
  pdf.text("Item", M + COL_CODE + 2, hy);
  pdf.text("Descrição", M + COL_CODE + COL_ITEM + 2, hy);
  pdf.text("Qtd.", M + COL_CODE + COL_ITEM + COL_DESC + COL_QTY / 2, hy, { align: "center" });
  pdf.text("R$ Total", M + CW - 2, hy, { align: "right" });

  return y + headerH;
}

// ── Footer (adjustments + total) ──

function drawFooter(pdf: jsPDF, budget: BudgetData, startY: number): number {
  let y = startY + 4;
  const sections = budget.sections || [];
  const adjustments = budget.adjustments || [];

  if (y > A4_H - M - 30) {
    pdf.addPage();
    y = M;
  }

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

  if (budget.generated_at || budget.date) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(150, 150, 150);
    const dateStr = budget.generated_at || budget.date || "";
    if (dateStr) {
      const d = new Date(dateStr);
      pdf.text(`Gerado em ${d.toLocaleDateString("pt-BR")}`, A4_W / 2, y, { align: "center" });
    }
  }

  return y;
}
