import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  useClient,
  useClientStats,
  upsertClientByContact,
  CLIENT_SOURCES,
  CLIENT_STATUSES,
  getEffectiveClientStatus,
} from "@/hooks/useClients";
import { ClientForm } from "@/components/crm/ClientForm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Building2,
  Ruler,
  Tag,
  Pencil,
  ExternalLink,
  Link2,
  Loader2,
  FileText,
  Users as UsersIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface BudgetClientSnapshot {
  id: string;
  client_id: string | null;
  client_name: string | null;
  client_phone: string | null;
  lead_email?: string | null;
  property_type: string | null;
  city: string | null;
  bairro: string | null;
  condominio: string | null;
  unit: string | null;
  metragem: string | null;
}

interface Props {
  budget: BudgetClientSnapshot;
  /** Called after auto-link so the parent can refresh the budget row. */
  onLinked?: (clientId: string) => void;
  /** Slot for "Equipe & Datas" + outras ações que vêm do orçamento. */
  extraSection?: React.ReactNode;
}

/**
 * Painel "Cliente" da demanda — espelha os dados do CRM (tabela clients) e
 * permite edição com o mesmo formulário de /admin/crm/:clientId.
 *
 * Se o orçamento não tiver client_id vinculado, faz upsert por contato
 * (email/telefone) e linka automaticamente, garantindo paridade com o CRM.
 */
export function ClientModulePanel({ budget, onLinked, extraSection }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [linking, setLinking] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const linkAttempted = useRef(false);

  // Auto-link: se não houver client_id, tenta vincular um cliente existente
  // (por email/telefone) ou criar um novo a partir do snapshot do orçamento.
  useEffect(() => {
    if (budget.client_id) return;
    if (linkAttempted.current) return;
    if (!user) return;
    linkAttempted.current = true;

    let cancelled = false;
    (async () => {
      setLinking(true);
      try {
        const name = (budget.client_name || "").trim() || "Cliente sem nome";
        const client = await upsertClientByContact({
          name,
          email: budget.lead_email ?? null,
          phone: budget.client_phone ?? null,
          createdBy: user.id,
          extra: {
            city: budget.city ?? null,
            bairro: budget.bairro ?? null,
            condominio_default: budget.condominio ?? null,
            property_type_default: budget.property_type ?? null,
          },
        });

        const { error } = await supabase
          .from("budgets")
          .update({ client_id: client.id })
          .eq("id", budget.id);
        if (error) throw error;

        if (cancelled) return;
        queryClient.invalidateQueries({ queryKey: ["clients"] });
        onLinked?.(client.id);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Erro desconhecido";
        toast.error(`Não foi possível vincular cliente: ${msg}`);
      } finally {
        if (!cancelled) setLinking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [budget.id, budget.client_id, budget.client_name, budget.client_phone, budget.lead_email, budget.city, budget.bairro, budget.condominio, budget.property_type, user, queryClient, onLinked]);

  const { data: client, isLoading } = useClient(budget.client_id ?? undefined);
  const { data: stats } = useClientStats(budget.client_id ?? undefined);

  // Estado: vinculando ou ainda sem client_id
  if (!budget.client_id || linking) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground font-body">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {linking ? "Vinculando ao CRM…" : "Buscando vínculo no CRM…"}
        </div>
        <SnapshotFallback budget={budget} />
        {extraSection && (
          <>
            <Separator />
            {extraSection}
          </>
        )}
      </div>
    );
  }

  if (isLoading || !client) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  }

  const sCfg = CLIENT_STATUSES[getEffectiveClientStatus(client, stats ?? null)];

  return (
    <div className="space-y-5">
      {/* Header com badge + ações */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-display font-semibold text-foreground truncate">
              {client.name}
            </h3>
            <Badge className={cn("font-normal text-[10px]", sCfg.color)}>{sCfg.label}</Badge>
          </div>
          <p className="text-[11px] text-muted-foreground font-body mt-0.5">
            Sincronizado com o CRM. Edições refletem em todos os orçamentos do cliente.
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => setEditOpen(true)}>
            <Pencil className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Editar</span>
          </Button>
          <Button asChild size="sm" className="h-8 gap-1.5 text-xs">
            <Link to={`/admin/crm/${client.id}`}>
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Abrir no CRM</span>
            </Link>
          </Button>
        </div>
      </div>

      <Separator />

      {/* Contato */}
      <Section title="Contato">
        <InfoRow icon={<User className="h-3.5 w-3.5" />} label="Nome" value={client.name} />
        <InfoRow icon={<Mail className="h-3.5 w-3.5" />} label="E-mail" value={client.email} />
        <InfoRow icon={<Phone className="h-3.5 w-3.5" />} label="Telefone" value={client.phone} />
        <InfoRow
          icon={<FileText className="h-3.5 w-3.5" />}
          label={client.document_type === "cnpj" ? "CNPJ" : "CPF / CNPJ"}
          value={client.document}
        />
      </Section>

      <Separator />

      {/* Imóvel */}
      <Section title="Imóvel">
        <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="Cidade" value={client.city ?? budget.city} />
        <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="Bairro" value={client.bairro ?? budget.bairro} />
        <InfoRow
          icon={<Building2 className="h-3.5 w-3.5" />}
          label="Condomínio"
          value={client.condominio_default ?? budget.condominio}
        />
        <InfoRow
          icon={<Building2 className="h-3.5 w-3.5" />}
          label="Tipo de imóvel"
          value={client.property_type_default ?? budget.property_type}
        />
        {budget.unit && (
          <InfoRow icon={<Building2 className="h-3.5 w-3.5" />} label="Unidade" value={budget.unit} />
        )}
        {budget.metragem && (
          <InfoRow icon={<Ruler className="h-3.5 w-3.5" />} label="Metragem" value={budget.metragem} />
        )}
      </Section>

      {(client.source || client.referrer_name || client.tags.length > 0) && (
        <>
          <Separator />
          <Section title="Relacionamento">
            {client.source && (
              <InfoRow
                icon={<Tag className="h-3.5 w-3.5" />}
                label="Fonte"
                value={CLIENT_SOURCES[client.source] ?? client.source}
              />
            )}
            {client.referrer_name && (
              <InfoRow icon={<UsersIcon className="h-3.5 w-3.5" />} label="Indicado por" value={client.referrer_name} />
            )}
            {client.tags.length > 0 && (
              <div className="flex items-start gap-2">
                <Tag className="h-3.5 w-3.5 text-muted-foreground/60 mt-1 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-body">Tags</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {client.tags.map((t) => (
                      <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </Section>
        </>
      )}

      {extraSection && (
        <>
          <Separator />
          {extraSection}
        </>
      )}

      {/* Link discreto na base */}
      <div className="flex items-center gap-1.5 pt-1 text-[11px] text-muted-foreground font-body">
        <Link2 className="h-3 w-3" />
        Vinculado ao CRM · ID {client.id.slice(0, 8)}
      </div>

      <ClientForm open={editOpen} onOpenChange={setEditOpen} initial={client} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider">
        {title}
      </h4>
      {children}
    </div>
  );
}

function InfoRow({
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
    <div className="flex items-start gap-2.5">
      <span className="text-muted-foreground/60 mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-body">{label}</p>
        <p className="text-sm text-foreground font-body mt-0.5 break-words">{value}</p>
      </div>
    </div>
  );
}

/** UI de fallback durante o auto-link inicial. */
function SnapshotFallback({ budget }: { budget: BudgetClientSnapshot }) {
  return (
    <div className="space-y-2 text-sm font-body">
      {budget.client_name && <InfoRow icon={<User className="h-3.5 w-3.5" />} label="Nome" value={budget.client_name} />}
      {budget.client_phone && <InfoRow icon={<Phone className="h-3.5 w-3.5" />} label="Telefone" value={budget.client_phone} />}
      {budget.city && <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="Cidade" value={budget.city} />}
      {budget.bairro && <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="Bairro" value={budget.bairro} />}
    </div>
  );
}
