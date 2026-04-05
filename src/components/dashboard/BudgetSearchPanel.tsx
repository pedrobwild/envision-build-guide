import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, Filter, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BudgetActionsMenu } from "@/components/admin/BudgetActionsMenu";
import { BudgetHoverCard } from "@/components/dashboard/BudgetHoverCard";
import { INTERNAL_STATUSES, type InternalStatus } from "@/lib/role-constants";
import { formatBRL } from "@/lib/formatBRL";
import { calculateSectionSubtotal } from "@/lib/supabase-helpers";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import type { BudgetWithSections } from "@/types/budget-common";

interface BudgetSearchPanelProps {
  budgets: BudgetWithSections[];
  profiles: Record<string, string>;
  onRefresh?: () => void;
}

const STATUS_QUICK_FILTERS = [
  { key: "active", label: "Ativos", statuses: ["requested", "novo", "triage", "assigned", "in_progress", "waiting_info", "blocked", "ready_for_review"] },
  { key: "overdue", label: "Atrasados", filter: (b: BudgetWithSections) => b.due_at && new Date(b.due_at) < new Date() && !["contrato_fechado", "lost", "archived"].includes(b.internal_status) },
  { key: "published", label: "Publicados", filter: (b: BudgetWithSections) => b.status === "published" && b.public_id },
  { key: "waiting", label: "Aguardando info", statuses: ["waiting_info"] },
  { key: "review", label: "Em revisão", statuses: ["ready_for_review"] },
  { key: "closed", label: "Fechados", statuses: ["contrato_fechado"] },
] as const;

export function BudgetSearchPanel({ budgets, profiles, onRefresh }: BudgetSearchPanelProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setExpanded(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === "Escape" && expanded) {
        setExpanded(false);
        setSearch("");
        setActiveFilter(null);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [expanded]);

  const filteredBudgets = useMemo(() => {
    let list = budgets;

    // Apply quick filter
    if (activeFilter) {
      const qf = STATUS_QUICK_FILTERS.find((f) => f.key === activeFilter);
      if (qf) {
        if ("statuses" in qf) {
          list = list.filter((b) => (qf.statuses as readonly string[]).includes(b.internal_status));
        } else if ("filter" in qf) {
          list = list.filter(qf.filter);
        }
      }
    }

    // Apply search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((b) => {
        const ownerName = (profiles[b.estimator_owner_id] || "").toLowerCase();
        const commercialName = (profiles[b.commercial_owner_id] || "").toLowerCase();
        return (
          (b.client_name || "").toLowerCase().includes(q) ||
          (b.project_name || "").toLowerCase().includes(q) ||
          (b.sequential_code || "").toLowerCase().includes(q) ||
          (b.bairro || "").toLowerCase().includes(q) ||
          (b.condominio || "").toLowerCase().includes(q) ||
          ownerName.includes(q) ||
          commercialName.includes(q)
        );
      });
    }

    return list.slice(0, 20);
  }, [budgets, search, activeFilter, profiles]);

  const hasActiveSearch = search.trim() !== "" || activeFilter !== null;

  if (!expanded) {
    return (
      <button
        onClick={() => {
          setExpanded(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 w-full hover:border-primary/30 hover:bg-muted/30 transition-colors group"
      >
        <Search className="h-3.5 w-3.5 text-muted-foreground/60 group-hover:text-primary transition-colors" />
        <span className="text-xs text-muted-foreground/60 font-body flex-1 text-left">
          Buscar orçamento por cliente, projeto, código...
        </span>
        <kbd className="hidden sm:inline text-[9px] font-mono text-muted-foreground/40 bg-muted rounded px-1.5 py-0.5">
          ⌘K
        </kbd>
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Search Input */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Search className="h-4 w-4 text-muted-foreground/60 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por cliente, projeto, código, bairro, responsável..."
          className="flex-1 text-sm font-body bg-transparent outline-none placeholder:text-muted-foreground/40 text-foreground"
        />
        {hasActiveSearch && (
          <button
            onClick={() => { setSearch(""); setActiveFilter(null); }}
            className="text-muted-foreground/50 hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          onClick={() => { setExpanded(false); setSearch(""); setActiveFilter(null); }}
          className="text-[10px] font-body text-muted-foreground/50 hover:text-foreground transition-colors"
        >
          ESC
        </button>
      </div>

      {/* Quick filter chips */}
      <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border/50 overflow-x-auto">
        <Filter className="h-3 w-3 text-muted-foreground/40 shrink-0" />
        {STATUS_QUICK_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(activeFilter === f.key ? null : f.key)}
            className={`px-2 py-1 rounded-md text-[10px] font-body font-medium whitespace-nowrap transition-colors ${
              activeFilter === f.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Results */}
      {hasActiveSearch && (
        <div className="max-h-[320px] overflow-y-auto">
          {filteredBudgets.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-xs text-muted-foreground font-body">
                Nenhum orçamento encontrado
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {filteredBudgets.map((b) => (
                <BudgetSearchRow
                  key={b.id}
                  budget={b}
                  profiles={profiles}
                  onRefresh={onRefresh}
                />
              ))}
            </div>
          )}
          {filteredBudgets.length >= 20 && (
            <div className="px-4 py-2 border-t border-border/50 text-center">
              <button
                onClick={() => navigate("/admin/operacoes")}
                className="text-[10px] font-body text-primary hover:underline"
              >
                Ver todos na tela operacional →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BudgetSearchRow({
  budget: b,
  profiles,
  onRefresh,
}: {
  budget: BudgetWithSections;
  profiles: Record<string, string>;
  onRefresh?: () => void;
}) {
  const navigate = useNavigate();
  const statusConfig = INTERNAL_STATUSES[b.internal_status as InternalStatus];
  const isOverdue = b.due_at && new Date(b.due_at) < new Date() && !["contrato_fechado", "lost", "archived"].includes(b.internal_status);
  const total = getBudgetTotalQuick(b);

  return (
    <BudgetHoverCard budget={b} profiles={profiles}>
      <div
        className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 cursor-pointer transition-colors group"
        onClick={() => navigate(`/admin/budget/${b.id}`)}
      >
        {/* Status dot */}
        <div className={`h-2 w-2 rounded-full shrink-0 ${
          isOverdue ? "bg-destructive" : "bg-primary/60"
        }`} />

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-body font-medium text-foreground truncate">
              {b.project_name || "Sem nome"}
            </span>
            {b.sequential_code && (
              <span className="text-[9px] font-mono tabular-nums text-muted-foreground/50">
                {b.sequential_code}
              </span>
            )}
          </div>
          <p className="text-[11px] font-body text-muted-foreground truncate">
            {b.client_name}
            {profiles[b.estimator_owner_id] && ` · ${profiles[b.estimator_owner_id]}`}
          </p>
        </div>

        {/* Status badge */}
        {statusConfig && (
          <span className="text-[9px] font-body font-medium text-muted-foreground bg-muted/80 px-1.5 py-0.5 rounded whitespace-nowrap">
            {statusConfig.label}
          </span>
        )}

        {/* Value */}
        {total > 0 && (
          <span className="text-xs font-mono tabular-nums text-muted-foreground hidden sm:inline">
            {total >= 1000 ? `R$ ${(total / 1000).toFixed(0)}k` : formatBRL(total)}
          </span>
        )}

        {/* Actions */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          <BudgetActionsMenu
            budget={b}
            onRefresh={onRefresh}
            fromPath="/admin"
          />
        </div>
      </div>
    </BudgetHoverCard>
  );
}

function getBudgetTotalQuick(b: BudgetWithSections): number {
  const sectionsTotal = (b.sections || []).reduce(
    (sum, s) => sum + calculateSectionSubtotal(s),
    0
  );
  const adjustmentsTotal = (b.adjustments || []).reduce(
    (sum, adj) => sum + adj.sign * Number(adj.amount),
    0
  );
  return sectionsTotal + adjustmentsTotal;
}
