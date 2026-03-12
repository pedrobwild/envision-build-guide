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
}

type ImportStep = "upload" | "parsing" | "preview" | "importing" | "done";

export function ImportExcelModal({ open, onOpenChange, fileFilter }: ImportExcelModalProps) {
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
      section: ["seção", "secao", "seçao", "section", "categoria", "ambiente"],
      title: ["item", "título", "titulo", "nome", "descrição curta", "servico", "serviço"],
      description: ["descrição", "descricao", "desc", "observação", "obs", "detalhe"],
      qty: ["qtd", "quantidade", "qty", "quant"],
      unit: ["unidade", "und", "un", "unit"],
      unitPrice: ["preço unit", "preco unit", "valor unit", "unit price", "p.u.", "pu"],
      total: ["total", "valor", "subtotal", "valor total", "preço total"],
    };
    for (const [key, words] of Object.entries(patterns)) {
      const idx = lower.findIndex((h) => words.some((w) => h.includes(w)));
      if (idx !== -1) map[key] = idx;
    }
    return map;
  };

  const parseExcel = useCallback((f: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (json.length < 2) {
          setError("A planilha precisa ter pelo menos 2 linhas (cabeçalho + dados).");
          return;
        }

        const headers = json[0].map(String);
        const map = detectColumns(headers);

        if (!map.section && !map.title) {
          setError("Não foi possível detectar as colunas 'Seção' e 'Item'. Verifique o cabeçalho.");
          return;
        }

        const rows: ParsedRow[] = json
          .slice(1)
          .filter((row) => row.some((cell: any) => cell !== undefined && cell !== ""))
          .map((row) => ({
            section: map.section !== undefined ? String(row[map.section] || "Geral") : "Geral",
            title: map.title !== undefined ? String(row[map.title] || "") : "",
            description: map.description !== undefined ? String(row[map.description] || "") : undefined,
            qty: map.qty !== undefined ? Number(row[map.qty]) || undefined : undefined,
            unit: map.unit !== undefined ? String(row[map.unit] || "") : undefined,
            unitPrice: map.unitPrice !== undefined ? Number(row[map.unitPrice]) || undefined : undefined,
            total: map.total !== undefined ? Number(row[map.total]) || undefined : undefined,
          }))
          .filter((r) => r.title.trim() !== "");

        if (rows.length === 0) {
          setError("Nenhum item encontrado na planilha.");
          return;
        }

        const sectionTotals: Record<string, number> = {};
        rows.forEach((row) => {
          if (!row.total) return;
          sectionTotals[row.section] = (sectionTotals[row.section] || 0) + row.total;
        });

        setParsedSectionTotals(sectionTotals);
        setParsedRows(rows);
        setStep("preview");
      } catch {
        setError("Erro ao ler o arquivo. Verifique se é um Excel válido (.xlsx ou .xls).");
      }
    };
    reader.readAsArrayBuffer(f);
  }, []);

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
        parsedData = await invokePdfParser({ textContent });
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
          clientName: parsedData.meta.clientName || null,
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
      } else if (ext === "xlsx" || ext === "xls") {
        parseExcel(f);
      } else {
        setError("Formato não suportado. Use .xlsx, .xls ou .pdf");
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

      const clientName = parsedMeta.clientName?.trim() || "Cliente";
      const projectName =
        parsedMeta.projectName?.trim() ||
        (parsedMeta.clientName?.trim() ? `Reforma ${parsedMeta.clientName.trim()}` : file?.name.replace(/\.(xlsx|xls|pdf)$/i, "") || "Importação");

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
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display pr-8">
            {isPdf ? <FileText className="h-5 w-5 text-primary" /> : <FileSpreadsheet className="h-5 w-5 text-primary" />}
            Importar Orçamento
          </DialogTitle>
          <DialogDescription className="font-body">
            Faça upload de um arquivo <strong>.xlsx</strong> ou <strong>.pdf</strong> com os dados do orçamento.
            {" "}PDFs são processados com IA para extrair seções e itens automaticamente.
          </DialogDescription>
        </DialogHeader>

        {/* Step: Upload */}
        {step === "upload" && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed border-border rounded-xl p-10 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = fileFilter === 'pdf' ? '.pdf' : fileFilter === 'excel' ? '.xlsx,.xls' : '.xlsx,.xls,.pdf';
              input.onchange = (e: any) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              };
              input.click();
            }}
          >
            <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-body text-foreground font-medium mb-1">
              Arraste o arquivo aqui ou clique para selecionar
            </p>
            <p className="text-xs text-muted-foreground font-body">
              .xlsx, .xls ou .pdf
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

            <div className="border border-border rounded-lg overflow-hidden max-h-80 overflow-y-auto">
              <table className="w-full text-xs font-body">
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
              {parsedRows.length > 50 && (
                <p className="text-xs text-muted-foreground text-center py-2 font-body">
                  Mostrando 50 de {parsedRows.length} itens
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

        <DialogFooter>
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={reset}>
                Voltar
              </Button>
              <Button onClick={handleImport}>Importar {parsedRows.length} itens</Button>
            </>
          )}
          {step === "done" && createdBudgetId && (
            <Button onClick={() => navigate(`/admin/budget/${createdBudgetId}`)}>
              Abrir Orçamento
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
