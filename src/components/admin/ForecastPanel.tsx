import { useState } from "react";
import { useForecast } from "@/hooks/useForecast";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Target, Loader2, Pencil } from "lucide-react";
import { formatBRL } from "@/lib/formatBRL";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ForecastPanelProps {
  ownerFilter?: string | null;
  isAdmin?: boolean;
}

export function ForecastPanel({ ownerFilter, isAdmin = false }: ForecastPanelProps) {
  const { data, loading } = useForecast(3, ownerFilter);
  const [editingMonth, setEditingMonth] = useState<{ key: string; date: Date } | null>(null);
  const [editRevenue, setEditRevenue] = useState("");
  const [editDeals, setEditDeals] = useState("");
  const [saving, setSaving] = useState(false);

  const openEdit = (bucket: typeof data[number]) => {
    setEditingMonth({ key: bucket.monthKey, date: bucket.monthStart });
    setEditRevenue(String(bucket.revenueTarget || ""));
    setEditDeals(String(bucket.dealsTarget || ""));
  };

  const saveTarget = async () => {
    if (!editingMonth) return;
    setSaving(true);
    try {
      const monthStr = editingMonth.date.toISOString().slice(0, 10);
      const revenue = parseFloat(editRevenue.replace(",", ".")) || 0;
      const deals = parseInt(editDeals, 10) || 0;

      const { error } = await supabase
        .from("commercial_targets")
        .upsert(
          {
            owner_id: ownerFilter ?? null,
            target_month: monthStr,
            revenue_target_brl: revenue,
            deals_target: deals,
          },
          { onConflict: "owner_id,target_month" }
        );

      if (error) throw error;
      toast.success("Meta atualizada");
      setEditingMonth(null);
      // Forçar refetch via reload do hook (key change)
      window.location.reload();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao salvar";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">Carregando forecast…</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Forecast & Previsibilidade</h3>
        </div>
        <Badge variant="outline" className="text-[10px]">
          Próximos 3 meses
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {data.map((bucket) => {
          const projected = bucket.closedRevenue + bucket.weighted;
          const projectedPct = bucket.revenueTarget > 0
            ? (projected / bucket.revenueTarget) * 100
            : null;

          return (
            <div
              key={bucket.monthKey}
              className="rounded-lg border bg-card/40 p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {bucket.monthLabel}
                </span>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => openEdit(bucket)}
                    title="Editar meta"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
              </div>

              {/* Projetado (fechado + ponderado) */}
              <div>
                <div className="text-[10px] text-muted-foreground uppercase">Projetado</div>
                <div className="text-lg font-bold tabular-nums">
                  {formatBRL(projected)}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Fechado: <span className="text-success font-medium">{formatBRL(bucket.closedRevenue)}</span>
                  {" + "}
                  Ponderado: <span className="text-warning font-medium">{formatBRL(bucket.weighted)}</span>
                </div>
              </div>

              {/* Meta */}
              {bucket.revenueTarget > 0 ? (
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                    <span className="flex items-center gap-1">
                      <Target className="h-2.5 w-2.5" />
                      Meta: {formatBRL(bucket.revenueTarget)}
                    </span>
                    {projectedPct !== null && (
                      <span className={projectedPct >= 100 ? "text-success font-semibold" : "text-foreground"}>
                        {projectedPct.toFixed(0)}%
                      </span>
                    )}
                  </div>
                  <Progress value={Math.min(100, projectedPct ?? 0)} className="h-1.5" />
                </div>
              ) : (
                <div className="pt-2 border-t">
                  <span className="text-[10px] text-muted-foreground italic">
                    {isAdmin ? "Defina uma meta" : "Sem meta definida"}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
                <span>{bucket.dealsCount} negócios em aberto</span>
                <span>{bucket.closedDeals} fechado{bucket.closedDeals !== 1 ? "s" : ""}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editingMonth} onOpenChange={(o) => !o && setEditingMonth(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Meta — {editingMonth?.date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="rev">Receita alvo (R$)</Label>
              <Input
                id="rev"
                type="number"
                value={editRevenue}
                onChange={(e) => setEditRevenue(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <Label htmlFor="deals">Fechamentos alvo</Label>
              <Input
                id="deals"
                type="number"
                value={editDeals}
                onChange={(e) => setEditDeals(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMonth(null)}>
              Cancelar
            </Button>
            <Button onClick={saveTarget} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
