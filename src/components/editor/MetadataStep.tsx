import { Calendar, MapPin, User, Building, Ruler, Mail, UserCheck, Hash, Save, Timer, Clock, Loader2, ShoppingBag, Users, ExternalLink } from "lucide-react";
import { HeaderConfigStep } from "@/components/editor/HeaderConfigStep";
import type { HeaderConfig } from "@/components/budget/BudgetHeader";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface MetadataStepProps {
  budget: any;
  onFieldChange: (field: string, value: any) => void;
  onNext: () => void;
  saving?: boolean;
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
  { key: "estimated_weeks", label: "Prazo estimado (semanas)", placeholder: "8", icon: Timer, type: "number" },
  { key: "consultora_comercial", label: "Consultora Comercial", placeholder: "Nome da vendedora", icon: UserCheck },
  { key: "email_comercial", label: "E-mail Comercial", placeholder: "email@exemplo.com", icon: Mail, type: "email" },
];

export function MetadataStep({ budget, onFieldChange, onNext, saving }: MetadataStepProps) {
  const hasClientName = !!budget.client_name && budget.client_name !== "Cliente";
  const headerConfig: HeaderConfig = budget.header_config || {};
  const { members: comerciais } = useTeamMembers("comercial");
  const { members: orcamentistas } = useTeamMembers("orcamentista");

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

      {/* Responsáveis */}
      <div className="mb-8 p-4 rounded-xl border border-border bg-card space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Users className="h-4 w-4 text-primary" />
          <span className="font-display font-semibold text-sm text-foreground">Responsáveis</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground font-body">
              <UserCheck className="h-3.5 w-3.5 text-muted-foreground" />
              Comercial
            </label>
            <Select
              value={budget.commercial_owner_id || ""}
              onValueChange={(v) => onFieldChange("commercial_owner_id", v || null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o comercial" />
              </SelectTrigger>
              <SelectContent>
                {comerciais.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground font-body">
              <UserCheck className="h-3.5 w-3.5 text-muted-foreground" />
              Orçamentista
            </label>
            <Select
              value={budget.estimator_owner_id || ""}
              onValueChange={(v) => onFieldChange("estimator_owner_id", v || null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o orçamentista" />
              </SelectTrigger>
              <SelectContent>
                {orcamentistas.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Hubspot Deal URL */}
      <div className="mb-8 p-4 rounded-xl border border-border bg-card space-y-2">
        <div className="flex items-center gap-2">
          <ExternalLink className="h-4 w-4 text-primary" />
          <span className="font-display font-semibold text-sm text-foreground">Negócio Hubspot</span>
        </div>
        <div className="flex gap-2 items-center">
          <input
            type="url"
            value={budget.hubspot_deal_url || ""}
            onChange={(e) => onFieldChange("hubspot_deal_url", e.target.value)}
            placeholder="https://app.hubspot.com/contacts/.../deal/..."
            className="flex-1 px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm font-body placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          />
          {budget.hubspot_deal_url && (
            <a
              href={budget.hubspot_deal_url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2.5 rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-primary"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
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

      {/* Optional items toggle */}
      <div className="mb-8 p-4 rounded-xl border border-border bg-card flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ShoppingBag className="h-4 w-4 text-warning" />
          <div>
            <p className="text-sm font-body font-medium text-foreground">Incluir opcionais</p>
            <p className="text-xs text-muted-foreground font-body">Permite que o cliente simule a inclusão de itens opcionais no orçamento público</p>
          </div>
        </div>
        <button
          onClick={() => onFieldChange("show_optional_items", !budget.show_optional_items)}
          className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${budget.show_optional_items ? 'bg-primary' : 'bg-muted'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${budget.show_optional_items ? 'translate-x-5' : ''}`} />
        </button>
      </div>

      {/* Header config hidden — kept in code for future use */}

      <div className="flex justify-end">
        <button
          onClick={onNext}
          disabled={!hasClientName || saving}
          className="flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-body font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Publicando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Salvar e Publicar
            </>
          )}
        </button>
      </div>
    </div>
  );
}
