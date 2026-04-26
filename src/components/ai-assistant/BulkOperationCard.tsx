import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Globe2,
  Layers,
  Loader2,
  ShieldAlert,
  Undo2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BulkOperationPlan, BulkOpStatus, BulkPlanRow } from "./types";
import { fmtBRL } from "./utils";

interface Props {
  plan?: BulkOperationPlan;
  status: BulkOpStatus;
  appliedCount?: number;
  error?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onRevert: () => void;
}

/** How many detailed rows to show before collapsing into an aggregate summary. */
const DETAIL_LIMIT = 8;

type GroupedRow = {
  key: string;
  client_name: string;
  project_name: string;
  count: number;
  protected_count: number;
  before_total: number;
  after_total: number;
  delta: number;
  /** Sample row used for single-item display (sequential_code, changes_summary). */
  sample: BulkPlanRow;
  rows: BulkPlanRow[];
};

function groupRows(rows: BulkPlanRow[]): GroupedRow[] {
  const map = new Map<string, GroupedRow>();
  for (const r of rows) {
    const key = `${r.client_name}__${r.project_name}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      existing.protected_count += r.protected ? 1 : 0;
      existing.before_total += r.before_total;
      existing.after_total += r.after_total;
      existing.delta += r.delta;
      existing.rows.push(r);
    } else {
      map.set(key, {
        key,
        client_name: r.client_name,
        project_name: r.project_name,
        count: 1,
        protected_count: r.protected ? 1 : 0,
        before_total: r.before_total,
        after_total: r.after_total,
        delta: r.delta,
        sample: r,
        rows: [r],
      });
    }
  }
  // Sort: largest absolute delta first, then by count desc
  return Array.from(map.values()).sort(
    (a, b) => Math.abs(b.delta) - Math.abs(a.delta) || b.count - a.count,
  );
}

export function BulkOperationCard({
  plan,
  status,
  appliedCount,
  error,
  busy,
  onConfirm,
  onCancel,
  onRevert,
}: Props) {
  const [showAll, setShowAll] = useState(false);

  const groups = useMemo(() => (plan ? groupRows(plan.rows) : []), [plan]);

  if (!plan) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
        {error ?? "Não foi possível interpretar o comando."}
      </div>
    );
  }

  const hasFinancial = plan.action_type === "financial_adjustment";
  const deltaTotal = plan.total_after - plan.total_before;

  const visibleGroups = showAll ? groups : groups.slice(0, DETAIL_LIMIT);
  const hiddenGroups = showAll ? [] : groups.slice(DETAIL_LIMIT);
  const hiddenAggregate = hiddenGroups.reduce(
    (acc, g) => {
      acc.groups += 1;
      acc.budgets += g.count;
      acc.protected += g.protected_count;
      acc.before += g.before_total;
      acc.after += g.after_total;
      acc.delta += g.delta;
      return acc;
    },
    { groups: 0, budgets: 0, protected: 0, before: 0, after: 0, delta: 0 },
  );

  const statusBadge = (() => {
    if (status === "applied")
      return (
        <Badge className="gap-1 bg-success/15 text-success hover:bg-success/15">
          <CheckCircle2 className="h-3 w-3" /> Aplicado
        </Badge>
      );
    if (status === "reverted")
      return (
        <Badge variant="secondary" className="gap-1">
          <Undo2 className="h-3 w-3" /> Revertido
        </Badge>
      );
    if (status === "failed")
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" /> Falhou
        </Badge>
      );
    return (
      <Badge variant="outline" className="gap-1">
        Aguardando confirmação
      </Badge>
    );
  })();

  return (
    <div className="rounded-xl border border-border/60 bg-background overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border/60 bg-muted/30">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
              Operação em lote
            </p>
            <p className="text-sm font-medium text-foreground leading-snug mt-0.5">
              {plan.summary}
            </p>
          </div>
          {statusBadge}
        </div>

        {plan.reasoning && (
          <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
            {plan.reasoning}
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 divide-x divide-border/60 border-b border-border/60 text-center">
        <div className="px-2 py-2">
          <p className="text-[10px] uppercase text-muted-foreground">Afetados</p>
          <p className="text-sm font-semibold tabular-nums">{plan.applicable_count}</p>
        </div>
        <div className="px-2 py-2">
          <p className="text-[10px] uppercase text-muted-foreground">Bloqueados</p>
          <p className="text-sm font-semibold tabular-nums text-muted-foreground">
            {plan.protected_count}
          </p>
        </div>
        <div className="px-2 py-2">
          <p className="text-[10px] uppercase text-muted-foreground">
            {hasFinancial ? "Δ Total" : "Total"}
          </p>
          <p
            className={cn(
              "text-sm font-semibold tabular-nums",
              hasFinancial && deltaTotal < 0 && "text-warning",
              hasFinancial && deltaTotal > 0 && "text-success",
            )}
          >
            {hasFinancial
              ? `${deltaTotal >= 0 ? "+" : ""}${fmtBRL(deltaTotal)}`
              : plan.applicable_count}
          </p>
        </div>
      </div>

      {/* Grouped rows */}
      <ScrollArea className="max-h-64">
        <ul className="divide-y divide-border/40">
          {visibleGroups.map((g) => {
            const allProtected = g.protected_count === g.count;
            const isMulti = g.count > 1;
            return (
              <li
                key={g.key}
                className={cn(
                  "px-3 py-2 text-xs flex items-center gap-2",
                  allProtected && "bg-muted/30",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {!isMulti && g.sample.sequential_code && (
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {g.sample.sequential_code}
                      </span>
                    )}
                    <span className="truncate font-medium text-foreground">
                      {g.client_name}
                    </span>
                    {isMulti && (
                      <Badge
                        variant="secondary"
                        className="gap-0.5 px-1.5 py-0 h-4 text-[10px] font-medium"
                      >
                        <Layers className="h-2.5 w-2.5" />
                        {g.count} orçamentos
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-muted-foreground text-[11px]">
                    {g.project_name}
                    {g.protected_count > 0 && g.protected_count < g.count && (
                      <span className="ml-1.5 text-warning">
                        · {g.protected_count} protegido{g.protected_count > 1 ? "s" : ""}
                      </span>
                    )}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {allProtected ? (
                    <span className="inline-flex items-center gap-1 text-[10px] text-warning">
                      <ShieldAlert className="h-3 w-3" /> Protegido
                    </span>
                  ) : hasFinancial ? (
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <span className="text-muted-foreground line-through">
                        {fmtBRL(g.before_total)}
                      </span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="font-semibold">{fmtBRL(g.after_total)}</span>
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">
                      {isMulti ? `${g.count} alterações` : g.sample.changes_summary}
                    </span>
                  )}
                </div>
              </li>
            );
          })}

          {/* Aggregate row for hidden groups */}
          {!showAll && hiddenAggregate.groups > 0 && (
            <li className="px-3 py-2 text-xs flex items-center gap-2 bg-muted/20">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Layers className="h-3 w-3 text-muted-foreground" />
                  <span className="font-medium text-foreground">
                    + {hiddenAggregate.groups} cliente{hiddenAggregate.groups > 1 ? "s" : ""} ({hiddenAggregate.budgets} orçamento{hiddenAggregate.budgets > 1 ? "s" : ""})
                  </span>
                </div>
                <p className="text-muted-foreground text-[11px]">
                  Demais alterações agregadas
                  {hiddenAggregate.protected > 0 && (
                    <span className="ml-1.5 text-warning">
                      · {hiddenAggregate.protected} protegido{hiddenAggregate.protected > 1 ? "s" : ""}
                    </span>
                  )}
                </p>
              </div>
              <div className="text-right shrink-0">
                {hasFinancial ? (
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <span className="text-muted-foreground line-through">
                      {fmtBRL(hiddenAggregate.before)}
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="font-semibold">{fmtBRL(hiddenAggregate.after)}</span>
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground">
                    {hiddenAggregate.budgets} alterações
                  </span>
                )}
              </div>
            </li>
          )}
        </ul>
      </ScrollArea>

      {groups.length > DETAIL_LIMIT && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="w-full text-[11px] py-1.5 text-primary hover:bg-muted/40 border-t border-border/40"
        >
          {showAll
            ? `Recolher (mostrar ${DETAIL_LIMIT} principais)`
            : `Ver todos os ${groups.length} grupos (${plan.rows.length} orçamentos)`}
        </button>
      )}

      {/* Actions */}
      <div className="border-t border-border/60 px-3 py-2.5 flex items-center justify-end gap-2 bg-muted/20">
        {status === "pending" && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={busy}
              className="h-8"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={onConfirm}
              disabled={busy || plan.applicable_count === 0}
              className="h-8 gap-1.5"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              Confirmar e aplicar
            </Button>
          </>
        )}
        {status === "applied" && (
          <>
            <span className="text-[11px] text-muted-foreground mr-auto">
              {appliedCount ?? plan.applicable_count} orçamentos atualizados
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRevert}
              disabled={busy}
              className="h-8 gap-1.5"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Undo2 className="h-3.5 w-3.5" />
              )}
              Reverter operação
            </Button>
          </>
        )}
        {status === "reverted" && (
          <span className="text-[11px] text-muted-foreground">
            Operação revertida ao estado anterior.
          </span>
        )}
        {status === "failed" && (
          <span className="inline-flex items-center gap-1 text-[11px] text-destructive">
            <AlertTriangle className="h-3 w-3" />
            {error ?? "Falha ao aplicar a operação."}
          </span>
        )}
      </div>
    </div>
  );
}
