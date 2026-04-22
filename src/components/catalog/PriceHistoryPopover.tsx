import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { History, TrendingDown, TrendingUp } from "lucide-react";
import { formatBRL } from "@/lib/formatBRL";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip as RTooltip,
} from "recharts";

interface PriceHistoryRow {
  id: string;
  old_unit_price: number | null;
  new_unit_price: number | null;
  changed_at: string;
}

export function PriceHistoryPopover({
  catalogItemId,
  supplierId,
  supplierName,
}: {
  catalogItemId: string;
  supplierId: string;
  supplierName: string;
}) {
  const { data = [], isLoading } = useQuery<PriceHistoryRow[]>({
    queryKey: ["catalog_price_history", catalogItemId, supplierId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalog_price_history")
        .select("id, old_unit_price, new_unit_price, changed_at")
        .eq("catalog_item_id", catalogItemId)
        .eq("supplier_id", supplierId)
        .order("changed_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as PriceHistoryRow[];
    },
    enabled: false,
    refetchOnMount: true,
  });

  const chartData = [...data].reverse().map((row) => ({
    date: new Date(row.changed_at).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    }),
    price: Number(row.new_unit_price ?? 0),
  }));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Histórico de preço">
          <History className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-2">
          <div>
            <p className="text-xs font-semibold text-foreground">Histórico de preço</p>
            <p className="text-[11px] text-muted-foreground">{supplierName}</p>
          </div>
          {isLoading ? (
            <p className="text-xs text-muted-foreground py-3 text-center">Carregando...</p>
          ) : data.length === 0 ? (
            <p className="text-xs text-muted-foreground py-3 text-center">
              Sem alterações registradas.
            </p>
          ) : (
            <>
              {chartData.length >= 2 && (
                <div className="h-32 -mx-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 6, right: 8, left: -10, bottom: 0 }}>
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                        width={50}
                      />
                      <RTooltip formatter={(v: number) => formatBRL(v)} />
                      <Line
                        type="monotone"
                        dataKey="price"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="max-h-40 overflow-y-auto border-t border-border pt-1.5 space-y-1">
                {data.map((row) => {
                  const oldP = Number(row.old_unit_price ?? 0);
                  const newP = Number(row.new_unit_price ?? 0);
                  const variation = oldP > 0 ? ((newP - oldP) / oldP) * 100 : 0;
                  const TrendIcon = variation >= 0 ? TrendingUp : TrendingDown;
                  const trendColor = variation > 0 ? "text-destructive" : "text-emerald-600";
                  return (
                    <div key={row.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-muted-foreground tabular-nums">
                        {new Date(row.changed_at).toLocaleDateString("pt-BR")}
                      </span>
                      <span className="text-muted-foreground font-mono">
                        {formatBRL(oldP)} → {formatBRL(newP)}
                      </span>
                      {oldP > 0 && (
                        <span className={`inline-flex items-center gap-0.5 font-medium ${trendColor}`}>
                          <TrendIcon className="h-3 w-3" />
                          {variation > 0 ? "+" : ""}
                          {variation.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
