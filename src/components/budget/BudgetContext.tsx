import { formatDate } from "@/lib/formatBRL";
import { Calendar, MapPin, User, Clock } from "lucide-react";

interface BudgetContextProps {
  budget: any;
}

export function BudgetContext({ budget }: BudgetContextProps) {
  const validUntil = budget.date && budget.validity_days
    ? new Date(new Date(budget.date).getTime() + budget.validity_days * 86400000)
    : null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8 p-5 rounded-lg bg-card border border-border">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-accent">
          <MapPin className="h-4 w-4 text-accent-foreground" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-body">Projeto</p>
          <p className="text-sm font-medium text-foreground font-body">{budget.project_name || '—'}</p>
          {budget.unit && <p className="text-xs text-muted-foreground">{budget.unit}</p>}
        </div>
      </div>
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-accent">
          <User className="h-4 w-4 text-accent-foreground" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-body">Cliente</p>
          <p className="text-sm font-medium text-foreground font-body">{budget.client_name || '—'}</p>
        </div>
      </div>
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-accent">
          <Calendar className="h-4 w-4 text-accent-foreground" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-body">Data</p>
          <p className="text-sm font-medium text-foreground font-body">{budget.date ? formatDate(budget.date) : '—'}</p>
        </div>
      </div>
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-accent">
          <Clock className="h-4 w-4 text-accent-foreground" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-body">Validade</p>
          <p className="text-sm font-medium text-foreground font-body">
            {validUntil ? formatDate(validUntil) : `${budget.validity_days || 30} dias`}
          </p>
        </div>
      </div>
    </div>
  );
}
