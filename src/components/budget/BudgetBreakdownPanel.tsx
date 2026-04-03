import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Package, DollarSign, TrendingUp, Loader2 } from "lucide-react";
import { formatBRL } from "@/lib/formatBRL";

interface SectionWithItems {
  id: string;
  title: string;
  order_index: number;
  section_price: number | null;
  is_optional: boolean;
  items: {
    id: string;
    title: string;
    qty: number | null;
    unit: string | null;
    internal_unit_price: number | null;
    bdi_percentage: number | null;
    order_index: number;
  }[];
}

function calcSalePrice(cost: number | null, bdi: number | null): number {
  const c = Number(cost) || 0;
  const b = Number(bdi) || 0;
  return c * (1 + b / 100);
}

interface Props {
  budgetId: string;
}

export function BudgetBreakdownPanel({ budgetId }: Props) {
  const [sections, setSections] = useState<SectionWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("sections")
        .select("id, title, order_index, section_price, is_optional, items(id, title, qty, unit, internal_unit_price, bdi_percentage, order_index)")
        .eq("budget_id", budgetId)
        .order("order_index", { ascending: true });

      const mapped = (data || []).map((s: any) => ({
        ...s,
        items: (s.items || []).sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0)),
      }));
      setSections(mapped);
      setLoading(false);
    }
    load();
  }, [budgetId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (sections.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center">
          <Package className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground font-body">
            Nenhuma seção ou item cadastrado neste orçamento ainda.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Grand totals
  let grandCost = 0;
  let grandSale = 0;

  const sectionSummaries = sections.map((sec) => {
    let secCost = 0;
    let secSale = 0;
    const itemRows = sec.items.map((item) => {
      const qty = Number(item.qty) || 0;
      const cost = Number(item.internal_unit_price) || 0;
      const bdi = Number(item.bdi_percentage) || 0;
      const sale = calcSalePrice(cost, bdi);
      // When qty is missing, fall back to internal_total or unit price as the total
      const totalCost = qty > 0 ? qty * cost : (Number((item as any).internal_total) || cost);
      const totalSale = qty > 0 ? qty * sale : calcSalePrice(totalCost, bdi);
      secCost += totalCost;
      secSale += totalSale;
      return { ...item, cost, bdi, sale, totalCost, totalSale, qty };
    });
    // Use section_price as sale override if set and different
    const effectiveSale = sec.section_price != null && sec.section_price > 0 ? sec.section_price : secSale;
    grandCost += secCost;
    grandSale += effectiveSale;
    const secBdi = secCost > 0 ? ((effectiveSale / secCost) - 1) * 100 : 0;
    return { ...sec, itemRows, secCost, secSale: effectiveSale, secBdi };
  });

  const grandBdi = grandCost > 0 ? ((grandSale / grandCost) - 1) * 100 : 0;
  const margin = grandSale - grandCost;

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="pb-3 flex flex-row items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors">
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              Estrutura do Orçamento ({sections.length} seções)
            </CardTitle>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {/* Grand totals strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-lg bg-muted/50 border border-border">
              <MiniStat label="Total Venda" value={formatBRL(grandSale)} icon={<DollarSign className="h-3.5 w-3.5" />} accent />
              <MiniStat label="Total Custo" value={formatBRL(grandCost)} icon={<DollarSign className="h-3.5 w-3.5" />} />
              <MiniStat label="BDI Médio" value={`${grandBdi.toFixed(1)}%`} icon={<TrendingUp className="h-3.5 w-3.5" />} />
              <MiniStat label="Margem Líquida" value={formatBRL(margin)} icon={<TrendingUp className="h-3.5 w-3.5" />} accent={margin > 0} />
            </div>

            {/* Sections */}
            {sectionSummaries.map((sec) => (
              <SectionBlock key={sec.id} section={sec} />
            ))}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function MiniStat({ label, value, icon, accent }: { label: string; value: string; icon: React.ReactNode; accent?: boolean }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] text-muted-foreground font-body flex items-center gap-1">
        {icon} {label}
      </p>
      <p className={`text-sm font-semibold font-body tabular-nums ${accent ? "text-primary" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}

function SectionBlock({ section }: { section: any }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors cursor-pointer">
          <div className="flex items-center gap-2 min-w-0">
            <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0 ${open ? "rotate-180" : ""}`} />
            <span className="text-sm font-medium font-body text-foreground truncate">
              {section.title || "Seção"}
            </span>
            {section.is_optional && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-body shrink-0">
                Opcional
              </span>
            )}
            <span className="text-xs text-muted-foreground font-body shrink-0">
              ({section.itemRows.length} itens)
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs font-body tabular-nums shrink-0">
            <span className="text-muted-foreground">Custo: {formatBRL(section.secCost)}</span>
            <span className="text-muted-foreground">BDI: {section.secBdi.toFixed(1)}%</span>
            <span className="font-semibold text-foreground">Venda: {formatBRL(section.secSale)}</span>
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-5 mt-1 border-l-2 border-border pl-3 space-y-0">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_60px_80px_60px_80px_80px] gap-2 px-2 py-1.5 text-[11px] text-muted-foreground font-body font-medium border-b border-border">
            <span>Item</span>
            <span className="text-right">Qtd</span>
            <span className="text-right">$ Custo</span>
            <span className="text-right">% BDI</span>
            <span className="text-right">$ Venda</span>
            <span className="text-right">Total Venda</span>
          </div>
          {section.itemRows.map((item: any) => (
            <div key={item.id} className="grid grid-cols-[1fr_60px_80px_60px_80px_80px] gap-2 px-2 py-1.5 text-xs font-body border-b border-border/50 last:border-b-0 hover:bg-muted/20">
              <span className="text-foreground truncate">{item.title || "—"}</span>
              <span className="text-right text-muted-foreground tabular-nums">{item.qty || "—"}</span>
              <span className="text-right text-muted-foreground tabular-nums">{item.cost > 0 ? formatBRL(item.cost) : "—"}</span>
              <span className="text-right text-muted-foreground tabular-nums">{item.bdi > 0 ? `${item.bdi}%` : "—"}</span>
              <span className="text-right text-muted-foreground tabular-nums">{item.sale > 0 ? formatBRL(item.sale) : "—"}</span>
              <span className="text-right font-medium text-foreground tabular-nums">{item.totalSale > 0 ? formatBRL(item.totalSale) : "—"}</span>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
