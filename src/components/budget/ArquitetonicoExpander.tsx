import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { CheckCircle2 } from "lucide-react";

const bullets = [
  "Reuniões de briefing e revisões com arquiteta",
  "Projeto 3D: layout, iluminação, marcenaria e decoração",
  "Projeto executivo + memorial descritivo",
  "ART e acompanhamento técnico durante a obra",
  "Aprovação no CREA e no condomínio (toda burocracia)",
];

const executiveDetails = [
  "Plantas detalhadas com dimensões exatas",
  "Projeto elétrico e hidráulico",
  "Especificações de materiais e acabamentos",
  "Detalhamento de marcenaria e mobiliário sob medida",
];

export function ArquitetonicoExpander() {
  return (
    <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5 overflow-hidden">
      <CardContent className="p-5 sm:p-6 space-y-5">
        <div>
          <h3 className="text-base sm:text-lg font-display font-bold text-foreground">
            Projeto Arquitetônico Personalizado
          </h3>
          <p className="text-sm text-muted-foreground font-body mt-1">
            Diferente de modelos padronizados, o projeto da Bwild é desenvolvido exclusivamente para sua unidade.
          </p>
        </div>

        <ul className="space-y-2.5">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2.5 text-sm font-body text-foreground">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <span>{b}</span>
            </li>
          ))}
        </ul>

        <div className="rounded-lg border-l-4 border-primary bg-primary/5 px-4 py-3">
          <p className="text-sm font-body text-foreground leading-relaxed">
            Você tem contato direto com a Lorena, sócia e diretora de arquitetura — projeto feito para sua unidade.
          </p>
        </div>

        <Accordion type="single" collapsible>
          <AccordionItem value="exec" className="border-border">
            <AccordionTrigger className="hover:no-underline text-sm font-display font-semibold py-2">
              Saiba mais
            </AccordionTrigger>
            <AccordionContent className="space-y-3 text-sm font-body text-muted-foreground">
              <p className="font-display font-semibold text-foreground text-xs">
                Projeto Executivo — o que acontece nesta etapa
              </p>
              <p>
                Nossa equipe de engenharia desenvolve o conjunto completo de documentos técnicos para execução com precisão.
              </p>
              <ul className="space-y-1.5 pl-1">
                {executiveDetails.map((d) => (
                  <li key={d} className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
              <div className="rounded-md bg-muted/50 px-3 py-2 mt-2">
                <p className="text-xs text-muted-foreground italic">
                  Menos improviso, menos retrabalho, mais previsibilidade.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
