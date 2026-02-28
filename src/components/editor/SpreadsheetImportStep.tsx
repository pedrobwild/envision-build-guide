import { useState, useCallback } from "react";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import * as XLSX from "xlsx";

export interface ParsedPackage {
  name: string;
  price: number;
  items: ParsedItem[];
}

export interface ParsedItem {
  name: string;
  description?: string;
  qty?: number;
  unit?: string;
  total?: number;
  coverageType: "geral" | "local";
}

interface SpreadsheetImportStepProps {
  packages: ParsedPackage[];
  onImported: (packages: ParsedPackage[]) => void;
  onNext: () => void;
  onBack: () => void;
}

export function SpreadsheetImportStep({ packages, onImported, onNext, onBack }: SpreadsheetImportStepProps) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const detectColumns = (headers: string[]) => {
    const map: Record<string, number> = {};
    const lower = headers.map(h => (h || "").toString().trim().toLowerCase());

    const patterns: Record<string, string[]> = {
      index: ["índice", "indice", "index", "cod", "código", "codigo"],
      section: ["seção", "secao", "pacote", "package", "categoria", "ambiente"],
      title: ["item", "título", "titulo", "nome", "servico", "serviço"],
      description: ["descrição", "descricao", "desc", "obs", "detalhe"],
      qty: ["qtd", "quantidade", "qty"],
      unit: ["unidade", "und", "un", "unid"],
      total: ["total", "valor", "subtotal", "preço total", "valor total"],
      coverageType: ["cobertura", "coverage", "coveragetype", "contempla", "cotempla", "mapeamento"],
    };

    for (const [key, words] of Object.entries(patterns)) {
      const idx = lower.findIndex(h => words.some(w => h.includes(w)));
      if (idx !== -1) map[key] = idx;
    }
    return map;
  };

  const isTopLevelIndex = (val: string) => {
    const trimmed = val.trim();
    return /^\d+$/.test(trimmed);
  };

  const parseRows = (json: any[][], map: Record<string, number>) => {
    const packageMap = new Map<string, { items: ParsedItem[]; totalPrice: number }>();
    const hasIndex = map.index !== undefined;
    const hasSection = map.section !== undefined;
    let currentSection = "Geral";

    json.slice(1)
      .filter(row => row.some((cell: any) => cell !== undefined && cell !== ""))
      .forEach(row => {
        const indexVal = hasIndex ? String(row[map.index] || "").trim() : "";
        const itemName = map.title !== undefined ? String(row[map.title] || "") : "";
        if (!itemName.trim()) return;

        // Hierarchical detection: top-level index (e.g. "1", "2") = section header
        if (hasIndex && !hasSection && isTopLevelIndex(indexVal)) {
          currentSection = itemName.trim();
          // Section headers with a total but no coverage are just section rows
          const total = map.total !== undefined ? Number(row[map.total]) || 0 : 0;
          if (total > 0) {
            const existing = packageMap.get(currentSection) || { items: [], totalPrice: 0 };
            existing.totalPrice = total;
            packageMap.set(currentSection, existing);
          } else {
            if (!packageMap.has(currentSection)) {
              packageMap.set(currentSection, { items: [], totalPrice: 0 });
            }
          }
          return;
        }

        // Sub-section headers (e.g. "2.1 DEMOLIÇÕES") with no qty/coverage → skip
        if (hasIndex && indexVal && !indexVal.includes(".") === false) {
          const rawCoverage = map.coverageType !== undefined ? String(row[map.coverageType] || "").trim().toLowerCase() : "";
          const hasQty = map.qty !== undefined && row[map.qty] !== undefined && row[map.qty] !== "";
          if (!rawCoverage && !hasQty && indexVal.split(".").length === 2 && !isTopLevelIndex(indexVal)) {
            // Could be a sub-section header like "2.1 DEMOLIÇÕES" - skip it
            return;
          }
        }

        const sectionName = hasSection
          ? String(row[map.section] || currentSection)
          : currentSection;

        const total = map.total !== undefined ? Number(row[map.total]) || 0 : 0;
        const rawCoverage = map.coverageType !== undefined ? String(row[map.coverageType] || "").trim().toLowerCase() : "";
        const coverageType: "geral" | "local" = rawCoverage === "local" ? "local" : "geral";

        // Skip sub-section header rows (no coverage, no qty, name is all caps)
        const hasQty = map.qty !== undefined && row[map.qty] !== undefined && row[map.qty] !== "";
        if (!rawCoverage && !hasQty && total === 0) return;

        const item: ParsedItem = {
          name: itemName,
          description: map.description !== undefined ? String(row[map.description] || "") : undefined,
          qty: map.qty !== undefined ? Number(row[map.qty]) || undefined : undefined,
          unit: map.unit !== undefined ? String(row[map.unit] || "") : undefined,
          total,
          coverageType,
        };

        const existing = packageMap.get(sectionName) || { items: [], totalPrice: 0 };
        existing.items.push(item);
        if (!packageMap.has(sectionName)) {
          existing.totalPrice = total;
        }
        packageMap.set(sectionName, existing);
      });

    return packageMap;
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
          setError("A planilha precisa ter pelo menos 2 linhas.");
          return;
        }

        // Find the header row (first row with recognizable column names)
        let headerRowIdx = 0;
        for (let i = 0; i < Math.min(json.length, 15); i++) {
          const row = json[i];
          if (!row) continue;
          const lower = row.map((c: any) => (c || "").toString().trim().toLowerCase());
          if (lower.some((h: string) => h.includes("item") || h.includes("índice") || h.includes("indice"))) {
            headerRowIdx = i;
            break;
          }
        }

        const headers = json[headerRowIdx].map(String);
        const map = detectColumns(headers);

        if (!map.index && !map.section && !map.title) {
          setError("Não foi possível detectar colunas 'Índice', 'Seção' ou 'Item'.");
          return;
        }

        const dataRows = [json[headerRowIdx], ...json.slice(headerRowIdx + 1)];
        const packageMap = parseRows(dataRows, map);

        const pkgs: ParsedPackage[] = [...packageMap.entries()].map(([name, d]) => ({
          name,
          price: d.totalPrice,
          items: d.items,
        }));

        if (pkgs.length === 0) {
          setError("Nenhum item encontrado.");
          return;
        }

        onImported(pkgs);
      } catch {
        setError("Erro ao ler o arquivo.");
      }
    };
    reader.readAsArrayBuffer(f);
  }, [onImported]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const totalItems = packages.reduce((s, p) => s + p.items.length, 0);
  const geralCount = packages.reduce((s, p) => s + p.items.filter(i => i.coverageType === "geral").length, 0);
  const localCount = totalItems - geralCount;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display font-bold text-xl text-foreground mb-1">Importar Planilha</h3>
        <p className="text-sm text-muted-foreground font-body">
          Upload do XLSX com colunas: Seção, Item, Total, Cobertura (geral/local). Se "Cobertura" estiver ausente, assume "geral".
        </p>
      </div>

      {packages.length === 0 ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
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
          className="border-2 border-dashed border-border rounded-xl p-16 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
        >
          <Upload className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-body text-foreground font-medium mb-1">
            Arraste a planilha aqui ou clique para selecionar
          </p>
          <p className="text-xs text-muted-foreground font-body">.xlsx ou .xls</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-body font-medium text-foreground">{file?.name}</p>
              <p className="text-xs text-muted-foreground font-body">
                {packages.length} pacotes • {totalItems} itens • {geralCount} geral • {localCount} local
              </p>
            </div>
            <button
              onClick={() => { onImported([]); setFile(null); }}
              className="text-xs text-muted-foreground hover:text-destructive font-body transition-colors"
            >
              Remover
            </button>
          </div>

          <div className="border border-border rounded-lg overflow-hidden max-h-72 overflow-y-auto">
            <table className="w-full text-xs font-body">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Pacote</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Item</th>
                  <th className="text-center px-3 py-2 font-medium text-muted-foreground">Tipo</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {packages.flatMap(pkg =>
                  pkg.items.map((item, i) => (
                    <tr key={`${pkg.name}-${i}`} className="border-t border-border/50">
                      <td className="px-3 py-1.5 text-muted-foreground">{i === 0 ? pkg.name : ""}</td>
                      <td className="px-3 py-1.5 text-foreground">{item.name}</td>
                      <td className="px-3 py-1.5 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          item.coverageType === "geral"
                            ? "bg-primary/10 text-primary"
                            : "bg-accent text-accent-foreground"
                        }`}>
                          {item.coverageType}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-right text-foreground font-medium">
                        {item.total ? `R$ ${item.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <p className="text-sm text-destructive font-body">{error}</p>
        </div>
      )}

      <div className="flex items-center justify-between pt-4">
        <button
          onClick={onBack}
          className="px-4 py-2.5 rounded-lg border border-border text-sm font-body text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Voltar
        </button>
        <button
          onClick={onNext}
          disabled={packages.length === 0}
          className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-body font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continuar → Mapeamento
        </button>
      </div>
    </div>
  );
}
