import { formatDate } from "@/lib/formatBRL";
import { Calendar, MapPin, User, Clock, Building, Ruler, Mail, UserCheck, Hash } from "lucide-react";
import { motion } from "framer-motion";

interface BudgetContextProps {
  budget: any;
}

export function BudgetContext({ budget }: BudgetContextProps) {
  const validUntil = budget.date && budget.validity_days
    ? new Date(new Date(budget.date).getTime() + budget.validity_days * 86400000)
    : null;

  const fields = [
    { icon: User, label: "Cliente", value: budget.client_name },
    { icon: Building, label: "Obra", value: budget.condominio },
    { icon: MapPin, label: "Bairro", value: budget.bairro },
    { icon: Ruler, label: "Metragem", value: budget.metragem },
    { icon: Calendar, label: "Data", value: budget.date ? formatDate(budget.date) : null },
    { icon: Hash, label: "Versão", value: budget.versao },
    { icon: Clock, label: "Validade", value: validUntil ? formatDate(validUntil) : `${budget.validity_days || 30} dias` },
    { icon: UserCheck, label: "Consultora", value: budget.consultora_comercial },
    { icon: Mail, label: "E-mail", value: budget.email_comercial },
  ].filter(f => f.value);

  if (fields.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="mb-8"
    >
      <h2 className="font-display font-bold text-xl sm:text-2xl text-foreground text-center mb-6">
        Informações do Projeto
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {fields.map((f, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + i * 0.05, duration: 0.4 }}
            className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3"
          >
            <div className="p-2.5 rounded-lg bg-accent w-fit">
              <f.icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-body">{f.label}</p>
              <p className="text-sm font-semibold text-foreground font-body mt-0.5">{f.value}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
