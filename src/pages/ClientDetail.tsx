import { useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  type ClientStatus,
} from "@/hooks/useClients";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { INTERNAL_STATUSES } from "@/lib/role-constants";
import { ClientForm } from "@/components/crm/ClientForm";
import { cn } from "@/lib/utils";

function formatBRL(value: number | null | undefined) {
  if (!value) return "R$ 0";
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

export default function ClientDetail() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();

  const { data: client, isLoading } = useClient(clientId);
  const { data: stats } = useClientStats(clientId);
  const { data: budgets = [] } = useClientBudgets(clientId);
  const { members: comerciais } = useTeamMembers("comercial");

  const [editOpen, setEditOpen] = useState(false);

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
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/admin/crm")} className="gap-1.5">
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar para clientes
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <User className="h-7 w-7 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-display font-bold tracking-tight">{client.name}</h1>
              <Badge className={cn("font-normal", sCfg.color)}>{sCfg.label}</Badge>
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
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="gap-1.5">
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
          <TabsTrigger value="budgets">Orçamentos ({budgets.length})</TabsTrigger>
          <TabsTrigger value="notes">Notas</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="p-5">
              <h3 className="text-xs font-display font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Informações de contato
              </h3>
              <dl className="space-y-2.5 text-sm">
                <InfoRow icon={User} label="Nome" value={client.name} />
                <InfoRow icon={Mail} label="E-mail" value={client.email} />
                <InfoRow icon={Phone} label="Telefone" value={client.phone} />
                <InfoRow
                  icon={FileText}
                  label={client.document_type === "cnpj" ? "CNPJ" : "CPF / CNPJ"}
                  value={client.document}
                />
              </dl>
            </Card>

            <Card className="p-5">
              <h3 className="text-xs font-display font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Imóvel padrão
              </h3>
              <dl className="space-y-2.5 text-sm">
                <InfoRow icon={MapPin} label="Cidade" value={client.city} />
                <InfoRow icon={MapPin} label="Bairro" value={client.bairro} />
                <InfoRow
                  icon={Building2}
                  label="Condomínio"
                  value={client.condominio_default}
                />
                <InfoRow
                  icon={Building2}
                  label="Tipo de imóvel"
                  value={client.property_type_default}
                />
                <InfoRow
                  icon={Building2}
                  label="Tipo de locação"
                  value={client.location_type_default}
                />
              </dl>
            </Card>

            <Card className="p-5">
              <h3 className="text-xs font-display font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Relacionamento
              </h3>
              <dl className="space-y-2.5 text-sm">
                <InfoRow
                  icon={UsersIcon}
                  label="Responsável comercial"
                  value={ownerName}
                />
                <InfoRow
                  icon={Tag}
                  label="Fonte do lead"
                  value={client.source ? CLIENT_SOURCES[client.source] ?? client.source : null}
                />
                <InfoRow
                  icon={User}
                  label="Indicado por"
                  value={client.referrer_name}
                />
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
            </Card>

            <Card className="p-5">
              <h3 className="text-xs font-display font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Tags
              </h3>
              {client.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {client.tags.map((t) => (
                    <Badge key={t} variant="secondary">
                      {t}
                    </Badge>
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

        <TabsContent value="budgets" className="mt-4">
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Projeto</TableHead>
                  <TableHead>Status interno</TableHead>
                  <TableHead>Localização</TableHead>
                  <TableHead>Metragem</TableHead>
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
                    return (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium">{b.project_name || "—"}</TableCell>
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
                        <TableCell className="text-sm text-muted-foreground">
                          {[b.city, b.bairro, b.condominio].filter(Boolean).join(" · ") || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {b.metragem ?? "—"}
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
            {client.notes ? (
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

      <ClientForm open={editOpen} onOpenChange={setEditOpen} initial={client} />
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
