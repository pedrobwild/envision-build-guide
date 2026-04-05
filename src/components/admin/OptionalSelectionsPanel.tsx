import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDate } from "@/lib/formatBRL";
import { calculateSectionSubtotal } from "@/lib/supabase-helpers";
import { ShoppingBag, ChevronDown, ChevronRight, User, Mail, Calendar, Package } from "lucide-react";
import { cn } from "@/lib/utils";

interface OptionalSelection {
  id: string;
  budget_id: string;
  section_id: string;
  client_name: string | null;
  client_email: string | null;
  confirmed: boolean;
  confirmed_at: string | null;
  created_at: string;
}

interface GroupedSelection {
  budgetId: string;
  budgetName: string;
  clientName: string;
  selections: {
    id: string;
    sectionTitle: string;
    sectionTotal: number;
    clientName: string | null;
    clientEmail: string | null;
    confirmedAt: string | null;
  }[];
  totalAdded: number;
  confirmedAt: string | null;
}

export function OptionalSelectionsPanel() {
  const [groups, setGroups] = useState<GroupedSelection[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedBudget, setExpandedBudget] = useState<string | null>(null);

  useEffect(() => {
    loadSelections();
  }, []);

  const loadSelections = async () => {
    const { data: selections, error } = await supabase
      .from("budget_optional_selections")
      .select("*")
      .eq("confirmed", true)
      .order("created_at", { ascending: false });

    if (error || !selections || selections.length === 0) {
      setLoading(false);
      return;
    }

    // Get unique budget IDs and section IDs
    const budgetIds = [...new Set(selections.map((s) => s.budget_id))];
    const sectionIds = [...new Set(selections.map((s) => s.section_id))];

    // Fetch budgets
    const { data: budgets } = await supabase
      .from("budgets")
      .select("id, project_name, client_name")
      .in("id", budgetIds);

    // Fetch sections with items for totals
    const { data: sections } = await supabase
      .from("sections")
      .select("id, title, section_price, qty, items(id, internal_total, internal_unit_price, qty)")
      .in("id", sectionIds);

    const budgetMap = Object.fromEntries((budgets || []).map((b: any) => [b.id, b]));
    const sectionMap = Object.fromEntries((sections || []).map((s: any) => [s.id, s]));

    // Group by budget + timestamp (same confirmation batch)
    const groupMap = new Map<string, GroupedSelection>();

    for (const sel of selections as OptionalSelection[]) {
      const budget = budgetMap[sel.budget_id];
      const section = sectionMap[sel.section_id];
      if (!budget) continue;

      // Group key: budget_id + confirmed_at (rounded to minute for grouping)
      const timeKey = sel.confirmed_at
        ? new Date(sel.confirmed_at).toISOString().slice(0, 16)
        : sel.created_at.slice(0, 16);
      const key = `${sel.budget_id}-${timeKey}`;

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          budgetId: sel.budget_id,
          budgetName: budget.project_name || "Sem nome",
          clientName: sel.client_name || budget.client_name || "—",
          selections: [],
          totalAdded: 0,
          confirmedAt: sel.confirmed_at || sel.created_at,
        });
      }

      const group = groupMap.get(key)!;
      const sectionTotal = section ? calculateSectionSubtotal(section) : 0;

      group.selections.push({
        id: sel.id,
        sectionTitle: section?.title || "Seção removida",
        sectionTotal,
        clientName: sel.client_name,
        clientEmail: sel.client_email,
        confirmedAt: sel.confirmed_at,
      });
      group.totalAdded += sectionTotal;
    }

    setGroups(Array.from(groupMap.values()));
    setLoading(false);
  };

  if (loading) return null;
  if (groups.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <ShoppingBag className="h-4 w-4 text-warning" />
        <h2 className="font-display font-semibold text-sm text-foreground">
          Seleções de Opcionais
        </h2>
        <span className="px-2 py-0.5 rounded-full bg-warning/10 text-warning text-xs font-medium font-body">
          {groups.length}
        </span>
      </div>

      <div className="space-y-2">
        {groups.map((group, idx) => {
          const isExpanded = expandedBudget === `${group.budgetId}-${idx}`;

          return (
            <div
              key={`${group.budgetId}-${idx}`}
              className="rounded-lg border border-border bg-card overflow-hidden"
            >
              <button
                onClick={() =>
                  setExpandedBudget(
                    isExpanded ? null : `${group.budgetId}-${idx}`
                  )
                }
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}

                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-body font-medium text-sm text-foreground truncate">
                      {group.budgetName}
                    </span>
                    <span className="px-1.5 py-0.5 rounded-full bg-success/10 text-success text-xs font-medium">
                      Confirmado
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground font-body mt-0.5">
                    {group.clientName}
                    {group.confirmedAt && ` • ${formatDate(group.confirmedAt)}`}
                    {` • ${group.selections.length} ${group.selections.length === 1 ? "item" : "itens"}`}
                  </p>
                </div>

                <span className="text-sm font-display font-semibold text-warning whitespace-nowrap">
                  + {formatBRL(group.totalAdded)}
                </span>
              </button>

              {isExpanded && (
                <div className="border-t border-border">
                  {/* Client info */}
                  {(group.selections[0]?.clientName || group.selections[0]?.clientEmail) && (
                    <div className="px-4 py-3 bg-muted/30 flex flex-wrap gap-4 text-xs text-muted-foreground font-body">
                      {group.selections[0].clientName && (
                        <span className="flex items-center gap-1.5">
                          <User className="h-3 w-3" />
                          {group.selections[0].clientName}
                        </span>
                      )}
                      {group.selections[0].clientEmail && (
                        <span className="flex items-center gap-1.5">
                          <Mail className="h-3 w-3" />
                          {group.selections[0].clientEmail}
                        </span>
                      )}
                      {group.confirmedAt && (
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-3 w-3" />
                          {formatDate(group.confirmedAt)}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Selected sections */}
                  <div className="divide-y divide-border">
                    {group.selections.map((sel) => (
                      <div
                        key={sel.id}
                        className="px-4 py-2.5 flex items-center gap-3"
                      >
                        <Package className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="flex-1 text-sm font-body text-foreground">
                          {sel.sectionTitle}
                        </span>
                        <span className="text-sm font-mono tabular-nums text-warning font-medium whitespace-nowrap">
                          + {formatBRL(sel.sectionTotal)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
