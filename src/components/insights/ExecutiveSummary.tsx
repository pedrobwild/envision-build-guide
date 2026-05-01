import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain, ShieldAlert, Target, Eye, Sparkles, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { InsightsDashboardData } from "@/types/insights-dashboard";

import { logger } from "@/lib/logger";

const ICON_MAP: Record<string, React.ElementType> = {
  brain: Brain,
  shield: ShieldAlert,
  target: Target,
  eye: Eye,
  sparkles: Sparkles,
};

interface Takeaway {
  icon: string;
  title: string;
  insight: string;
}

interface ExecutiveSummaryProps {
  dashboardData: InsightsDashboardData | null | undefined;
}

export default function ExecutiveSummary({ dashboardData }: ExecutiveSummaryProps) {
  const [takeaways, setTakeaways] = useState<Takeaway[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (dashboardData && !hasLoaded) {
      generate();
    }
  }, [dashboardData]);

  const generate = async () => {
    if (!dashboardData) return;
    setLoading(true);
    try {
      const dd: any = dashboardData;
      const { data, error } = await supabase.functions.invoke("elephant-insights", {
        body: {
          action: "executive-summary",
          dashboardData: {
            personalityProfiles: dd.personalityProfiles?.slice(0, 5),
            objections: dd.objections?.slice(0, 8),
            hiddenObjections: dd.hiddenObjections?.slice(0, 5),
            topQuestions: dd.topQuestions?.slice(0, 8),
            buyingSignals: dd.buyingSignals?.slice(0, 8),
            closingArguments: dd.closingArguments?.slice(0, 5),
            buyerPersona: dd.buyerPersona,
            sentimentSummary: dd.sentimentSummary,
            metrics: dd.metrics,
          },
        },
      });

      if (error || !data?.success) throw new Error(data?.error || "Erro");
      setTakeaways(data.takeaways || []);
      setHasLoaded(true);
    } catch (err) {
      logger.error("Executive summary error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-8 text-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Gerando resumo executivo…</p>
        </CardContent>
      </Card>
    );
  }

  if (!takeaways.length) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/5 overflow-hidden">
      <CardContent className="p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-display font-semibold text-foreground">Resumo Executivo</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={generate} disabled={loading} className="h-7 text-xs text-muted-foreground">
            <RefreshCw className="h-3 w-3 mr-1" />
            Regerar
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {takeaways.slice(0, 3).map((t, i) => {
            const IconComp = ICON_MAP[t.icon] || Sparkles;
            return (
              <div
                key={i}
                className="flex gap-3 p-3 rounded-lg bg-background/60 border border-border/40"
              >
                <div className="shrink-0 mt-0.5">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <IconComp className="h-4 w-4 text-primary" />
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-foreground leading-tight">{t.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{t.insight}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
