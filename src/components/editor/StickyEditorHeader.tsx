import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Check, X, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { INTERNAL_STATUSES, type InternalStatus } from "@/lib/role-constants";
import { formatBRL } from "@/lib/formatBRL";
import { calcGrandTotals, type CalcSection } from "@/lib/budget-calc";
import { cn } from "@/lib/utils";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface StickyEditorHeaderProps {
  budget: any;
  sections: CalcSection[];
  backPath: string;
  saveStatus: SaveStatus;
  lastSavedAt: Date | null;
  onRetrySave?: () => void;
  /** Primary workflow action — rendered as a button */
  primaryAction?: {
    label: string;
    onClick: () => void;
    variant?: string;
    icon?: React.ReactNode;
    className?: string;
  } | null;
}

function getStatusBadgeClass(status: InternalStatus): string {
  switch (status) {
    case "in_progress":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "ready_for_review":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "delivered_to_sales":
      return "bg-purple-100 text-purple-800 border-purple-200";
    case "sent_to_client":
      return "bg-green-100 text-green-800 border-green-200";
    case "revision_requested":
      return "bg-orange-100 text-orange-700 border-orange-300";
    case "minuta_solicitada":
      return "bg-violet-100 text-violet-700 border-violet-300";
    case "contrato_fechado":
      return "bg-emerald-100 text-emerald-700 border-emerald-300";
    case "blocked":
    case "waiting_info":
      return "bg-red-100 text-red-800 border-red-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

function AutoSaveChip({ status, lastSavedAt, onRetry }: { status: SaveStatus; lastSavedAt: Date | null; onRetry?: () => void }) {
  if (status === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground font-body">
        <Loader2 className="h-3 w-3 animate-spin" />
        Salvando…
      </span>
    );
  }

  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-destructive font-body">
        <X className="h-3 w-3" />
        Erro
        {onRetry && (
          <button onClick={onRetry} className="underline hover:no-underline ml-0.5">
            Tentar novamente
          </button>
        )}
      </span>
    );
  }

  if (status === "saved" && lastSavedAt) {
    const seconds = Math.max(0, Math.round((Date.now() - lastSavedAt.getTime()) / 1000));
    const label = seconds < 5 ? "agora" : `há ${seconds}s`;
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-body">
        <Check className="h-3 w-3" />
        Salvo {label}
      </span>
    );
  }

  return null;
}

export function StickyEditorHeader({
  budget,
  sections,
  backPath,
  saveStatus,
  lastSavedAt,
  onRetrySave,
  primaryAction,
}: StickyEditorHeaderProps) {
  const navigate = useNavigate();
  const internalStatus = (budget.internal_status ?? "requested") as InternalStatus;
  const statusInfo = INTERNAL_STATUSES[internalStatus] ?? INTERNAL_STATUSES.requested;

  const totals = useMemo(() => calcGrandTotals(sections), [sections]);

  const projectName = budget.project_name || "Sem nome";
  const truncatedName = projectName.length > 30 ? projectName.slice(0, 30) + "…" : projectName;

  const marginColor = totals.marginPercent >= 15
    ? "text-emerald-600 dark:text-emerald-400"
    : totals.marginPercent >= 10
    ? "text-amber-600 dark:text-amber-400"
    : "text-destructive";

  return (
    <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border/60">
      {/* Layer 1 — Breadcrumb + status + action + auto-save (56px) */}
      <div className="max-w-[1200px] mx-auto px-6 h-14 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => navigate(backPath)}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-1.5 text-sm font-body text-muted-foreground min-w-0">
            <span className="hidden sm:inline shrink-0">Orçamentos</span>
            <span className="hidden sm:inline shrink-0">/</span>
            <span className="text-foreground font-medium truncate max-w-[200px]">
              {truncatedName}
            </span>
          </div>

          <Badge className={`${getStatusBadgeClass(internalStatus)} text-[10px] font-body border shrink-0`}>
            {statusInfo.icon} {statusInfo.label}
          </Badge>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <AutoSaveChip status={saveStatus} lastSavedAt={lastSavedAt} onRetry={onRetrySave} />

          {primaryAction && (
            <Button
              size="sm"
              className={cn("h-7 text-xs gap-1.5", primaryAction.className)}
              onClick={primaryAction.onClick}
            >
              {primaryAction.icon}
              {primaryAction.label}
            </Button>
          )}
        </div>
      </div>

      {/* Layer 2 — Financial totals (40px) */}
      <div className="border-t border-border/40">
        <div className="max-w-[1200px] mx-auto px-6 h-10 flex items-center gap-6 text-xs font-body">
          <span className="inline-flex items-center gap-1.5">
            <span className="text-muted-foreground uppercase tracking-wider text-[10px]">Venda</span>
            <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatBRL(totals.sale)}
            </span>
          </span>

          <span className="text-border">|</span>

          <span className="inline-flex items-center gap-1.5">
            <span className="text-muted-foreground uppercase tracking-wider text-[10px]">Custo</span>
            <span className="font-medium tabular-nums text-muted-foreground">
              {formatBRL(totals.cost)}
            </span>
          </span>

          <span className="text-border">|</span>

          <span className="inline-flex items-center gap-1.5">
            <span className="text-muted-foreground uppercase tracking-wider text-[10px]">BDI</span>
            <span className="font-medium tabular-nums text-blue-600 dark:text-blue-400">
              {totals.bdiPercent.toFixed(1)}%
            </span>
          </span>

          <span className="text-border">|</span>

          <span className="inline-flex items-center gap-1.5">
            <span className="text-muted-foreground uppercase tracking-wider text-[10px]">Margem</span>
            <span className={cn("font-semibold tabular-nums", marginColor)}>
              {formatBRL(totals.margin)} · {totals.marginPercent.toFixed(1)}%
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
