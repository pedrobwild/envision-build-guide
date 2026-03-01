import { formatDate } from "@/lib/formatBRL";
import { Calendar, MapPin, User, Clock, Building, Ruler, Mail, UserCheck, Hash } from "lucide-react";

interface BudgetContextProps {
  budget: any;
}

export function BudgetContext({ budget }: BudgetContextProps) {
  const validUntil = budget.date && budget.validity_days
    ? new Date(new Date(budget.date).getTime() + budget.validity_days * 86400000)
    : null;

  const fields = [
    { icon: User, label: "Cliente", value: budget.client_name },
    { icon: Building, label: "Condomínio", value: budget.condominio },
    { icon: MapPin, label: "Bairro", value: budget.bairro },
    { icon: Ruler, label: "Metragem", value: budget.metragem },
    { icon: Calendar, label: "Data de elaboração", value: budget.date ? formatDate(budget.date) : null },
    { icon: Hash, label: "Versão", value: budget.versao },
    { icon: Clock, label: "Validade", value: validUntil ? formatDate(validUntil) : `${budget.validity_days || 30} dias` },
    { icon: UserCheck, label: "Consultora Comercial", value: budget.consultora_comercial },
    { icon: Mail, label: "E-mail", value: budget.email_comercial },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8 p-5 rounded-lg bg-card border border-border">
      {fields.map((f, i) => (
        <div key={i} className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-accent">
            <f.icon className="h-4 w-4 text-accent-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-body">{f.label}</p>
            <p className="text-sm font-medium text-foreground font-body">{f.value || '—'}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
