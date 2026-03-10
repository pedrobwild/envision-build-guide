import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HardHat, Truck, CalendarClock, Monitor } from "lucide-react";

const bullets = [
  { icon: HardHat, text: "Mobilização e coordenação de mão de obra e fornecedores" },
  { icon: Truck, text: "Compras e logística de materiais e equipamentos" },
  { icon: CalendarClock, text: "Gestão de cronograma por engenheiro dedicado" },
  { icon: Monitor, text: "Atualizações contínuas no portal" },
];

const chips = [
  "Atrasos por falta de material",
  "Ruído entre fornecedores",
  "Surpresas no custo",
];

export function EngenhariaExpander() {
  return (
    <Card className="border-border overflow-hidden">
      <CardContent className="p-4 sm:p-5 md:p-6 space-y-4 sm:space-y-5">
        <h3 className="text-base sm:text-lg font-display font-bold text-foreground">
          Engenharia e Gestão — você não precisa gerenciar a obra
        </h3>

        <ul className="space-y-2.5 sm:space-y-3">
          {bullets.map((b) => (
            <li key={b.text} className="flex items-start gap-2.5 sm:gap-3 text-xs sm:text-sm font-body text-foreground">
              <b.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary mt-0.5 flex-shrink-0" />
              <span>{b.text}</span>
            </li>
          ))}
        </ul>

        <div className="space-y-2">
          <p className="text-[10px] sm:text-xs font-display font-semibold text-muted-foreground uppercase tracking-wide">
            O que você evita
          </p>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {chips.map((c) => (
              <Badge key={c} variant="secondary" className="text-[10px] sm:text-xs font-body">
                {c}
              </Badge>
            ))}
          </div>
        </div>

        <p className="text-xs sm:text-sm text-muted-foreground font-body italic">
          "Você contrata um resultado — não um processo."
        </p>
      </CardContent>
    </Card>
  );
}
