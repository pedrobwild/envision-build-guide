import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Check, X, RotateCcw, Save } from "lucide-react";
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
  onPublish?: () => void;
  publishing?: boolean;
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
      return "bg-primary/10 text-primary border-primary/20";
    case "ready_for_review":
      return "bg-warning/10 text-warning border-warning/20";
    case "delivered_to_sales":
      return "bg-accent text-accent-foreground border-border";
    case "sent_to_client":
      return "bg-success/10 text-success border-success/20";
    case "revision_requested":
      return "bg-warning/10 text-warning border-warning/20";
    case "minuta_solicitada":
      return "bg-accent text-accent-foreground border-border";
    case "contrato_fechado":
      return "bg-success/10 text-success border-success/20";
    case "blocked":
    case "waiting_info":
      return "bg-destructive/10 text-destructive border-destructive/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function AutoSaveChip({ status, lastSavedAt, onRetry }: { status: SaveStatus; lastSavedAt: Date | null; onRetry?: () => void }) {
  if (status === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground font-body px-2.5 py-1 rounded-full bg-muted/60">
        <Loader2 className="h-3 w-3 animate-spin" />
        Salvando…
      </span>
    );
  }

  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-destructive font-body px-2.5 py-1 rounded-full bg-destructive/10">
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
      <span className="inline-flex items-center gap-1 text-[11px] text-success font-body px-2.5 py-1 rounded-full bg-success/10">
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
  onPublish,
  publishing,
  primaryAction,
}: StickyEditorHeaderProps) {
  const navigate = useNavigate();
  const internalStatus = (budget.internal_status ?? "requested") as InternalStatus;
  const statusInfo = INTERNAL_STATUSES[internalStatus] ?? INTERNAL_STATUSES.requested;

  const totals = useMemo(() => calcGrandTotals(sections), [sections]);

  const projectName = budget.project_name || "Sem nome";
  const truncatedName = projectName.length > 30 ? projectName.slice(0, 30) + "…" : projectName;

  const marginColor = totals.marginPercent >= 15
    ? "text-success"
    : totals.marginPercent >= 10
    ? "text-warning"
    : "text-destructive";

  return (
    <div className="sticky top-0 z-50 bg-card/80 glass border-b border-border/50 shadow-premium-sm">
      {/* Layer 1 — Breadcrumb + status + action + auto-save */}
      <div className="max-w-[1200px] mx-auto px-6 h-14 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate(backPath)}
            className="p-2 rounded-xl hover:bg-accent text-muted-foreground hover:text-foreground transition-all duration-200 shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2 text-sm font-body text-muted-foreground min-w-0">
            <span className="hidden sm:inline shrink-0">Orçamentos</span>
            <span className="hidden sm:inline shrink-0 text-border">/</span>
            {budget.sequential_code && (
              <span className="hidden sm:inline text-[10px] font-mono text-muted-foreground/60 shrink-0">{budget.sequential_code}</span>
            )}
            <span className="text-foreground font-semibold truncate max-w-[200px] tracking-tight">
              {truncatedName}
            </span>
          </div>

          <Badge className={cn("text-[10px] font-body border shrink-0 rounded-full px-2.5", getStatusBadgeClass(internalStatus))}>
            {statusInfo.icon} {statusInfo.label}
          </Badge>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <AutoSaveChip status={saveStatus} lastSavedAt={lastSavedAt} onRetry={onRetrySave} />

          {onPublish && (
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={onPublish}
              disabled={publishing}
            >
              {publishing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {publishing ? "Publicando…" : "Salvar e Publicar"}
            </Button>
          )}

          {primaryAction && (
            <Button
              size="sm"
              className={cn("h-8 text-xs gap-1.5", primaryAction.className)}
              onClick={primaryAction.onClick}
            >
              {primaryAction.icon}
              {primaryAction.label}
            </Button>
          )}
        </div>
      </div>

      {/* Layer 2 — Financial totals */}
      <div className="border-t border-border/30">
        <div className="max-w-[1200px] mx-auto px-6 h-10 flex items-center gap-6 text-xs font-body">
          <span className="inline-flex items-center gap-2">
            <span className="text-muted-foreground uppercase tracking-widest text-[10px] font-medium">Venda</span>
            <span className="font-bold tabular-nums text-success tracking-tight">
              {formatBRL(totals.sale)}
            </span>
          </span>

          <span className="w-px h-4 bg-border/60" />

          <span className="inline-flex items-center gap-2">
            <span className="text-muted-foreground uppercase tracking-widest text-[10px] font-medium">Custo</span>
            <span className="font-semibold tabular-nums text-muted-foreground tracking-tight">
              {formatBRL(totals.cost)}
            </span>
          </span>

          <span className="w-px h-4 bg-border/60" />

          <span className="inline-flex items-center gap-2">
            <span className="text-muted-foreground uppercase tracking-widest text-[10px] font-medium">BDI</span>
            <span className="font-semibold tabular-nums text-primary tracking-tight">
              {totals.bdiPercent.toFixed(1)}%
            </span>
          </span>

          <span className="w-px h-4 bg-border/60" />

          <span className="inline-flex items-center gap-2">
            <span className="text-muted-foreground uppercase tracking-widest text-[10px] font-medium">Margem</span>
            <span className={cn("font-bold tabular-nums tracking-tight", marginColor)}>
              {formatBRL(totals.margin)} · {totals.marginPercent.toFixed(1)}%
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
