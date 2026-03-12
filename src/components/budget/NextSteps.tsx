import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Rocket } from "lucide-react";

const steps = [
  { num: 1, title: "Briefing", desc: "Alinhamento de expectativas, estilo e objetivos do projeto." },
  { num: 2, title: "Projeto 3D", desc: "Maquete realista com revisões até sua aprovação." },
  { num: 3, title: "Medição técnica", desc: "Levantamento preciso do espaço para o projeto executivo." },
  { num: 4, title: "Projeto executivo", desc: "Plantas detalhadas com especificações de materiais e acabamentos." },
  { num: 5, title: "Liberação", desc: "ART no CREA e documentação para o condomínio." },
  { num: 6, title: "Início da obra", desc: "Cronograma definido, equipe mobilizada." },
];

export function NextSteps() {
  return (
    <Card className="border-border overflow-hidden">
      <CardContent className="p-4 sm:p-5 md:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Rocket className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-display font-bold text-foreground">
              Próximos passos após a assinatura
            </h3>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {steps.map((s, i) => (
            <motion.div
              key={s.num}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06, duration: 0.3 }}
              className="relative flex sm:flex-col items-start gap-3 sm:gap-2 p-3 rounded-xl bg-muted/30 sm:text-center"
            >
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-display font-bold flex-shrink-0 sm:mx-auto">
                {s.num}
              </div>
              <div className="sm:space-y-1">
                <p className="text-xs font-display font-semibold text-foreground">{s.title}</p>
                <p className="text-xs text-muted-foreground font-body leading-relaxed">{s.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground font-body text-center pt-1">
          Engenheiro e gerente de relacionamento dedicados do início ao fim.
        </p>
      </CardContent>
    </Card>
  );
}
