import { useEffect, useState } from "react";
import { Home, MapPin, Building2, Ruler, ExternalLink, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

interface PropertyData {
  address: string | null;
  address_complement: string | null;
  bairro: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  empreendimento: string | null;
  property_type: string | null;
  metragem: string | null;
  floor_plan_url: string | null;
}

interface Props {
  clientId: string | null | undefined;
  propertyId: string | null | undefined;
}

function joinAddress(addr?: string | null, complement?: string | null) {
  return [addr?.trim(), complement?.trim()].filter(Boolean).join(" — ") || null;
}
function joinCityState(city?: string | null, state?: string | null) {
  return [city?.trim(), state?.trim()].filter(Boolean).join(" / ") || null;
}

function Row({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-1.5 px-1.5 -mx-1.5 rounded-lg hover:bg-muted/30">
      <div className="flex items-center gap-2 w-[172px] shrink-0 pt-0.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
        <span className="text-[13px] text-muted-foreground font-body truncate">{label}</span>
      </div>
      <div className="flex-1 min-w-0 text-sm font-body text-foreground">{value}</div>
    </div>
  );
}

export function LinkedPropertyCard({ clientId, propertyId }: Props) {
  const [data, setData] = useState<PropertyData | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!clientId && !propertyId) {
        setData(null);
        return;
      }
      try {
        if (propertyId) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: prop, error } = await (supabase as any)
            .from("client_properties")
            .select("address, address_complement, bairro, city, state, zip_code, empreendimento, property_type, metragem, floor_plan_url")
            .eq("id", propertyId)
            .maybeSingle();
          if (error) throw error;
          if (!cancelled && prop) {
            setData(prop as PropertyData);
            return;
          }
        }
        if (clientId) {
          const { data: cli, error } = await supabase
            .from("clients")
            .select("property_address, property_address_complement, property_bairro, property_city, property_state, property_zip_code, property_empreendimento, property_type_default, property_metragem, property_floor_plan_url, condominio_default")
            .eq("id", clientId)
            .maybeSingle();
          if (error) throw error;
          if (!cancelled && cli) {
            setData({
              address: cli.property_address,
              address_complement: cli.property_address_complement,
              bairro: cli.property_bairro,
              city: cli.property_city,
              state: cli.property_state,
              zip_code: cli.property_zip_code,
              empreendimento: cli.property_empreendimento ?? cli.condominio_default,
              property_type: cli.property_type_default,
              metragem: cli.property_metragem,
              floor_plan_url: cli.property_floor_plan_url,
            });
          }
        }
      } catch (err) {
        logger.warn("LinkedPropertyCard load failed", err);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [clientId, propertyId]);

  if (!data) return null;

  const hasAny =
    data.address || data.zip_code || data.floor_plan_url ||
    data.empreendimento || data.property_type || data.metragem ||
    data.bairro || data.city;

  if (!hasAny) return null;

  return (
    <div className="rounded-lg border border-border/40 bg-muted/20 p-3 space-y-0">
      <div className="flex items-center justify-between mb-1 px-1.5">
        <span className="text-[10px] font-display font-semibold text-muted-foreground uppercase tracking-[0.08em]">
          Imóvel vinculado (CRM)
        </span>
        <span className="text-[10px] text-muted-foreground/60">somente leitura</span>
      </div>
      <Row icon={Home} label="Endereço do imóvel" value={joinAddress(data.address, data.address_complement)} />
      <Row icon={MapPin} label="Bairro" value={data.bairro} />
      <Row icon={MapPin} label="Cidade / UF" value={joinCityState(data.city, data.state)} />
      <Row icon={MapPin} label="CEP" value={data.zip_code} />
      <Row icon={Building2} label="Empreendimento" value={data.empreendimento} />
      <Row icon={Building2} label="Tipo de imóvel" value={data.property_type} />
      <Row icon={Ruler} label="Metragem" value={data.metragem} />
      {data.floor_plan_url && (
        <a
          href={data.floor_plan_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-xs text-primary hover:underline mt-2 ml-1.5"
        >
          <ImageIcon className="h-3.5 w-3.5" />
          Visualizar planta do imóvel
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}
