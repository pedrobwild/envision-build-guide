import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { HardHat, Truck, CalendarClock, Monitor, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
import { CollapsingSectionHeader } from "./CollapsingSectionHeader";
import { useIsMobile } from "@/hooks/use-mobile";

const bullets = [
  { icon: HardHat, highlight: "Gestão centralizada", text: "Planejamento, execução e controle de qualidade sob uma única responsabilidade." },
  { icon: Truck, highlight: "Logística integrada", text: "Materiais, fornecedores e entregas coordenados para manter o ritmo da obra." },
  { icon: CalendarClock, highlight: "Engenheiro dedicado", text: "Planejamento técnico, vistorias e gestão ativa de cronograma." },
  { icon: Monitor, highlight: "Visibilidade total", text: "Acompanhe cada etapa pelo portal Bwild, com atualizações frequentes." },
];

export function EngenhariaExpander() {
  const isMobile = useIsMobile();
  const [expanded, setExpanded] = useState(false);

  const visibleBullets = isMobile && !expanded ? bullets.slice(0, 2) : bullets;

  return (
    <Card className="border-border overflow-hidden">
      <CardContent className="p-3 sm:p-5 md:p-6 space-y-3 sm:space-y-4">
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
          {visibleBullets.map((b, i) => (
            <motion.div
              key={b.highlight}
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              className="flex items-start gap-2 p-2 sm:p-2.5 rounded-lg bg-muted/30"
            >
              <b.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-xs font-display font-semibold text-foreground block">{b.highlight}</span>
                <span className="text-[11px] sm:text-xs text-muted-foreground font-body leading-snug">{b.text}</span>
              </div>
            </motion.div>
          ))}
        </div>

        {isMobile && bullets.length > 2 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-primary font-medium mx-auto"
          >
            {expanded ? "Ver menos" : `Ver todos (${bullets.length})`}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        )}
      </CardContent>
    </Card>
  );
}
