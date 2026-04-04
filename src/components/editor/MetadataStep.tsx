import { useState } from "react";
import { Calendar, MapPin, User, Building, Ruler, Mail, UserCheck, Hash, Timer, Clock, ShoppingBag, ExternalLink, ChevronDown } from "lucide-react";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface MetadataStepProps {
  budget: any;
  onFieldChange: (field: string, value: any) => void;
}

/* ── Notion-like property row ── */
function PropertyRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-1.5 group">
      <div className="flex items-center gap-2 w-[180px] shrink-0 pt-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground/60" />
        <span className="text-sm text-muted-foreground font-body truncate">{label}</span>
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function NotionInput({
  value,
  onChange,
  placeholder,
  type = "text",
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
  className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full px-2 py-1.5 rounded-md border border-transparent hover:border-border focus:border-border bg-transparent text-sm font-body text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all ${className}`}
      style={type === "number" ? { fontVariantNumeric: "tabular-nums" } : undefined}
    />
  );
}

const CORE_FIELDS = [
  { key: "client_name", label: "Cliente", placeholder: "Nome do cliente", icon: User },
  { key: "condominio", label: "Condomínio", placeholder: "Nome do condomínio", icon: Building },
  { key: "bairro", label: "Bairro", placeholder: "Bairro", icon: MapPin },
  { key: "metragem", label: "Metragem", placeholder: "Ex: 120m²", icon: Ruler },
];

const TIME_FIELDS = [
  { key: "date", label: "Data de elaboração", placeholder: "AAAA-MM-DD", icon: Calendar, type: "date" },
  { key: "versao", label: "Versão", placeholder: "Ex: 1.0", icon: Hash },
  { key: "validity_days", label: "Validade (dias)", placeholder: "30", icon: Timer, type: "number" },
  { key: "prazo_dias_uteis", label: "Prazo execução (dias)", placeholder: "55", icon: Clock, type: "number" },
  { key: "estimated_weeks", label: "Prazo (semanas)", placeholder: "8", icon: Timer, type: "number" },
];

const COMMERCIAL_FIELDS = [
  { key: "consultora_comercial", label: "Consultora Comercial", placeholder: "Nome da vendedora", icon: UserCheck },
  { key: "email_comercial", label: "E-mail Comercial", placeholder: "email@exemplo.com", icon: Mail, type: "email" },
];

export function MetadataStep({ budget, onFieldChange }: MetadataStepProps) {
  const { members: comerciais } = useTeamMembers("comercial");
  const { members: orcamentistas } = useTeamMembers("orcamentista");
  const [showMore, setShowMore] = useState(false);

  return (
    <div className="max-w-3xl">
      {/* ── Core properties (always visible) ── */}
      <div className="border-b border-border/40 pb-1 mb-1">
        {CORE_FIELDS.map((field) => (
          <PropertyRow key={field.key} icon={field.icon} label={field.label}>
            <NotionInput
              value={budget[field.key] || ""}
              onChange={(v) => onFieldChange(field.key, v)}
              placeholder={field.placeholder}
            />
          </PropertyRow>
        ))}
      </div>

      {/* ── Responsáveis ── */}
      <div className="border-b border-border/40 pb-1 mb-1">
        <PropertyRow icon={UserCheck} label="Comercial">
          <Select
            value={budget.commercial_owner_id || ""}
            onValueChange={(v) => onFieldChange("commercial_owner_id", v || null)}
          >
            <SelectTrigger className="border-transparent hover:border-border shadow-none h-auto py-1.5 px-2 text-sm font-body bg-transparent focus:ring-1 focus:ring-primary/20">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {comerciais.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PropertyRow>
        <PropertyRow icon={UserCheck} label="Orçamentista">
          <Select
            value={budget.estimator_owner_id || ""}
            onValueChange={(v) => onFieldChange("estimator_owner_id", v || null)}
          >
            <SelectTrigger className="border-transparent hover:border-border shadow-none h-auto py-1.5 px-2 text-sm font-body bg-transparent focus:ring-1 focus:ring-primary/20">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {orcamentistas.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PropertyRow>
      </div>

      {/* ── Hubspot ── */}
      <div className="border-b border-border/40 pb-1 mb-1">
        <PropertyRow icon={ExternalLink} label="Negócio Hubspot">
          <div className="flex items-center gap-1">
            <NotionInput
              value={budget.hubspot_deal_url || ""}
              onChange={(v) => onFieldChange("hubspot_deal_url", v)}
              placeholder="https://app.hubspot.com/..."
              type="url"
            />
            {budget.hubspot_deal_url && (
              <a
                href={budget.hubspot_deal_url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-primary transition-colors shrink-0"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </PropertyRow>
      </div>

      {/* ── Optional items toggle ── */}
      <div className="border-b border-border/40 pb-1 mb-1">
        <PropertyRow icon={ShoppingBag} label="Incluir opcionais">
          <button
            onClick={() => onFieldChange("show_optional_items", !budget.show_optional_items)}
            className="flex items-center gap-2 py-1.5 px-2 text-sm font-body text-foreground"
          >
            <div className={`relative w-8 h-[18px] rounded-full transition-colors ${budget.show_optional_items ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
              <span className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-transform ${budget.show_optional_items ? 'translate-x-[14px]' : ''}`} />
            </div>
            <span className="text-muted-foreground text-xs">
              {budget.show_optional_items ? "Ativado" : "Desativado"}
            </span>
          </button>
        </PropertyRow>
      </div>

      {/* ── Show more properties ── */}
      <button
        onClick={() => setShowMore(!showMore)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-body py-2 transition-colors"
      >
        <ChevronDown className={`h-3 w-3 transition-transform ${showMore ? 'rotate-0' : '-rotate-90'}`} />
        {showMore ? "Menos propriedades" : "Mais propriedades"}
      </button>

      {showMore && (
        <div className="space-y-0 animate-in fade-in-0 slide-in-from-top-2 duration-200">
          {/* Time & scheduling */}
          <div className="border-b border-border/40 pb-1 mb-1">
            {TIME_FIELDS.map((field) => (
              <PropertyRow key={field.key} icon={field.icon} label={field.label}>
                <NotionInput
                  value={budget[field.key] || ""}
                  onChange={(v) => onFieldChange(field.key, field.type === "number" ? (v ? Number(v) : null) : v)}
                  placeholder={field.placeholder}
                  type={field.type || "text"}
                />
              </PropertyRow>
            ))}
          </div>

          {/* Commercial info */}
          <div className="border-b border-border/40 pb-1 mb-1">
            {COMMERCIAL_FIELDS.map((field) => (
              <PropertyRow key={field.key} icon={field.icon} label={field.label}>
                <NotionInput
                  value={budget[field.key] || ""}
                  onChange={(v) => onFieldChange(field.key, v)}
                  placeholder={field.placeholder}
                  type={field.type || "text"}
                />
              </PropertyRow>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}