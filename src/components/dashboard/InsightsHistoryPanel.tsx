import { useEffect, useState } from "react";
import { History, Loader2, ChevronDown, Activity, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface InsightItem {
  id: string;
  severity: "critical" | "warning" | "info" | "opportunity";
  title: string;
  rootCause: string;
  recommendation: string;
  affectedCount: number;
  estimatedImpactBRL?: number;
}

interface HistoryEntry {
  id: string;
  generated_at: string;
  period_from: string;
  period_to: string;
  period_days: number;
  health_diagnosis: "excellent" | "healthy" | "warning" | "critical";
  health_score: number | null;
  executive_summary: string;
  insights: InsightItem[];
}

const DIAGNOSIS_STYLE: Record<HistoryEntry["health_diagnosis"], { label: string; cls: string; icon: typeof Activity }> = {
  excellent: { label: "Excelente", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300", icon: TrendingUp },
  healthy: { label: "Saudável", cls: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300", icon: Activity },
  warning: { label: "Atenção", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300", icon: Minus },
  critical: { label: "Crítico", cls: "bg-destructive/10 text-destructive", icon: TrendingDown },
};

interface Props {
  /** Bump this number when a new insight was just generated to force a refetch */
  refreshKey?: number;
}

export function InsightsHistoryPanel({ refreshKey = 0 }: Props) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("operations_insights_history")
        .select(
          "id,generated_at,period_from,period_to,period_days,health_diagnosis,health_score,executive_summary,insights",
        )
        .order("generated_at", { ascending: false })
        .limit(20);
      if (cancelled) return;
      if (error) {
        toast.error("Falha ao carregar histórico de diagnósticos");
        setEntries([]);
      } else {
        setEntries((data ?? []) as unknown as HistoryEntry[]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return (
    <Card className="border bg-card">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="bg-violet-100 dark:bg-violet-900/30 p-2.5 rounded-lg">
            <History className="h-5 w-5 text-foreground/70" />
          </div>
          <div>
            <h2 className="text-lg font-display font-semibold text-foreground">
              Histórico de diagnósticos
            </h2>
            <p className="text-sm text-muted-foreground font-body mt-0.5">
              Últimas 20 análises geradas pela IA — compare a evolução da saúde operacional
            </p>
          </div>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando histórico…
          </div>
        )}

        {!loading && entries.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum diagnóstico salvo ainda. Gere o primeiro pelo painel acima.
          </p>
        )}

        {!loading && entries.length > 0 && (
          <div className="space-y-2">
            {entries.map((e) => {
              const style = DIAGNOSIS_STYLE[e.health_diagnosis] ?? DIAGNOSIS_STYLE.healthy;
              const Icon = style.icon;
              const open = openId === e.id;
              return (
                <Collapsible key={e.id} open={open} onOpenChange={(v) => setOpenId(v ? e.id : null)}>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-between h-auto py-3 px-3 hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3 text-left flex-1 min-w-0">
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-foreground">
                              {format(new Date(e.generated_at), "dd 'de' MMM, HH:mm", { locale: ptBR })}
                            </span>
                            <Badge variant="secondary" className={`text-[10px] ${style.cls}`}>
                              {style.label}
                            </Badge>
                            {e.health_score != null && (
                              <span className="text-[11px] text-muted-foreground font-mono">
                                Score {e.health_score}
                              </span>
                            )}
                            <span className="text-[11px] text-muted-foreground">
                              · {e.period_days}d · {e.insights?.length ?? 0} insights
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                            {e.executive_summary}
                          </p>
                        </div>
                      </div>
                      <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-3 pb-3 pt-1 space-y-2">
                    <p className="text-sm text-foreground font-body bg-muted/30 rounded-md p-3">
                      {e.executive_summary}
                    </p>
                    {(e.insights ?? []).map((ins) => (
                      <div key={ins.id} className="rounded-md border bg-background p-3 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary" className="text-[9px] uppercase">{ins.severity}</Badge>
                          <span className="text-sm font-medium text-foreground">{ins.title}</span>
                        </div>
                        <p className="text-xs text-muted-foreground"><strong>Causa:</strong> {ins.rootCause}</p>
                        <p className="text-xs text-muted-foreground"><strong>Ação:</strong> {ins.recommendation}</p>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
