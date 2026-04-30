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
import { buildBudgetXlsxBlob } from "@/lib/budget-xlsx-export";

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
  }, [budgetId, kind]);

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
          const { blob, fileName, workbook } = await buildBudgetXlsxBlob(
            budgetId,
            { simple: simpleXlsx },
          );
          if (cancelled) return;
          setXlsxPreview({ blob, fileName, workbook });
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
        </div>

        <DialogFooter className="px-6 py-3 border-t flex-row items-center justify-between gap-3 sm:justify-between">
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground truncate">
              {fileName ?? "—"}
            </span>
            {kind === "xlsx" && (
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
// Usamos `sheet_to_html` do `xlsx-js-style` para preservar merges e a
// estrutura visual de cada planilha. Aplicamos um wrapper estilizado para
// integrar com o tema do app sem reinventar tabelas.

function XlsxWorkbookPreview({ workbook }: { workbook: XLSX.WorkBook }) {
  const sheetNames = workbook.SheetNames;
  const [active, setActive] = useState(sheetNames[0] ?? "");

  // Cache do HTML gerado por planilha, para evitar reprocessar a cada toque.
  const htmlBySheet = useMemo(() => {
    const out: Record<string, string> = {};
    for (const name of sheetNames) {
      const ws = workbook.Sheets[name];
      try {
        out[name] = XLSX.utils.sheet_to_html(ws, { id: `sheet-${name}` });
      } catch (e) {
        logger.error("[ExportPreviewDialog] sheet_to_html failed:", e);
        out[name] = `<p style="padding:16px;color:#64748b">Não foi possível renderizar esta planilha.</p>`;
      }
    }
    return out;
  }, [workbook, sheetNames]);

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
            <div
              className="xlsx-preview p-4 bg-white text-foreground"
              // sheet_to_html devolve markup confiável gerado pela própria
              // lib a partir do workbook que acabamos de construir.
              dangerouslySetInnerHTML={{ __html: htmlBySheet[name] ?? "" }}
            />
          </ScrollArea>
        </TabsContent>
      ))}
    </Tabs>
  );
}
