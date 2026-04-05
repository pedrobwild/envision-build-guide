import { useState } from "react";
import {
  Brain,
  Loader2,
  Wrench,
  ShieldCheck,
  AlertTriangle,
  Copy,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

interface FixResult {
  log_id: string;
  status: string;
  reason: string;
  response?: string;
}

interface AutoFixResponse {
  analysis: string;
  risk_level: string;
  fixes_proposed: number;
  fixes_applied: number;
  results: FixResult[];
  error?: string;
}

const RISK_COLORS: Record<string, string> = {
  low: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  high: "bg-destructive/10 text-destructive",
};

export default function AiSyncInsightsPanel() {
  const { toast } = useToast();
  const [analyzing, setAnalyzing] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [fixResult, setFixResult] = useState<AutoFixResponse | null>(null);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalysis(null);
    setFixResult(null);

    try {
      const res = await supabase.functions.invoke("ai-sync-monitor", {
        body: { action: "analyze" },
      });

      if (res.error) throw new Error(res.error.message);
      setAnalysis(res.data?.content ?? "Sem resultado.");
    } catch (err: unknown) {
      toast({
        title: "Erro na análise",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAutoFix = async () => {
    setFixing(true);
    setFixResult(null);

    try {
      const res = await supabase.functions.invoke("ai-sync-monitor", {
        body: { action: "auto_fix" },
      });

      if (res.error) throw new Error(res.error.message);
      const data = res.data as AutoFixResponse;
      setFixResult(data);

      if (data.fixes_applied > 0) {
        toast({
          title: "Correções aplicadas",
          description: `${data.fixes_applied}/${data.fixes_proposed} correções executadas com sucesso.`,
        });
      } else if (data.fixes_proposed === 0) {
        toast({
          title: "Nenhuma correção necessária",
          description: "A IA não identificou problemas que precisem de correção automática.",
        });
      }
    } catch (err: unknown) {
      toast({
        title: "Erro na correção",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setFixing(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!" });
  };

  return (
    <Card className="border bg-card">
      <CardContent className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="bg-violet-100 dark:bg-violet-900/30 p-2.5 rounded-lg">
              <Brain className="h-5 w-5 text-foreground/70" />
            </div>
            <div>
              <h2 className="text-lg font-display font-semibold text-foreground">
                Monitor de IA
              </h2>
              <p className="text-sm text-muted-foreground font-body mt-0.5">
                Análise inteligente e correção automática de problemas de sincronização
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleAnalyze}
            disabled={analyzing}
          >
            {analyzing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="h-3.5 w-3.5" />
            )}
            {analyzing ? "Analisando..." : "Analisar Saúde"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/20"
            onClick={handleAutoFix}
            disabled={fixing}
          >
            {fixing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wrench className="h-3.5 w-3.5" />
            )}
            {fixing ? "Corrigindo..." : "Auto-Corrigir Falhas"}
          </Button>
        </div>

        {/* Analysis Result */}
        {analysis && (
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-display font-semibold text-foreground">
                Análise de Saúde
              </h3>
              <div className="flex gap-1.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleAnalyze}
                  disabled={analyzing}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${analyzing ? "animate-spin" : ""}`} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleCopy(analysis)}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none font-body text-sm">
              <ReactMarkdown>{analysis}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Auto-Fix Result */}
        {fixResult && (
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-display font-semibold text-foreground flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                Resultado da Correção Automática
              </h3>
              {fixResult.risk_level && (
                <Badge
                  variant="secondary"
                  className={`text-[10px] ${RISK_COLORS[fixResult.risk_level] ?? ""}`}
                >
                  Risco: {fixResult.risk_level}
                </Badge>
              )}
            </div>

            {fixResult.analysis && (
              <p className="text-sm text-muted-foreground font-body">
                {fixResult.analysis}
              </p>
            )}

            {fixResult.error && (
              <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{fixResult.error}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border bg-background p-3 text-center">
                <p className="text-xs text-muted-foreground font-body">Propostas</p>
                <p className="text-xl font-display font-bold text-foreground">
                  {fixResult.fixes_proposed}
                </p>
              </div>
              <div className="rounded-lg border bg-background p-3 text-center">
                <p className="text-xs text-muted-foreground font-body">Aplicadas</p>
                <p className="text-xl font-display font-bold text-emerald-600 dark:text-emerald-400">
                  {fixResult.fixes_applied}
                </p>
              </div>
            </div>

            {fixResult.results.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Detalhes:</p>
                {fixResult.results.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 text-xs font-body bg-background rounded-md p-2 border"
                  >
                    <Badge
                      variant="secondary"
                      className={`text-[9px] shrink-0 mt-0.5 ${
                        r.status === "retried" || r.status === "payload_updated"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                          : r.status === "skipped"
                          ? "bg-muted text-muted-foreground"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {r.status}
                    </Badge>
                    <span className="text-muted-foreground flex-1">{r.reason}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
