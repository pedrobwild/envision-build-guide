import { Zap, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * "Próxima melhor ação" sugerida por IA na página de detalhes da demanda.
 * Pensada para ser alimentada por heurísticas do hub + resumo do Elephan.ia.
 */
export interface NextBestActionBannerProps {
  title: string;
  rationale: string;
  liftLabel?: string;
  onPrimary?: () => void;
  onDismiss?: () => void;
  primaryLabel?: string;
}

export function NextBestActionBanner({
  title,
  rationale,
  liftLabel,
  onPrimary,
  onDismiss,
  primaryLabel = "Executar agora",
}: NextBestActionBannerProps) {
  return (
    <div className="mt-4 rounded-xl border border-primary/15 bg-gradient-to-r from-primary/5 via-primary/5 to-violet-500/5 p-3 flex items-center gap-3">
      <div className="h-8 w-8 rounded-lg bg-background flex items-center justify-center shrink-0 border border-primary/20">
        <Zap className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
            Próxima ação sugerida
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:text-violet-300">
            IA
          </span>
          {liftLabel && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
              {liftLabel}
            </span>
          )}
        </div>
        <p className="text-[13px] text-foreground mt-0.5 font-body">
          <span className="font-semibold">{title}</span>
          <span className="text-muted-foreground"> — {rationale}</span>
        </p>
      </div>
      {onPrimary && (
        <Button size="sm" className="gap-1.5 shrink-0" onClick={onPrimary}>
          {primaryLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      )}
      {onDismiss && (
        <Button size="sm" variant="ghost" className="shrink-0 text-muted-foreground" onClick={onDismiss}>
          Mais tarde
        </Button>
      )}
    </div>
  );
}
