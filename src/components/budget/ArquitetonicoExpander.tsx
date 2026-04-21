import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Pencil, Palette, FileCheck, FileText, Headset, Lightbulb, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";

const bullets = [
  { icon: Lightbulb, highlight: "Consultoria", text: "Orientação para o melhor resultado do investimento." },
  { icon: Pencil, highlight: "Projeto 3D", text: "Maquete realista com revisões até a aprovação." },
  { icon: Palette, highlight: "Personalização", text: "Cores, materiais e disposição guiados pelo arquiteto." },
  { icon: FileCheck, highlight: "Projeto executivo", text: "Plantas detalhadas que eliminam improvisos." },
  { icon: FileText, highlight: "Documentação", text: "ART, CREA e liberação do condomínio." },
  { icon: Headset, highlight: "Acompanhamento", text: "Arquiteto e engenheiro juntos durante toda a obra." },
];

export function ArquitetonicoExpander() {
  const isMobile = useIsMobile();
  const [expanded, setExpanded] = useState(false);

  const visibleBullets = !expanded ? bullets.slice(0, 3) : bullets;

  return (
    <Card className="border-border overflow-hidden">
      <CardContent className="p-3 sm:p-4 space-y-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Pencil className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-display font-bold text-foreground leading-tight">
              Arquitetura
            </h3>
            <p className="text-[11px] text-muted-foreground font-body leading-snug">
              Do conceito à documentação.
            </p>
          </div>
        </div>

        <ul className="space-y-1">
          <AnimatePresence initial={false}>
            {visibleBullets.map((b, i) => (
              <motion.li
                key={b.highlight}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ delay: i * 0.03, duration: 0.2 }}
                className="flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-muted/30 transition-colors"
              >
                <b.icon className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-[11.5px] leading-snug font-body text-muted-foreground min-w-0">
                  <span className="font-display font-semibold text-foreground">{b.highlight}:</span>{" "}
                  {b.text}
                </p>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>

        {bullets.length > 3 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-[11px] text-primary font-medium mx-auto hover:underline"
          >
            {expanded ? "Ver menos" : `Ver todos (${bullets.length})`}
            <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        )}
      </CardContent>
    </Card>
  );
}
