import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Shield, CheckCircle2 } from "lucide-react";

const checklist = [
  "Projeto executivo completo",
  "Orçamento detalhado e fixo",
  "Cronograma planejado",
  "Engenheiro responsável",
  "Portal com atualização contínua",
  "Vistoria final obrigatória",
  "Garantia estrutural de 5 anos",
];

const deliveryBullets = [
  "Manual de obra e manutenção",
  "Certificado de garantia de 5 anos",
  "Canal ágil para suporte pós-obra",
];

export function ProjectSecurity() {
  return (
    <Card className="border-border overflow-hidden">
      <CardContent className="p-4 sm:p-5 md:p-6 space-y-4 sm:space-y-6">
        <h3 className="text-base sm:text-lg font-display font-bold text-foreground">
          Segurança e previsibilidade do seu projeto
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* Left: score */}
          <div className="space-y-2 sm:space-y-3">
            <p className="text-[10px] sm:text-xs font-display font-semibold text-muted-foreground uppercase tracking-wide">
              Índice de previsibilidade do projeto
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xl sm:text-2xl font-display font-bold text-primary">92%</span>
              </div>
              <Progress value={92} className="h-2.5 sm:h-3" />
            </div>
            <p className="text-[11px] sm:text-xs text-muted-foreground font-body leading-relaxed">
              Projetos com projeto executivo completo e engenheiro dedicado têm alto índice de previsibilidade.
            </p>
          </div>

          {/* Right: checklist */}
          <ul className="space-y-1.5 sm:space-y-2">
            {checklist.map((item) => (
              <li key={item} className="flex items-start gap-2 text-xs sm:text-sm font-body text-foreground">
                <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Callout */}
        <div className="rounded-lg bg-primary/10 border border-primary/20 p-3 sm:p-4 space-y-2">
          <p className="font-display font-semibold text-xs sm:text-sm text-foreground">Entrega e garantia</p>
          <p className="text-[11px] sm:text-xs text-muted-foreground font-body">
            A obra só é considerada finalizada após vistoria e aprovação de todos os detalhes.
          </p>
          <ul className="space-y-1 mt-1">
            {deliveryBullets.map((b) => (
              <li key={b} className="flex items-start gap-2 text-[11px] sm:text-xs font-body text-muted-foreground">
                <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary mt-0.5 flex-shrink-0" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
