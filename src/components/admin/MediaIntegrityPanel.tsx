import { useEffect, useState } from "react";
import {
  ShieldAlert,
  RefreshCw,
  CheckCircle2,
  Eye,
  Loader2,
  AlertTriangle,
  AlertCircle,
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
  type MediaIntegrityAlert,
} from "@/lib/media-integrity";
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
            {running ? "Verificando..." : "Rodar verificação agora"}
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
