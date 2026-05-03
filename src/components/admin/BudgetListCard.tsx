import { memo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { formatBRL, formatDate } from "@/lib/formatBRL";
import { getPublicBudgetUrl } from "@/lib/getPublicUrl";
import { openPublicBudgetByPublicId } from "@/lib/openPublicBudget";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Pencil, Eye, ExternalLink,
  User, Calendar, Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BudgetActionsMenu } from "@/components/admin/BudgetActionsMenu";
import { VersionBadge } from "@/components/admin/VersionBadge";

import type { BudgetRow } from "@/types/budget-common";

interface BudgetListCardProps {
  budget: BudgetRow;
  total: number;
  sectionCount: number;
  statusLabel: string;
  statusColor: string;
  onRefresh?: () => void;
}

function BudgetListCardImpl({
  budget,
  total,
  sectionCount,
  statusLabel,
  statusColor,
  onRefresh,
}: BudgetListCardProps) {
  const navigate = useNavigate();

  const internalCost = Number(budget.internal_cost) || 0;
  const isClosed = budget.status === "contrato_fechado";
  const profit = total - internalCost;
  const profitMargin = total > 0 ? (profit / total) * 100 : 0;

  return (
    <div
      className="group relative bg-card hover:bg-accent/30 active:bg-accent/50 transition-colors cursor-pointer"
      onClick={() => navigate(`/admin/budget/${budget.id}`)}
    >
      <div className="px-4 py-3 sm:py-3.5">
        <div className="flex items-start gap-3">
          {/* Left: initials avatar */}
          <div className="hidden sm:flex h-10 w-10 rounded-lg bg-primary/10 text-primary items-center justify-center shrink-0 text-sm font-bold font-display">
            {(budget.project_name || "?")[0]?.toUpperCase()}
          </div>

          {/* Center: info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
              {budget.sequential_code && (
                <span className="text-[10px] font-mono text-muted-foreground/70 shrink-0">{budget.sequential_code}</span>
              )}
              <span className="font-semibold text-sm font-display text-foreground truncate max-w-[200px] sm:max-w-none">
                {budget.project_name || "Sem nome"}
              </span>
              <VersionBadge versionNumber={budget.version_number} isCurrent={budget.is_current_version} />

              <Badge
                variant="secondary"
                className={cn("text-[10px] px-1.5 py-0 font-body h-[18px]", statusColor)}
              >
                {statusLabel}
              </Badge>
              {budget.is_published_version && (
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" title="Versão publicada" />
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground font-body flex-wrap">
              <span className="flex items-center gap-1 truncate max-w-[140px] sm:max-w-none">
                <User className="h-3 w-3 shrink-0 opacity-60" />
                {budget.client_name}
              </span>
              {budget.date && (
                <span className="flex items-center gap-1 shrink-0">
                  <Calendar className="h-3 w-3 opacity-60" />
                  {formatDate(budget.date)}
                </span>
              )}
              <span className="flex items-center gap-1 shrink-0">
                <Layers className="h-3 w-3 opacity-60" />
                {sectionCount} {sectionCount === 1 ? "seção" : "seções"}
              </span>
              {budget.view_count > 0 && (
                <span className="flex items-center gap-1 shrink-0">
                  <Eye className="h-3 w-3 opacity-60" />
                  {budget.view_count}
                </span>
              )}
            </div>

            {isClosed && internalCost > 0 && (
              <div className="flex items-center gap-2 text-[11px] font-body mt-1">
                <span className="text-muted-foreground">Custo {formatBRL(internalCost)}</span>
                <span className={profit >= 0 ? "text-green-600 font-medium" : "text-destructive font-medium"}>
                  Lucro {formatBRL(profit)} ({profitMargin.toFixed(0)}%)
                </span>
              </div>
            )}
          </div>

          {/* Right: price + actions */}
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-sm font-display font-bold text-foreground whitespace-nowrap mr-1">
              {formatBRL(total)}
            </span>

            {/* Public page button — sempre visível quando há link público (mobile + desktop) */}
            {budget.public_id && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-primary hover:bg-primary/10"
                onClick={(e) => { e.stopPropagation(); void openPublicBudgetByPublicId(budget.public_id!); }}
                title="Ver orçamento público"
                aria-label="Ver orçamento público"
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
            )}

            {/* Desktop edit icon (hover) */}
            <div className="hidden sm:flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => { e.stopPropagation(); navigate(`/admin/budget/${budget.id}`); }}
                title="Editar"
                aria-label="Editar"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Shared actions menu */}
            <BudgetActionsMenu budget={budget} onRefresh={onRefresh} />
          </div>
        </div>
      </div>
    </div>
  );
}

export const BudgetListCard = memo(BudgetListCardImpl);

/* Skeleton for loading state */
export function BudgetListSkeleton() {
  return (
    <div className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="px-4 py-3.5 flex items-start gap-3">
          <div className="hidden sm:block h-10 w-10 rounded-lg bg-muted animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-4 w-32 bg-muted animate-pulse rounded" />
              <div className="h-4 w-16 bg-muted animate-pulse rounded-full" />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-3 w-24 bg-muted animate-pulse rounded" />
              <div className="h-3 w-16 bg-muted animate-pulse rounded" />
            </div>
          </div>
          <div className="h-4 w-20 bg-muted animate-pulse rounded shrink-0 mt-1" />
        </div>
      ))}
    </div>
  );
}
