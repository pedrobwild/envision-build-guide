import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  Undo2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BulkOperationPlan, BulkOpStatus } from "./types";
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

  if (!plan) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
        {error ?? "Não foi possível interpretar o comando."}
      </div>
    );
  }

  const visibleRows = showAll ? plan.rows : plan.rows.slice(0, 8);
  const hasFinancial = plan.action_type === "financial_adjustment";
  const deltaTotal = plan.total_after - plan.total_before;

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

      {/* Rows */}
      <ScrollArea className="max-h-56">
        <ul className="divide-y divide-border/40">
          {visibleRows.map((r) => (
            <li
              key={r.budget_id}
              className={cn(
                "px-3 py-2 text-xs flex items-center gap-2",
                r.protected && "bg-muted/30",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  {r.sequential_code && (
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {r.sequential_code}
                    </span>
                  )}
                  <span className="truncate font-medium text-foreground">
                    {r.client_name}
                  </span>
                </div>
                <p className="truncate text-muted-foreground text-[11px]">
                  {r.project_name}
                </p>
              </div>
              <div className="text-right shrink-0">
                {r.protected ? (
                  <span className="inline-flex items-center gap-1 text-[10px] text-amber-600">
                    <ShieldAlert className="h-3 w-3" /> Protegido
                  </span>
                ) : hasFinancial ? (
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <span className="text-muted-foreground line-through">
                      {fmtBRL(r.before_total)}
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="font-semibold">{fmtBRL(r.after_total)}</span>
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground">
                    {r.changes_summary}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </ScrollArea>

      {plan.rows.length > 8 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="w-full text-[11px] py-1.5 text-primary hover:bg-muted/40 border-t border-border/40"
        >
          {showAll ? "Ver menos" : `Ver todos (${plan.rows.length})`}
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
