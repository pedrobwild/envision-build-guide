import { formatBRL } from "@/lib/formatBRL";

interface InstallmentPreviewProps {
  total: number;
  installments: number;
}

/**
 * Linha "ou R$ X em N× sem juros" — tipografia padronizada
 * usada tanto no resumo lateral (desktop) quanto no card superior (mobile).
 */
export function InstallmentPreview({ total, installments }: InstallmentPreviewProps) {
  return (
    <div className="flex items-baseline gap-1 flex-wrap">
      <span className="text-[11px] font-body text-muted-foreground">ou</span>
      <span className="budget-currency text-[13px] font-semibold text-foreground">
        {formatBRL(total / installments)}
      </span>
      <span className="text-[11px] font-body text-muted-foreground">
        em <span className="budget-numeric">{installments}×</span> sem juros
      </span>
    </div>
  );
}
