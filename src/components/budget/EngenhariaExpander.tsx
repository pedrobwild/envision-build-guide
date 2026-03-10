import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HardHat, Truck, CalendarClock, Monitor, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const bullets = [
  { icon: HardHat, text: "Mobilização e coordenação de mão de obra e fornecedores", highlight: "Coordenação completa" },
  { icon: Truck, text: "Compras e logística de materiais e equipamentos", highlight: "Logística integrada" },
  { icon: CalendarClock, text: "Gestão de cronograma por engenheiro dedicado", highlight: "Engenheiro dedicado" },
  { icon: Monitor, text: "Atualizações contínuas no portal", highlight: "Transparência total" },
];

const chips = [
  "Atrasos por falta de material",
  "Ruído entre fornecedores",
  "Surpresas no custo",
];

export function EngenhariaExpander() {
  return (
    <Card className="border-border overflow-hidden">
      <CardContent className="p-4 sm:p-5 md:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <HardHat className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-display font-bold text-foreground">
              Engenharia e Gestão
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground font-body mt-0.5">
              Você não precisa gerenciar a obra — nós cuidamos de tudo.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {bullets.map((b, i) => (
            <motion.div
              key={b.text}
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/30"
            >
              <b.icon className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-xs font-display font-semibold text-foreground block">{b.highlight}</span>
                <span className="text-xs text-muted-foreground font-body">{b.text}</span>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <span className="text-[10px] sm:text-xs font-display font-semibold text-muted-foreground uppercase tracking-wide">
            O que você evita
          </span>
          <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
          <div className="flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <Badge key={c} variant="secondary" className="text-[10px] sm:text-xs font-body bg-destructive/5 text-destructive/80 border-destructive/10">
                {c}
              </Badge>
            ))}
          </div>
        </div>

        <div className="rounded-lg bg-primary/5 border border-primary/10 px-3 py-2.5">
          <p className="text-xs text-foreground font-body italic text-center">
            "Você contrata um resultado — não um processo."
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
