import { Calendar, MapPin, User, Building, Ruler, Mail, UserCheck, Hash, ArrowRight, Timer, Clock } from "lucide-react";

interface MetadataStepProps {
  budget: any;
  onFieldChange: (field: string, value: string) => void;
  onNext: () => void;
}

const FIELDS = [
  { key: "client_name", label: "Cliente", placeholder: "Nome do cliente", icon: User },
  { key: "condominio", label: "Condomínio", placeholder: "Nome do condomínio", icon: Building },
  { key: "bairro", label: "Bairro", placeholder: "Bairro", icon: MapPin },
  { key: "metragem", label: "Metragem", placeholder: "Ex: 120m²", icon: Ruler },
  { key: "date", label: "Data de elaboração", placeholder: "AAAA-MM-DD", icon: Calendar, type: "date" },
  { key: "versao", label: "Versão", placeholder: "Ex: 1.0", icon: Hash },
  { key: "validity_days", label: "Validade (dias)", placeholder: "30", icon: Timer, type: "number" },
  { key: "prazo_dias_uteis", label: "Prazo de execução (dias úteis)", placeholder: "55", icon: Clock, type: "number" },
  { key: "consultora_comercial", label: "Consultora Comercial", placeholder: "Nome da vendedora", icon: UserCheck },
  { key: "email_comercial", label: "E-mail Comercial", placeholder: "email@exemplo.com", icon: Mail, type: "email" },
];

export function MetadataStep({ budget, onFieldChange, onNext }: MetadataStepProps) {
  const hasClientName = !!budget.client_name && budget.client_name !== "Cliente";

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h2 className="font-display text-2xl font-bold text-foreground mb-2">
          Dados do orçamento
        </h2>
        <p className="text-muted-foreground font-body text-sm">
          Preencha as informações do cabeçalho que aparecerão no orçamento público.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {FIELDS.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground font-body">
              <field.icon className="h-3.5 w-3.5 text-muted-foreground" />
              {field.label}
            </label>
            <input
              type={field.type || "text"}
              value={budget[field.key] || ""}
              onChange={(e) => onFieldChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm font-body placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            />
          </div>
        ))}
      </div>

      {/* Project name (full width) */}
      <div className="space-y-1.5 mb-8">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground font-body">
          Nome do projeto
        </label>
        <input
          type="text"
          value={budget.project_name || ""}
          onChange={(e) => onFieldChange("project_name", e.target.value)}
          placeholder="Nome do projeto"
          className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm font-body placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
        />
      </div>

      <div className="flex justify-end">
        <button
          onClick={onNext}
          disabled={!hasClientName}
          className="flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-body font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Próximo
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
