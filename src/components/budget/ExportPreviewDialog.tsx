// Pré-visualização de export de orçamento (PDF e XLSX) antes do download.
//
// Princípios:
// - Reutiliza os builders já testados (`buildBudgetPdfBlob` /
//   `buildBudgetXlsxBlob`) para garantir que o conteúdo previsto é exatamente
//   o que será baixado — nada de gerar um "preview parecido" e depois um
//   arquivo diferente.
// - PDF: renderiza o blob direto em um `<iframe>` via object URL (suporte
//   nativo do navegador).
// - XLSX: percorre o `WorkBook` em memória e mostra cada planilha como
//   tabela HTML, preservando merges e formato numérico — assim o usuário
//   confere layout e textos sem precisar baixar o arquivo.
// - Não modifica nenhuma lógica de geração; apenas adia o download para
//   depois da confirmação explícita do usuário.

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx-js-style";
import { Download, Loader2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { Textarea } from "@/components/ui/textarea";
import {
  buildBudgetPdfBlob,
  DEFAULT_BUDGET_PDF_DISCLAIMER,
} from "@/lib/budget-pdf-export";
import { buildBudgetXlsxBlob, type BudgetXlsxTotals } from "@/lib/budget-xlsx-export";
import { supabase } from "@/integrations/supabase/client";
import {
  calcSectionCostTotal,
  calcSectionSaleTotal,
  isCreditSection,
  type CalcSection,
} from "@/lib/budget-calc";

export type ExportPreviewKind = "pdf" | "xlsx";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budgetId: string | null;
  kind: ExportPreviewKind;
}

interface PdfPreview {
  blob: Blob;
  fileName: string;
  url: string;
}

interface XlsxPreview {
  blob: Blob;
  fileName: string;
  workbook: XLSX.WorkBook;
  totals: BudgetXlsxTotals;
}

interface EditorSectionTotal {
  id: string;
  title: string;
  cost: number;
  sale: number;
  isCredit: boolean;
}

interface EditorAuditTotals {
  sections: EditorSectionTotal[];
  cost: number;
  sale: number;
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ExportPreviewDialog({ open, onOpenChange, budgetId, kind }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfPreview, setPdfPreview] = useState<PdfPreview | null>(null);
  const [xlsxPreview, setXlsxPreview] = useState<XlsxPreview | null>(null);
  // Modo de auditoria do XLSX: mostra, por seção, custo/venda usados no
  // export (já normalizados) e compara com o resumo do editor (dados
  // crus do banco). Útil para identificar onde uma diferença surge —
  // por exemplo, um desconto digitado positivo é normalizado para
  // negativo no export e a divergência fica visível na coluna "Δ".
  const [auditMode, setAuditMode] = useState(false);
  const [auditEditor, setAuditEditor] = useState<EditorAuditTotals | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  // Modo compatível: gera o XLSX sem cores, bordas, mesclagens nem
  // wrapText. Útil quando o cliente abre o arquivo num leitor que
  // renderiza errado a formatação avançada (Excel antigo, alguns
  // visualizadores embarcados, planilha do celular sem suporte etc.).
  const [simpleXlsx, setSimpleXlsx] = useState(false);
  // Personalizações do PDF: logo da Bwild (on/off) e texto livre que vai
  // ao rodapé como "Observações". Default carrega o disclaimer padrão da
  // empresa, e o usuário pode editar/limpar antes de baixar.
  const [includeLogo, setIncludeLogo] = useState(true);
  const [disclaimer, setDisclaimer] = useState<string>(DEFAULT_BUDGET_PDF_DISCLAIMER);
  // Versão "debounced" do disclaimer — só dispara nova geração depois de
  // 600ms parado, evitando regerar o PDF a cada tecla pressionada.
  const [disclaimerDebounced, setDisclaimerDebounced] = useState<string>(
    DEFAULT_BUDGET_PDF_DISCLAIMER,
  );

  // Reseta toggles ao trocar de alvo/tipo para não carregar preferência
  // de um orçamento anterior sem o usuário perceber.
  useEffect(() => {
    setSimpleXlsx(false);
    setIncludeLogo(true);
    setDisclaimer(DEFAULT_BUDGET_PDF_DISCLAIMER);
    setDisclaimerDebounced(DEFAULT_BUDGET_PDF_DISCLAIMER);
    setAuditMode(false);
    setAuditEditor(null);
  }, [budgetId, kind]);

  // Carrega o "resumo do editor" — dados crus do banco passados pelo
  // mesmo motor de cálculo do editor (`calcSection*`), SEM normalização
  // de descontos/créditos. Comparar este número com `xlsxPreview.totals`
  // (que já é o que vai pro arquivo) revela divergências introduzidas
  // pela normalização (descontos com sinal errado, BDI em crédito etc.).
  useEffect(() => {
    if (!open || !budgetId || kind !== "xlsx" || !auditMode) return;
    let cancelled = false;
    setAuditLoading(true);
    (async () => {
      try {
        const { data: secsRaw, error: secErr } = await supabase
          .from("sections")
          .select("id, title, qty, section_price, order_index")
          .eq("budget_id", budgetId)
          .order("order_index", { ascending: true });
        if (secErr) throw secErr;
        const secs = secsRaw ?? [];
        const ids = secs.map((s) => s.id);
        let itemsRaw: Array<{
          section_id: string;
          qty: number | null;
          internal_unit_price: number | null;
          internal_total: number | null;
          bdi_percentage: number | null;
          title: string | null;
        }> = [];
        if (ids.length > 0) {
          const { data: itData, error: itErr } = await supabase
            .from("items")
            .select(
              "section_id, qty, internal_unit_price, internal_total, bdi_percentage, title",
            )
            .in("section_id", ids);
          if (itErr) throw itErr;
          itemsRaw = itData ?? [];
        }
        if (cancelled) return;
        const sectionsAudit: EditorSectionTotal[] = secs.map((s) => {
          const calc: CalcSection = {
            qty: s.qty,
            section_price: s.section_price,
            title: s.title,
            items: itemsRaw
              .filter((i) => i.section_id === s.id)
              .map((i) => ({
                qty: i.qty,
                internal_unit_price: i.internal_unit_price,
                internal_total: i.internal_total,
                bdi_percentage: i.bdi_percentage,
                title: i.title,
              })),
          };
          return {
            id: s.id,
            title: (s.title ?? "").trim() || "Sem título",
            cost: calcSectionCostTotal(calc),
            sale: calcSectionSaleTotal(calc),
            isCredit: isCreditSection(calc),
          };
        });
        const cost = sectionsAudit
          .filter((s) => !s.isCredit)
          .reduce((a, s) => a + s.cost, 0);
        const sale = sectionsAudit.reduce((a, s) => a + s.sale, 0);
        setAuditEditor({ sections: sectionsAudit, cost, sale });
      } catch (e) {
        if (cancelled) return;
        logger.error("[ExportPreviewDialog] audit fetch failed:", e);
        toast.error("Falha ao carregar dados do editor para auditoria.");
        setAuditEditor(null);
      } finally {
        if (!cancelled) setAuditLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, budgetId, kind, auditMode]);

  // Debounce do textarea: aguarda 600ms sem digitação para regerar.
  useEffect(() => {
    if (kind !== "pdf") return;
    const t = setTimeout(() => setDisclaimerDebounced(disclaimer), 600);
    return () => clearTimeout(t);
  }, [disclaimer, kind]);

  // Limpa estado quando o diálogo abre/fecha ou o alvo muda.
  useEffect(() => {
    if (!open || !budgetId) return;
    let cancelled = false;
    setError(null);
    setLoading(true);
    setPdfPreview(null);
    setXlsxPreview(null);

    (async () => {
      try {
        if (kind === "pdf") {
          const { blob, fileName } = await buildBudgetPdfBlob(budgetId, {
            includeLogo,
            disclaimer: disclaimerDebounced,
          });
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          setPdfPreview({ blob, fileName, url });
        } else {
          const { blob, fileName, workbook, totals } = await buildBudgetXlsxBlob(
            budgetId,
            { simple: simpleXlsx },
          );
          if (cancelled) return;
          setXlsxPreview({ blob, fileName, workbook, totals });
        }
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "Falha ao gerar pré-visualização.";
        logger.error("[ExportPreviewDialog] generation failed:", e);
        setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, budgetId, kind, simpleXlsx, includeLogo, disclaimerDebounced]);

  // Revoga o object URL do PDF quando o preview é descartado/refeito.
  useEffect(() => {
    return () => {
      if (pdfPreview?.url) URL.revokeObjectURL(pdfPreview.url);
    };
  }, [pdfPreview?.url]);

  const handleDownload = () => {
    try {
      if (kind === "pdf" && pdfPreview) {
        triggerDownload(pdfPreview.blob, pdfPreview.fileName);
        toast.success("Download iniciado", { description: pdfPreview.fileName });
      } else if (kind === "xlsx" && xlsxPreview) {
        triggerDownload(xlsxPreview.blob, xlsxPreview.fileName);
        toast.success("Download iniciado", { description: xlsxPreview.fileName });
      }
      onOpenChange(false);
    } catch (e) {
      logger.error("[ExportPreviewDialog] download failed:", e);
      toast.error("Não foi possível iniciar o download.");
    }
  };

  const fileName =
    kind === "pdf" ? pdfPreview?.fileName : xlsxPreview?.fileName;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(1200px,95vw)] h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b">
          <DialogTitle className="text-base">
            Pré-visualização do {kind === "pdf" ? "PDF" : "Excel"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Confira o layout e os textos antes de baixar o arquivo. O conteúdo
            exibido é exatamente o que será exportado.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-hidden bg-muted/30 flex">
          <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
            {loading ? (
              <PreviewLoadingState kind={kind} />
            ) : error ? (
              <PreviewErrorState message={error} />
            ) : kind === "pdf" && pdfPreview ? (
              <iframe
                title="Pré-visualização do PDF"
                src={pdfPreview.url}
                className="w-full h-full border-0 bg-white"
              />
            ) : kind === "xlsx" && xlsxPreview ? (
              <XlsxWorkbookPreview workbook={xlsxPreview.workbook} />
            ) : null}
          </div>

          {kind === "pdf" && (
            <aside className="hidden md:flex w-[280px] shrink-0 flex-col gap-4 border-l bg-background p-4 overflow-y-auto">
              <div>
                <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Personalização do PDF
                </h4>
                <div className="flex items-center justify-between gap-2 py-1">
                  <Label
                    htmlFor="pdf-include-logo"
                    className="text-xs cursor-pointer"
                  >
                    Incluir logo Bwild
                  </Label>
                  <Switch
                    id="pdf-include-logo"
                    checked={includeLogo}
                    onCheckedChange={setIncludeLogo}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2 min-h-0">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="pdf-disclaimer" className="text-xs">
                    Observações no rodapé
                  </Label>
                  <button
                    type="button"
                    onClick={() => setDisclaimer(DEFAULT_BUDGET_PDF_DISCLAIMER)}
                    className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                    disabled={loading || disclaimer === DEFAULT_BUDGET_PDF_DISCLAIMER}
                  >
                    Restaurar padrão
                  </button>
                </div>
                <Textarea
                  id="pdf-disclaimer"
                  value={disclaimer}
                  onChange={(e) => setDisclaimer(e.target.value)}
                  placeholder="Texto livre a ser impresso no fim do PDF (deixe em branco para omitir)."
                  className="min-h-[180px] text-xs leading-relaxed resize-none"
                />
                <p className="text-[11px] text-muted-foreground">
                  A pré-visualização atualiza após uma breve pausa na digitação.
                </p>
              </div>
            </aside>
          )}

          {kind === "xlsx" && auditMode && xlsxPreview && (
            <aside className="hidden md:flex w-[360px] shrink-0 flex-col gap-3 border-l bg-background p-4 overflow-y-auto">
              <XlsxAuditPanel
                exportTotals={xlsxPreview.totals}
                editor={auditEditor}
                loading={auditLoading}
              />
            </aside>
          )}
        </div>

        <DialogFooter className="px-6 py-3 border-t flex-row items-center justify-between gap-3 sm:justify-between">
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground truncate">
              {fileName ?? "—"}
            </span>
            {kind === "xlsx" && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <div className="flex items-center gap-2">
                  <Switch
                    id="xlsx-simple-mode"
                    checked={simpleXlsx}
                    onCheckedChange={setSimpleXlsx}
                    disabled={loading}
                  />
                  <Label
                    htmlFor="xlsx-simple-mode"
                    className="text-xs text-muted-foreground cursor-pointer"
                    title="Gera o arquivo sem cores, bordas, mesclagens nem quebra de texto. Use quando o Excel do destinatário não renderiza bem a formatação."
                  >
                    Modo compatível (sem estilos avançados)
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="xlsx-audit-mode"
                    checked={auditMode}
                    onCheckedChange={setAuditMode}
                    disabled={loading}
                  />
                  <Label
                    htmlFor="xlsx-audit-mode"
                    className="text-xs text-muted-foreground cursor-pointer"
                    title="Mostra um painel lateral comparando, por seção, custo/venda usados no export com o resumo do editor."
                  >
                    Modo auditoria
                  </Label>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              <X className="h-4 w-4 mr-1.5" />
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleDownload}
              disabled={loading || !!error || (!pdfPreview && !xlsxPreview)}
            >
              <Download className="h-4 w-4 mr-1.5" />
              Baixar {kind === "pdf" ? "PDF" : "Excel"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreviewLoadingState({ kind }: { kind: ExportPreviewKind }) {
  return (
    <div className="h-full w-full p-6 space-y-3 overflow-hidden">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Gerando pré-visualização do {kind === "pdf" ? "PDF" : "Excel"}…
      </div>
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

function PreviewErrorState({ message }: { message: string }) {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center text-center p-6">
      <p className="text-sm font-medium text-foreground">
        Não foi possível gerar a pré-visualização.
      </p>
      <p className="text-xs text-muted-foreground mt-1 max-w-md">{message}</p>
    </div>
  );
}

// ── Renderização do XLSX ────────────────────────────────────────────────
// `sheet_to_html` é prático, mas mostra os valores BRUTOS (12345.67) e
// ignora o formato de célula (`R$ 12.345,67`, `%`, datas pt-BR), o que
// fazia o preview parecer infiel ao arquivo gerado. Reimplementamos a
// renderização lendo célula a célula e aplicando `XLSX.utils.format_cell`,
// que devolve a mesma string que o Excel mostraria. Também respeitamos
// merges (rowSpan/colSpan), larguras de coluna (`!cols`) e destacamos
// linhas de header/seção/subtotal/total a partir do estilo das células.

interface MergeMap {
  // r:c → { rowSpan, colSpan } na célula âncora (canto sup. esq. da merge).
  spans: Map<string, { rowSpan: number; colSpan: number }>;
  // Conjunto de células "cobertas" por uma merge — devem ser puladas.
  hidden: Set<string>;
}

function buildMergeMap(merges: XLSX.Range[] | undefined): MergeMap {
  const spans = new Map<string, { rowSpan: number; colSpan: number }>();
  const hidden = new Set<string>();
  if (!merges) return { spans, hidden };
  for (const m of merges) {
    const rowSpan = m.e.r - m.s.r + 1;
    const colSpan = m.e.c - m.s.c + 1;
    spans.set(`${m.s.r}:${m.s.c}`, { rowSpan, colSpan });
    for (let r = m.s.r; r <= m.e.r; r++) {
      for (let c = m.s.c; c <= m.e.c; c++) {
        if (r === m.s.r && c === m.s.c) continue;
        hidden.add(`${r}:${c}`);
      }
    }
  }
  return { spans, hidden };
}

// Heurística de "tipo da linha" combinando três sinais:
// 1) ESTILO da célula (fill escuro/claro, bold) — mais confiável quando o
//    exporter aplicou estilos avançados.
// 2) POSIÇÃO da linha (primeira linha = header da planilha; última linha
//    com conteúdo = total geral) — funciona mesmo no "Modo compatível"
//    em que os estilos são removidos.
// 3) TEXTO da primeira célula não vazia (palavras-chave como "TOTAL",
//    "SUBTOTAL", "TOTAL GERAL", "SEÇÃO") — fallback semântico para quando
//    nem estilo nem posição bastam.
// O resultado é usado apenas para realce visual no preview; nunca altera
// valores nem o arquivo gerado.
type RowKind = "header" | "section" | "subtotal" | "total" | "default";

// Normaliza o texto da primeira célula para casar com variações comuns
// em PT-BR: remove acentos, colapsa espaços/pontuação e padroniza
// minúsculas. Assim "Sub-Total", "SUBTOTAL", "Subt." e "Sub total"
// passam pela MESMA regex.
function normalizeRowLabel(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // tira acentos
    .toLowerCase()
    .replace(/[._:;]+/g, " ") // pontuação vira espaço (cobre "tot." etc.)
    .replace(/\s+/g, " ")
    .trim();
}

// "Total geral" e variantes que SEMPRE indicam o fechamento do orçamento.
// Cobre: total geral, total final, total do orçamento, total a pagar,
// total a investir, valor total do investimento, investimento total,
// grand total, vl/vlr total geral.
const TOTAL_GERAL_RE =
  /\b(total\s+(geral|final|do\s+or[cç]amento|a\s+(pagar|investir)|investimento|liquido|bruto)|(valor\s+(total|final))|investimento\s+total|grand\s+total|(vlr?|vl)\s+total(\s+geral)?)\b/;

// "Subtotal" e abreviações: subtotal, sub total, sub-total, subt,
// sub-tot, soma parcial, parcial.
const SUBTOTAL_RE =
  /^\s*(sub\s*-?\s*tot(al)?|subt|soma\s+parcial|parcial)\b/;

// "Total" sozinho ou abreviado: total, tot, tot., totais, total da
// seção/categoria/grupo/ambiente/item/serviço — quando vem qualificado
// por uma seção é subtotal; quando vem sozinho a posição decide.
const TOTAL_SECTION_RE =
  /^\s*total\s+(da\s+)?(se[cç]ao|categoria|grupo|ambiente|etapa|fase|servico|servicos|item|itens|obra|escopo)\b/;
const TOTAL_RE = /^\s*(tot(al|ais)?|tot)\b/;

// Cabeçalhos de agrupamento.
const SECTION_RE =
  /^\s*(se[cç]ao|categoria|grupo|ambiente|etapa|fase|m[oó]dulo|escopo)\b/;

function detectTextualKind(rawText: string): RowKind | null {
  if (!rawText) return null;
  const text = normalizeRowLabel(rawText);
  if (!text) return null;
  if (TOTAL_GERAL_RE.test(text)) return "total";
  if (SUBTOTAL_RE.test(text)) return "subtotal";
  if (TOTAL_SECTION_RE.test(text)) return "subtotal";
  if (TOTAL_RE.test(text)) return "total"; // posição decide depois
  if (SECTION_RE.test(text)) return "section";
  return null;
}

function detectRowKind(
  ws: XLSX.WorkSheet,
  row: number,
  startCol: number,
  endCol: number,
  hidden: Set<string>,
  lastContentRow: number,
): RowKind {
  let hasDarkFill = false;
  let hasLightFill = false;
  let hasBold = false;
  let firstText = "";
  let hasAnyContent = false;
  for (let c = startCol; c <= endCol; c++) {
    if (hidden.has(`${row}:${c}`)) continue;
    const addr = XLSX.utils.encode_cell({ r: row, c });
    const cell = ws[addr] as
      | (XLSX.CellObject & {
          s?: {
            fill?: { fgColor?: { rgb?: string } };
            font?: { bold?: boolean; color?: { rgb?: string } };
          };
        })
      | undefined;
    if (!cell) continue;
    if (cell.v != null && cell.v !== "") {
      hasAnyContent = true;
      if (!firstText) {
        try {
          firstText = XLSX.utils.format_cell(cell);
        } catch {
          firstText = String(cell.v ?? "");
        }
      }
    }
    if (!cell.s) continue;
    const rgb = cell.s.fill?.fgColor?.rgb?.toUpperCase();
    if (rgb === "0F172A" || rgb === "111827" || rgb === "1E293B") hasDarkFill = true;
    else if (rgb === "E5E7EB" || rgb === "F3F4F6" || rgb === "F1F5F9") hasLightFill = true;
    if (cell.s.font?.bold) hasBold = true;
  }

  // 1) Texto explícito da primeira célula — sinal mais forte.
  if (hasAnyContent) {
    const textual = detectTextualKind(firstText);
    if (textual === "total") {
      // "Total" puro sem qualificador → posição decide se é geral ou de seção.
      const isPureTotal = TOTAL_RE.test(normalizeRowLabel(firstText)) &&
        !TOTAL_GERAL_RE.test(normalizeRowLabel(firstText));
      if (isPureTotal) {
        return row === lastContentRow ? "total" : "subtotal";
      }
      return "total";
    }
    if (textual) return textual;
  }

  // 2) Estilo do exporter avançado.
  if (hasDarkFill) {
    // Fill escuro pode ser tanto cabeçalho quanto total. Diferenciamos
    // pela posição: linha 0 é sempre header; última linha de conteúdo é
    // total; meio = header de seção.
    if (row === 0) return "header";
    if (row === lastContentRow) return "total";
    return "header";
  }
  if (hasLightFill && hasBold) return "subtotal";
  if (hasLightFill) return "section";

  // 3) Fallback puramente posicional (modo compatível, sem estilos).
  if (row === 0 && hasAnyContent) return "header";
  if (row === lastContentRow && hasAnyContent && hasBold) return "total";
  return "default";
}

function XlsxWorkbookPreview({ workbook }: { workbook: XLSX.WorkBook }) {
  const sheetNames = workbook.SheetNames;
  const [active, setActive] = useState(sheetNames[0] ?? "");

  if (sheetNames.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
        Nenhuma planilha gerada.
      </div>
    );
  }

  return (
    <Tabs
      value={active}
      onValueChange={setActive}
      className="h-full flex flex-col"
    >
      <div className="px-4 pt-3 pb-2 bg-background/60 border-b">
        <TabsList className="h-auto flex-wrap gap-1">
          {sheetNames.map((name) => (
            <TabsTrigger key={name} value={name} className="text-xs">
              {name}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {sheetNames.map((name) => (
        <TabsContent
          key={name}
          value={name}
          className="flex-1 min-h-0 m-0 data-[state=inactive]:hidden"
        >
          <ScrollArea className="h-full">
            <div className="p-4 bg-white">
              <XlsxSheetTable worksheet={workbook.Sheets[name]} />
            </div>
          </ScrollArea>
        </TabsContent>
      ))}
    </Tabs>
  );
}

// Constantes do mapeamento Excel → preview HTML.
// O Excel mede largura em "characters" (wch) ≈ 7px no nosso preview.
// Altura é em "points" (pt); 1pt ≈ 1.333px. Linha padrão do Excel = 15pt
// (~20px). Cada linha extra de wrapText adiciona ~15pt.
const PX_PER_CHAR = 7;
const PX_PER_POINT = 4 / 3; // 1pt = 1.333px
const DEFAULT_ROW_PT = 15;
const EXTRA_LINE_PT = 15;
// Largura média de char no nosso preview (text-xs font-mono ~10px).
// Como cada coluna tem largura em px definida pela contagem de chars do
// Excel, a quebra real depende de quantos chars cabem nessa largura.
// Usamos a mesma métrica: 1 "wrap char" ≈ 1 char Excel.
const WRAP_CHARS_PER_WCH = 1;

function estimateWrappedLines(text: string, wch: number | undefined): number {
  if (!text) return 1;
  // Sem largura definida → considera só quebras explícitas.
  const hardLines = text.split(/\r?\n/);
  if (!wch || wch <= 0) return hardLines.length;
  const maxChars = Math.max(1, Math.floor(wch * WRAP_CHARS_PER_WCH));
  let total = 0;
  for (const line of hardLines) {
    if (line.length === 0) {
      total += 1;
      continue;
    }
    // Quebra preferindo espaços (mesma heurística do Excel: word-wrap).
    const words = line.split(/\s+/);
    let current = 0;
    let lines = 1;
    for (const w of words) {
      if (w.length === 0) continue;
      // Palavra maior que a largura → quebra forçada por chars.
      if (w.length > maxChars) {
        if (current > 0) {
          lines += 1;
          current = 0;
        }
        lines += Math.ceil(w.length / maxChars) - 1;
        current = w.length % maxChars;
        if (current === 0) {
          // múltiplo exato; próxima palavra começa em linha nova
          current = 0;
        } else {
          current += 1; // espaço seguinte
        }
        continue;
      }
      const need = current === 0 ? w.length : current + 1 + w.length;
      if (need > maxChars) {
        lines += 1;
        current = w.length + 1;
      } else {
        current = need;
      }
    }
    total += lines;
  }
  return Math.max(1, total);
}

function XlsxSheetTable({ worksheet }: { worksheet: XLSX.WorkSheet }) {
  const { rows, cols, mergeMap, range } = useMemo(() => {
    const ref = worksheet["!ref"];
    if (!ref) {
      return {
        rows: [] as number[],
        cols: [] as number[],
        mergeMap: { spans: new Map(), hidden: new Set() } as MergeMap,
        range: null as XLSX.Range | null,
      };
    }
    const rng = XLSX.utils.decode_range(ref);
    const rs: number[] = [];
    const cs: number[] = [];
    for (let r = rng.s.r; r <= rng.e.r; r++) rs.push(r);
    for (let c = rng.s.c; c <= rng.e.c; c++) cs.push(c);
    return {
      rows: rs,
      cols: cs,
      mergeMap: buildMergeMap(worksheet["!merges"]),
      range: rng,
    };
  }, [worksheet]);

  if (!range) {
    return (
      <p className="text-xs text-muted-foreground p-3">
        Planilha vazia.
      </p>
    );
  }

  const colWidths = (worksheet["!cols"] ?? []) as { wch?: number }[];
  // Alturas explícitas definidas pelo exporter (em pontos). Quando
  // presente, respeitamos para bater 1:1 com o arquivo gerado.
  const rowMeta = (worksheet["!rows"] ?? []) as { hpt?: number; hpx?: number }[];

  // Última linha com algum conteúdo — referência para identificar o
  // "total geral" tanto por estilo quanto por posição.
  const lastContentRow = (() => {
    for (let r = range.e.r; r >= range.s.r; r--) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = worksheet[XLSX.utils.encode_cell({ r, c })] as
          | XLSX.CellObject
          | undefined;
        if (cell && cell.v != null && cell.v !== "") return r;
      }
    }
    return range.e.r;
  })();

  return (
    <table className="w-full border-collapse text-xs font-mono tabular-nums">
      <colgroup>
        {cols.map((c, idx) => {
          const wch = colWidths[c]?.wch;
          // ~7px por "char" do Excel é uma aproximação razoável que mantém
          // proporção entre as colunas no preview HTML.
          const widthPx = wch ? Math.round(wch * PX_PER_CHAR) : undefined;
          return (
            <col
              key={`col-${idx}`}
              style={widthPx ? { width: `${widthPx}px` } : undefined}
            />
          );
        })}
      </colgroup>
      <tbody>
        {rows.map((r) => {
          const kind = detectRowKind(
            worksheet,
            r,
            range.s.c,
            range.e.c,
            mergeMap.hidden,
            lastContentRow,
          );
          // Realce visual por tipo. Reforçamos cabeçalho e total com
          // borda extra para que o usuário escaneie a tabela mesmo
          // quando o exporter remove cores (modo compatível).
          const rowClass =
            kind === "header"
              ? "bg-slate-900 text-white uppercase tracking-wide text-[11px] border-b-2 border-slate-700"
              : kind === "total"
                ? "bg-slate-900 text-white font-semibold border-t-2 border-slate-700"
                : kind === "subtotal"
                  ? "bg-slate-100 font-semibold text-slate-900 border-t border-slate-300"
                  : kind === "section"
                    ? "bg-slate-50 font-semibold text-slate-700 uppercase text-[11px] tracking-wide"
                    : "";

          // Altura da linha:
          // 1) Se o exporter definiu altura explícita (`!rows[r].hpt`),
          //    usamos ela diretamente — é exatamente o que o Excel vai
          //    aplicar.
          // 2) Caso contrário, estimamos baseado no wrapText: contamos
          //    quantas linhas o texto vai ocupar dada a largura da coluna
          //    e multiplicamos pela altura padrão da linha.
          let heightPt = rowMeta[r]?.hpt;
          if (heightPt == null && rowMeta[r]?.hpx != null) {
            heightPt = rowMeta[r]!.hpx! / PX_PER_POINT;
          }
          if (heightPt == null) {
            let maxLines = 1;
            for (const c of cols) {
              const key = `${r}:${c}`;
              if (mergeMap.hidden.has(key)) continue;
              const span = mergeMap.spans.get(key);
              const addr = XLSX.utils.encode_cell({ r, c });
              const cell = worksheet[addr] as
                | (XLSX.CellObject & {
                    s?: { alignment?: { wrapText?: boolean } };
                  })
                | undefined;
              if (!cell) continue;
              const wraps = cell.s?.alignment?.wrapText === true;
              if (!wraps) continue;
              let text = "";
              try {
                text = XLSX.utils.format_cell(cell);
              } catch {
                text = String(cell.v ?? "");
              }
              if (!text) continue;
              // Largura efetiva: soma das colunas mescladas.
              const colSpan = span?.colSpan ?? 1;
              let totalWch = 0;
              for (let k = 0; k < colSpan; k++) {
                totalWch += colWidths[c + k]?.wch ?? 10;
              }
              // Desconta um pouco do padding interno do Excel (~2 chars).
              const usableWch = Math.max(1, totalWch - 2);
              const lines = estimateWrappedLines(text, usableWch);
              if (lines > maxLines) maxLines = lines;
            }
            heightPt = DEFAULT_ROW_PT + (maxLines - 1) * EXTRA_LINE_PT;
          }
          const heightPx = Math.round(heightPt * PX_PER_POINT);

          return (
            <tr
              key={`row-${r}`}
              className={rowClass}
              style={{ height: `${heightPx}px` }}
            >
              {cols.map((c) => {
                const key = `${r}:${c}`;
                if (mergeMap.hidden.has(key)) return null;
                const span = mergeMap.spans.get(key);
                const addr = XLSX.utils.encode_cell({ r, c });
                const cell = worksheet[addr] as XLSX.CellObject | undefined;
                // `format_cell` é a função canônica do xlsx para devolver
                // o valor JÁ FORMATADO (BRL, %, data dd/mm/yyyy, etc.) —
                // ou seja, a mesma string que o Excel renderizaria.
                let display = "";
                let isNumeric = false;
                if (cell) {
                  try {
                    display = XLSX.utils.format_cell(cell);
                  } catch {
                    display = String(cell.v ?? "");
                  }
                  isNumeric = cell.t === "n";
                }
                const styled = cell as
                  | (XLSX.CellObject & {
                      s?: { alignment?: { horizontal?: string } };
                    })
                  | undefined;
                const explicitAlign = styled?.s?.alignment?.horizontal;
                const align =
                  explicitAlign ??
                  (isNumeric ? "right" : undefined);
                return (
                  <td
                    key={`cell-${r}-${c}`}
                    rowSpan={span?.rowSpan}
                    colSpan={span?.colSpan}
                    className="border border-slate-200 px-2 py-1 align-middle whitespace-pre-wrap break-words overflow-hidden"
                    style={align ? { textAlign: align as "left" | "right" | "center" } : undefined}
                  >
                    {display}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ── Painel de auditoria do XLSX ─────────────────────────────────────────
// Mostra, por seção, os valores de custo/venda usados no arquivo gerado
// (totals do `buildBudgetXlsxBlob`, já normalizados) ao lado dos valores
// crus do editor (mesma fórmula, dados sem normalização). Diferenças
// destacadas em cor de aviso revelam onde a normalização agiu — quase
// sempre por causa de descontos/créditos digitados com sinal trocado.

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// Considera "igual" diferenças menores que 1 centavo para evitar ruído
// de ponto flutuante.
const isClose = (a: number, b: number) => Math.abs(a - b) < 0.005;

function XlsxAuditPanel({
  exportTotals,
  editor,
  loading,
}: {
  exportTotals: BudgetXlsxTotals;
  editor: EditorAuditTotals | null;
  loading: boolean;
}) {
  // Indexa o editor por id para alinhar com as seções do export.
  const editorById = new Map(editor?.sections.map((s) => [s.id, s]) ?? []);
  const rows = exportTotals.sections.map((exp) => {
    const ed = editorById.get(exp.id);
    return {
      id: exp.id,
      title: exp.title,
      isCredit: exp.isCredit,
      expCost: exp.cost,
      expSale: exp.sale,
      edCost: ed?.cost ?? null,
      edSale: ed?.sale ?? null,
    };
  });

  return (
    <>
      <div>
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Auditoria do export
        </h4>
        <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
          Compara, por seção, os valores enviados ao arquivo (export) com os
          valores crus do editor. Δ destacado indica que a normalização
          ajustou sinais ou BDI.
        </p>
      </div>

      {loading || !editor ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Carregando dados do editor…
        </div>
      ) : (
        <>
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div>
                <div className="text-muted-foreground">Custo</div>
                <div className="font-mono font-semibold">
                  {fmtBRL(exportTotals.cost)}
                </div>
                <div
                  className={
                    isClose(exportTotals.cost, editor.cost)
                      ? "text-muted-foreground"
                      : "text-destructive font-semibold"
                  }
                >
                  Editor: {fmtBRL(editor.cost)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Venda</div>
                <div className="font-mono font-semibold">
                  {fmtBRL(exportTotals.sale)}
                </div>
                <div
                  className={
                    isClose(exportTotals.sale, editor.sale)
                      ? "text-muted-foreground"
                      : "text-destructive font-semibold"
                  }
                >
                  Editor: {fmtBRL(editor.sale)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Margem</div>
                <div className="font-mono font-semibold">
                  {(exportTotals.marginRatio * 100).toFixed(2)}%
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-1.5 px-1 font-medium">Seção</th>
                  <th className="py-1.5 px-1 font-medium text-right">Export</th>
                  <th className="py-1.5 px-1 font-medium text-right">Editor</th>
                  <th className="py-1.5 px-1 font-medium text-right">Δ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const deltaCost = r.edCost == null ? null : r.expCost - r.edCost;
                  const deltaSale = r.edSale == null ? null : r.expSale - r.edSale;
                  const costDiff = deltaCost != null && !isClose(deltaCost, 0);
                  const saleDiff = deltaSale != null && !isClose(deltaSale, 0);
                  return (
                    <tr key={r.id} className="border-b last:border-0 align-top">
                      <td className="py-1.5 px-1">
                        <div className="font-medium truncate" title={r.title}>
                          {r.title}
                        </div>
                        {r.isCredit && (
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            crédito
                          </div>
                        )}
                      </td>
                      <td className="py-1.5 px-1 text-right font-mono">
                        <div>{fmtBRL(r.expCost)}</div>
                        <div className="text-muted-foreground">
                          {fmtBRL(r.expSale)}
                        </div>
                      </td>
                      <td className="py-1.5 px-1 text-right font-mono">
                        <div>{r.edCost == null ? "—" : fmtBRL(r.edCost)}</div>
                        <div className="text-muted-foreground">
                          {r.edSale == null ? "—" : fmtBRL(r.edSale)}
                        </div>
                      </td>
                      <td className="py-1.5 px-1 text-right font-mono">
                        <div
                          className={
                            costDiff
                              ? "text-destructive font-semibold"
                              : "text-muted-foreground"
                          }
                        >
                          {deltaCost == null
                            ? "—"
                            : isClose(deltaCost, 0)
                            ? "0,00"
                            : fmtBRL(deltaCost)}
                        </div>
                        <div
                          className={
                            saleDiff
                              ? "text-destructive font-semibold"
                              : "text-muted-foreground"
                          }
                        >
                          {deltaSale == null
                            ? "—"
                            : isClose(deltaSale, 0)
                            ? "0,00"
                            : fmtBRL(deltaSale)}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {exportTotals.warnings.length > 0 && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5">
              <div className="text-[11px] font-semibold text-destructive mb-1">
                {exportTotals.warnings.length} aviso(s) de estrutura
              </div>
              <ul className="text-[11px] text-destructive/90 space-y-0.5 list-disc pl-4">
                {exportTotals.warnings.slice(0, 6).map((w, i) => (
                  <li key={i}>
                    <span className="font-semibold">{w.sectionTitle}</span>
                    {w.itemTitle ? ` › ${w.itemTitle}` : ""} —{" "}
                    {w.kind === "abatement_positive_value"
                      ? "valor positivo em abatimento (normalizado para negativo)"
                      : w.kind === "negative_in_productive_section"
                      ? "item negativo em seção produtiva"
                      : "BDI aplicado em crédito (zerado)"}
                  </li>
                ))}
                {exportTotals.warnings.length > 6 && (
                  <li>… e mais {exportTotals.warnings.length - 6}.</li>
                )}
              </ul>
            </div>
          )}
        </>
      )}
    </>
  );
}
