import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { calculateSectionSubtotal } from "@/lib/supabase-helpers";
import { formatBRL } from "@/lib/formatBRL";
import {
  ArrowLeft, Download, TrendingUp, Award, BarChart3, Percent,
  ArrowUpRight, ArrowDownRight
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Line, ComposedChart
} from "recharts";
import logoDark from "@/assets/logo-bwild-dark.png";
import logoWhite from "@/assets/logo-bwild-white.png";

interface MonthData {
  key: string;
  label: string;
  month: number;
  year: number;
  contracts: number;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
}

export default function FinancialHistory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [budgets, setBudgets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState<number>(6);

  useEffect(() => {
    loadClosedBudgets();
  }, []);

  const loadClosedBudgets = async () => {
    const { data } = await supabase
      .from("budgets")
      .select("*, sections(id, title, section_price, qty, items(id, internal_total, internal_unit_price, qty)), adjustments(id, sign, amount)")
      .eq("status", "contrato_fechado")
      .order("closed_at", { ascending: false } as any);
    setBudgets(data || []);
    setLoading(false);
  };

  const getBudgetTotal = (budget: any) => {
    const sectionsTotal = (budget.sections || []).reduce(
      (sum: number, s: any) => sum + calculateSectionSubtotal(s), 0
    );
    const adjustmentsTotal = (budget.adjustments || []).reduce(
      (sum: number, adj: any) => sum + (adj.sign * Number(adj.amount)), 0
    );
    return sectionsTotal + adjustmentsTotal;
  };

  // Build monthly data
  const allMonthlyData: MonthData[] = useMemo(() => {
    const monthMap = new Map<string, { contracts: number; revenue: number; cost: number }>();

    budgets.forEach(b => {
      const closedAt = (b as any).closed_at;
      if (!closedAt) return;
      const d = new Date(closedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const existing = monthMap.get(key) || { contracts: 0, revenue: 0, cost: 0 };
      existing.contracts += 1;
      existing.revenue += getBudgetTotal(b);
      existing.cost += Number((b as any).internal_cost) || 0;
      monthMap.set(key, existing);
    });

    return Array.from(monthMap.entries())
      .map(([key, data]) => {
        const [year, month] = key.split("-").map(Number);
        const profit = data.revenue - data.cost;
        const margin = data.revenue > 0 ? (profit / data.revenue) * 100 : 0;
        const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        return {
          key,
          label: `${monthNames[month - 1]}/${String(year).slice(2)}`,
          month,
          year,
          contracts: data.contracts,
          revenue: data.revenue,
          cost: data.cost,
          profit,
          margin: Math.round(margin * 10) / 10,
        };
      })
      .sort((a, b) => b.key.localeCompare(a.key));
  }, [budgets]);

  const filteredData = useMemo(() => {
    return allMonthlyData.slice(0, periodFilter);
  }, [allMonthlyData, periodFilter]);

  const chartData = useMemo(() => [...filteredData].reverse(), [filteredData]);

  // KPI indicators
  const kpis = useMemo(() => {
    if (allMonthlyData.length === 0) return null;

    const bestRevenue = allMonthlyData.reduce((best, m) => m.revenue > best.revenue ? m : best, allMonthlyData[0]);
    const bestMargin = allMonthlyData.reduce((best, m) => m.margin > best.margin ? m : best, allMonthlyData[0]);

    const last6 = allMonthlyData.slice(0, 6);
    const avgRevenue = last6.length > 0 ? last6.reduce((s, m) => s + m.revenue, 0) / last6.length : 0;

    // MoM growth
    let momGrowth = 0;
    if (allMonthlyData.length >= 2) {
      const current = allMonthlyData[0].revenue;
      const previous = allMonthlyData[1].revenue;
      momGrowth = previous > 0 ? ((current - previous) / previous) * 100 : 0;
    }

    return {
      bestMonth: { label: bestRevenue.label, value: formatBRL(bestRevenue.revenue) },
      bestMargin: { label: bestMargin.label, value: `${bestMargin.margin}%` },
      avgMonthly: formatBRL(avgRevenue),
      momGrowth: Math.round(momGrowth * 10) / 10,
    };
  }, [allMonthlyData]);

  const exportCSV = () => {
    const header = "Mês/Ano,Contratos,Faturamento,Custo,Lucro,Margem %\n";
    const rows = allMonthlyData
      .map(m => `${m.label},${m.contracts},${m.revenue.toFixed(2)},${m.cost.toFixed(2)},${m.profit.toFixed(2)},${m.margin}`)
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historico-financeiro-bwild.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload) return null;
    return (
      <div className="rounded-lg border border-border bg-popover p-3 shadow-lg">
        <p className="font-display font-semibold text-sm text-foreground mb-2">{label}</p>
        {payload.map((entry: any, i: number) => (
          <div key={i} className="flex items-center gap-2 text-xs font-body">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-medium text-foreground">
              {entry.name === "Margem %" ? `${entry.value}%` : formatBRL(entry.value)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => navigate("/admin")}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <img src={logoDark} alt="Bwild" className="h-6 sm:h-7 dark:hidden flex-shrink-0" />
            <img src={logoWhite} alt="Bwild" className="h-6 sm:h-7 hidden dark:block flex-shrink-0" />
            <div className="h-5 w-px bg-border hidden sm:block" />
            <h1 className="font-display font-semibold text-sm text-foreground leading-tight">Histórico Financeiro</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />)}
          </div>
        ) : allMonthlyData.length === 0 ? (
          <div className="text-center py-16">
            <BarChart3 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="font-display text-lg font-semibold text-foreground mb-1">Sem dados financeiros</h3>
            <p className="text-muted-foreground text-sm font-body">
              Marque orçamentos como "Contrato Fechado" para gerar o histórico.
            </p>
          </div>
        ) : (
          <>
            {/* Chart */}
            <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h2 className="font-display font-bold text-foreground text-sm sm:text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Evolução Mensal
                </h2>
                <select
                  value={periodFilter}
                  onChange={(e) => setPeriodFilter(Number(e.target.value))}
                  className="px-3 py-1.5 rounded-lg border border-border bg-background text-foreground font-body text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value={3}>Últimos 3 meses</option>
                  <option value={6}>Últimos 6 meses</option>
                  <option value={12}>Últimos 12 meses</option>
                </select>
              </div>
              <div className="h-72 sm:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} className="font-body fill-muted-foreground" />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 11 }}
                      className="font-body fill-muted-foreground"
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 11 }}
                      className="font-body fill-muted-foreground"
                      tickFormatter={(v) => `${v}%`}
                      domain={[0, 100]}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: 11, fontFamily: "inherit" }}
                      iconType="circle"
                      iconSize={8}
                    />
                    <Bar yAxisId="left" dataKey="revenue" name="Faturamento" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={20} />
                    <Bar yAxisId="left" dataKey="cost" name="Custo" fill="hsl(var(--warning, 30 90% 50%))" radius={[4, 4, 0, 0]} barSize={20} />
                    <Bar yAxisId="left" dataKey="profit" name="Lucro" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} barSize={20} />
                    <Line yAxisId="right" type="monotone" dataKey="margin" name="Margem %" stroke="hsl(var(--accent-foreground))" strokeWidth={2} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* KPI Cards */}
            {kpis && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                <div className="p-3 sm:p-4 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Award className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs text-muted-foreground font-body">Melhor Mês</span>
                  </div>
                  <p className="text-sm sm:text-base font-display font-bold text-foreground truncate">{kpis.bestMonth.value}</p>
                  <p className="text-xs text-muted-foreground font-body">{kpis.bestMonth.label}</p>
                </div>
                <div className="p-3 sm:p-4 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Percent className="h-3.5 w-3.5 text-success" />
                    <span className="text-xs text-muted-foreground font-body">Maior Margem</span>
                  </div>
                  <p className="text-sm sm:text-base font-display font-bold text-success">{kpis.bestMargin.value}</p>
                  <p className="text-xs text-muted-foreground font-body">{kpis.bestMargin.label}</p>
                </div>
                <div className="p-3 sm:p-4 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-1.5 mb-1">
                    <BarChart3 className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs text-muted-foreground font-body">Média Mensal</span>
                  </div>
                  <p className="text-sm sm:text-base font-display font-bold text-foreground truncate">{kpis.avgMonthly}</p>
                  <p className="text-xs text-muted-foreground font-body">Últimos 6 meses</p>
                </div>
                <div className="p-3 sm:p-4 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-1.5 mb-1">
                    {kpis.momGrowth >= 0
                      ? <ArrowUpRight className="h-3.5 w-3.5 text-success" />
                      : <ArrowDownRight className="h-3.5 w-3.5 text-destructive" />
                    }
                    <span className="text-xs text-muted-foreground font-body">Crescimento MoM</span>
                  </div>
                  <p className={`text-sm sm:text-base font-display font-bold ${kpis.momGrowth >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {kpis.momGrowth >= 0 ? '+' : ''}{kpis.momGrowth}%
                  </p>
                  <p className="text-xs text-muted-foreground font-body">vs. mês anterior</p>
                </div>
              </div>
            )}

            {/* Table */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-4 sm:px-6 py-4 border-b border-border flex items-center justify-between">
                <h2 className="font-display font-bold text-foreground text-sm sm:text-base">Histórico por Mês</h2>
                <button
                  onClick={exportCSV}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm font-body text-foreground hover:bg-muted transition-colors"
                >
                  <Download className="h-3.5 w-3.5" /> Exportar CSV
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm font-body">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border">
                      <th className="text-left px-4 sm:px-6 py-3 text-xs text-muted-foreground font-medium">Mês/Ano</th>
                      <th className="text-right px-4 py-3 text-xs text-muted-foreground font-medium">Contratos</th>
                      <th className="text-right px-4 py-3 text-xs text-muted-foreground font-medium">Faturamento</th>
                      <th className="text-right px-4 py-3 text-xs text-muted-foreground font-medium">Custo</th>
                      <th className="text-right px-4 py-3 text-xs text-muted-foreground font-medium">Lucro</th>
                      <th className="text-right px-4 sm:px-6 py-3 text-xs text-muted-foreground font-medium">Margem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allMonthlyData.map(m => (
                      <tr key={m.key} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-4 sm:px-6 py-3 font-medium text-foreground">{m.label}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{m.contracts}</td>
                        <td className="px-4 py-3 text-right text-foreground font-medium" style={{ fontVariantNumeric: "tabular-nums" }}>
                          {formatBRL(m.revenue)}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>
                          {formatBRL(m.cost)}
                        </td>
                        <td className={`px-4 py-3 text-right font-medium ${m.profit >= 0 ? 'text-success' : 'text-destructive'}`} style={{ fontVariantNumeric: "tabular-nums" }}>
                          {formatBRL(m.profit)}
                        </td>
                        <td className="px-4 sm:px-6 py-3 text-right text-foreground font-medium">
                          {m.margin}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
