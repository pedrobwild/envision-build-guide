import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Pencil,
  Plus,
  ExternalLink,
  User,
  Building2,
  Tag,
  TrendingUp,
  DollarSign,
  FileText,
  CheckCircle2,
  XCircle,
  Users as UsersIcon,
  Loader2,
  X,
  FileSpreadsheet,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CLIENT_SOURCES,
  CLIENT_STATUSES,
  getEffectiveClientStatus,
  useClient,
  useClientBudgets,
  useClientStats,
  useUpsertClient,
  type Client,
  type ClientStatus,
} from "@/hooks/useClients";
import { useClientProperties, summarizeProperty } from "@/hooks/useClientProperties";
import { ClientPropertiesManager } from "@/components/crm/ClientPropertiesManager";
import { ClientTimeline } from "@/components/crm/ClientTimeline";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { INTERNAL_STATUSES, LOCATION_TYPES } from "@/lib/role-constants";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function formatBRL(value: number | null | undefined) {
  if (!value) return "R$ 0";
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

const MARITAL_STATUSES = [
  "Solteiro(a)",
  "Casado(a)",
  "União estável",
  "Divorciado(a)",
  "Viúvo(a)",
  "Separado(a)",
];

const BR_STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

// (PROPERTY_TYPES movido para ClientPropertiesManager — agora gerenciado por imóvel)

type Draft = {
  name: string;
  nationality: string;
  marital_status: string;
  profession: string;
  document: string;
  document_type: string;
  rg: string;
  email: string;
  phone: string;
  address: string;
  address_complement: string;
  bairro: string;
  city: string;
  state: string;
  zip_code: string;
  property_address: string;
  property_address_complement: string;
  property_bairro: string;
  property_city: string;
  property_state: string;
  property_zip_code: string;
  property_metragem: string;
  property_empreendimento: string;
  property_type_default: string;
  location_type_default: string;
  property_floor_plan_url: string;
  source: string;
  referrer_name: string;
  commercial_owner_id: string;
  notes: string;
  tags: string[];
};

function buildDraft(client: Client): Draft {
  return {
    name: client.name ?? "",
    nationality: client.nationality ?? "",
    marital_status: client.marital_status ?? "",
    profession: client.profession ?? "",
    document: client.document ?? "",
    document_type: client.document_type ?? "",
    rg: client.rg ?? "",
    email: client.email ?? "",
    phone: client.phone ?? "",
    address: client.address ?? "",
    address_complement: client.address_complement ?? "",
    bairro: client.bairro ?? "",
    city: client.city ?? "",
    state: client.state ?? "",
    zip_code: client.zip_code ?? "",
    property_address: client.property_address ?? "",
    property_address_complement: client.property_address_complement ?? "",
    property_bairro: client.property_bairro ?? "",
    property_city: client.property_city ?? "",
    property_state: client.property_state ?? "",
    property_zip_code: client.property_zip_code ?? "",
    property_metragem: client.property_metragem ?? "",
    property_empreendimento: client.property_empreendimento ?? client.condominio_default ?? "",
    property_type_default: client.property_type_default ?? "",
    location_type_default: client.location_type_default ?? "",
    property_floor_plan_url: client.property_floor_plan_url ?? "",
    source: client.source ?? "",
    referrer_name: client.referrer_name ?? "",
    commercial_owner_id: client.commercial_owner_id ?? "",
    notes: client.notes ?? "",
    tags: client.tags ?? [],
  };
}

export default function ClientDetail() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();

  const { data: client, isLoading } = useClient(clientId);
  const { data: stats } = useClientStats(clientId);
  const { data: budgets = [] } = useClientBudgets(clientId);
  const { data: properties = [] } = useClientProperties(clientId);
  const { members: comerciais } = useTeamMembers("comercial");
  const upsert = useUpsertClient();

  // Mapa: property_id -> property (para enriquecer aba de orçamentos)
  const propertyMap = useMemo(() => {
    const m = new Map<string, typeof properties[number]>();
    for (const p of properties) m.set(p.id, p);
    return m;
  }, [properties]);

  // Contagem de orçamentos por imóvel (para card de imóveis)
  const budgetCountByProperty = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of budgets) {
      const pid = (b as { property_id?: string | null }).property_id;
      if (pid) counts[pid] = (counts[pid] ?? 0) + 1;
    }
    return counts;
  }, [budgets]);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [tagInput, setTagInput] = useState("");

  // Inicializa draft quando entra em modo edição (ou cliente recarrega)
  useEffect(() => {
    if (editing && client && !draft) {
      setDraft(buildDraft(client));
    }
    if (!editing) {
      setDraft(null);
      setTagInput("");
    }
  }, [editing, client, draft]);

  const ownerName = useMemo(() => {
    if (!client?.commercial_owner_id) return null;
    return comerciais.find((m) => m.id === client.commercial_owner_id)?.full_name ?? null;
  }, [client?.commercial_owner_id, comerciais]);

  const conversionRate = useMemo(() => {
    const total = stats?.total_budgets ?? 0;
    const won = stats?.won_budgets ?? 0;
    if (total === 0) return 0;
    return Math.round((won / total) * 100);
  }, [stats]);

  function patch<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function addTag() {
    const v = tagInput.trim();
    if (!v || !draft) return;
    if (!draft.tags.includes(v)) {
      patch("tags", [...draft.tags, v]);
    }
    setTagInput("");
  }

  function removeTag(t: string) {
    if (!draft) return;
    patch("tags", draft.tags.filter((x) => x !== t));
  }

  // (handleUploadPlan removido — gestão de planta agora vive em ClientPropertiesManager por imóvel)

  async function handleSave() {
    if (!draft || !client) return;
    if (!draft.name.trim()) {
      toast.error("O nome do cliente é obrigatório.");
      return;
    }
    const payload = {
      id: client.id,
      name: draft.name.trim(),
      nationality: draft.nationality.trim() || null,
      marital_status: draft.marital_status || null,
      profession: draft.profession.trim() || null,
      document: draft.document.trim() || null,
      document_type: draft.document_type || null,
      rg: draft.rg.trim() || null,
      email: draft.email.trim() || null,
      phone: draft.phone.trim() || null,
      address: draft.address.trim() || null,
      address_complement: draft.address_complement.trim() || null,
      bairro: draft.bairro.trim() || null,
      city: draft.city.trim() || null,
      state: draft.state || null,
      zip_code: draft.zip_code.trim() || null,
      property_address: draft.property_address.trim() || null,
      property_address_complement: draft.property_address_complement.trim() || null,
      property_bairro: draft.property_bairro.trim() || null,
      property_city: draft.property_city.trim() || null,
      property_state: draft.property_state || null,
      property_zip_code: draft.property_zip_code.trim() || null,
      property_metragem: draft.property_metragem.trim() || null,
      property_empreendimento: draft.property_empreendimento.trim() || null,
      condominio_default: draft.property_empreendimento.trim() || null,
      property_type_default: draft.property_type_default || null,
      location_type_default: draft.location_type_default || null,
      property_floor_plan_url: draft.property_floor_plan_url || null,
      source: draft.source || null,
      referrer_name: draft.referrer_name.trim() || null,
      commercial_owner_id: draft.commercial_owner_id || null,
      notes: draft.notes.trim() || null,
      tags: draft.tags,
    };
    try {
      await upsert.mutateAsync(payload as Parameters<typeof upsert.mutateAsync>[0]);
      setEditing(false);
    } catch {
      /* hook já mostra toast */
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 max-w-[1200px] mx-auto">
        <p className="text-sm text-muted-foreground">Carregando cliente…</p>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-6 max-w-[1200px] mx-auto">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/crm")} className="gap-1.5">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para clientes
        </Button>
        <div className="mt-8 text-center">
          <XCircle className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Cliente não encontrado.</p>
        </div>
      </div>
    );
  }

  const sCfg = CLIENT_STATUSES[getEffectiveClientStatus(client, stats ?? null)];

  return (
    <div className="p-3 sm:p-6 max-w-[1200px] mx-auto space-y-4 sm:space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/admin/crm")} className="gap-1.5 h-9">
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar para clientes
      </Button>

      <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:justify-between gap-3 sm:gap-4">
        <div className="flex items-start gap-3 sm:gap-4 min-w-0 w-full sm:w-auto">
          <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <User className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              {client.sequential_code && (
                <span className="font-mono text-xs tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  {client.sequential_code}
                </span>
              )}
              <h1 className="text-lg sm:text-2xl font-display font-bold tracking-tight break-words">{client.name}</h1>
              <Badge className={cn("font-normal", sCfg.color)}>{sCfg.label}</Badge>
              {editing && (
                <Badge variant="outline" className="font-normal border-primary/40 text-primary">
                  Editando
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-muted-foreground font-body">
              {client.email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" />
                  {client.email}
                </span>
              )}
              {client.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" />
                  {client.phone}
                </span>
              )}
              {(client.city || client.bairro) && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {[client.city, client.bairro].filter(Boolean).join(" · ")}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(false)}
                disabled={upsert.isPending}
              >
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={upsert.isPending} className="gap-1.5">
                {upsert.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Salvar alterações
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1.5">
                <Pencil className="h-3.5 w-3.5" /> Editar
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  const params = new URLSearchParams({
                    client_id: client.id,
                    name: client.name,
                    ...(client.email ? { email: client.email } : {}),
                    ...(client.phone ? { phone: client.phone } : {}),
                  });
                  navigate(`/admin/solicitacoes/nova?${params.toString()}`);
                }}
              >
                <Plus className="h-3.5 w-3.5" /> Novo orçamento
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard
          icon={FileText}
          label="Orçamentos"
          value={(stats?.total_budgets ?? 0).toString()}
          hint={`${stats?.active_budgets ?? 0} ativos`}
        />
        <KpiCard
          icon={TrendingUp}
          label="Pipeline"
          value={formatBRL(stats?.pipeline_value)}
          hint="Orçamentos em aberto"
        />
        <KpiCard
          icon={DollarSign}
          label="Fechado"
          value={formatBRL(stats?.total_won_value)}
          hint={`${stats?.won_budgets ?? 0} contratos`}
          accent="success"
        />
        <KpiCard
          icon={Building2}
          label="Ticket médio"
          value={formatBRL(stats?.avg_ticket)}
          hint="Média dos fechados"
        />
        <KpiCard
          icon={CheckCircle2}
          label="Conversão"
          value={`${conversionRate}%`}
          hint={`${stats?.won_budgets ?? 0}/${stats?.total_budgets ?? 0}`}
        />
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="timeline">Atividades</TabsTrigger>
          <TabsTrigger value="properties">Imóveis ({properties.length})</TabsTrigger>
          <TabsTrigger value="budgets">Orçamentos ({budgets.length})</TabsTrigger>
          <TabsTrigger value="notes">Notas</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* === DADOS DO CLIENTE === */}
            <Card className="p-5">
              <h3 className="text-xs font-display font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Dados do cliente
              </h3>
              {editing && draft ? (
                <div className="space-y-3">
                  <EditField label="Nome completo" required>
                    <Input value={draft.name} onChange={(e) => patch("name", e.target.value)} maxLength={255} />
                  </EditField>
                  <EditField label="Nacionalidade">
                    <Input value={draft.nationality} onChange={(e) => patch("nationality", e.target.value)} maxLength={100} />
                  </EditField>
                  <EditField label="Estado civil">
                    <Select
                      value={draft.marital_status || "none"}
                      onValueChange={(v) => patch("marital_status", v === "none" ? "" : v)}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {MARITAL_STATUSES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </EditField>
                  <EditField label="Profissão">
                    <Input value={draft.profession} onChange={(e) => patch("profession", e.target.value)} maxLength={120} />
                  </EditField>
                  <div className="grid grid-cols-2 gap-3">
                    <EditField label="CPF / CNPJ">
                      <Input value={draft.document} onChange={(e) => patch("document", e.target.value)} maxLength={20} />
                    </EditField>
                    <EditField label="Tipo de documento">
                      <Select
                        value={draft.document_type || "none"}
                        onValueChange={(v) => patch("document_type", v === "none" ? "" : v)}
                      >
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">—</SelectItem>
                          <SelectItem value="cpf">CPF</SelectItem>
                          <SelectItem value="cnpj">CNPJ</SelectItem>
                        </SelectContent>
                      </Select>
                    </EditField>
                  </div>
                  <EditField label="RG">
                    <Input value={draft.rg} onChange={(e) => patch("rg", e.target.value)} maxLength={30} />
                  </EditField>
                  <EditField label="E-mail">
                    <Input type="email" value={draft.email} onChange={(e) => patch("email", e.target.value)} maxLength={255} />
                  </EditField>
                  <EditField label="Telefone">
                    <Input value={draft.phone} onChange={(e) => patch("phone", e.target.value)} maxLength={20} />
                  </EditField>
                </div>
              ) : (
                <dl className="space-y-2.5 text-sm">
                  <InfoRow icon={User} label="Nome completo" value={client.name} />
                  <InfoRow icon={User} label="Nacionalidade" value={client.nationality} />
                  <InfoRow icon={User} label="Estado civil" value={client.marital_status} />
                  <InfoRow icon={User} label="Profissão" value={client.profession} />
                  <InfoRow
                    icon={FileText}
                    label={client.document_type === "cnpj" ? "CNPJ" : "CPF / CNPJ"}
                    value={client.document}
                  />
                  <InfoRow icon={FileText} label="RG" value={client.rg} />
                  <InfoRow icon={Mail} label="E-mail" value={client.email} />
                  <InfoRow icon={Phone} label="Telefone" value={client.phone} />
                </dl>
              )}
            </Card>

            {/* === ENDEREÇO RESIDENCIAL === */}
            <Card className="p-5">
              <h3 className="text-xs font-display font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Endereço residencial
              </h3>
              {editing && draft ? (
                <div className="space-y-3">
                  <EditField label="Endereço">
                    <Input value={draft.address} onChange={(e) => patch("address", e.target.value)} placeholder="Rua, número" />
                  </EditField>
                  <EditField label="Complemento">
                    <Input value={draft.address_complement} onChange={(e) => patch("address_complement", e.target.value)} placeholder="Apto, bloco..." />
                  </EditField>
                  <div className="grid grid-cols-2 gap-3">
                    <EditField label="Bairro">
                      <Input value={draft.bairro} onChange={(e) => patch("bairro", e.target.value)} />
                    </EditField>
                    <EditField label="Cidade">
                      <Input value={draft.city} onChange={(e) => patch("city", e.target.value)} />
                    </EditField>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <EditField label="Estado">
                      <Select value={draft.state || "none"} onValueChange={(v) => patch("state", v === "none" ? "" : v)}>
                        <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">—</SelectItem>
                          {BR_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </EditField>
                    <EditField label="CEP">
                      <Input value={draft.zip_code} onChange={(e) => patch("zip_code", e.target.value)} maxLength={10} />
                    </EditField>
                  </div>
                </div>
              ) : (
                <dl className="space-y-2.5 text-sm">
                  <InfoRow icon={MapPin} label="Endereço" value={client.address} />
                  <InfoRow icon={MapPin} label="Complemento" value={client.address_complement} />
                  <InfoRow icon={MapPin} label="Bairro" value={client.bairro} />
                  <InfoRow icon={MapPin} label="Cidade" value={client.city} />
                  <InfoRow icon={MapPin} label="Estado" value={client.state} />
                  <InfoRow icon={MapPin} label="CEP" value={client.zip_code} />
                </dl>
              )}
            </Card>

            {/* Imóveis movidos para a aba "Imóveis" — gerenciados em ClientPropertiesManager */}

            {/* === RELACIONAMENTO === */}
            <Card className="p-5">
              <h3 className="text-xs font-display font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Relacionamento
              </h3>
              {editing && draft ? (
                <div className="space-y-3">
                  <EditField label="Responsável comercial">
                    <Select
                      value={draft.commercial_owner_id || "none"}
                      onValueChange={(v) => patch("commercial_owner_id", v === "none" ? "" : v)}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {comerciais.map((m) => (
                          <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </EditField>
                  <EditField label="Fonte do lead">
                    <Select value={draft.source || "none"} onValueChange={(v) => patch("source", v === "none" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {Object.entries(CLIENT_SOURCES).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </EditField>
                  <EditField label="Indicado por">
                    <Input value={draft.referrer_name} onChange={(e) => patch("referrer_name", e.target.value)} />
                  </EditField>
                </div>
              ) : (
                <dl className="space-y-2.5 text-sm">
                  <InfoRow icon={UsersIcon} label="Responsável comercial" value={ownerName} />
                  <InfoRow
                    icon={Tag}
                    label="Fonte do lead"
                    value={client.source ? CLIENT_SOURCES[client.source] ?? client.source : null}
                  />
                  <InfoRow icon={User} label="Indicado por" value={client.referrer_name} />
                  <InfoRow
                    icon={FileText}
                    label="HubSpot"
                    value={
                      client.hubspot_contact_url ? (
                        <a
                          href={client.hubspot_contact_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          Abrir contato <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : null
                    }
                  />
                </dl>
              )}
            </Card>

            {/* === TAGS === */}
            <Card className="p-5">
              <h3 className="text-xs font-display font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Tags
              </h3>
              {editing && draft ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      placeholder="Ex: VIP, Arquiteto, Reforma"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addTag();
                        }
                      }}
                    />
                    <Button type="button" variant="outline" size="sm" onClick={addTag}>
                      Adicionar
                    </Button>
                  </div>
                  {draft.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {draft.tags.map((t) => (
                        <Badge key={t} variant="secondary" className="gap-1 pr-1">
                          {t}
                          <button
                            type="button"
                            onClick={() => removeTag(t)}
                            className="ml-0.5 rounded-sm hover:bg-muted p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ) : client.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {client.tags.map((t) => (
                    <Badge key={t} variant="secondary">{t}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sem tags.</p>
              )}

              <Separator className="my-4" />

              <h3 className="text-xs font-display font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Criado em
              </h3>
              <p className="text-sm">
                {format(new Date(client.created_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <ClientTimeline clientId={client.id} />
        </TabsContent>

        <TabsContent value="properties" className="mt-4">
          <ClientPropertiesManager clientId={client.id} budgetCountByProperty={budgetCountByProperty} />
        </TabsContent>

        <TabsContent value="budgets" className="mt-4">
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">Código</TableHead>
                  <TableHead>Projeto</TableHead>
                  <TableHead>Imóvel</TableHead>
                  <TableHead>Status interno</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Criado</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {budgets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-sm text-muted-foreground">
                      Este cliente ainda não tem orçamentos.
                    </TableCell>
                  </TableRow>
                ) : (
                  budgets.map((b) => {
                    const st =
                      INTERNAL_STATUSES[
                        b.internal_status as keyof typeof INTERNAL_STATUSES
                      ];
                    const propId = (b as { property_id?: string | null }).property_id;
                    const prop = propId ? propertyMap.get(propId) : null;
                    const propLabel = prop
                      ? summarizeProperty(prop)
                      : [b.condominio, b.bairro, b.metragem].filter(Boolean).join(" · ");
                    return (
                      <TableRow key={b.id}>
                        <TableCell>
                          {b.sequential_code ? (
                            <span className="font-mono text-[11px] tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded">
                              {b.sequential_code}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{b.project_name || "—"}</TableCell>
                        <TableCell>
                          {propLabel ? (
                            <div className="flex items-center gap-1.5">
                              <Building2 className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                              <span className="text-xs text-foreground/80 truncate max-w-[200px]" title={propLabel}>
                                {propLabel}
                              </span>
                              {!prop && propId === undefined && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 font-normal text-muted-foreground/60">
                                  legado
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {st ? (
                            <Badge variant="outline" className={cn("font-normal", st.color)}>
                              {st.icon} {st.label}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {b.internal_status}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatBRL(b.manual_total)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {b.created_at
                            ? format(new Date(b.created_at), "dd MMM yy", { locale: ptBR })
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Button asChild variant="ghost" size="icon" className="h-7 w-7">
                            <Link to={`/admin/budget/${b.id}`}>
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <Card className="p-5">
            <h3 className="text-xs font-display font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Observações
            </h3>
            {editing && draft ? (
              <Textarea
                value={draft.notes}
                onChange={(e) => patch("notes", e.target.value)}
                placeholder="Preferências, restrições, histórico de contato..."
                rows={6}
                maxLength={4000}
              />
            ) : client.notes ? (
              <p className="text-sm whitespace-pre-wrap font-body leading-relaxed">{client.notes}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Sem observações. Use o botão "Editar" para adicionar notas sobre o relacionamento,
                preferências ou histórico do cliente.
              </p>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Sticky save bar quando estiver editando (mobile) */}
      {editing && (
        <div className="sticky bottom-3 z-20 sm:hidden">
          <div className="flex items-center gap-2 p-2 rounded-xl bg-background/95 backdrop-blur border border-border shadow-lg">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setEditing(false)}
              disabled={upsert.isPending}
            >
              Cancelar
            </Button>
            <Button size="sm" className="flex-1 gap-1.5" onClick={handleSave} disabled={upsert.isPending}>
              {upsert.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Salvar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode | null | undefined;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="h-3.5 w-3.5 text-muted-foreground/60 mt-1 shrink-0" />
      <div className="min-w-0 flex-1">
        <dt className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</dt>
        <dd className="text-sm mt-0.5">
          {value ? value : <span className="text-muted-foreground/60">—</span>}
        </dd>
      </div>
    </div>
  );
}

function EditField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground uppercase tracking-wide font-body">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  accent?: "success";
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground font-body uppercase tracking-wide">{label}</p>
          <p
            className={cn(
              "text-lg font-display font-bold mt-1 tabular-nums truncate",
              accent === "success" && "text-emerald-700 dark:text-emerald-400",
            )}
          >
            {value}
          </p>
          {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
        </div>
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </div>
    </Card>
  );
}
