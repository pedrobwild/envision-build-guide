import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import type { BudgetMeta } from "@/lib/orcamento-types";

interface BudgetHeroProps {
  meta: BudgetMeta;
  included: string[];
}

export function BudgetHero({ meta, included }: BudgetHeroProps) {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.08em] font-body font-semibold text-muted-foreground/60 mb-1">
          Proposta
        </p>
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground tracking-tight">
          Orçamento
        </h1>
        <p className="text-sm text-muted-foreground font-body mt-1.5 leading-relaxed">
          Resumo do seu projeto e tudo que está incluído nos serviços Bwild.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary" className="font-body text-xs">{meta.area}</Badge>
        <Badge variant="secondary" className="font-body text-xs">{meta.version}</Badge>
        <Badge variant="secondary" className="font-body text-xs">Válido até {meta.validUntil}</Badge>
        <Badge variant="outline" className="font-body text-xs">Arq. {meta.architect}</Badge>
        <Badge variant="outline" className="font-body text-xs">Eng. {meta.engineer}</Badge>
      </div>

      <Card className="border-primary/15 bg-primary/4">
        <CardContent className="pt-5 pb-4">
          <p className="text-[10px] font-body font-semibold text-primary uppercase tracking-[0.08em] mb-3">
            Inclui (Serviços Bwild)
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {included.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm font-body text-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground/60 font-body italic leading-relaxed">
        A Bwild cuida do projeto, engenharia e gestão — para você não precisar coordenar fornecedores, cronograma ou burocracias.
      </p>
    </section>
  );
}
