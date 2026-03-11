import { Card, CardContent } from "@/components/ui/card";
import { Clock, ShieldCheck, Check } from "lucide-react";
import { motion } from "framer-motion";

const checklist = [
  "Projeto executivo completo incluso",
  "Cronograma detalhado por etapa",
  "Garantia de 5 anos na estrutura",
];

interface ProjectConditionsProps {
  estimatedWeeks?: number;
}

export function ProjectConditions({ estimatedWeeks = 8 }: ProjectConditionsProps) {
  return (
    <Card className="border-border overflow-hidden">
      <CardContent className="p-4 sm:p-5 md:p-6 space-y-5">
        <div>
          <h2 className="text-xl font-display font-bold text-foreground">
            Condições do Projeto
          </h2>
          <p className="text-sm text-muted-foreground font-body mt-1">
            Informações sobre prazo e investimento
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Prazo */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3 }}
            className="rounded-xl bg-muted/30 p-5 space-y-2"
          >
            <div className="flex items-center gap-2">
              <Clock className="h-4.5 w-4.5 text-primary" />
              <span className="text-sm font-display font-semibold text-foreground">
                Prazo estimado de execução
              </span>
            </div>
            <p className="text-2xl font-display font-bold text-primary">
              {estimatedWeeks} semanas
            </p>
            <p className="text-xs text-muted-foreground font-body">
              A partir da aprovação do projeto
            </p>
          </motion.div>

          {/* Orçamento fechado */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="rounded-xl bg-muted/30 p-5 space-y-2"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4.5 w-4.5 text-success" />
              <span className="text-sm font-display font-semibold text-foreground">
                Orçamento fechado
              </span>
            </div>
            <p className="text-base font-display font-medium text-foreground">
              O valor apresentado é o valor final
            </p>
            <p className="text-xs text-muted-foreground font-body">
              Sem custos ocultos ou reajustes. Alterações de escopo são tratadas como adendo.
            </p>
          </motion.div>
        </div>

        {/* Checklist */}
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {checklist.map((item, i) => (
            <motion.div
              key={item}
              initial={{ opacity: 0, x: 8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, duration: 0.2 }}
              className="flex items-center gap-2 text-sm font-body text-foreground"
            >
              <Check className="h-4 w-4 text-success flex-shrink-0" />
              <span>{item}</span>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
