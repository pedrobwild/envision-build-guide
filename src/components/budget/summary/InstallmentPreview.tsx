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
    <p className="text-[11px] font-body text-muted-foreground leading-snug text-balance">
      <span>ou </span>
      <span className="budget-currency text-[13px] font-semibold text-foreground whitespace-nowrap">
        {formatBRL(total / installments)}
      </span>
      <span className="whitespace-nowrap">
        {" "}em <span className="budget-numeric">{installments}×</span> sem juros
      </span>
    </p>
  );
}
