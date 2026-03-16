import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, FileText, AlertCircle, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { matchAndCopyItemMedia } from "@/lib/item-media-matcher";

interface ParsedRow {
  section: string;
  title: string;
  description?: string;
  qty?: number;
  unit?: string;
  unitPrice?: number;
  total?: number;
}

interface ParsedMeta {
  clientName?: string | null;
  projectName?: string | null;
  area?: string | null;
  bairro?: string | null;
  version?: string | null;
  date?: string | null;
  grandTotal?: number | null;
}

interface ImportExcelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileFilter?: 'pdf' | 'excel';
  /** If set, the imported budget will be assigned to this version group instead of being standalone. */
  targetBudgetGroupId?: string;
}

type ImportStep = "upload" | "parsing" | "preview" | "importing" | "done";

const normalizeClientName = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;

  const raw = String(value).replace(/\s+/g, " ").trim();
  if (!raw) return null;

  const withoutDocs = raw
    .replace(/\d{3}\.?\d{3}\.?\d{3}[-.]?\d{2}/g, "")
    .replace(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}[-.]?\d{2}/g, "")
    .replace(/\b\d{11,14}\b/g, "")
    .replace(/\b(?:n[ºo°]\s*)?\d{5,}\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  const cleaned = withoutDocs
    .replace(/^\s*(?:nome\s+do\s+)?cliente\s*[:\-–]?\s*/i, "")
    .replace(/^\s*(?:orçamento|orcamento|proposta)\s*(?:n[ºo°]\s*\d+)?\s*(?:para|de)?\s*/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!cleaned) return null;

  return cleaned
    .toLocaleLowerCase("pt-BR")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toLocaleUpperCase("pt-BR") + part.slice(1))
    .join(" ");
};

export function ImportExcelModal({ open, onOpenChange, fileFilter, targetBudgetGroupId }: ImportExcelModalProps) {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [parsedMeta, setParsedMeta] = useState<ParsedMeta>({});
  const [parsedSectionTotals, setParsedSectionTotals] = useState<Record<string, number>>({});
  const [step, setStep] = useState<ImportStep>("upload");
  const [error, setError] = useState<string | null>(null);
  const [createdBudgetId, setCreatedBudgetId] = useState<string | null>(null);

  const toNumber = useCallback((value: unknown): number | undefined => {
    if (value === null || value === undefined || value === "") return undefined;
    if (typeof value === "number") return Number.isFinite(value) ? value : undefined;

    const raw = String(value).replace(/R\$/gi, "").replace(/\s/g, "").trim();
    if (!raw) return undefined;

    const hasComma = raw.includes(",");
    const hasDot = raw.includes(".");

    const normalized = (hasComma && hasDot
      ? raw.replace(/\./g, "").replace(/,/g, ".")
      : hasComma
        ? raw.replace(/,/g, ".")
        : raw
    ).replace(/[^0-9.-]/g, "");

    if (!normalized || normalized === "-" || normalized === ".") return undefined;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
  }, []);

  const reset = () => {
    setFile(null);
    setParsedRows([]);
    setParsedMeta({});
    setParsedSectionTotals({});
    setStep("upload");
    setError(null);
    setCreatedBudgetId(null);
  };

  const handleClose = (val: boolean) => {
    if (!val) reset();
    onOpenChange(val);
  };

  const extractStructuredPageText = useCallback((items: any[]): string => {
    const tokens = (items || [])
      .map((item: any) => ({
        text: String(item?.str || "").trim(),
        x: Number(item?.transform?.[4] ?? 0),
        y: Number(item?.transform?.[5] ?? 0),
      }))
      .filter((token: any) => token.text.length > 0);

    if (tokens.length === 0) return "";

    const lines: Array<{ y: number; tokens: Array<{ text: string; x: number }> }> = [];
    const yThreshold = 2.5;

    for (const token of tokens) {
      const line = lines.find((l) => Math.abs(l.y - token.y) <= yThreshold);
      if (line) {
        line.tokens.push({ text: token.text, x: token.x });
        line.y = (line.y + token.y) / 2;
      } else {
        lines.push({ y: token.y, tokens: [{ text: token.text, x: token.x }] });
      }
    }

    return lines
      .sort((a, b) => b.y - a.y)
      .map((line) => line.tokens.sort((a, b) => a.x - b.x).map((t) => t.text).join(" "))
      .join("\n");
  }, []);

  const renderPdfPagesAsImages = useCallback(async (pdf: any, maxPages = 8) => {
    const pageImages: string[] = [];
    const scale = 1.8;

    for (let i = 1; i <= Math.min(pdf.numPages, maxPages); i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      await page.render({ canvasContext: ctx, viewport }).promise;
      pageImages.push(canvas.toDataURL("image/png", 0.9));
    }

    return pageImages;
  }, []);

  const invokePdfParser = useCallback(async (body: Record<string, unknown>) => {
    const { data, error: fnError } = await supabase.functions.invoke("parse-budget-pdf", { body });
    if (fnError) throw new Error(fnError.message);
    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

  // ─── Excel parsing ───
  const detectColumns = (headers: string[]): Record<string, number> => {
    const map: Record<string, number> = {};
    const lower = headers.map((h) => (h || "").toString().trim().toLowerCase());
    const patterns: Record<string, string[]> = {
      index: ["índice", "indice", "index"],
      code: ["cód", "cod", "código", "codigo"],
      section: ["seção", "secao", "seçao", "section", "categoria", "ambiente", "pacote"],
      title: ["item", "título", "titulo", "nome", "descrição curta", "servico", "serviço"],
      description: ["descrição", "descricao", "desc", "observação", "obs", "detalhe"],
      qty: ["qtd", "quantidade", "qty", "quant"],
      unit: ["unidade", "und", "un", "unit", "unid"],
      unitPrice: ["preço unit", "preco unit", "valor unit", "unit price", "p.u.", "pu"],
      total: ["total", "valor", "subtotal", "valor total", "preço total", "total venda"],
    };
    for (const [key, words] of Object.entries(patterns)) {
      const idx = lower.findIndex((h) => h && words.some((w) => h.includes(w)));
      if (idx !== -1) map[key] = idx;
    }
    return map;
  };

  const parseExcel = useCallback((f: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array", cellDates: false, cellNF: false, cellText: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

        // Filter out completely empty rows
        const nonEmptyRows = json.filter((row) => Array.isArray(row) && row.some((cell: any) => cell !== undefined && cell !== null && cell !== ""));

        if (nonEmptyRows.length < 2) {
          setError("A planilha precisa ter pelo menos 2 linhas (cabeçalho + dados).");
          return;
        }

        // Find header row (may not be the first row)
        let headerRowIdx = 0;
        for (let i = 0; i < Math.min(nonEmptyRows.length, 15); i++) {
          const row = nonEmptyRows[i];
          if (!row) continue;
          const lower = row.map((c: any) => (c == null ? "" : String(c)).trim().toLowerCase());
          if (lower.some((h: string) => h && (h.includes("item") || h.includes("índice") || h.includes("indice") || h.includes("seção") || h.includes("secao") || h.includes("título") || h.includes("titulo")))) {
            headerRowIdx = i;
            break;
          }
        }

        const headerRow = nonEmptyRows[headerRowIdx];
        if (!headerRow || !Array.isArray(headerRow)) {
          setError("Cabeçalho não encontrado na planilha.");
          return;
        }

        const headers = Array.from(headerRow, (c: any) => (c == null ? "" : String(c)));
        const map = detectColumns(headers);

        console.log("[Excel Import] Header row:", headerRowIdx, headers);
        console.log("[Excel Import] Column map:", map);

        if (!map.section && !map.title && !map.index) {
          const firstTextCol = headers.findIndex((h) => h.trim().length > 0);
          if (firstTextCol !== -1) {
            map.title = firstTextCol;
          } else {
            setError("Não foi possível detectar as colunas 'Seção' e 'Item'. Verifique o cabeçalho.");
            return;
          }
        }

        const dataRows = nonEmptyRows.slice(headerRowIdx + 1);
        const indexCol = map.index !== undefined ? map.index : -1;

        // Extract metadata from rows before header
        const meta: ParsedMeta = {};
        for (let i = 0; i < headerRowIdx && i < nonEmptyRows.length; i++) {
          const row = nonEmptyRows[i];
          if (!row) continue;
          const rowText = row.map((c: any) => String(c ?? "").trim()).join(" ").toLowerCase();
          for (let j = 0; j < row.length; j++) {
            const cellText = String(row[j] ?? "").trim().toLowerCase();
            if (cellText.includes("cliente")) {
              const val = normalizeClientName(row[j + 1] ?? row[j + 2] ?? "");
              if (val) meta.clientName = val;
            }
            if (cellText.includes("obra")) {
              const val = String(row[j + 1] ?? row[j + 2] ?? "").trim();
              if (val) meta.projectName = val;
            }
          }
        }
        if (meta.clientName || meta.projectName) {
          setParsedMeta(meta);
        }

        let currentSection = "Geral";
        const rows: ParsedRow[] = [];
        const sectionTotals: Record<string, number> = {};

        const isTopLevel = (v: string) => /^\d+$/.test(v.trim());
        const isSubSection = (v: string) => /^\d+\.\d+$/.test(v.trim());

        for (const row of dataRows) {
          if (!Array.isArray(row)) continue;
          const cells = row.map((c: any) => (c == null ? "" : c));

          const indexVal = indexCol >= 0 ? String(cells[indexCol] ?? "").trim() : "";
          const itemName = map.title !== undefined ? String(cells[map.title] ?? "").trim() : "";

          if (!itemName) continue;

          // Top-level index (e.g. "1", "2") = section header with total
          if (indexCol >= 0 && isTopLevel(indexVal)) {
            currentSection = itemName;
            const total = map.total !== undefined ? toNumber(cells[map.total]) : undefined;
            if (total && total > 0) {
              sectionTotals[currentSection] = total;
            }
            continue;
          }

          // Sub-section header (e.g. "3.1", "4.2") — treat as header if it has NO qty
          // Items like "6.1" with qty are leaf items and should be imported
          if (indexCol >= 0 && isSubSection(indexVal)) {
            const hasQty = map.qty !== undefined && cells[map.qty] !== undefined && cells[map.qty] !== "" && cells[map.qty] !== 0;
            if (!hasQty) {
              // Sub-section header — skip (its total is already included in parent section total)
              continue;
            }
          }

          const section = map.section !== undefined ? String(cells[map.section] || currentSection) : currentSection;

          rows.push({
            section,
            title: itemName,
            description: map.description !== undefined ? String(cells[map.description] || "") : undefined,
            qty: map.qty !== undefined ? toNumber(cells[map.qty]) : undefined,
            unit: map.unit !== undefined ? String(cells[map.unit] || "") : undefined,
            unitPrice: map.unitPrice !== undefined ? toNumber(cells[map.unitPrice]) : undefined,
            total: map.total !== undefined ? toNumber(cells[map.total]) : undefined,
          });
        }

        if (rows.length === 0) {
          setError("Nenhum item encontrado na planilha.");
          return;
        }

        // Extract grand total from last rows (often in the spreadsheet footer)
        for (let i = nonEmptyRows.length - 1; i >= Math.max(0, nonEmptyRows.length - 5); i--) {
          const row = nonEmptyRows[i];
          if (!row) continue;
          for (const cell of row) {
            const val = toNumber(cell);
            if (val && val > 10000) {
              meta.grandTotal = val;
              break;
            }
          }
          if (meta.grandTotal) break;
        }
        setParsedMeta({ ...meta });

        // Use section totals from top-level headers (they already include sub-section totals)
        // Only recalculate if we have no section totals but items have individual totals
        if (Object.keys(sectionTotals).length === 0) {
          rows.forEach((row) => {
            if (!row.total) return;
            sectionTotals[row.section] = (sectionTotals[row.section] || 0) + row.total;
          });
        }

        console.log("[Excel Import] Parsed", rows.length, "items across", new Set(rows.map(r => r.section)).size, "sections");

        setParsedSectionTotals(sectionTotals);
        setParsedRows(rows);
        setStep("preview");
      } catch (err) {
        console.error("[Excel Import] Error:", err);
        setError(`Erro ao ler o arquivo: ${err instanceof Error ? err.message : "formato inválido"}. Verifique se é um Excel válido (.xlsx ou .xls).`);
      }
    };
    reader.onerror = () => {
      setError("Erro ao ler o arquivo. Tente novamente.");
    };
    reader.readAsArrayBuffer(f);
  }, [toNumber]);

  // ─── PDF parsing (AI-powered) ───
  const parsePdf = useCallback(async (f: File) => {
    setStep("parsing");
    setError(null);

    try {
      const arrayBuffer = await f.arrayBuffer();
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
      let textContent = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = extractStructuredPageText(content.items as any[]);
        textContent += `\n--- Página ${i} ---\n${pageText}\n`;
      }

      const isScanned = !textContent.trim() || textContent.trim().length < 120;
      let parsedData: any;

      if (isScanned) {
        const pageImages = await renderPdfPagesAsImages(pdf, 10);
        parsedData = await invokePdfParser({ pageImages });
      } else {
        // Always send images alongside text for better table/value extraction
        const pageImages = await renderPdfPagesAsImages(pdf, 10);
        parsedData = await invokePdfParser({ textContent, pageImages });
      }

      const hasValues = (sections: any[]) =>
        sections.some(
          (section: any) =>
            (toNumber(section?.total) || 0) > 0 ||
            (section?.items || []).some((item: any) => (toNumber(item?.total) || 0) > 0)
        );

      if (
        !isScanned &&
        (!Array.isArray(parsedData?.sections) ||
          parsedData.sections.length === 0 ||
          !hasValues(parsedData.sections))
      ) {
        const pageImages = await renderPdfPagesAsImages(pdf, 8);
        parsedData = await invokePdfParser({ textContent, pageImages });
      }

      const sections = Array.isArray(parsedData?.sections) ? parsedData.sections : [];
      const rows: ParsedRow[] = [];
      const sectionTotals: Record<string, number> = {};

      for (const section of sections) {
        const sectionTitle = String(section?.title || "Geral").trim() || "Geral";
        const normalizedSectionTotal = toNumber(section?.total);

        if (normalizedSectionTotal && normalizedSectionTotal > 0) {
          sectionTotals[sectionTitle] = normalizedSectionTotal;
        }

        for (const item of section?.items || []) {
          const title = String(item?.title || "").trim();
          if (!title) continue;

          rows.push({
            section: sectionTitle,
            title,
            description: String(item?.description || "").trim() || undefined,
            qty: toNumber(item?.qty),
            unit: String(item?.unit || "").trim() || undefined,
            unitPrice: toNumber(item?.unitPrice),
            total: toNumber(item?.total),
          });
        }
      }

      if (rows.length === 0) {
        setError("Nenhum item encontrado no PDF.");
        setStep("upload");
        return;
      }

      if (parsedData?.meta) {
        setParsedMeta({
          clientName: normalizeClientName(parsedData.meta.clientName),
          projectName: parsedData.meta.projectName || null,
          area: parsedData.meta.area || null,
          bairro: parsedData.meta.bairro || null,
          version: parsedData.meta.version || null,
          date: parsedData.meta.date || null,
          grandTotal: toNumber(parsedData.meta.grandTotal) || null,
        });
      }

      setParsedSectionTotals(sectionTotals);
      setParsedRows(rows);
      setStep("preview");
    } catch (err: any) {
      console.error("PDF parse error:", err);
      setError(err?.message || "Erro ao processar o PDF. Tente novamente.");
      setStep("upload");
    }
  }, [extractStructuredPageText, invokePdfParser, renderPdfPagesAsImages, toNumber]);

  // ─── File handler ───
  const handleFile = useCallback(
    (f: File) => {
      setFile(f);
      setError(null);
      const ext = f.name.split(".").pop()?.toLowerCase();

      if (ext === "pdf") {
        parsePdf(f);
      } else if (ext === "xlsx" || ext === "xls" || ext === "csv") {
        parseExcel(f);
      } else {
        setError(
          fileFilter === 'pdf'
            ? "Formato não suportado. Use apenas arquivos .pdf"
            : fileFilter === 'excel'
              ? "Formato não suportado. Use .xlsx, .xls ou .csv"
              : "Formato não suportado. Use .xlsx, .xls, .csv ou .pdf"
        );
      }
    },
    [parseExcel, parsePdf]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  // ─── Import to database ───
  const handleImport = async () => {
    setStep("importing");
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const sectionMap = new Map<string, ParsedRow[]>();
      parsedRows.forEach((row) => {
        const key = row.section?.trim() || "Geral";
        const list = sectionMap.get(key) || [];
        list.push(row);
        sectionMap.set(key, list);
      });

      const normalizedClientName = normalizeClientName(parsedMeta.clientName);
      const clientName = normalizedClientName || "Cliente";
      const projectName =
        parsedMeta.projectName?.trim() ||
        (normalizedClientName ? `Reforma ${normalizedClientName}` : file?.name.replace(/\.(xlsx|xls|pdf)$/i, "") || "Importação");

      const { data: budget, error: budgetErr } = await supabase
        .from("budgets")
        .insert({
          project_name: projectName,
          client_name: clientName,
          metragem: parsedMeta.area || null,
          bairro: parsedMeta.bairro || null,
          versao: parsedMeta.version || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (budgetErr || !budget) throw budgetErr;

      let sectionIdx = 0;
      const createdSections: { id: string; title: string }[] = [];

      for (const [sectionTitle, items] of sectionMap.entries()) {
        const calculatedSectionTotal = items.reduce((sum, item) => sum + (item.total || 0), 0);
        const parserSectionTotal = parsedSectionTotals[sectionTitle] || 0;
        const finalSectionTotal =
          calculatedSectionTotal > 0
            ? calculatedSectionTotal
            : parserSectionTotal > 0
              ? parserSectionTotal
              : null;

        const { data: section, error: secErr } = await supabase
          .from("sections")
          .insert({
            budget_id: budget.id,
            title: sectionTitle,
            order_index: sectionIdx++,
            section_price: finalSectionTotal,
          })
          .select()
          .single();

        if (secErr || !section) {
          throw secErr || new Error(`Falha ao criar seção: ${sectionTitle}`);
        }

        createdSections.push({ id: section.id, title: sectionTitle });

        const itemInserts = items.map((item, i) => {
          const hasQty = typeof item.qty === "number" && Number.isFinite(item.qty) && item.qty > 0;
          const inferredTotal =
            item.total ??
            (hasQty && item.unitPrice ? item.qty! * item.unitPrice : undefined) ??
            (items.length === 1 && finalSectionTotal ? finalSectionTotal : undefined);

          const inferredUnitPrice =
            item.unitPrice ??
            (hasQty && inferredTotal !== undefined ? inferredTotal / (item.qty as number) : undefined);

          return {
            section_id: section.id,
            title: item.title,
            description: item.description || null,
            qty: item.qty || null,
            unit: item.unit || null,
            internal_unit_price: inferredUnitPrice ?? null,
            internal_total: inferredTotal ?? null,
            order_index: i,
          };
        });

        const { error: itemsErr } = await supabase.from("items").insert(itemInserts);
        if (itemsErr) throw itemsErr;
      }

      // Auto-match images and descriptions from existing items in mobiliário/eletro/marcenaria
      try {
        const result = await matchAndCopyItemMedia(budget.id, createdSections);
        if (result.matched > 0) {
          console.log(`[Import] Auto-matched ${result.matched} items with existing media`);
        }
      } catch (matchErr) {
        console.warn("[Import] Media matching failed (non-critical):", matchErr);
      }

      // If importing into an existing budget group, assign to that group
      if (targetBudgetGroupId) {
        const { assignImportedBudgetToGroup } = await import("@/lib/budget-versioning");
        await assignImportedBudgetToGroup(budget.id, targetBudgetGroupId);
      }

      setCreatedBudgetId(budget.id);
      setStep("done");
    } catch (err: any) {
      setError(err?.message || "Erro ao importar.");
      setStep("preview");
    }
  };

  // Group for preview
  const sectionGroups = parsedRows.reduce<Record<string, ParsedRow[]>>((acc, row) => {
    (acc[row.section] = acc[row.section] || []).push(row);
    return acc;
  }, {});

  const isPdf = file?.name.toLowerCase().endsWith(".pdf");

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[100dvh] sm:max-h-[85vh] overflow-y-auto w-[calc(100%-2rem)] sm:w-full rounded-2xl sm:rounded-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display pr-8 text-base sm:text-lg">
            {fileFilter === 'pdf' ? <FileText className="h-5 w-5 text-primary" /> : <FileSpreadsheet className="h-5 w-5 text-primary" />}
            {fileFilter === 'pdf' ? 'Importar PDF' : fileFilter === 'excel' ? 'Importar Planilha' : 'Importar Orçamento'}
          </DialogTitle>
          <DialogDescription className="font-body text-xs sm:text-sm">
            {fileFilter === 'pdf'
              ? <>Faça upload de um arquivo <strong>.pdf</strong> com os dados do orçamento. PDFs são processados com IA para extrair seções e itens automaticamente.</>
              : fileFilter === 'excel'
                ? <>Faça upload de uma planilha <strong>.xlsx</strong>, <strong>.xls</strong> ou <strong>.csv</strong> com os dados do orçamento.</>
                : <>Faça upload de um arquivo <strong>.xlsx</strong>, <strong>.xls</strong>, <strong>.csv</strong> ou <strong>.pdf</strong> com os dados do orçamento.</>
            }
          </DialogDescription>
        </DialogHeader>

        {/* Step: Upload */}
        {step === "upload" && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed border-border rounded-xl p-6 sm:p-10 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 active:bg-primary/10 transition-all min-h-[160px] sm:min-h-0 flex flex-col items-center justify-center"
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = fileFilter === 'pdf' ? '.pdf' : fileFilter === 'excel' ? '.xlsx,.xls,.csv' : '.xlsx,.xls,.csv,.pdf';
              input.onchange = (e: any) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              };
              input.click();
            }}
          >
            <Upload className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground mb-3" />
            <p className="text-sm font-body text-foreground font-medium mb-1">
              Toque para selecionar <span className="hidden sm:inline">ou arraste</span>
            </p>
            <p className="text-xs text-muted-foreground font-body">
              {fileFilter === 'pdf' ? '.pdf' : fileFilter === 'excel' ? '.xlsx, .xls ou .csv' : '.xlsx, .xls, .csv ou .pdf'}
            </p>
          </div>
        )}

        {/* Step: Parsing PDF with AI */}
        {step === "parsing" && (
          <div className="flex flex-col items-center py-10 gap-4">
            <div className="relative">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
              <Sparkles className="h-4 w-4 text-primary absolute -top-1 -right-1 animate-pulse" />
            </div>
            <div className="text-center">
              <p className="text-sm font-body text-foreground font-medium">Analisando PDF com IA...</p>
              <p className="text-xs text-muted-foreground font-body mt-1">
                Extraindo seções, itens e valores automaticamente (inclui OCR para PDFs escaneados)
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <p className="text-sm text-destructive font-body">{error}</p>
          </div>
        )}

        {/* Step: Preview */}
        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground font-body">
              {isPdf ? <FileText className="h-4 w-4" /> : <FileSpreadsheet className="h-4 w-4" />}
              <span className="truncate">{file?.name}</span>
              {isPdf && <Sparkles className="h-3 w-3 text-primary" />}
              <span className="ml-auto whitespace-nowrap">
                {parsedRows.length} itens • {Object.keys(sectionGroups).length} seções
              </span>
            </div>

            {/* Metadata from PDF */}
            {parsedMeta.clientName && (
              <div className="flex flex-wrap gap-2 text-xs font-body">
                {parsedMeta.clientName && (
                  <span className="px-2 py-1 rounded-md bg-muted text-foreground">
                    Cliente: {parsedMeta.clientName}
                  </span>
                )}
                {parsedMeta.area && (
                  <span className="px-2 py-1 rounded-md bg-muted text-foreground">
                    Área: {parsedMeta.area}
                  </span>
                )}
                {parsedMeta.bairro && (
                  <span className="px-2 py-1 rounded-md bg-muted text-foreground">
                    Bairro: {parsedMeta.bairro}
                  </span>
                )}
              </div>
            )}

            {/* Mobile: card list / Desktop: table */}
            <div className="border border-border rounded-lg overflow-hidden max-h-64 sm:max-h-80 overflow-y-auto">
              {/* Desktop table */}
              <table className="w-full text-xs font-body hidden sm:table">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Seção</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Item</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Qtd</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.slice(0, 50).map((row, i) => (
                    <tr key={i} className="border-t border-border/50">
                      <td className="px-3 py-1.5 text-muted-foreground">{row.section}</td>
                      <td className="px-3 py-1.5 text-foreground">{row.title}</td>
                      <td className="px-3 py-1.5 text-right text-muted-foreground">{row.qty ?? "—"}</td>
                      <td className="px-3 py-1.5 text-right text-foreground font-medium">
                        {row.total ? `R$ ${row.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Mobile card list */}
              <div className="sm:hidden divide-y divide-border">
                {parsedRows.slice(0, 30).map((row, i) => (
                  <div key={i} className="px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-body font-medium text-foreground truncate">{row.title}</p>
                        <p className="text-[10px] font-body text-muted-foreground truncate mt-0.5">{row.section}</p>
                      </div>
                      <span className="text-xs font-body font-medium text-foreground whitespace-nowrap">
                        {row.total ? `R$ ${row.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {parsedRows.length > 50 && (
                <p className="text-xs text-muted-foreground text-center py-2 font-body hidden sm:block">
                  Mostrando 50 de {parsedRows.length} itens
                </p>
              )}
              {parsedRows.length > 30 && (
                <p className="text-xs text-muted-foreground text-center py-2 font-body sm:hidden">
                  Mostrando 30 de {parsedRows.length} itens
                </p>
              )}
            </div>
          </div>
        )}

        {/* Step: Importing */}
        {step === "importing" && (
          <div className="flex flex-col items-center py-8 gap-3">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <p className="text-sm font-body text-muted-foreground">Importando {parsedRows.length} itens...</p>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <div className="flex flex-col items-center py-8 gap-3">
            <CheckCircle2 className="h-10 w-10 text-primary" />
            <p className="text-sm font-body text-foreground font-medium">Importação concluída!</p>
            <p className="text-xs text-muted-foreground font-body">
              {Object.keys(sectionGroups).length} seções e {parsedRows.length} itens criados.
            </p>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={reset} className="w-full sm:w-auto min-h-[44px]">
                Voltar
              </Button>
              <Button onClick={handleImport} className="w-full sm:w-auto min-h-[44px]">Importar {parsedRows.length} itens</Button>
            </>
          )}
          {step === "done" && createdBudgetId && (
            <Button onClick={() => navigate(`/admin/budget/${createdBudgetId}`)} className="w-full sm:w-auto min-h-[44px]">
              Abrir Orçamento
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
