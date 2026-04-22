import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/formatBRL";
import { getSupplierPrices, type SupplierPrice } from "@/lib/catalog-helpers";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Award, ArrowUpDown, Plus, Star } from "lucide-react";
import { toast } from "sonner";

type SortKey = "price" | "lead" | "updated";

function timeAgo(iso: string | null) {
  if (!iso) return "—";
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 30) return `há ${days}d`;
  if (days < 365) return `há ${Math.round(days / 30)} meses`;
  return `há ${Math.round(days / 365)} anos`;
}

interface Props {
  catalogItemId: string;
  onAddPrice?: () => void;
  onEditPrice?: (price: SupplierPrice) => void;
}

export function SupplierComparisonTab({ catalogItemId, onAddPrice, onEditPrice }: Props) {
  const queryClient = useQueryClient();
  const [sortKey, setSortKey] = useState<SortKey>("price");

  const { data: prices = [], isLoading } = useQuery({
    queryKey: ["catalog_item_supplier_prices", catalogItemId],
    queryFn: () => getSupplierPrices(catalogItemId),
  });

  const activePrices = useMemo(
    () => prices.filter((p) => p.is_active && p.unit_price != null),
    [prices],
  );

  const bestValue = useMemo(() => {
    if (activePrices.length === 0) return null;
    let best = activePrices[0];
    let bestScore = (best.unit_price ?? 0) * (1 + (best.lead_time_days ?? 0) / 30);
    for (const p of activePrices.slice(1)) {
      const score = (p.unit_price ?? 0) * (1 + (p.lead_time_days ?? 0) / 30);
      if (score < bestScore) {
        best = p;
        bestScore = score;
      }
    }
    return best;
  }, [activePrices]);

  const sorted = useMemo(() => {
    const arr = [...prices];
    arr.sort((a, b) => {
      // Primary always on top
      if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
      if (sortKey === "price") {
        return (a.unit_price ?? Infinity) - (b.unit_price ?? Infinity);
      }
      if (sortKey === "lead") {
        return (a.lead_time_days ?? Infinity) - (b.lead_time_days ?? Infinity);
      }
      // updated
      const ta = a as unknown as { updated_at?: string | null };
      const tb = b as unknown as { updated_at?: string | null };
      return new Date(tb.updated_at ?? 0).getTime() - new Date(ta.updated_at ?? 0).getTime();
    });
    return arr;
  }, [prices, sortKey]);

  const handleSetPrimary = async (priceId: string) => {
    const { error } = await supabase.rpc("set_primary_supplier_price", {
      p_catalog_item_id: catalogItemId,
      p_price_id: priceId,
    });
    if (error) {
      toast.error("Erro ao definir como principal");
      return;
    }
    toast.success("Fornecedor principal atualizado");
    queryClient.invalidateQueries({ queryKey: ["catalog_item_supplier_prices", catalogItemId] });
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground py-6 text-center">Carregando...</p>;
  }

  if (prices.length === 0) {
    return (
      <div className="py-8 text-center border rounded-lg border-dashed border-border space-y-2">
        <p className="text-sm text-muted-foreground">Sem preços cadastrados.</p>
        {onAddPrice && (
          <Button size="sm" variant="outline" onClick={onAddPrice}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar primeiro preço
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {bestValue && (
        <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <Award className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-primary uppercase tracking-wide">
              Melhor custo-benefício
            </p>
            <p className="text-sm text-foreground font-medium">
              {(bestValue.suppliers as { name?: string } | null)?.name ?? "—"}{" "}
              <span className="font-mono text-muted-foreground">
                · {formatBRL(bestValue.unit_price)}
                {bestValue.lead_time_days != null && ` · ${bestValue.lead_time_days}d`}
              </span>
            </p>
          </div>
          {!bestValue.is_primary && (
            <Button size="sm" variant="outline" className="shrink-0" onClick={() => handleSetPrimary(bestValue.id)}>
              <Star className="h-3.5 w-3.5 mr-1" /> Definir como principal
            </Button>
          )}
        </div>
      )}

      <div className="border rounded-lg border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-8"></TableHead>
              <TableHead className="text-xs">Fornecedor</TableHead>
              <TableHead className="text-xs">SKU</TableHead>
              <TableHead className="text-xs text-right">
                <button
                  className="inline-flex items-center gap-1 hover:text-foreground"
                  onClick={() => setSortKey("price")}
                >
                  Preço <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead className="text-xs">
                <button
                  className="inline-flex items-center gap-1 hover:text-foreground"
                  onClick={() => setSortKey("lead")}
                >
                  Prazo <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead className="text-xs">
                <button
                  className="inline-flex items-center gap-1 hover:text-foreground"
                  onClick={() => setSortKey("updated")}
                >
                  Atualizado <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead className="text-xs w-20">Status</TableHead>
              <TableHead className="text-xs w-16 text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((p) => {
              const updatedAt = (p as unknown as { updated_at?: string | null }).updated_at ?? null;
              return (
                <TableRow key={p.id} className={!p.is_active ? "opacity-50" : ""}>
                  <TableCell>
                    {p.is_primary && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {(p.suppliers as { name?: string } | null)?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.supplier_sku ?? "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatBRL(p.unit_price)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.lead_time_days != null ? `${p.lead_time_days}d` : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {timeAgo(updatedAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {p.is_primary && (
                        <Badge variant="default" className="text-[10px] px-1.5 py-0">
                          Principal
                        </Badge>
                      )}
                      <Badge variant={p.is_active ? "secondary" : "outline"} className="text-[10px] px-1.5 py-0">
                        {p.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {onEditPrice && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onEditPrice(p)}>
                        Editar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
