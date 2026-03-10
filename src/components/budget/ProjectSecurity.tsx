import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Shield, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

const checklist = [
  "Projeto executivo completo",
  "Orçamento detalhado e fixo",
  "Cronograma planejado",
  "Engenheiro responsável",
  "Portal com atualização contínua",
  "Vistoria final obrigatória",
  "Garantia estrutural de 5 anos",
];

const deliveryBullets = [
  "Manual de obra e manutenção",
  "Certificado de garantia de 5 anos",
  "Canal ágil para suporte pós-obra",
];

export function ProjectSecurity() {
  return (
    <Card className="border-border overflow-hidden">
      <CardContent className="p-4 sm:p-5 md:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center flex-shrink-0">
            <Shield className="h-5 w-5 text-success" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-display font-bold text-foreground">
              Segurança e previsibilidade
            </h3>
            <p className="text-xs text-muted-foreground font-body mt-0.5">
              Indicadores que garantem tranquilidade no seu projeto.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Score */}
          <div className="rounded-xl bg-muted/30 p-4 space-y-2.5">
            <p className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wide">
              Índice de previsibilidade
            </p>
            <div className="flex items-end gap-2">
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="text-3xl font-display font-bold text-primary"
              >
                92%
              </motion.span>
            </div>
            <Progress value={92} className="h-2" />
            <p className="text-xs text-muted-foreground font-body leading-relaxed">
              Projetos com projeto executivo e engenheiro dedicado.
            </p>
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
          <p className="font-display font-semibold text-xs text-foreground">Entrega e garantia</p>
          <p className="text-[10px] text-muted-foreground font-body">
            Obra finalizada após vistoria e aprovação de todos os detalhes.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {deliveryBullets.map((b) => (
              <span key={b} className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-body text-muted-foreground">
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
