import { Download, Loader2 } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { formatDate } from "@/lib/formatBRL";
import logoDark from "@/assets/logo-bwild-dark.png";
import logoWhite from "@/assets/logo-bwild-white.png";

interface BudgetHeaderProps {
  budget: any;
  onExportPdf?: () => void;
  exporting?: boolean;
}

export function BudgetHeader({ budget, onExportPdf, exporting }: BudgetHeaderProps) {
  const validUntil = budget.date && budget.validity_days
    ? new Date(new Date(budget.date).getTime() + budget.validity_days * 86400000)
    : null;

  const metaLeft = [
    { label: "Cliente", value: budget.client_name },
    { label: "Condomínio", value: budget.condominio },
    { label: "Bairro", value: budget.bairro },
    { label: "Metragem", value: budget.metragem },
  ].filter(f => f.value);

  const metaRight = [
    { label: "Data de elaboração", value: budget.date ? formatDate(budget.date) : null },
    { label: "Versão", value: budget.versao },
    { label: "Validade", value: validUntil ? formatDate(validUntil) : `${budget.validity_days || 30} dias` },
  ].filter(f => f.value);

  const commercial = [
    { label: "Consultora Comercial", value: budget.consultora_comercial },
    { label: "E-mail", value: budget.email_comercial },
  ].filter(f => f.value);

  return (
    <header className="sticky top-0 z-40">
      {/* Top bar */}
      <div className="bg-charcoal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoWhite} alt="Bwild" className="h-7" />
            <div className="h-5 w-px bg-white/20" />
            <span className="text-xs font-body text-white/60 tracking-wide uppercase">
              Orçamento de Reforma
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={onExportPdf}
              disabled={exporting}
              className="group flex items-center gap-2 px-4 py-2 rounded-md bg-white/10 text-white hover:bg-white/20 backdrop-blur transition-all text-sm font-body font-medium disabled:opacity-50 border border-white/10 hover:border-white/20"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4 group-hover:translate-y-0.5 transition-transform" />
              )}
              {exporting ? "Gerando..." : "Exportar PDF"}
            </button>
          </div>
        </div>
      </div>

      {/* Project title + metadata strip */}
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          {/* Title row */}
          <h1 className="font-display font-bold text-xl sm:text-2xl text-foreground leading-tight mb-4">
            {budget.project_name || "Orçamento"}
          </h1>

          {/* Metadata grid */}
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm font-body">
            {metaLeft.map((m, i) => (
              <div key={i} className="flex items-baseline gap-1.5">
                <span className="text-muted-foreground">{m.label}:</span>
                <span className="font-medium text-foreground">{m.value}</span>
              </div>
            ))}

            {metaLeft.length > 0 && metaRight.length > 0 && (
              <div className="hidden sm:block w-px h-4 bg-border self-center" />
            )}

            {metaRight.map((m, i) => (
              <div key={i} className="flex items-baseline gap-1.5">
                <span className="text-muted-foreground">{m.label}:</span>
                <span className="font-semibold text-foreground">{m.value}</span>
              </div>
            ))}
          </div>

          {/* Commercial info */}
          {commercial.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border flex flex-wrap gap-x-8 gap-y-2 text-sm font-body">
              {commercial.map((c, i) => (
                <div key={i} className="flex items-baseline gap-1.5">
                  <span className="text-muted-foreground">{c.label}:</span>
                  <span className="font-medium text-foreground">{c.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
