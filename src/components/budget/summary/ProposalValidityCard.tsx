import { Clock, AlertTriangle, RefreshCw } from "lucide-react";
import { formatDateLong } from "@/lib/formatBRL";
import { cn } from "@/lib/utils";

interface ProposalValidityCardProps {
  expired: boolean;
  daysLeft: number;
  expiresAt: Date;
  /** Shows "revised" label when budget was updated */
  revised?: boolean;
}

const BODY_SM = "text-xs font-body leading-snug";

export function ProposalValidityCard({
  expired,
  daysLeft,
  expiresAt,
  revised,
}: ProposalValidityCardProps) {
  const urgent = !expired && daysLeft <= 5;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "rounded-xl px-3.5 py-2.5 flex items-center gap-2.5 transition-colors",
        expired
          ? "bg-destructive/[0.05] border border-destructive/[0.10]"
          : urgent
            ? "bg-warning/[0.05] border border-warning/[0.10]"
            : "bg-muted/30 border border-border/60"
      )}
    >
      {expired ? (
        <AlertTriangle className="h-3.5 w-3.5 text-destructive flex-shrink-0" aria-hidden />
      ) : revised ? (
        <RefreshCw className="h-3.5 w-3.5 text-primary/60 flex-shrink-0" aria-hidden />
      ) : (
        <Clock
          className={cn(
            "h-3.5 w-3.5 flex-shrink-0",
            urgent ? "text-warning" : "text-muted-foreground"
          )}
          aria-hidden
        />
      )}
      <p className={cn(BODY_SM, expired ? "text-destructive" : "text-foreground")}>
        {expired
          ? "Condições expiradas — solicite valores atualizados."
          : revised
            ? `Proposta revisada · Válido até ${formatDateLong(expiresAt)}`
            : `Válido até ${formatDateLong(expiresAt)}`}
      </p>
    </div>
  );
}
