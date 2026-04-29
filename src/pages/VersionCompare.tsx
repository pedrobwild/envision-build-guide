import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Loader2, Plus, Minus, RefreshCw, Equal, Eye, EyeOff, TrendingUp, TrendingDown } from "lucide-react";
import { formatBRL } from "@/lib/formatBRL";
import { calculateBudgetTotal } from "@/lib/supabase-helpers";
import { logVersionEvent } from "@/lib/version-audit";
import { logger } from "@/lib/logger";

interface CompareSection {
  id: string;
  title: string;
  order_index: number;
  section_price: number | null;
  qty: number | null;
  items: CompareItem[];
}

interface CompareItem {
  id: string;
  title: string;
  description: string | null;
  qty: number | null;
  unit: string | null;
  internal_total: number | null;
  internal_unit_price?: number | null;
  bdi_percentage?: number | null;
  addendum_action?: "add" | "remove" | null;
}

interface CompareAdjustment {
  id: string;
  label: string;
  amount: number;
  sign: number;
}

interface VersionMeta {
  id: string;
  version_number: number | null;
  versao: string | null;
  project_name: string;
  client_name: string;
  status: string;
  created_at: string | null;
  change_reason: string | null;
  version_group_id: string | null;
}

type DiffStatus = "added" | "removed" | "changed" | "unchanged";

interface DiffRow {
  status: DiffStatus;
  left?: CompareItem;
  right?: CompareItem;
}

interface SectionDiff {
  status: DiffStatus;
  left?: CompareSection;
  right?: CompareSection;
  items: DiffRow[];
}

async function loadVersion(budgetId: string): Promise<{ meta: VersionMeta; sections: CompareSection[]; adjustments: CompareAdjustment[] }> {
  const { data: budget, error: budgetErr } = await supabase
    .from("budgets")
    .select("id, version_number, versao, project_name, client_name, status, created_at, change_reason, version_group_id")
    .eq("id", budgetId)
    .single();

  if (budgetErr || !budget) throw new Error("Versão não encontrada");

  const { data: sections, error: secErr } = await supabase
    .from("sections")
    .select("id, title, order_index, section_price, qty, addendum_action, items(id, title, description, qty, unit, internal_total, internal_unit_price, bdi_percentage, addendum_action)")
    .eq("budget_id", budgetId)
    .order("order_index");

  if (secErr) toast.error(`Erro ao carregar seções: ${secErr.message}`);

  const { data: adjustments } = await supabase
    .from("adjustments")
    .select("id, label, amount, sign")
    .eq("budget_id", budgetId);

  const mapped: CompareSection[] = (sections || []).map((s) => ({
    ...s,
    items: ((s.items as CompareItem[]) || []).sort((a, b) => (a.title || "").localeCompare(b.title || "")),
  }));

  return { meta: budget as VersionMeta, sections: mapped, adjustments: ((adjustments as unknown) as CompareAdjustment[]) || [] };
}

function diffSections(left: CompareSection[], right: CompareSection[]): SectionDiff[] {
  const result: SectionDiff[] = [];
  // Use order_index as primary key, title as fallback
  const rightByIndex = new Map(right.map((s) => [s.order_index, s]));
  const rightByTitle = new Map(right.map((s) => [s.title.toLowerCase().trim(), s]));
  const matchedRight = new Set<string>();

  for (const ls of left) {
    const rs = rightByIndex.get(ls.order_index) ?? rightByTitle.get(ls.title.toLowerCase().trim());
    if (rs) {
      matchedRight.add(rs.id);
      const items = diffItems(ls.items, rs.items);
      const hasChanges = items.some((i) => i.status !== "unchanged");
      result.push({ status: hasChanges ? "changed" : "unchanged", left: ls, right: rs, items });
    } else {
      result.push({ status: "removed", left: ls, items: ls.items.map((i) => ({ status: "removed" as DiffStatus, left: i })) });
    }
  }

  for (const rs of right) {
    if (!matchedRight.has(rs.id)) {
      result.push({ status: "added", right: rs, items: rs.items.map((i) => ({ status: "added" as DiffStatus, right: i })) });
    }
  }

  return result;
}

function diffItems(left: CompareItem[], right: CompareItem[]): DiffRow[] {
  const result: DiffRow[] = [];
  const rightByTitle = new Map(right.map((i) => [i.title.toLowerCase().trim(), i]));
  const matchedRight = new Set<string>();

  for (const li of left) {
    const key = li.title.toLowerCase().trim();
    const ri = rightByTitle.get(key);
    if (ri) {
      matchedRight.add(ri.id);
      const changed = li.qty !== ri.qty || li.unit !== ri.unit || li.internal_total !== ri.internal_total || li.description !== ri.description;
      result.push({ status: changed ? "changed" : "unchanged", left: li, right: ri });
    } else {
      result.push({ status: "removed", left: li });
    }
  }

  for (const ri of right) {
    if (!matchedRight.has(ri.id)) {
      result.push({ status: "added", right: ri });
    }
  }

  return result;
}

function calcTotal(sections: CompareSection[], adjustments: CompareAdjustment[]): number {
  return calculateBudgetTotal(sections, adjustments);
}

const statusConfig: Record<DiffStatus, { icon: typeof Equal; color: string; bg: string }> = {
  unchanged: { icon: Equal, color: "text-muted-foreground", bg: "" },
  changed: { icon: RefreshCw, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/10" },
  added: { icon: Plus, color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-900/10" },
  removed: { icon: Minus, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/10" },
};

const statusLabel: Record<DiffStatus, string> = {
  unchanged: "Sem alteração",
  changed: "Alterada",
  added: "Nova",
  removed: "Removida",
};

export default function VersionCompare() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const leftId = params.get("left");
  const rightId = params.get("right");

  const [loading, setLoading] = useState(true);
  const [leftData, setLeftData] = useState<{ meta: VersionMeta; sections: CompareSection[] } | null>(null);
  const [rightData, setRightData] = useState<{ meta: VersionMeta; sections: CompareSection[] } | null>(null);
  const [diffs, setDiffs] = useState<SectionDiff[]>([]);
  const [showUnchanged, setShowUnchanged] = useState(false);
  const [clientView, setClientView] = useState(false);

  useEffect(() => {
    if (!leftId || !rightId) return;
    setLoading(true);
    Promise.all([loadVersion(leftId), loadVersion(rightId)])
      .then(async ([l, r]) => {
        // Validate versions belong to same group
        const lGroup = (l.meta as VersionMeta & { version_group_id?: string | null }).version_group_id;
        const rGroup = (r.meta as VersionMeta & { version_group_id?: string | null }).version_group_id;
        if (lGroup && rGroup && lGroup !== rGroup) {
          toast.error("Estas versões não pertencem ao mesmo orçamento.");
          return;
        }
        setLeftData(l);
        setRightData(r);
        setDiffs(diffSections(l.sections, r.sections));
        // Fire-and-forget audit log
        const { data: { session } } = await supabase.auth.getSession();
        logVersionEvent({
          event_type: "version_compared",
          budget_id: rightId,
          user_id: session?.user?.id ?? null,
          metadata: { left_version: l.meta.version_number, right_version: r.meta.version_number, left_id: leftId, right_id: rightId },
        });
      })
      .catch((err) => logger.error(err))
      .finally(() => setLoading(false));
  }, [leftId, rightId]);

  if (!leftId || !rightId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground font-body">Selecione duas versões para comparar.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const filteredDiffs = showUnchanged ? diffs : diffs.filter((d) => d.status !== "unchanged");
  const stats = {
    added: diffs.filter((d) => d.status === "added").length,
    removed: diffs.filter((d) => d.status === "removed").length,
    changed: diffs.filter((d) => d.status === "changed").length,
    unchanged: diffs.filter((d) => d.status === "unchanged").length,
  };

  // Executive summary calculations
  const leftTotal = leftData ? calcTotal(leftData.sections, leftData.adjustments) : 0;
  const rightTotal = rightData ? calcTotal(rightData.sections, rightData.adjustments) : 0;
  const delta = rightTotal - leftTotal;
  const deltaPercent = leftTotal > 0 ? (delta / leftTotal) * 100 : 0;
  const totalItems = (side: CompareSection[]) => side.reduce((n, s) => n + s.items.length, 0);
  const leftItemCount = leftData ? totalItems(leftData.sections) : 0;
  const rightItemCount = rightData ? totalItems(rightData.sections) : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <span className="font-display font-bold text-sm text-foreground">Comparação de Versões</span>
            {clientView && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-body font-medium">
                Visão do cliente
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs font-body">
            <span className="flex items-center gap-1 text-green-600 dark:text-green-400"><Plus className="h-3 w-3" />{stats.added}</span>
            <span className="flex items-center gap-1 text-red-600 dark:text-red-400"><Minus className="h-3 w-3" />{stats.removed}</span>
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400"><RefreshCw className="h-3 w-3" />{stats.changed}</span>
            <label className="flex items-center gap-1.5 text-muted-foreground cursor-pointer ml-2">
              <input type="checkbox" checked={showUnchanged} onChange={(e) => setShowUnchanged(e.target.checked)} className="rounded" />
              Inalteradas ({stats.unchanged})
            </label>
            <button
              onClick={() => setClientView(!clientView)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-colors ml-2 ${
                clientView
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted text-muted-foreground border-border hover:text-foreground"
              }`}
              title={clientView ? "Voltar à visão interna" : "Alternar para visão do cliente"}
            >
              {clientView ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              {clientView ? "Interno" : "Cliente"}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        {/* Executive Summary */}
        {!clientView && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <SummaryCard label="Total Anterior" value={formatBRL(leftTotal)} />
            <SummaryCard label="Total Nova" value={formatBRL(rightTotal)} />
            <SummaryCard
              label="Variação"
              value={`${delta >= 0 ? "+" : ""}${formatBRL(delta)}`}
              accent={delta > 0 ? "up" : delta < 0 ? "down" : undefined}
              sub={leftTotal > 0 ? `${deltaPercent >= 0 ? "+" : ""}${deltaPercent.toFixed(1)}%` : undefined}
            />
            <SummaryCard
              label="Itens"
              value={`${leftItemCount} → ${rightItemCount}`}
              sub={`${leftData?.sections.length || 0} → ${rightData?.sections.length || 0} seções`}
            />
          </div>
        )}

        {/* Client-mode summary (no values, just scope changes) */}
        {clientView && (
          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="font-display font-bold text-foreground mb-1">Resumo das alterações</h2>
            <p className="text-sm text-muted-foreground font-body">
              {stats.added > 0 && <span className="text-green-600 dark:text-green-400 font-medium">{stats.added} {stats.added === 1 ? "seção adicionada" : "seções adicionadas"}</span>}
              {stats.added > 0 && (stats.removed > 0 || stats.changed > 0) && <span> · </span>}
              {stats.removed > 0 && <span className="text-red-600 dark:text-red-400 font-medium">{stats.removed} {stats.removed === 1 ? "seção removida" : "seções removidas"}</span>}
              {stats.removed > 0 && stats.changed > 0 && <span> · </span>}
              {stats.changed > 0 && <span className="text-amber-600 dark:text-amber-400 font-medium">{stats.changed} {stats.changed === 1 ? "seção alterada" : "seções alteradas"}</span>}
              {stats.added === 0 && stats.removed === 0 && stats.changed === 0 && <span>Nenhuma alteração de escopo.</span>}
            </p>
          </div>
        )}

        {/* Version headers */}
        <div className="grid grid-cols-2 gap-4">
          {[leftData, rightData].map((d, idx) => (
            <div key={idx} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-sm text-foreground">
                  V{d?.meta.version_number || "?"}
                </span>
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-body">
                  {idx === 0 ? "Anterior" : "Nova"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-body mt-1">
                {d?.meta.project_name} — {d?.meta.client_name}
              </p>
              {d?.meta.change_reason && (
                <p className="text-xs text-muted-foreground font-body mt-1 italic">
                  Motivo: {d.meta.change_reason}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Diffs */}
        {filteredDiffs.length === 0 && (
          <div className="text-center py-12 text-muted-foreground font-body text-sm">
            {diffs.length === 0 ? "Nenhuma seção encontrada." : "Nenhuma diferença encontrada entre as versões."}
          </div>
        )}

        {filteredDiffs.map((sd, si) => {
          const cfg = statusConfig[sd.status];
          const Icon = cfg.icon;
          const section = sd.left || sd.right;

          return (
            <div key={si} className={`rounded-lg border border-border overflow-hidden ${cfg.bg}`}>
              {/* Section header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card/50">
                <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                <span className="font-display font-semibold text-sm text-foreground">{section?.title}</span>
                <span className={`text-[10px] font-body font-medium ${cfg.color}`}>{statusLabel[sd.status]}</span>
              </div>

              {/* Items table */}
              {sd.items.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-body">
                    <thead>
                      <tr className="text-muted-foreground border-b border-border">
                        <th className="text-left px-4 py-2 font-medium w-8"></th>
                        <th className="text-left px-4 py-2 font-medium">Item</th>
                        <th className="text-right px-4 py-2 font-medium">Qtd Anterior</th>
                        <th className="text-right px-4 py-2 font-medium">Qtd Nova</th>
                        {!clientView && <th className="text-right px-4 py-2 font-medium">Valor Anterior</th>}
                        {!clientView && <th className="text-right px-4 py-2 font-medium">Valor Novo</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {sd.items
                        .filter((r) => showUnchanged || r.status !== "unchanged")
                        .map((row, ri) => {
                          const ic = statusConfig[row.status];
                          const RowIcon = ic.icon;
                          return (
                            <tr key={ri} className={ic.bg}>
                              <td className="px-4 py-2"><RowIcon className={`h-3 w-3 ${ic.color}`} /></td>
                              <td className="px-4 py-2 text-foreground">
                                {row.left?.title || row.right?.title}
                                {clientView && row.status === "changed" && row.left?.description !== row.right?.description && (
                                  <span className="block text-[10px] text-muted-foreground mt-0.5 italic">Descrição atualizada</span>
                                )}
                              </td>
                              <td className="px-4 py-2 text-right text-muted-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>
                                {row.left ? `${row.left.qty ?? "—"} ${row.left.unit || ""}`.trim() : "—"}
                              </td>
                              <td className="px-4 py-2 text-right text-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>
                                {row.right ? `${row.right.qty ?? "—"} ${row.right.unit || ""}`.trim() : "—"}
                              </td>
                              {!clientView && (
                                <td className="px-4 py-2 text-right text-muted-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>
                                  {row.left?.internal_total ? formatBRL(row.left.internal_total) : "—"}
                                </td>
                              )}
                              {!clientView && (
                                <td className={`px-4 py-2 text-right font-medium ${
                                  row.status === "changed" && row.left?.internal_total && row.right?.internal_total
                                    ? (row.right.internal_total > row.left.internal_total ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400")
                                    : "text-foreground"
                                }`} style={{ fontVariantNumeric: "tabular-nums" }}>
                                  {row.right?.internal_total ? formatBRL(row.right.internal_total) : "—"}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </main>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
  sub,
}: {
  label: string;
  value: string;
  accent?: "up" | "down";
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-[11px] text-muted-foreground font-body uppercase tracking-wide">{label}</p>
      <div className="flex items-center gap-1.5 mt-1">
        {accent === "up" && <TrendingUp className="h-4 w-4 text-red-500" />}
        {accent === "down" && <TrendingDown className="h-4 w-4 text-green-500" />}
        <span
          className={`font-display font-bold text-lg ${
            accent === "up" ? "text-red-600 dark:text-red-400" : accent === "down" ? "text-green-600 dark:text-green-400" : "text-foreground"
          }`}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {value}
        </span>
      </div>
      {sub && <p className="text-[11px] text-muted-foreground font-body mt-0.5">{sub}</p>}
    </div>
  );
}
