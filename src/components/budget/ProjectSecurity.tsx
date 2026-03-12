import { Card, CardContent } from "@/components/ui/card";
import { Shield, CheckCircle2, Clock, Award } from "lucide-react";
import { motion } from "framer-motion";

const checklist = [
  "Projeto executivo completo",
  "Orçamento detalhado e fixo",
  "Cronograma com marcos semanais",
  "Engenheiro responsável dedicado",
  "Portal com atualizações em tempo real",
  "Vistoria final antes da entrega",
  "Garantia estrutural de 5 anos",
];

const deliveryBullets = [
  "Manual de obra e manutenção",
  "Certificado de garantia",
  "Suporte pós-obra",
];

export function ProjectSecurity({ prazoDiasUteis = 55 }: { prazoDiasUteis?: number }) {
  return (
    <Card className="border-border overflow-hidden">
      <CardContent className="p-4 sm:p-5 md:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center flex-shrink-0">
            <Shield className="h-5 w-5 text-success" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-display font-bold text-foreground">
              O que garante seu projeto
            </h3>
            <p className="text-xs text-muted-foreground font-body mt-0.5">
              Previsibilidade em cada etapa, do contrato à entrega.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Highlights */}
          <div className="grid grid-cols-2 gap-3">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3 }}
              className="rounded-xl bg-muted/30 p-4 flex flex-col items-center text-center gap-2"
            >
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <Clock className="h-4.5 w-4.5 text-primary" />
              </div>
              <span className="text-2xl font-display font-bold text-primary">{prazoDiasUteis}</span>
              <span className="text-xs text-muted-foreground font-body leading-snug">dias úteis</span>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="rounded-xl bg-muted/30 p-4 flex flex-col items-center text-center gap-2"
            >
              <div className="w-9 h-9 rounded-full bg-success/10 flex items-center justify-center">
                <Award className="h-4.5 w-4.5 text-success" />
              </div>
              <span className="text-2xl font-display font-bold text-success">5 anos</span>
              <span className="text-xs text-muted-foreground font-body leading-snug">de garantia</span>
            </motion.div>
          </div>

          {/* Checklist */}
          <div className="space-y-1.5">
            {checklist.map((item, i) => (
              <motion.div
                key={item}
                initial={{ opacity: 0, x: 8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.03, duration: 0.2 }}
                className="flex items-center gap-2 text-xs font-body text-foreground"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-success flex-shrink-0" />
                <span>{item}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Delivery callout */}
        <div className="rounded-lg bg-primary/5 border border-primary/10 p-3 space-y-2">
          <p className="font-display font-semibold text-xs text-foreground">Na entrega da obra</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {deliveryBullets.map((b) => (
              <span key={b} className="flex items-center gap-1.5 text-xs font-body text-muted-foreground">
                <CheckCircle2 className="h-3 w-3 text-primary flex-shrink-0" />
                {b}
              </span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
