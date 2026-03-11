import { Shield, X, CheckCircle2, TrendingUp } from "lucide-react";

const negatives = [
  "Orçamento estourado em média 40–60%",
  "3 a 5 fornecedores para gerenciar",
  "15–20h/semana do seu tempo",
  "Sem garantia de prazo",
  "Retrabalhos e custos surpresa",
];

const positives = [
  "Preço fixo — sem surpresas",
  "Gestão única de ponta a ponta",
  "0h/semana do seu tempo",
  "Cronograma detalhado e controlado",
  "Projeto focado em rentabilidade",
];

export function TurnkeyComparison() {
  return (
    <div className="rounded-xl border border-border bg-card p-5 sm:p-6 space-y-5">
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-lg bg-primary/10">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <h3 className="font-display font-bold text-base sm:text-lg text-foreground">
          Por que Turnkey?
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Left — DIY */}
        <div className="rounded-lg bg-muted/50 border-l-4 border-destructive/30 p-4 space-y-2.5">
          <p className="font-display font-semibold text-sm text-foreground">Reforma por conta própria</p>
          <ul className="space-y-2">
            {negatives.map((text, i) => (
              <li key={i} className="flex items-start gap-2 text-xs font-body text-foreground/80">
                <X className="h-3.5 w-3.5 text-destructive mt-0.5 flex-shrink-0" />
                {text}
              </li>
            ))}
          </ul>
        </div>

        {/* Right — Bwild */}
        <div className="rounded-lg bg-primary/[0.03] border-l-4 border-primary/30 p-4 space-y-2.5">
          <p className="font-display font-semibold text-sm text-foreground">Bwild Turnkey</p>
          <ul className="space-y-2">
            {positives.map((text, i) => (
              <li key={i} className="flex items-start gap-2 text-xs font-body text-foreground/80">
                <CheckCircle2 className="h-3.5 w-3.5 text-success mt-0.5 flex-shrink-0" />
                {text}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Callout */}
      <div className="rounded-lg border border-border bg-card p-4 flex items-start gap-2.5">
        <TrendingUp className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground font-body italic">
          Reformas sem gestão profissional estouram o orçamento em média 47%.*
        </p>
      </div>
    </div>
  );
}
