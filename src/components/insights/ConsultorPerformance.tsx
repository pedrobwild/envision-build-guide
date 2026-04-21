import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2, Users, RefreshCw, CalendarRange, Database,
  UserCircle, ArrowLeftRight, UserX,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import InsightsDashboard from "./InsightsDashboard";
import ConsultorComparison from "./ConsultorComparison";
import {
  type ConsultorInsightData,
  type ElephantInsightsCacheRow,
  normalizeInsightsCache,
} from "@/types/insights";

type InsightsData = ConsultorInsightData;

interface ConsultorUser {
  id: string;
  name: string;
  email: string | null;
}

export default function ConsultorPerformance() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [consultores, setConsultores] = useState<ConsultorUser[]>([]);
  const [selectedConsultor, setSelectedConsultor] = useState<string>("");
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [viewMode, setViewMode] = useState<"individual" | "comparativo">("individual");
  const { toast } = useToast();

  useEffect(() => {
    const loadUsers = async () => {
      setLoadingUsers(true);
      try {
        const { data: res, error } = await supabase.functions.invoke(
          "elephant-insights",
          { body: { action: "list-users" } }
        );
        if (!error && res?.success && res.users) {
          setConsultores(res.users);
          if (res.users.length > 0) setSelectedConsultor(res.users[0].id);
        }
      } catch { /* silent */ }
      finally { setLoadingUsers(false); }
    };
    loadUsers();
  }, []);

  useEffect(() => {
    if (!selectedConsultor) { setInitialLoad(false); return; }
    const loadCache = async () => {
      try {
        const { data: cached } = await (supabase as any)
          .from("elephant_insights_cache")
          .select("*")
          .eq("cache_key", `user_${selectedConsultor}`)
          .single<ElephantInsightsCacheRow>();
        if (cached) {
          const age = cached.updated_at
            ? Math.round((Date.now() - new Date(cached.updated_at).getTime()) / 60000)
            : 0;
          setData(normalizeInsightsCache(cached, { cached: true, cacheAge: age }));
        } else { setData(null); }
      } catch { setData(null); }
      finally { setInitialLoad(false); }
    };
    loadCache();
  }, [selectedConsultor]);

  const fetchInsights = async (refresh = false) => {
    setLoading(true);
    try {
      const body: Record<string, string> = {};
      if (refresh) body.refresh = "true";
      if (selectedConsultor) body.userId = selectedConsultor;
      const { data: res, error } = await supabase.functions.invoke("elephant-insights", { body });
      if (error) throw error;
      if (!res?.success) throw new Error(res?.error || "Erro ao buscar insights");
      if (res.totalMeetings === 0) {
        setData(null);
        toast({
          title: "Nenhuma reunião encontrada",
          description: `${res.consultantName} não possui reuniões válidas registradas (reuniões sem duração são ignoradas).`,
          variant: "destructive",
        });
      } else {
        setData({
          consultantName: res.consultantName,
          totalMeetings: res.totalMeetings,
          totalDurationMinutes: res.totalDurationMinutes || 0,
          positiveSentimentPct: res.positiveSentimentPct,
          latestMeeting: res.latestMeeting,
          cached: res.cached || false, cacheAge: res.cacheAge,
          dashboard: res.chartsData,
        });
        toast({
          title: res.cached ? "Dados carregados do cache" : "Insights atualizados",
          description: res.cached ? `Atualizado há ${res.cacheAge} minutos.` : "Dados processados com sucesso.",
        });
      }
    } catch (err: any) {
      toast({ title: "Erro ao buscar insights", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const selectedConsultorName = consultores.find(c => c.id === selectedConsultor)?.name || "Consultor";

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground">
            Performance por Consultor
          </h2>
          <p className="text-muted-foreground mt-1 max-w-xl">
            Analise a performance individual de cada consultor ou compare métricas entre dois consultores.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3 shrink-0">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="shrink-0">
            <TabsList className="h-10">
              <TabsTrigger value="individual" className="text-xs gap-1.5 px-3">
                <UserCircle className="h-3.5 w-3.5" /> Individual
              </TabsTrigger>
              <TabsTrigger value="comparativo" className="text-xs gap-1.5 px-3">
                <ArrowLeftRight className="h-3.5 w-3.5" /> Comparativo
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {viewMode === "individual" && (
            <>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1">
                  <UserCircle className="h-3 w-3" /> Consultor
                </label>
                <Select value={selectedConsultor} onValueChange={setSelectedConsultor} disabled={loadingUsers || loading}>
                  <SelectTrigger className="w-[200px] h-10">
                    <SelectValue placeholder={loadingUsers ? "Carregando…" : "Selecione"} />
                  </SelectTrigger>
                  <SelectContent>
                    {consultores.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {data && (
                <Button onClick={() => fetchInsights(true)} disabled={loading} variant="outline" size="lg" className="min-h-[48px]">
                  <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Forçar atualização
                </Button>
              )}
              <Button onClick={() => fetchInsights(false)} disabled={loading || !selectedConsultor} size="lg" className="min-h-[48px]">
                {loading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analisando…</>
                ) : data ? (
                  <><RefreshCw className="mr-2 h-4 w-4" />Atualizar</>
                ) : (
                  <><Users className="mr-2 h-4 w-4" />Gerar insights</>
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      {viewMode === "comparativo" && (
        <ConsultorComparison consultores={consultores} loadingUsers={loadingUsers} />
      )}

      {viewMode === "individual" && (
        <>
          {!data && !loading && !initialLoad && (
            <Card className="border-dashed border-2 border-border/60">
              <CardContent className="py-16 text-center">
                <Users className="h-10 w-10 text-muted-foreground/40 mx-auto mb-4" />
                <p className="text-muted-foreground font-medium mb-1">Nenhum insight carregado</p>
                <p className="text-sm text-muted-foreground/70 max-w-md mx-auto">
                  Selecione um consultor e clique em "Gerar insights" para analisar as reuniões.
                </p>
              </CardContent>
            </Card>
          )}

          {loading && !data && (
            <Card className="border-border/60">
              <CardContent className="py-16 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                <p className="text-muted-foreground font-medium">Processando reuniões de {selectedConsultorName}…</p>
                <p className="text-sm text-muted-foreground/60 mt-1">Pode levar até 30s.</p>
              </CardContent>
            </Card>
          )}

          {data && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge className="bg-primary/10 text-primary border-primary/15 hover:bg-primary/10 text-sm py-1 px-3">
                  <UserCircle className="h-3.5 w-3.5 mr-1.5" /> {data.consultantName}
                </Badge>
                {data.cached && data.cacheAge !== undefined && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Database className="h-3.5 w-3.5" />
                    <span>Cache de {data.cacheAge < 60 ? `${data.cacheAge}min` : `${Math.round(data.cacheAge / 60)}h`} atrás</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="border-border/60">
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-primary tabular-nums">{data.totalMeetings}</p>
                    <p className="text-xs text-muted-foreground mt-1">reuniões analisadas</p>
                  </CardContent>
                </Card>
                <Card className="border-border/60">
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-foreground tabular-nums">
                      {data.totalDurationMinutes > 60 ? `${Math.round(data.totalDurationMinutes / 60)}h ${data.totalDurationMinutes % 60}m` : `${data.totalDurationMinutes}m`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">tempo total gravado</p>
                  </CardContent>
                </Card>
                {data.dashboard?.metrics?.scheduledCount > 0 && (
                  <Card className="border-border/60">
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-amber-600 tabular-nums flex items-center justify-center gap-1.5">
                        <UserX className="h-5 w-5" />
                        {data.dashboard.metrics.noShowRate}%
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        no-show ({data.dashboard.metrics.noShowCount}/{data.dashboard.metrics.scheduledCount})
                      </p>
                    </CardContent>
                  </Card>
                )}
                {data.latestMeeting && (
                  <Card className="border-border/60">
                    <CardContent className="p-4 text-center">
                      <p className="text-sm font-semibold text-foreground flex items-center justify-center gap-1.5">
                        <CalendarRange className="h-4 w-4 text-muted-foreground" />
                        {new Date(data.latestMeeting).toLocaleDateString("pt-BR")}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">última reunião</p>
                    </CardContent>
                  </Card>
                )}
              </div>

              {data.dashboard && <InsightsDashboard data={data.dashboard} scopeLabel={data.consultantName} />}
            </div>
          )}
        </>
      )}
    </div>
  );
}
