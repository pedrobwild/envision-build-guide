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
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
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

interface ImportExcelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EXPECTED_COLUMNS = ["Seção", "Item", "Descrição", "Qtd", "Unidade", "Preço Unit.", "Total"];

export function ImportExcelModal({ open, onOpenChange }: ImportExcelModalProps) {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, number>>({});
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "done">("upload");
  const [error, setError] = useState<string | null>(null);
  const [createdBudgetId, setCreatedBudgetId] = useState<string | null>(null);

  const reset = () => {
    setFile(null);
    setParsedRows([]);
    setColumnMap({});
    setStep("upload");
    setError(null);
    setCreatedBudgetId(null);
  };

  const handleClose = (val: boolean) => {
    if (!val) reset();
    onOpenChange(val);
  };

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

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setError(null);
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

        setColumnMap(map);

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

        setParsedRows(rows);
        setStep("preview");
      } catch {
        setError("Erro ao ler o arquivo. Verifique se é um Excel válido (.xlsx ou .xls).");
      }
    };
    reader.readAsArrayBuffer(f);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const handleImport = async () => {
    setStep("importing");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      // Group rows by section
      const sectionMap = new Map<string, ParsedRow[]>();
      parsedRows.forEach((row) => {
        const list = sectionMap.get(row.section) || [];
        list.push(row);
        sectionMap.set(row.section, list);
      });

      // Create budget
      const { data: budget, error: budgetErr } = await supabase
        .from("budgets")
        .insert({
          project_name: file?.name.replace(/\.(xlsx|xls)$/i, "") || "Importação Excel",
          client_name: "Cliente",
          created_by: user.id,
        })
        .select()
        .single();

      if (budgetErr || !budget) throw budgetErr;

      let sectionIdx = 0;
      for (const [sectionTitle, items] of sectionMap.entries()) {
        // Calculate section total
        const sectionTotal = items.reduce((s, i) => s + (i.total || 0), 0);

        const { data: section, error: secErr } = await supabase
          .from("sections")
          .insert({
            budget_id: budget.id,
            title: sectionTitle,
            order_index: sectionIdx++,
            section_price: sectionTotal > 0 ? sectionTotal : null,
          })
          .select()
          .single();

        if (secErr || !section) continue;

        const itemInserts = items.map((item, i) => ({
          section_id: section.id,
          title: item.title,
          description: item.description || null,
          qty: item.qty || null,
          unit: item.unit || null,
          internal_unit_price: item.unitPrice || null,
          internal_total: item.total || null,
          order_index: i,
        }));

        await supabase.from("items").insert(itemInserts);
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar Planilha Excel
          </DialogTitle>
          <DialogDescription className="font-body">
            Faça upload de um arquivo .xlsx com colunas: Seção, Item, Qtd, Unidade, Preço Unit., Total.
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
              input.accept = ".xlsx,.xls";
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
            <p className="text-xs text-muted-foreground font-body">.xlsx ou .xls</p>
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
              <FileSpreadsheet className="h-4 w-4" />
              <span className="truncate">{file?.name}</span>
              <span className="ml-auto whitespace-nowrap">{parsedRows.length} itens • {Object.keys(sectionGroups).length} seções</span>
            </div>

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
