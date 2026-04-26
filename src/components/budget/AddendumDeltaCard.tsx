import { TrendingUp, TrendingDown, Equal } from "lucide-react";
import { formatBRL } from "@/lib/formatBRL";

interface AddendumDeltaCardProps {
  added: number;
  removed: number;
  net: number;
}

/**
 * Card exibido na página pública do orçamento quando este é um aditivo.
 * Mostra de forma transparente o delta financeiro: adicionado, removido e líquido.
 */
export function AddendumDeltaCard({ added, removed, net }: AddendumDeltaCardProps) {
  // Se não houve mudança financeira nenhuma, não renderiza o card.
  if (added === 0 && removed === 0) return null;

  const netSign = net > 0 ? "+" : net < 0 ? "−" : "";
  const netLabel = net > 0 ? "Acréscimo" : net < 0 ? "Redução" : "Sem variação";
  const NetIcon = net > 0 ? TrendingUp : net < 0 ? TrendingDown : Equal;
  const netToneClass =
    net > 0
      ? "text-foreground"
      : net < 0
        ? "text-success"
        : "text-muted-foreground";

  return (
    <section
      aria-label="Resumo financeiro do aditivo"
      className="mb-3 rounded-xl border border-border bg-card overflow-hidden"
    >
      <header className="px-4 py-2.5 border-b border-border bg-muted/30">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground font-body">
          Resumo da variação contratual
        </h3>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
        {/* Adicionado */}
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="shrink-0 size-9 rounded-lg bg-success/10 text-success flex items-center justify-center">
            <TrendingUp className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-body">
              Adicionado
            </p>
            <p className="text-base font-bold text-foreground budget-heading tabular-nums">
              {added > 0 ? `+${formatBRL(added)}` : formatBRL(0)}
            </p>
          </div>
        </div>

        {/* Removido */}
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="shrink-0 size-9 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center">
            <TrendingDown className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-body">
              Removido
            </p>
            <p className="text-base font-bold text-foreground budget-heading tabular-nums">
              {removed > 0 ? `−${formatBRL(removed)}` : formatBRL(0)}
            </p>
          </div>
        </div>

        {/* Líquido */}
        <div className="px-4 py-3 flex items-center gap-3 bg-muted/20">
          <div
            className={`shrink-0 size-9 rounded-lg flex items-center justify-center ${
              net > 0
                ? "bg-foreground/10 text-foreground"
                : net < 0
                  ? "bg-success/10 text-success"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            <NetIcon className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-body">
              {netLabel}
            </p>
            <p className={`text-base font-bold budget-heading tabular-nums ${netToneClass}`}>
              {net === 0 ? formatBRL(0) : `${netSign}${formatBRL(Math.abs(net))}`}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
