import { useEffect, useState } from "react";
import {
  ShieldAlert,
  RefreshCw,
  CheckCircle2,
  Eye,
  Loader2,
  AlertTriangle,
  AlertCircle,
  Activity,
  Lock,
  Copy,
  CircleDashed,
  FileDiff,
  Download,
  Database,
  ArrowDownToLine,
  ArrowUpFromLine,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  listMediaIntegrityAlerts,
  runMediaIntegrityCheck,
  acknowledgeAlert,
  resolveAlertAndRebaseline,
  getMediaIntegritySummary,
  type MediaIntegrityAlert,
  type MediaIntegritySummary,
} from "@/lib/media-integrity";
import {
  generateManualDiffReport,
  reportToJsonBlob,
  type ManualDiffReport,
} from "@/lib/media-manual-diff-report";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";

const ALERT_LABELS: Record<string, string> = {
  config_changed: "Configuração alterada",
  count_mismatch: "Quantidade divergente",
  url_broken: "URL quebrada",
  missing_baseline: "Sem baseline",
};

const SEVERITY_STYLES: Record<string, string> = {
  info: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  warning:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  critical: "bg-destructive/10 text-destructive",
};

export default function MediaIntegrityPanel() {
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<MediaIntegrityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [summary, setSummary] = useState<MediaIntegritySummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [diffReport, setDiffReport] = useState<ManualDiffReport | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);

  const handleGenerateDiffReport = async () => {
    setDiffLoading(true);
    try {
      const report = await generateManualDiffReport();
      setDiffReport(report);
      toast({
        title: "Relatório gerado",
        description: `${report.totalManualBudgets} manuais — ${report.changedCount} com alterações, ${report.unchangedCount} preservados intactos.`,
      });
    } catch (err) {
      toast({
        title: "Erro ao gerar relatório",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setDiffLoading(false);
    }
  };

  const handleDownloadReport = () => {
    if (!diffReport) return;
    const blob = reportToJsonBlob(diffReport);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `media-manual-diff-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCheckIntegrity = async () => {
    setSummaryLoading(true);
    try {
      const data = await getMediaIntegritySummary();
      setSummary({ ...data, openAlerts: alerts.filter(a => a.status === "open").length || data.openAlerts });
      toast({
        title: "Integridade verificada",
        description: `${data.totalBudgets} orçamentos analisados — ${data.manualPreserved} manuais preservados.`,
      });
    } catch (err) {
      toast({
        title: "Erro ao verificar integridade",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSummaryLoading(false);
    }
  };

  const load = async (status: "open" | "all" = filter) => {
    setLoading(true);
    try {
      const rows = await listMediaIntegrityAlerts({ status });
      setAlerts(rows);
    } catch (err) {
      toast({
        title: "Erro ao carregar alertas",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(filter);
  }, [filter]);

  const handleRun = async () => {
    setRunning(true);
    try {
      const res = await runMediaIntegrityCheck();
      toast({
        title: "Verificação concluída",
        description: `${res.summary.checked} orçamentos analisados — ${res.summary.alerts_created} novos alertas.`,
      });
      await load(filter);
    } catch (err) {
      toast({
        title: "Erro na verificação",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  };

  const handleAck = async (id: string) => {
    try {
      await acknowledgeAlert(id);
      await load(filter);
    } catch (err) {
      toast({
        title: "Erro ao reconhecer",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  const handleResolve = async (alert: MediaIntegrityAlert) => {
    try {
      await resolveAlertAndRebaseline(
        alert.id,
        alert.budget_id,
        "Operador confirmou nova mídia como esperada"
      );
      toast({
        title: "Alerta resolvido",
        description: "Baseline atualizado para a config atual.",
      });
      await load(filter);
    } catch (err) {
      toast({
        title: "Erro ao resolver",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  const openCount = alerts.filter((a) => a.status === "open").length;

  return (
    <Card className="border bg-card">
      <CardContent className="p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="bg-amber-100 dark:bg-amber-900/30 p-2.5 rounded-lg">
              <ShieldAlert className="h-5 w-5 text-foreground/70" />
            </div>
            <div>
              <h2 className="text-lg font-display font-semibold text-foreground">
                Integridade de Mídia
              </h2>
              <p className="text-sm text-muted-foreground font-body mt-0.5">
                Monitora orçamentos com upload manual — alerta quando o{" "}
                <code>media_config</code> ou as URLs públicas mudam.
              </p>
            </div>
          </div>
          {openCount > 0 && (
            <Badge variant="secondary" className={SEVERITY_STYLES.warning}>
              {openCount} aberto{openCount > 1 ? "s" : ""}
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={handleCheckIntegrity}
            disabled={summaryLoading}
            className="gap-1.5"
          >
            {summaryLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Activity className="h-3.5 w-3.5" />
            )}
            {summaryLoading ? "Verificando…" : "Verificar integridade de mídia"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRun}
            disabled={running}
            className="gap-1.5"
          >
            {running ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {running ? "Verificando..." : "Rodar verificação completa"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateDiffReport}
            disabled={diffLoading}
            className="gap-1.5"
          >
            {diffLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileDiff className="h-3.5 w-3.5" />
            )}
            {diffLoading ? "Gerando…" : "Gerar relatório de diffs"}
          </Button>
          <Button
            variant={filter === "open" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("open")}
          >
            Abertos
          </Button>
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            Todos
          </Button>
        </div>

        {summary && (
          <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-display font-semibold text-foreground">
                Resumo da verificação
              </h3>
              <span className="text-xs text-muted-foreground font-mono">
                {formatDistanceToNow(new Date(summary.generatedAt), {
                  addSuffix: true,
                  locale: ptBR,
                })}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-md border border-border bg-background p-3">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
                  <ShieldAlert className="h-3 w-3" /> Total
                </div>
                <div className="text-2xl font-display font-bold text-foreground tabular-nums mt-1">
                  {summary.totalBudgets}
                </div>
              </div>
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-mono">
                  <Lock className="h-3 w-3" /> Manuais preservados
                </div>
                <div className="text-2xl font-display font-bold text-emerald-700 dark:text-emerald-400 tabular-nums mt-1">
                  {summary.manualPreserved}
                </div>
              </div>
              <div className="rounded-md border border-sky-500/30 bg-sky-500/5 p-3">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-sky-700 dark:text-sky-400 font-mono">
                  <Copy className="h-3 w-3" /> Replicados
                </div>
                <div className="text-2xl font-display font-bold text-sky-700 dark:text-sky-400 tabular-nums mt-1">
                  {summary.replicated}
                </div>
              </div>
              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-400 font-mono">
                  <CircleDashed className="h-3 w-3" /> Pendentes
                </div>
                <div className="text-2xl font-display font-bold text-amber-700 dark:text-amber-400 tabular-nums mt-1">
                  {summary.pending}
                </div>
              </div>
            </div>

            {summary.openAlerts > 0 && (
              <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                {summary.openAlerts} alerta{summary.openAlerts > 1 ? "s" : ""} aberto
                {summary.openAlerts > 1 ? "s" : ""} no monitor de integridade.
              </div>
            )}

            {summary.sample.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono mb-2">
                  Amostra
                </div>
                <div className="space-y-1.5">
                  {summary.sample.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between gap-2 text-xs rounded-md bg-background border border-border px-2.5 py-1.5"
                    >
                      <span className="truncate text-foreground font-body">{s.label}</span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] shrink-0 ${
                          s.bucket === "manual"
                            ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                            : s.bucket === "replicado"
                            ? "border-sky-500/40 text-sky-700 dark:text-sky-400"
                            : "border-amber-500/40 text-amber-700 dark:text-amber-400"
                        }`}
                      >
                        {s.bucket}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Carregando…
            </div>
          ) : alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              <p className="text-sm">Nenhum alerta {filter === "open" ? "aberto" : "registrado"}.</p>
            </div>
          ) : (
            alerts.map((a) => (
              <div
                key={a.id}
                className="rounded-lg border bg-background p-3 flex items-start gap-3"
              >
                <div className="mt-0.5">
                  {a.severity === "critical" ? (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="secondary"
                      className={`text-[10px] ${SEVERITY_STYLES[a.severity] ?? ""}`}
                    >
                      {ALERT_LABELS[a.alert_type] ?? a.alert_type}
                    </Badge>
                    {a.status !== "open" && (
                      <Badge variant="outline" className="text-[10px]">
                        {a.status === "acknowledged" ? "reconhecido" : "resolvido"}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(a.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground mt-1 truncate">
                    {a.budget_label ?? a.budget_id}
                  </p>
                  <pre className="text-xs text-muted-foreground mt-1 font-mono whitespace-pre-wrap break-all max-h-24 overflow-auto">
                    {JSON.stringify(a.details, null, 2)}
                  </pre>
                </div>
                {a.status === "open" && (
                  <div className="flex flex-col gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1"
                      onClick={() => handleAck(a.id)}
                    >
                      <Eye className="h-3 w-3" />
                      Reconhecer
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1 text-emerald-700 dark:text-emerald-400"
                      onClick={() => handleResolve(a)}
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Resolver + rebaseline
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
