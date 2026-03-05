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
      <CardContent className="p-5 sm:p-6 space-y-5">
        <h3 className="text-base sm:text-lg font-display font-bold text-foreground">
          Engenharia e Gestão — você não precisa gerenciar a obra
        </h3>

        <ul className="space-y-3">
          {bullets.map((b) => (
            <li key={b.text} className="flex items-start gap-3 text-sm font-body text-foreground">
              <b.icon className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <span>{b.text}</span>
            </li>
          ))}
        </ul>

        <div className="space-y-2">
          <p className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wide">
            O que você evita
          </p>
          <div className="flex flex-wrap gap-2">
            {chips.map((c) => (
              <Badge key={c} variant="secondary" className="text-xs font-body">
                {c}
              </Badge>
            ))}
          </div>
        </div>

        <p className="text-sm text-muted-foreground font-body italic">
          "Você contrata um resultado — não um processo."
        </p>
      </CardContent>
    </Card>
  );
}
