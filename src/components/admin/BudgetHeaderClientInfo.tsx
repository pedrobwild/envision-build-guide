import { useState } from "react";
import { useClient } from "@/hooks/useClients";
import { useClientProperties } from "@/hooks/useClientProperties";
import { ChevronDown, User, Mail, Phone, MapPin, Building2, Ruler, Home, Tag, Image as ImageIcon, ExternalLink, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Props {
  clientId: string | null;
  /** Property id vinculado ao orçamento, quando houver. */
  propertyId?: string | null;
  /** Snapshot do orçamento — usado como fallback caso o CRM não tenha o dado. */
  fallback: {
    client_name?: string | null;
    client_phone?: string | null;
    lead_email?: string | null;
    bairro?: string | null;
    city?: string | null;
    condominio?: string | null;
    metragem?: string | null;
    property_type?: string | null;
    unit?: string | null;
    lead_source?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  };
  createdByName?: string | null;
  commercialOwnerName?: string | null;
  estimatorOwnerName?: string | null;
}

/**
 * Resumo do cliente, imóvel, relacionamento e equipe — exibido no cabeçalho do
 * negócio. Mantém paridade com o painel "Cliente" (ClientModulePanel) usando
 * os mesmos hooks (useClient + useClientProperties), mas em formato compacto
 * e colapsável para não poluir o topo da página.
 */
export function BudgetHeaderClientInfo({
  clientId,
  propertyId,
  fallback,
  createdByName,
  commercialOwnerName,
  estimatorOwnerName,
}: Props) {
  const [open, setOpen] = useState(false);
  const { data: client } = useClient(clientId ?? undefined);
  const { data: properties } = useClientProperties(clientId ?? undefined);

  const property =
    (propertyId && properties?.find((p) => p.id === propertyId)) ||
    properties?.find((p) => p.is_primary) ||
    properties?.[0] ||
    null;

  const c = client;
  const propertyAddress = property?.address || c?.property_address || null;
  const propertyAddressComplement = property?.address_complement || c?.property_address_complement || null;
  const propertyBairro = property?.bairro || c?.property_bairro || fallback.bairro || null;
  const propertyCity = property?.city || c?.property_city || c?.city || fallback.city || null;
  const propertyState = property?.state || c?.property_state || null;
  const propertyZip = property?.zip_code || c?.property_zip_code || null;
  const propertyEmpreendimento = property?.empreendimento || c?.property_empreendimento || c?.condominio_default || fallback.condominio || null;
  const propertyType = property?.property_type || c?.property_type_default || fallback.property_type || null;
  const propertyMetragem = property?.metragem || c?.property_metragem || fallback.metragem || null;
  const propertyFloorPlan = property?.floor_plan_url || c?.property_floor_plan_url || null;

  const fullAddress = [propertyAddress, propertyAddressComplement].filter(Boolean).join(" — ") || null;
  const cityState = [propertyCity, propertyState].filter(Boolean).join(" / ") || null;

  return (
    <div className="mt-4 rounded-lg border border-border/60 bg-muted/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left hover:bg-muted/30 transition-colors rounded-lg"
        aria-expanded={open}
      >
        <span className="text-[11px] uppercase tracking-wider font-display font-semibold text-muted-foreground">
          Detalhes do cliente, imóvel e equipe
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground shrink-0 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="px-3.5 pb-4 pt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 divide-y divide-border/50 sm:divide-y-0 [&>*]:pt-4 sm:[&>*]:pt-0 first:[&>*]:pt-0">
          {/* Contato */}
          <Section title="Contato">
            <Row icon={<User className="h-3.5 w-3.5" />} label="Nome" value={c?.name || fallback.client_name} />
            <Row icon={<Mail className="h-3.5 w-3.5" />} label="E-mail" value={c?.email || fallback.lead_email} />
            <Row icon={<Phone className="h-3.5 w-3.5" />} label="Telefone" value={c?.phone || fallback.client_phone} />
          </Section>

          {/* Imóvel */}
          <Section title="Imóvel">
            <Row icon={<Home className="h-3.5 w-3.5" />} label="Endereço" value={fullAddress} />
            <Row icon={<MapPin className="h-3.5 w-3.5" />} label="Bairro" value={propertyBairro} />
            <Row icon={<MapPin className="h-3.5 w-3.5" />} label="Cidade / UF" value={cityState} />
            <Row icon={<MapPin className="h-3.5 w-3.5" />} label="CEP" value={propertyZip} />
            <Row icon={<Building2 className="h-3.5 w-3.5" />} label="Empreendimento" value={propertyEmpreendimento} />
            <Row icon={<Building2 className="h-3.5 w-3.5" />} label="Tipo de imóvel" value={propertyType} />
            {fallback.unit && <Row icon={<Building2 className="h-3.5 w-3.5" />} label="Unidade" value={fallback.unit} />}
            <Row icon={<Ruler className="h-3.5 w-3.5" />} label="Metragem" value={propertyMetragem} />
            {propertyFloorPlan && (
              <a
                href={propertyFloorPlan}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline mt-1"
              >
                <ImageIcon className="h-3.5 w-3.5" />
                Visualizar planta
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </Section>

          {/* Relacionamento + Equipe & Datas */}
          <Section title="Relacionamento e equipe">
            <Row icon={<Tag className="h-3.5 w-3.5" />} label="Fonte" value={c?.source || fallback.lead_source} />
            <Row icon={<User className="h-3.5 w-3.5" />} label="Comercial" value={commercialOwnerName} />
            <Row icon={<User className="h-3.5 w-3.5" />} label="Orçamentista" value={estimatorOwnerName} />
            <Row icon={<User className="h-3.5 w-3.5" />} label="Criado por" value={createdByName} />
            <Row
              icon={<Calendar className="h-3.5 w-3.5" />}
              label="Criado"
              value={fallback.created_at ? format(new Date(fallback.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : null}
            />
            <Row
              icon={<Calendar className="h-3.5 w-3.5" />}
              label="Atualizado"
              value={fallback.updated_at ? format(new Date(fallback.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : null}
            />
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="text-[10px] font-display font-semibold text-muted-foreground uppercase tracking-wider">
        {title}
      </h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode | null | undefined;
}) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground/60 mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-body">{label}</p>
        <p className="text-[13px] text-foreground font-body mt-0.5 break-words leading-snug">{value}</p>
      </div>
    </div>
  );
}
