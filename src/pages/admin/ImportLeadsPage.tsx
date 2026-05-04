import { useCallback, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Trash2,
  Inbox,
  Route as RouteIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { CLIENT_SOURCES } from "@/hooks/useClients";
import { logger } from "@/lib/logger";
import { useToast } from "@/hooks/use-toast";

const TARGET_FIELDS = [
  { key: "lead_captured_at", label: "Data/Hora do lead", required: false },
  { key: "name", label: "Nome", required: false },
  { key: "email", label: "Email", required: false },
  { key: "phone", label: "Telefone", required: false },
  { key: "city", label: "Cidade", required: false },
  { key: "bairro", label: "Bairro", required: false },
  { key: "campaign_name", label: "Campanha", required: false },
  { key: "campaign_id", label: "Campaign ID", required: false },
  { key: "adset_name", label: "Conjunto de anúncios", required: false },
  { key: "adset_id", label: "Adset ID", required: false },
  { key: "ad_name", label: "Anúncio", required: false },
  { key: "ad_id", label: "Ad ID", required: false },
  { key: "platform", label: "Plataforma", required: false },
  { key: "external_id", label: "ID Lead Meta", required: false },
  { key: "form_id", label: "Form ID", required: false },
  { key: "form_name", label: "Form name", required: false },
] as const;

type TargetKey = (typeof TARGET_FIELDS)[number]["key"];

const HEADER_HINTS: Record<TargetKey, string[]> = {
  lead_captured_at: ["data/hora do lead", "data hora", "data do lead", "created_time", "data/hora", "data lead"],
  name: ["nome completo", "nome", "name", "full_name", "lead_name"],
  email: ["e-mail", "email", "endereco de email", "endereço de e-mail"],
  phone: ["telefone", "whatsapp", "celular", "phone", "phone_number"],
  city: ["cidade", "city"],
  bairro: ["bairro", "neighborhood"],
  campaign_name: ["campanha", "campaign", "campaign_name", "nome da campanha"],
  campaign_id: ["campaign_id", "id da campanha", "id campanha"],
  adset_name: ["conjunto de anúncios", "conjunto de anuncios", "adset", "adset_name", "nome do conjunto"],
  adset_id: ["adset_id", "id do conjunto", "id conjunto"],
  ad_name: ["anúncio", "anuncio", "ad", "ad_name", "nome do anúncio", "nome do anuncio"],
  ad_id: ["ad_id", "id do anúncio", "id anuncio"],
  platform: ["plataforma", "platform"],
  external_id: ["id lead meta", "lead id", "lead_id", "leadgen_id", "id do lead"],
  form_id: ["form_id", "id formulário", "id formulario"],
  form_name: ["form_name", "nome formulário", "nome formulario"],
};

const NONE = "__none__";
const MAX_PREVIEW = 5;
const CHUNK_SIZE = 200;

interface ParsedSheet {
  fileName: string;
  headers: string[];
  rows: Array<Record<string, unknown>>;
}

interface ImportSummary {
  total: number;
  processed: number;
  duplicate: number;
  failed: number;
  errors: Array<{ row_index: number; error: string }>;
}

function normalizeHeader(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\s_-]+/g, " ")
    .trim();
}

function autoMap(headers: string[]): Record<TargetKey, string> {
  const normalized = headers.map(normalizeHeader);
  const result = {} as Record<TargetKey, string>;
  for (const field of TARGET_FIELDS) {
    const hints = HEADER_HINTS[field.key].map(normalizeHeader);
    let matchIdx = -1;
    for (const hint of hints) {
      const idx = normalized.findIndex((h) => h === hint);
      if (idx !== -1) {
        matchIdx = idx;
        break;
      }
    }
    if (matchIdx === -1) {
      for (const hint of hints) {
        const idx = normalized.findIndex((h) => h.includes(hint));
        if (idx !== -1) {
          matchIdx = idx;
          break;
        }
      }
    }
    result[field.key] = matchIdx >= 0 ? headers[matchIdx] : NONE;
  }
  return result;
}

function parseDateValue(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (raw instanceof Date && !isNaN(raw.getTime())) return raw.toISOString();
  if (typeof raw === "number") {
    // Excel/Sheets serial — converte usando epoch 1899-12-30
    const ms = Math.round((raw - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  const s = String(raw).trim();
  if (!s) return null;
  // ISO direto
  const iso = new Date(s);
  if (!isNaN(iso.getTime()) && /\d{4}-\d{2}-\d{2}/.test(s)) return iso.toISOString();
  // dd/mm/yyyy [hh:mm[:ss]]
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (br) {
    const [, dd, mm, yyRaw, hh = "0", mi = "0", ss = "0"] = br;
    const yy = yyRaw.length === 2 ? `20${yyRaw}` : yyRaw;
    const d = new Date(
      Date.UTC(Number(yy), Number(mm) - 1, Number(dd), Number(hh), Number(mi), Number(ss)),
    );
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  // yyyy-mm-dd hh:mm:ss
  const sql = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (sql) {
    const [, yy, mm, dd, hh, mi, ss = "0"] = sql;
    const d = new Date(
      Date.UTC(Number(yy), Number(mm) - 1, Number(dd), Number(hh), Number(mi), Number(ss)),
    );
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  const fallback = new Date(s);
  return isNaN(fallback.getTime()) ? null : fallback.toISOString();
}

function cleanCell(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  return s === "" ? null : s;
}

export default function ImportLeadsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<Record<TargetKey, string>>({} as Record<TargetKey, string>);
  const [defaultSource, setDefaultSource] = useState<string>("meta_ads");
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const { toast } = useToast();

  const handleFile = useCallback((file: File) => {
    setParseError(null);
    setSummary(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        const nonEmpty = json.filter(
          (r) => Array.isArray(r) && r.some((c) => c !== undefined && c !== null && c !== ""),
        );
        if (nonEmpty.length < 2) {
          setParseError("A planilha precisa ter pelo menos cabeçalho + 1 linha de dados.");
          return;
        }
        const headers = (nonEmpty[0] as unknown[]).map((h) => String(h ?? "").trim());
        const rows = nonEmpty.slice(1).map((r) => {
          const obj: Record<string, unknown> = {};
          headers.forEach((h, i) => {
            obj[h] = (r as unknown[])[i];
          });
          return obj;
        });
        setSheet({ fileName: file.name, headers, rows });
        setMapping(autoMap(headers));
      } catch (err) {
        logger.error("[ImportLeadsPage] parse failed", err);
        setParseError("Falha ao ler o arquivo. Verifique se é um CSV/XLSX válido.");
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const previewRows = useMemo(() => sheet?.rows.slice(0, MAX_PREVIEW) ?? [], [sheet]);

  const buildPayloadRow = useCallback(
    (raw: Record<string, unknown>, rowIndex: number) => {
      const get = (k: TargetKey) => {
        const col = mapping[k];
        if (!col || col === NONE) return null;
        return raw[col];
      };
      return {
        row_index: rowIndex,
        source: defaultSource,
        external_id: cleanCell(get("external_id")),
        name: cleanCell(get("name")) ?? "",
        email: cleanCell(get("email")),
        phone: cleanCell(get("phone")),
        city: cleanCell(get("city")),
        bairro: cleanCell(get("bairro")),
        campaign_id: cleanCell(get("campaign_id")),
        campaign_name: cleanCell(get("campaign_name")),
        adset_id: cleanCell(get("adset_id")),
        adset_name: cleanCell(get("adset_name")),
        ad_id: cleanCell(get("ad_id")),
        ad_name: cleanCell(get("ad_name")),
        form_id: cleanCell(get("form_id")),
        form_name: cleanCell(get("form_name")),
        platform: cleanCell(get("platform")),
        lead_captured_at: parseDateValue(get("lead_captured_at")),
      };
    },
    [mapping, defaultSource],
  );

  const handleImport = useCallback(async () => {
    if (!sheet) return;
    setImporting(true);
    setSummary(null);

    const payload = sheet.rows.map((r, i) => buildPayloadRow(r, i + 2)); // +2: linha 1 é header
    const total = payload.length;
    setProgress({ done: 0, total });

    const aggregate: ImportSummary = {
      total,
      processed: 0,
      duplicate: 0,
      failed: 0,
      errors: [],
    };

    try {
      for (let start = 0; start < payload.length; start += CHUNK_SIZE) {
        const chunk = payload.slice(start, start + CHUNK_SIZE);
        const { data, error } = await supabase.functions.invoke("import-leads-csv", {
          body: { rows: chunk, default_source: defaultSource },
        });
        if (error) throw error;
        const res = data as ImportSummary;
        aggregate.processed += res.processed ?? 0;
        aggregate.duplicate += res.duplicate ?? 0;
        aggregate.failed += res.failed ?? 0;
        if (Array.isArray(res.errors)) aggregate.errors.push(...res.errors);
        setProgress({ done: Math.min(start + chunk.length, total), total });
      }
      setSummary(aggregate);
      toast({
        title: "Importação concluída",
        description: `${aggregate.processed} novos · ${aggregate.duplicate} duplicados · ${aggregate.failed} falhas`,
      });
    } catch (err) {
      logger.error("[ImportLeadsPage] import failed", err);
      const message = err instanceof Error ? err.message : "Erro inesperado";
      toast({ title: "Falha na importação", description: message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  }, [sheet, buildPayloadRow, defaultSource, toast]);

  const reset = () => {
    setSheet(null);
    setMapping({} as Record<TargetKey, string>);
    setSummary(null);
    setProgress({ done: 0, total: 0 });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-3xl font-bold font-display tracking-tight flex items-center gap-2">
            <Upload className="h-5 w-5 sm:h-7 sm:w-7 shrink-0" />
            Importar leads (planilha)
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground font-body mt-1">
            Suba um CSV ou XLSX (ex: planilha de leads do Meta Ads). Cada linha vira um cliente
            em estágio MQL e é distribuída automaticamente segundo as{" "}
            <Link to="/admin/leads/regras" className="underline">regras de roteamento</Link>.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild className="h-10 sm:h-9">
            <Link to="/admin/leads/regras"><RouteIcon className="h-4 w-4 mr-2" /> Regras</Link>
          </Button>
          <Button variant="outline" asChild className="h-10 sm:h-9">
            <Link to="/admin/leads"><Inbox className="h-4 w-4 mr-2" /> Auditoria</Link>
          </Button>
        </div>
      </div>

      {!sheet && (
        <Card>
          <CardHeader>
            <CardTitle>1. Escolha o arquivo</CardTitle>
            <CardDescription>
              Exporte a planilha do Google Sheets como CSV ou XLSX e selecione abaixo.
              Aceita as colunas: Data/Hora do lead, Nome, Email, Telefone, Campanha,
              Conjunto de anúncios, Anúncio, Plataforma, ID Lead Meta, Cidade, Bairro.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <label
              htmlFor="lead-csv-input"
              className="flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-lg p-10 cursor-pointer hover:bg-muted/40 transition"
            >
              <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
              <div className="text-center">
                <p className="font-medium">Clique para selecionar</p>
                <p className="text-xs text-muted-foreground">CSV ou XLSX, até ~5MB</p>
              </div>
              <Input
                ref={fileInputRef}
                id="lead-csv-input"
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </label>
            {parseError && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Não foi possível ler o arquivo</AlertTitle>
                <AlertDescription>{parseError}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {sheet && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle>2. Confirme o mapeamento</CardTitle>
                <CardDescription>
                  <strong>{sheet.fileName}</strong> — {sheet.rows.length} linhas,{" "}
                  {sheet.headers.length} colunas. Auto-detectado pelos cabeçalhos.
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={reset}>
                <Trash2 className="h-4 w-4 mr-1" /> Trocar arquivo
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Fonte (source) padrão</Label>
                  <Select value={defaultSource} onValueChange={setDefaultSource}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CLIENT_SOURCES).map(([k, label]) => (
                        <SelectItem key={k} value={k}>{label}</SelectItem>
                      ))}
                      <SelectItem value="google_sheets">Google Sheets (genérico)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Define qual regra de roteamento será aplicada (campo{" "}
                    <code className="text-xs">match_source</code>) e o{" "}
                    <code className="text-xs">utm_source</code> derivado.
                  </p>
                </div>
                {TARGET_FIELDS.map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <Label className="text-xs">
                      {field.label}{" "}
                      <span className="text-muted-foreground font-mono">({field.key})</span>
                    </Label>
                    <Select
                      value={mapping[field.key] ?? NONE}
                      onValueChange={(v) =>
                        setMapping((m) => ({ ...m, [field.key]: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="(não mapeado)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>(não mapeado)</SelectItem>
                        {sheet.headers.map((h) => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3. Pré-visualização</CardTitle>
              <CardDescription>
                Primeiras {Math.min(MAX_PREVIEW, sheet.rows.length)} linhas após mapeamento.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="w-full whitespace-nowrap rounded border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {TARGET_FIELDS.filter((f) => mapping[f.key] && mapping[f.key] !== NONE).map(
                        (f) => (
                          <TableHead key={f.key} className="text-xs">{f.label}</TableHead>
                        ),
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((row, i) => {
                      const built = buildPayloadRow(row, i + 2);
                      return (
                        <TableRow key={i}>
                          {TARGET_FIELDS.filter(
                            (f) => mapping[f.key] && mapping[f.key] !== NONE,
                          ).map((f) => (
                            <TableCell key={f.key} className="text-xs max-w-[200px] truncate">
                              {String((built as Record<string, unknown>)[f.key] ?? "—")}
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>4. Importar</CardTitle>
              <CardDescription>
                Cada linha será criada como cliente em estágio MQL e atribuída ao próximo
                comercial da fila configurada nas regras de roteamento. Duplicados (por
                email, telefone normalizado ou ID Lead Meta) são detectados automaticamente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {importing && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Enviando lotes…</span>
                    <span className="font-mono">
                      {progress.done} / {progress.total}
                    </span>
                  </div>
                  <Progress
                    value={progress.total ? (progress.done / progress.total) * 100 : 0}
                  />
                </div>
              )}

              {summary && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Importação concluída</AlertTitle>
                  <AlertDescription>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge variant="default">{summary.processed} novos</Badge>
                      <Badge variant="secondary">{summary.duplicate} duplicados</Badge>
                      {summary.failed > 0 && (
                        <Badge variant="destructive">{summary.failed} falhas</Badge>
                      )}
                    </div>
                    {summary.errors.length > 0 && (
                      <ScrollArea className="mt-3 max-h-40 rounded border p-2 text-xs font-mono">
                        {summary.errors.slice(0, 50).map((e, i) => (
                          <div key={i}>linha {e.row_index}: {e.error}</div>
                        ))}
                        {summary.errors.length > 50 && (
                          <div className="text-muted-foreground">
                            … +{summary.errors.length - 50} erros
                          </div>
                        )}
                      </ScrollArea>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={reset} disabled={importing}>
                  Cancelar
                </Button>
                <Button onClick={handleImport} disabled={importing || sheet.rows.length === 0}>
                  {importing ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importando…</>
                  ) : (
                    <>Importar {sheet.rows.length} leads <ArrowRight className="h-4 w-4 ml-2" /></>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
