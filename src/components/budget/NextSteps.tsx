import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Rocket } from "lucide-react";

const steps = [
  { num: 1, title: "Iniciar o projeto", desc: "Aprovação do orçamento e assinatura do contrato." },
  { num: 2, title: "Briefing com a Lorena", desc: "Videochamada para traduzir sua visão no Projeto 3D." },
  { num: 3, title: "Projeto 3D", desc: "Primeira versão de layout, iluminação, marcenaria e decoração." },
  { num: 4, title: "Revisões e aprovação", desc: "Ajustes até a versão final aprovada." },
  { num: 5, title: "Início da obra", desc: "Execução com acompanhamento no portal Bwild." },
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
              O que acontece depois que você inicia
            </h3>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 sm:gap-3">
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
                <p className="text-[10px] text-muted-foreground font-body leading-relaxed">{s.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <p className="text-[10px] text-muted-foreground font-body italic text-center pt-1">
          Canal direto com engenheiro e gerente de relacionamento durante todo o processo.
        </p>
      </CardContent>
    </Card>
  );
}
