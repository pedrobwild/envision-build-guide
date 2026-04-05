import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import type { BudgetMeta } from "@/lib/orcamento-types";

const LABEL = "text-[10px] uppercase tracking-[0.08em] font-body font-semibold text-muted-foreground/60";
const MONO = "font-mono tabular-nums";

interface BudgetHeroProps {
  meta: BudgetMeta;
  included: string[];
}

export function BudgetHero({ meta, included }: BudgetHeroProps) {
  return (
    <section className="space-y-6">
      <div>
        <p className={`${LABEL} mb-1`}>Proposta</p>
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground tracking-tight leading-[1.15]">
          Orçamento
        </h1>
        <p className="text-sm text-muted-foreground font-body mt-1.5 leading-relaxed tracking-[-0.01em]">
          Resumo do seu projeto e tudo que está incluído nos serviços Bwild.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary" className={`font-body text-xs ${MONO}`}>{meta.area}</Badge>
        <Badge variant="secondary" className={`font-body text-xs ${MONO}`}>{meta.version}</Badge>
        <Badge variant="secondary" className="font-body text-xs">
          Válido até <span className={MONO}>{meta.validUntil}</span>
        </Badge>
        <Badge variant="outline" className="font-body text-xs tracking-[-0.01em]">Arq. {meta.architect}</Badge>
        <Badge variant="outline" className="font-body text-xs tracking-[-0.01em]">Eng. {meta.engineer}</Badge>
      </div>

      <Card className="border-primary/15 bg-primary/4">
        <CardContent className="pt-5 pb-4">
          <p className={`${LABEL} text-primary mb-3`}>
            Inclui (Serviços Bwild)
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {included.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm font-body text-foreground leading-snug tracking-[-0.01em]">
                <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground/60 font-body italic leading-relaxed tracking-[-0.005em]">
        A Bwild cuida do projeto, engenharia e gestão — para você não precisar coordenar fornecedores, cronograma ou burocracias.
      </p>
    </section>
  );
}
