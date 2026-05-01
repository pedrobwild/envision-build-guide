import { AlertTriangle, RefreshCw, MessageCircle } from "lucide-react";
import { formatBRL, getValidityInfo } from "@/lib/formatBRL";
import { calculateBudgetTotal } from "@/lib/supabase-helpers";
import type { BudgetData } from "@/types/budget";

interface PublicBudgetFallbackProps {
  budget: BudgetData;
  errorMessage?: string;
}

/**
 * Fallback minimalista exibido quando o render principal do orçamento público falha.
 * Mostra somente o essencial: cliente, projeto, data, validade e total final —
 * garantindo que o cliente sempre veja as informações principais mesmo se imagens,
 * mapas ou cards interativos quebrarem.
 */
export function PublicBudgetFallback({ budget, errorMessage }: PublicBudgetFallbackProps) {
  const sections = budget.sections || [];
  const adjustments = budget.adjustments || [];
  const computedTotal = calculateBudgetTotal(sections, adjustments);
  // Mirror PublicBudget/BudgetInternalDetail: prefer manual_total when defined.
  const manualTotalRaw = (budget as { manual_total?: number | null }).manual_total;
  const total = (manualTotalRaw != null && Number.isFinite(Number(manualTotalRaw)))
    ? Number(manualTotalRaw)
    : computedTotal;
  const validity = getValidityInfo(budget.date, budget.validity_days || 30);

  const formatDate = (iso?: string | null) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
    } catch {
      return "—";
    }
  };

  const rawPhone = (budget as { client_phone?: string | null }).client_phone || "";
  const phoneDigits = rawPhone.replace(/\D/g, "");
  const whatsappUrl = phoneDigits
    ? `https://wa.me/${phoneDigits.startsWith("55") ? phoneDigits : `55${phoneDigits}`}`
    : "https://wa.me/5511999999999";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl space-y-6">
        {/* Aviso */}
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4">
          <AlertTriangle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-body font-semibold text-foreground">
              Exibindo resumo simplificado
            </p>
            <p className="text-xs font-body text-muted-foreground">
              Tivemos um problema ao carregar a versão completa do orçamento. Os dados principais estão abaixo.
              {errorMessage && import.meta.env.DEV && (
                <span className="block mt-1 text-[10px] font-mono text-destructive/70">{errorMessage}</span>
              )}
            </p>
          </div>
        </div>

        {/* Resumo */}
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-6">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.08em] font-body text-muted-foreground">
              Orçamento Bwild
            </p>
            <h1 className="text-xl sm:text-2xl budget-heading font-bold tracking-tight text-foreground">
              {budget.project_name || "Proposta de reforma"}
            </h1>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm font-body">
            <div>
              <p className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground mb-1">Cliente</p>
              <p className="text-foreground font-medium">{budget.client_name || "—"}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground mb-1">Data</p>
              <p className="text-foreground font-medium">{formatDate(budget.date)}</p>
            </div>
            {budget.bairro && (
              <div>
                <p className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground mb-1">Local</p>
                <p className="text-foreground font-medium">{budget.bairro}</p>
              </div>
            )}
            {budget.metragem && (
              <div>
                <p className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground mb-1">Área</p>
                <p className="text-foreground font-medium">{budget.metragem}</p>
              </div>
            )}
            <div>
              <p className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground mb-1">Validade</p>
              <p className="text-foreground font-medium">
                {validity.daysLeft > 0
                  ? `${validity.daysLeft} dia${validity.daysLeft === 1 ? "" : "s"}`
                  : "Expirado"}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground mb-1">Versão</p>
              <p className="text-foreground font-medium">
                v{budget.versao ? String(budget.versao).replace(/^v/i, "") : (budget.version_number ?? 1)}
              </p>
            </div>
          </div>

          <div className="border-t border-border pt-5">
            <p className="text-[11px] uppercase tracking-[0.08em] font-body text-muted-foreground mb-1">
              Investimento total
            </p>
            <p className="text-3xl sm:text-4xl budget-numeric font-bold tracking-tight text-foreground">
              {formatBRL(total)}
            </p>
          </div>
        </div>

        {/* Ações */}
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-3 text-sm font-body font-semibold hover:opacity-90 transition-opacity"
          >
            <RefreshCw className="h-4 w-4" />
            Tentar carregar versão completa
          </button>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm font-body font-semibold text-foreground hover:bg-muted transition-colors"
          >
            <MessageCircle className="h-4 w-4" />
            Falar com a consultora
          </a>
        </div>
      </div>
    </div>
  );
}
