import { Card, CardContent } from "@/components/ui/card";
import { Pencil, Palette, FileCheck, FileText, Headset, Lightbulb } from "lucide-react";
import { motion } from "framer-motion";

const bullets = [
  { icon: Lightbulb, highlight: "Consultoria", text: "Nosso time sugere a melhor composição de projeto para que seu objetivo com a reforma seja alcançado." },
  { icon: Pencil, highlight: "Projeto 3D", text: "Apresentado levando em consideração sua visão, preferências e objetivos, incluindo revisões." },
  { icon: Palette, highlight: "Personalização", text: "Escolha cores e disposições da pintura e marcenaria que melhor te atendem." },
  { icon: FileCheck, highlight: "Projeto Executivo", text: "Modelo ultra detalhado que guia minuciosamente a execução do projeto, à prova de falhas estruturais." },
  { icon: FileText, highlight: "Documentação e Burocracia", text: "Cuidamos de toda a interface com o CREA para emissão da ART e liberação da obra com o condomínio." },
  { icon: Headset, highlight: "Acompanhamento Técnico", text: "O arquiteto acompanhará todo o andamento da obra junto do engenheiro responsável." },
];

export function ArquitetonicoExpander() {
  return (
    <Card className="border-border overflow-hidden">
      <CardContent className="p-4 sm:p-5 md:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Pencil className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-display font-bold text-foreground">
              Projeto Arquitetônico Personalizado
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground font-body mt-0.5">
              Diferente de modelos padronizados, o seu projeto da Bwild é único e desenvolvido exclusivamente para sua unidade.
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
