import { useEffect, useMemo, useState } from "react";
import { Activity } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { format, parseISO, subDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

interface DayBucket {
  date: string; // YYYY-MM-DD (BRT)
  count: number;
}

/**
 * Widget compacto: mostra a média diária de novas solicitações de orçamento
 * dos últimos 7 dias (excluindo hoje, para evitar dia parcial), com um mini
 * gráfico de barras por dia. Lê direto a tabela `budgets` respeitando RLS
 * (admins veem tudo; outros papéis veem apenas os atribuídos).
 *
 * Janela: 7 dias completos terminando ontem (BRT, UTC-3).
 */
export function DailyRequestsWidget() {
  const [buckets, setBuckets] = useState<DayBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);

      // Janela: últimos 7 dias completos (ontem - 6 ... ontem), em BRT.
      // BRT = UTC-3 (sem DST). Meia-noite BRT = 03:00 UTC do mesmo dia.
      const now = new Date();
      const todayUtc = startOfDay(now);
      const endExclusiveBrtIso = new Date(todayUtc.getTime() + 3 * 3600_000).toISOString(); // hoje 00:00 BRT
      const startBrtIso = new Date(
        subDays(todayUtc, 7).getTime() + 3 * 3600_000,
      ).toISOString(); // 7 dias atrás 00:00 BRT

      const { data, error: qErr } = await supabase
        .from("budgets")
        .select("created_at")
        .gte("created_at", startBrtIso)
        .lt("created_at", endExclusiveBrtIso)
        .order("created_at", { ascending: true });

      if (cancelled) return;
      if (qErr) {
        setError(qErr.message);
        setLoading(false);
        return;
      }

      // Inicializa 7 buckets (mais antigo → mais recente, terminando ontem)
      const map = new Map<string, number>();
      for (let i = 7; i >= 1; i--) {
        const d = subDays(todayUtc, i);
        const key = format(d, "yyyy-MM-dd");
        map.set(key, 0);
      }

      for (const row of data ?? []) {
        // Converte UTC → BRT para classificar no dia local correto
        const utc = new Date(row.created_at as string);
        const brt = new Date(utc.getTime() - 3 * 3600_000);
        const key = format(brt, "yyyy-MM-dd");
        if (map.has(key)) map.set(key, (map.get(key) ?? 0) + 1);
      }

      setBuckets(
        Array.from(map.entries()).map(([date, count]) => ({ date, count })),
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const { total, average, peak } = useMemo(() => {
    const total = buckets.reduce((s, b) => s + b.count, 0);
    const average = buckets.length > 0 ? total / buckets.length : 0;
    const peak = buckets.reduce((m, b) => Math.max(m, b.count), 0);
    return { total, average, peak };
  }, [buckets]);

  return (
    <Card className="border bg-card">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="bg-primary/10 p-2.5 rounded-lg shrink-0">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-display font-semibold text-foreground">
              Novas solicitações por dia
            </h2>
            <p className="text-sm text-muted-foreground font-body mt-0.5">
              Últimos 7 dias completos (BRT)
            </p>
          </div>
        </div>

        {loading && (
          <div className="space-y-3">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-[160px] w-full" />
          </div>
        )}

        {!loading && error && (
          <p className="text-sm text-destructive py-4">
            Não foi possível carregar os dados: {error}
          </p>
        )}

        {!loading && !error && (
          <>
            <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
              <div>
                <div className="text-3xl font-display font-bold text-foreground tabular-nums">
                  {average.toLocaleString("pt-BR", {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}
                </div>
                <div className="text-xs text-muted-foreground font-body mt-0.5">
                  média diária
                </div>
              </div>
              <div>
                <div className="text-lg font-display font-semibold text-foreground tabular-nums">
                  {total}
                </div>
                <div className="text-xs text-muted-foreground font-body">
                  total na janela
                </div>
              </div>
              <div>
                <div className="text-lg font-display font-semibold text-foreground tabular-nums">
                  {peak}
                </div>
                <div className="text-xs text-muted-foreground font-body">
                  pico em um dia
                </div>
              </div>
            </div>

            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={buckets}
                  margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    opacity={0.4}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) =>
                      format(parseISO(d), "EEE dd", { locale: ptBR })
                    }
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    width={32}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.5rem",
                      fontSize: "0.75rem",
                    }}
                    labelFormatter={(d) =>
                      format(parseISO(d as string), "EEEE, dd 'de' MMM", {
                        locale: ptBR,
                      })
                    }
                    formatter={(v: number) => [`${v} solicitações`, "Recebidas"]}
                  />
                  <Bar
                    dataKey="count"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
