import { Card, CardContent } from "@/components/ui/card";
import { Pencil, Palette, FileCheck, FileText, Headset, Lightbulb } from "lucide-react";
import { motion } from "framer-motion";
import { CollapsingSectionHeader } from "./CollapsingSectionHeader";

const bullets = [
  { icon: Lightbulb, highlight: "Consultoria", text: "Orientação para alcançar o melhor resultado com seu investimento." },
  { icon: Pencil, highlight: "Projeto 3D", text: "Maquete realista do seu espaço, com revisões até a aprovação." },
  { icon: Palette, highlight: "Personalização", text: "Cores, materiais e disposição escolhidos por você, guiados pelo arquiteto." },
  { icon: FileCheck, highlight: "Projeto executivo", text: "Plantas detalhadas que eliminam improvisos na execução." },
  { icon: FileText, highlight: "Documentação", text: "ART, CREA e liberação do condomínio — cuidamos de tudo." },
  { icon: Headset, highlight: "Acompanhamento", text: "Arquiteto e engenheiro juntos durante toda a obra." },
];

export function ArquitetonicoExpander() {
  return (
    <Card className="border-border overflow-hidden">
      <CardContent className="p-4 sm:p-5 md:p-6 space-y-4">
        {/* Mobile: collapsing sticky header */}
        <CollapsingSectionHeader
          title="Arquitetura"
          subtitle="Projeto exclusivo para sua unidade — do conceito à documentação."
          icon={<Pencil className="h-5 w-5" />}
        />

        {/* Desktop: static header */}
        <div className="hidden lg:flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Pencil className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-display font-bold text-foreground">
              Arquitetura
            </h3>
            <p className="text-xs text-muted-foreground font-body mt-0.5">
              Projeto exclusivo para sua unidade — do conceito à documentação.
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
