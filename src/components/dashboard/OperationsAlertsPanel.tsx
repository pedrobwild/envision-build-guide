import { useState } from "react";
import { AlertTriangle, CheckCircle2, AlertCircle, Info, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useOperationsAlerts, type OperationsAlert } from "@/hooks/useOperationsAlerts";
import { toast } from "sonner";

const SEVERITY_CFG = {
  critical: { icon: AlertCircle, color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30", label: "Crítico" },
  warning:  { icon: AlertTriangle, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", label: "Atenção" },
  info:     { icon: Info, color: "text-primary", bg: "bg-primary/10", border: "border-primary/30", label: "Info" },
} as const;

export function OperationsAlertsPanel() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const { data, loading, error, resolve } = useOperationsAlerts(false, refreshKey);

  const handleResolve = async (alert: OperationsAlert) => {
    setResolvingId(alert.id);
    const err = await resolve(alert.id);
    setResolvingId(null);
    if (err) toast.error(`Erro: ${err}`);
    else {
      toast.success("Alerta resolvido");
      setRefreshKey((k) => k + 1);
    }
  };

  return (
    <Card className="border bg-card">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="bg-destructive/10 p-2.5 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-display font-semibold text-foreground">
              Alertas proativos
            </h2>
            <p className="text-sm text-muted-foreground font-body mt-0.5">
              Disparados automaticamente após cada snapshot diário
            </p>
          </div>
          {!loading && (
            <Badge variant={data.length > 0 ? "destructive" : "secondary"} className="text-xs">
              {data.length} ativo{data.length !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>

        {loading && <Skeleton className="h-32 w-full" />}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {!loading && !error && data.length === 0 && (
          <div className="text-center py-8 space-y-2">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
            <p className="text-sm text-foreground font-medium">Nenhum alerta ativo</p>
            <p className="text-xs text-muted-foreground">Todos os indicadores estão dentro dos limites</p>
          </div>
        )}

        {!loading && data.length > 0 && (
          <div className="space-y-2">
            {data.map((alert) => {
              const cfg = SEVERITY_CFG[alert.severity];
              const Icon = cfg.icon;
              return (
                <div
                  key={alert.id}
                  className={`rounded-lg border p-3 ${cfg.bg} ${cfg.border} flex items-start gap-3`}
                >
                  <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${cfg.color}`} />
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">{alert.title}</span>
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5">{cfg.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{alert.message}</p>
                    <p className="text-[10px] text-muted-foreground/70">
                      {format(parseISO(alert.created_at), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => handleResolve(alert)}
                    disabled={resolvingId === alert.id}
                  >
                    {resolvingId === alert.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Resolver"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
