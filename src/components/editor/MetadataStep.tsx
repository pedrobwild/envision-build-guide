import { useState } from "react";
import {
  Calendar, MapPin, User, Building, Ruler, Mail, UserCheck, Hash, Timer, Clock,
  ShoppingBag, ExternalLink, ChevronDown, Phone, Home, Globe, FileText, StickyNote,
  Link as LinkIcon, Plus, X, Flag, Layers,
} from "lucide-react";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LOCATION_TYPES } from "@/lib/role-constants";

interface MetadataStepProps {
  budget: BudgetRow;
  onFieldChange: (field: string, value: string | number | boolean | string[] | null) => void;
}

/* ── Notion-like property row ── */
function PropertyRow({
  icon: Icon,
  label,
  children,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-1.5 group/row rounded-lg hover:bg-muted/30 px-1.5 -mx-1.5 transition-colors">
      <div className="flex items-center gap-2 w-[172px] shrink-0 pt-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 group-hover/row:text-muted-foreground/80 transition-colors" />
        <span className="text-[13px] text-muted-foreground font-body truncate">{label}</span>
      </div>
      <div className="flex-1 min-w-0">
        {children}
        {hint && (
          <p className="text-[11px] text-muted-foreground/50 font-body mt-0.5 ml-0.5">{hint}</p>
        )}
      </div>
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
      className={cn(
        "w-full px-2.5 py-1.5 rounded-md border border-transparent hover:border-border focus:border-primary/40 bg-transparent text-sm font-body text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all",
        className
      )}
      style={type === "number" ? { fontVariantNumeric: "tabular-nums" } : undefined}
    />
  );
}

/* ── Section header ── */
function SectionHeader({ icon: Icon, title }: { icon: React.ComponentType<{ className?: string }>; title: string }) {
  return (
    <div className="flex items-center gap-2 pt-5 pb-2 first:pt-0">
      <div className="h-5 w-5 rounded-md bg-primary/8 flex items-center justify-center">
        <Icon className="h-3 w-3 text-primary" />
      </div>
      <span className="text-[11px] font-display font-semibold text-muted-foreground uppercase tracking-[0.08em]">{title}</span>
      <div className="flex-1 h-px bg-border/30 ml-1" />
    </div>
  );
}

const PRIORITY_STYLES: Record<string, string> = {
  alta: "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400",
  media: "border-warning/30 bg-warning/5 text-warning",
  normal: "border-border bg-muted/40 text-muted-foreground",
  baixa: "border-border bg-muted/30 text-muted-foreground/70",
};

export function MetadataStep({ budget, onFieldChange }: MetadataStepProps) {
  const { members: comerciais } = useTeamMembers("comercial");
  const { members: orcamentistas } = useTeamMembers("orcamentista");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Reference links helper
  const links: string[] = Array.isArray(budget.reference_links) ? budget.reference_links : [];
  const addLink = () => onFieldChange("reference_links", [...links, ""]);
  const removeLink = (i: number) => onFieldChange("reference_links", links.filter((_, idx) => idx !== i));
  const updateLink = (i: number, val: string) =>
    onFieldChange("reference_links", links.map((l, idx) => (idx === i ? val : l)));

  return (
    <div className="max-w-3xl space-y-0">

      {/* ═══ CLIENTE & CONTATO ═══ */}
      <SectionHeader icon={User} title="Cliente & Contato" />
      <div className="space-y-0">
        <PropertyRow icon={User} label="Cliente">
          <NotionInput
            value={budget.client_name || ""}
            onChange={(v) => onFieldChange("client_name", v)}
            placeholder="Nome do cliente"
          />
        </PropertyRow>
        <PropertyRow icon={Phone} label="Telefone">
          <NotionInput
            value={budget.client_phone || ""}
            onChange={(v) => onFieldChange("client_phone", v)}
            placeholder="(11) 99999-9999"
            type="tel"
          />
        </PropertyRow>
        <PropertyRow icon={Mail} label="E-mail do lead">
          <NotionInput
            value={budget.lead_email || ""}
            onChange={(v) => onFieldChange("lead_email", v)}
            placeholder="email@exemplo.com"
            type="email"
          />
        </PropertyRow>
      </div>

      {/* ═══ IMÓVEL & LOCALIZAÇÃO ═══ */}
      <SectionHeader icon={Building} title="Imóvel & Localização" />
      <div className="space-y-0">
        <PropertyRow icon={Building} label="Condomínio">
          <NotionInput
            value={budget.condominio || ""}
            onChange={(v) => onFieldChange("condominio", v)}
            placeholder="Nome do condomínio"
          />
        </PropertyRow>
        <PropertyRow icon={MapPin} label="Bairro">
          <NotionInput
            value={budget.bairro || ""}
            onChange={(v) => onFieldChange("bairro", v)}
            placeholder="Bairro"
          />
        </PropertyRow>
        <PropertyRow icon={Globe} label="Cidade">
          <NotionInput
            value={budget.city || ""}
            onChange={(v) => onFieldChange("city", v)}
            placeholder="São Paulo"
          />
        </PropertyRow>
        <PropertyRow icon={Home} label="Tipo de imóvel">
          <NotionInput
            value={budget.property_type || ""}
            onChange={(v) => onFieldChange("property_type", v)}
            placeholder="Ex: Apartamento"
          />
        </PropertyRow>
        <PropertyRow icon={Layers} label="Tipo de local">
          <Select
            value={budget.location_type || ""}
            onValueChange={(v) => onFieldChange("location_type", v || null)}
          >
            <SelectTrigger className="border-transparent hover:border-border shadow-none h-auto py-1.5 px-2.5 text-sm font-body bg-transparent focus:ring-1 focus:ring-primary/20">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(LOCATION_TYPES).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PropertyRow>
        <PropertyRow icon={Ruler} label="Metragem">
          <NotionInput
            value={budget.metragem || ""}
            onChange={(v) => onFieldChange("metragem", v)}
            placeholder="Ex: 120m²"
          />
        </PropertyRow>
        <PropertyRow icon={Hash} label="Unidade">
          <NotionInput
            value={budget.unit || ""}
            onChange={(v) => onFieldChange("unit", v)}
            placeholder="Ex: Apto 121"
          />
        </PropertyRow>
      </div>

      {/* ═══ RESPONSÁVEIS ═══ */}
      <SectionHeader icon={UserCheck} title="Responsáveis" />
      <div className="space-y-0">
        <PropertyRow icon={UserCheck} label="Comercial">
          <Select
            value={budget.commercial_owner_id || ""}
            onValueChange={(v) => onFieldChange("commercial_owner_id", v || null)}
          >
            <SelectTrigger className="border-transparent hover:border-border shadow-none h-auto py-1.5 px-2.5 text-sm font-body bg-transparent focus:ring-1 focus:ring-primary/20">
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
            <SelectTrigger className="border-transparent hover:border-border shadow-none h-auto py-1.5 px-2.5 text-sm font-body bg-transparent focus:ring-1 focus:ring-primary/20">
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

      {/* ═══ CONTEXTO DA DEMANDA ═══ */}
      <SectionHeader icon={FileText} title="Contexto da Demanda" />
      <div className="space-y-0">
        <PropertyRow icon={Flag} label="Prioridade">
          <Select
            value={budget.priority || "normal"}
            onValueChange={(v) => onFieldChange("priority", v)}
          >
            <SelectTrigger className="border-transparent hover:border-border shadow-none h-auto py-1.5 px-2.5 text-sm font-body bg-transparent focus:ring-1 focus:ring-primary/20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alta">🔴 Alta</SelectItem>
              <SelectItem value="media">🟡 Média</SelectItem>
              <SelectItem value="normal">🟢 Normal</SelectItem>
              <SelectItem value="baixa">⚪ Baixa</SelectItem>
            </SelectContent>
          </Select>
        </PropertyRow>

        <PropertyRow icon={FileText} label="Contexto / Briefing" hint="Informações do comercial sobre a demanda">
          <Textarea
            value={budget.demand_context || ""}
            onChange={(e) => onFieldChange("demand_context", e.target.value)}
            placeholder="Descreva o contexto da demanda, necessidades do cliente, observações importantes..."
            className="text-sm min-h-[80px] resize-y border-transparent hover:border-border focus:border-primary/40 bg-transparent focus:ring-1 focus:ring-primary/20"
          />
        </PropertyRow>

        <PropertyRow icon={StickyNote} label="Instruções comerciais" hint="Orientações específicas para o orçamentista">
          <Textarea
            value={budget.briefing || ""}
            onChange={(e) => onFieldChange("briefing", e.target.value)}
            placeholder="Instruções do comercial para elaboração do orçamento..."
            className="text-sm min-h-[60px] resize-y border-transparent hover:border-border focus:border-primary/40 bg-transparent focus:ring-1 focus:ring-primary/20"
          />
        </PropertyRow>

        <PropertyRow icon={StickyNote} label="Notas internas" hint="Anotações do orçamentista">
          <Textarea
            value={budget.internal_notes || ""}
            onChange={(e) => onFieldChange("internal_notes", e.target.value)}
            placeholder="Anotações internas sobre o orçamento..."
            className="text-sm min-h-[60px] resize-y border-transparent hover:border-border focus:border-primary/40 bg-transparent focus:ring-1 focus:ring-primary/20"
          />
        </PropertyRow>
      </div>

      {/* ═══ LINKS & REFERÊNCIAS ═══ */}
      <SectionHeader icon={LinkIcon} title="Links & Referências" />
      <div className="space-y-0">
        <PropertyRow icon={ExternalLink} label="Negócio HubSpot">
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

        <div className="py-1.5 px-1.5 -mx-1.5">
          <div className="flex items-center gap-2 mb-2">
            <LinkIcon className="h-3.5 w-3.5 text-muted-foreground/50" />
            <span className="text-[13px] text-muted-foreground font-body">Links de referência</span>
          </div>
          <div className="space-y-1.5 ml-[28px]">
            {links.map((link, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input
                  type="url"
                  value={link}
                  onChange={(e) => updateLink(i, e.target.value)}
                  placeholder="https://..."
                  className="flex-1 px-2.5 py-1.5 rounded-md border border-transparent hover:border-border focus:border-primary/40 bg-transparent text-sm font-body text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all"
                />
                {link && (
                  <a href={link} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-primary transition-colors">
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                <button onClick={() => removeLink(i)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive transition-colors">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <button
              onClick={addLink}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary font-body py-1 transition-colors"
            >
              <Plus className="h-3 w-3" /> Adicionar link
            </button>
          </div>
        </div>
      </div>

      {/* ═══ CONFIGURAÇÃO AVANÇADA ═══ */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-body py-3 transition-colors"
      >
        <ChevronDown className={cn("h-3 w-3 transition-transform", showAdvanced ? "rotate-0" : "-rotate-90")} />
        {showAdvanced ? "Menos configurações" : "Configurações avançadas"}
      </button>

      {showAdvanced && (
        <div className="space-y-0 animate-in fade-in-0 slide-in-from-top-2 duration-200">
          <SectionHeader icon={Calendar} title="Prazos & Datas" />
          <div className="space-y-0">
            <PropertyRow icon={Calendar} label="Data de elaboração">
              <NotionInput
                value={budget.date || ""}
                onChange={(v) => onFieldChange("date", v)}
                placeholder="AAAA-MM-DD"
                type="date"
              />
            </PropertyRow>
            <PropertyRow icon={Calendar} label="Prazo de entrega">
              <NotionInput
                value={budget.due_at ? new Date(budget.due_at).toISOString().slice(0, 10) : ""}
                onChange={(v) => onFieldChange("due_at", v || null)}
                placeholder="AAAA-MM-DD"
                type="date"
              />
            </PropertyRow>
            <PropertyRow icon={Hash} label="Versão">
              <NotionInput
                value={budget.versao || ""}
                onChange={(v) => onFieldChange("versao", v)}
                placeholder="Ex: 1.0"
              />
            </PropertyRow>
            <PropertyRow icon={Timer} label="Validade (dias)">
              <NotionInput
                value={budget.validity_days?.toString() || ""}
                onChange={(v) => onFieldChange("validity_days", v ? Number(v) : null)}
                placeholder="30"
                type="number"
              />
            </PropertyRow>
            <PropertyRow icon={Clock} label="Prazo execução (dias)">
              <NotionInput
                value={budget.prazo_dias_uteis?.toString() || ""}
                onChange={(v) => onFieldChange("prazo_dias_uteis", v ? Number(v) : null)}
                placeholder="55"
                type="number"
              />
            </PropertyRow>
            <PropertyRow icon={Timer} label="Prazo (semanas)">
              <NotionInput
                value={budget.estimated_weeks?.toString() || ""}
                onChange={(v) => onFieldChange("estimated_weeks", v ? Number(v) : null)}
                placeholder="8"
                type="number"
              />
            </PropertyRow>
          </div>

          <SectionHeader icon={UserCheck} title="Dados Comerciais" />
          <div className="space-y-0">
            <PropertyRow icon={UserCheck} label="Consultora Comercial">
              <NotionInput
                value={budget.consultora_comercial || ""}
                onChange={(v) => onFieldChange("consultora_comercial", v)}
                placeholder="Nome da vendedora"
              />
            </PropertyRow>
            <PropertyRow icon={Mail} label="E-mail Comercial">
              <NotionInput
                value={budget.email_comercial || ""}
                onChange={(v) => onFieldChange("email_comercial", v)}
                placeholder="email@exemplo.com"
                type="email"
              />
            </PropertyRow>
            <PropertyRow icon={Hash} label="Código sequencial">
              <NotionInput
                value={budget.sequential_code || ""}
                onChange={(v) => onFieldChange("sequential_code", v)}
                placeholder="ORC-0001"
              />
            </PropertyRow>
          </div>

          <SectionHeader icon={ShoppingBag} title="Exibição" />
          <div className="space-y-0">
            <PropertyRow icon={ShoppingBag} label="Incluir opcionais">
              <button
                onClick={() => onFieldChange("show_optional_items", !budget.show_optional_items)}
                className="flex items-center gap-2 py-1.5 px-2.5 text-sm font-body text-foreground"
              >
                <div className={cn("relative w-8 h-[18px] rounded-full transition-colors", budget.show_optional_items ? "bg-primary" : "bg-muted-foreground/30")}>
                  <span className={cn("absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-transform", budget.show_optional_items && "translate-x-[14px]")} />
                </div>
                <span className="text-muted-foreground text-xs">
                  {budget.show_optional_items ? "Ativado" : "Desativado"}
                </span>
              </button>
            </PropertyRow>
          </div>
        </div>
      )}
    </div>
  );
}