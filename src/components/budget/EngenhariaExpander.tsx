import { Card, CardContent } from "@/components/ui/card";
import { HardHat, Truck, CalendarClock, Monitor } from "lucide-react";
import { motion } from "framer-motion";
import { CollapsingSectionHeader } from "./CollapsingSectionHeader";

const bullets = [
  { icon: HardHat, highlight: "Gestão centralizada", text: "Planejamento, execução e controle de qualidade sob uma única responsabilidade." },
  { icon: Truck, highlight: "Logística integrada", text: "Materiais, fornecedores e entregas coordenados para manter o ritmo da obra." },
  { icon: CalendarClock, highlight: "Engenheiro dedicado", text: "Planejamento técnico, vistorias e gestão ativa de cronograma." },
  { icon: Monitor, highlight: "Visibilidade total", text: "Acompanhe cada etapa pelo portal Bwild, com atualizações frequentes." },
];

export function EngenhariaExpander() {
  return (
    <Card className="border-border overflow-hidden">
      <CardContent className="p-4 sm:p-5 md:p-6 space-y-4">
        {/* Mobile: collapsing sticky header */}
        <CollapsingSectionHeader
          title="Engenharia e gestão de obra"
          subtitle="Execução com previsibilidade, transparência e zero preocupação para você."
          icon={<HardHat className="h-5 w-5" />}
        />

        {/* Desktop: static header */}
        <div className="hidden lg:flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <HardHat className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-display font-bold text-foreground">
              Engenharia e gestão de obra
            </h3>
            <p className="text-xs text-muted-foreground font-body mt-0.5">
              Execução com previsibilidade, transparência e zero preocupação para você.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {bullets.map((b, i) => (
            <motion.div
              key={b.highlight}
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
      </CardContent>
    </Card>
  );
}
