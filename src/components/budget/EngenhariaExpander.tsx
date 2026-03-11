import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HardHat, Truck, CalendarClock, Monitor, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const bullets = [
  { icon: HardHat, text: "Toda a operação da obra sob gestão centralizada, do planejamento à execução.", highlight: "Coordenação completa" },
  { icon: Truck, text: "Materiais, equipamentos e fornecedores sincronizados sob nosso controle, para manter o ritmo da obra.", highlight: "Logística integrada" },
  { icon: CalendarClock, text: "Atuando como gestor da obra, realiza planejamento e acompanhamento técnico próximo, com gestão ativa de cronograma, da execução e vistorias técnicas de qualidade.", highlight: "Engenheiro sênior dedicado" },
  { icon: Monitor, text: "Visibilidade contínua da evolução da obra, com atualizações frequentes por meio do aplicativo web da Bwild.", highlight: "Transparência total" },
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
              A experiência de ter a obra conduzida por você, sem nenhum esforço, com excelência, previsibilidade e total tranquilidade.
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

        <div className="rounded-lg bg-primary/5 border border-primary/10 px-3 py-2.5">
          <p className="text-xs text-foreground font-body italic text-center">
            "Você não contrata apenas uma gestão de obra. Contrata segurança, previsibilidade e um resultado à altura do seu investimento."
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
