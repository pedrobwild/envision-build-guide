import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  Users,
  MoreVertical,
  Pencil,
  Archive,
  Eye,
  TrendingUp,
  DollarSign,
  Building2,
  Mail,
  Phone,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CLIENT_STATUSES,
  getEffectiveClientStatus,
  useClients,
  useDeleteClient,
  type ClientFilters,
  type ClientRowWithStats,
  type ClientStatus,
} from "@/hooks/useClients";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { ClientForm } from "@/components/crm/ClientForm";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: { value: ClientStatus; label: string }[] = Object.entries(
  CLIENT_STATUSES,
).map(([v, { label }]) => ({ value: v as ClientStatus, label }));

function formatBRL(value: number | null | undefined) {
  if (!value) return "R$ 0";
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

export default function ClientsList() {
  const navigate = useNavigate();
  const { members: comerciais } = useTeamMembers("comercial");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ClientStatus | "all">("all");
  const [ownerId, setOwnerId] = useState<string>("all");

  const filters: ClientFilters = useMemo(
    () => ({
      search,
      status: status === "all" ? undefined : [status],
      ownerId: ownerId === "all" ? null : ownerId,
    }),
    [search, status, ownerId],
  );

  const { data: clients = [], isLoading } = useClients(filters);
  const deleteClient = useDeleteClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ClientRowWithStats | null>(null);

  const ownersMap = useMemo(
    () => new Map(comerciais.map((m) => [m.id, m.full_name])),
    [comerciais],
  );

  const summary = useMemo(() => {
    const total = clients.length;
    const active = clients.filter((c) => c.status === "cliente").length;
    const mql = clients.filter(
      (c) => getEffectiveClientStatus(c, c.stats) === "mql",
    ).length;
    const pipelineValue = clients.reduce(
      (acc, c) => acc + (c.stats?.pipeline_value ?? 0),
      0,
    );
    const wonValue = clients.reduce(
      (acc, c) => acc + (c.stats?.total_won_value ?? 0),
      0,
    );
    return { total, active, mql, pipelineValue, wonValue };
  }, [clients]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(c: ClientRowWithStats) {
    setEditing(c);
    setFormOpen(true);
  }

  return (
    <div className="p-3 sm:p-6 max-w-[1400px] mx-auto space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight flex items-center gap-2">
            <Users className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0" />
            Clientes
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground font-body mt-1">
            Carteira de clientes do Bwild. Cada cliente concentra todos os orçamentos e o histórico
            comercial.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-1.5 w-full sm:w-auto h-10 sm:h-9">
          <Plus className="h-4 w-4" />
          Novo cliente
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={Users}
          label="Total na carteira"
          value={summary.total.toString()}
          hint={`${summary.active} ativos/fechados`}
        />
        <KpiCard
          icon={TrendingUp}
          label="Em pipeline"
          value={formatBRL(summary.pipelineValue)}
          hint="Orçamentos abertos"
        />
        <KpiCard
          icon={DollarSign}
          label="Fechado (acumulado)"
          value={formatBRL(summary.wonValue)}
          hint="Contratos fechados"
          accent="success"
        />
        <KpiCard
          icon={Building2}
          label="Ticket médio"
          value={
            summary.total > 0
              ? formatBRL(
                  clients.reduce((a, c) => a + (c.stats?.avg_ticket ?? 0), 0) /
                    Math.max(
                      clients.filter((c) => (c.stats?.avg_ticket ?? 0) > 0).length,
                      1,
                    ),
                )
              : "—"
          }
          hint="Média entre clientes fechados"
        />
      </div>

      <Card className="p-3">
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
          <div className="relative flex-1 sm:min-w-[240px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por código, nome, e-mail, telefone ou documento..."
              className="pl-8 h-10 sm:h-9"
            />
          </div>
          <div className="grid grid-cols-2 sm:flex gap-2">
            <Select value={status} onValueChange={(v) => setStatus(v as ClientStatus | "all")}>
              <SelectTrigger className="h-10 sm:h-9 w-full sm:w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={ownerId} onValueChange={setOwnerId}>
              <SelectTrigger className="h-10 sm:h-9 w-full sm:w-[200px]">
                <SelectValue placeholder="Todos os comerciais" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os comerciais</SelectItem>
                {comerciais.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {/* Mobile: card list */}
        <div className="md:hidden divide-y divide-border">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando clientes…</div>
          ) : clients.length === 0 ? (
            <div className="p-8 flex flex-col items-center gap-3 text-muted-foreground">
              <Users className="h-8 w-8 opacity-40" />
              <p className="text-sm font-body text-center">
                Nenhum cliente encontrado
                {search || status !== "all" || ownerId !== "all"
                  ? " com esses filtros."
                  : " ainda. Crie o primeiro."}
              </p>
              <Button variant="outline" size="sm" onClick={openCreate} className="gap-1.5 h-9">
                <Plus className="h-3.5 w-3.5" />
                Novo cliente
              </Button>
            </div>
          ) : (
            clients.map((c) => {
              const s = getEffectiveClientStatus(c, c.stats);
              const sCfg = CLIENT_STATUSES[s] ?? CLIENT_STATUSES.lead;
              const owner = c.commercial_owner_id
                ? ownersMap.get(c.commercial_owner_id) ?? "—"
                : "—";
              return (
                <button
                  type="button"
                  key={c.id}
                  className="w-full text-left p-4 active:bg-muted/40 transition-colors"
                  onClick={() => navigate(`/admin/crm/${c.id}`)}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {c.sequential_code && (
                          <span className="font-mono text-[10px] tracking-wider text-muted-foreground shrink-0">
                            {c.sequential_code}
                          </span>
                        )}
                        <p className="font-medium text-foreground font-body truncate">{c.name}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {[c.city, c.bairro].filter(Boolean).join(" · ") || owner}
                      </p>
                    </div>
                    <Badge className={cn("font-normal text-[10px] shrink-0", sCfg.color)}>
                      {sCfg.label}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-3 min-w-0">
                      {c.phone && (
                        <span className="flex items-center gap-1 truncate">
                          <Phone className="h-3 w-3 shrink-0" /> {c.phone}
                        </span>
                      )}
                      {!c.phone && c.email && (
                        <span className="flex items-center gap-1 truncate">
                          <Mail className="h-3 w-3 shrink-0" /> <span className="truncate">{c.email}</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="tabular-nums">{c.stats?.total_budgets ?? 0} orç.</span>
                      <span className="tabular-nums font-medium text-foreground">
                        {formatBRL(c.stats?.pipeline_value)}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Desktop: table */}
        <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[90px]">Código</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Cidade / Bairro</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead className="text-right">Orçamentos</TableHead>
              <TableHead className="text-right">Pipeline</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Última atividade</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-10 text-sm text-muted-foreground">
                  Carregando clientes…
                </TableCell>
              </TableRow>
            ) : clients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-16">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <Users className="h-8 w-8 opacity-40" />
                    <p className="text-sm font-body">
                      Nenhum cliente encontrado
                      {search || status !== "all" || ownerId !== "all"
                        ? " com esses filtros."
                        : " ainda. Crie o primeiro."}
                    </p>
                    <Button variant="outline" size="sm" onClick={openCreate} className="gap-1.5">
                      <Plus className="h-3.5 w-3.5" />
                      Novo cliente
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              clients.map((c) => {
                const s = getEffectiveClientStatus(c, c.stats);
                const sCfg = CLIENT_STATUSES[s] ?? CLIENT_STATUSES.lead;
                const owner = c.commercial_owner_id
                  ? ownersMap.get(c.commercial_owner_id) ?? "—"
                  : "—";
                return (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer hover:bg-muted/30"
                    onClick={() => navigate(`/admin/crm/${c.id}`)}
                  >
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        {c.email && (
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            <span className="truncate max-w-[180px]">{c.email}</span>
                          </div>
                        )}
                        {c.phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {c.phone}
                          </div>
                        )}
                        {!c.email && !c.phone && <span>—</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {[c.city, c.bairro].filter(Boolean).join(" · ") || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("font-normal", sCfg.color)}>{sCfg.label}</Badge>
                    </TableCell>
                    <TableCell>
                      {c.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-[180px]">
                          {c.tags.slice(0, 3).map((t) => (
                            <Badge key={t} variant="outline" className="text-[10px] py-0 h-5">
                              {t}
                            </Badge>
                          ))}
                          {c.tags.length > 3 && (
                            <span className="text-[10px] text-muted-foreground">
                              +{c.tags.length - 3}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.stats?.total_budgets ?? 0}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatBRL(c.stats?.pipeline_value)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{owner}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.stats?.last_budget_at
                        ? format(new Date(c.stats.last_budget_at), "dd MMM yy", { locale: ptBR })
                        : "—"}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/admin/crm/${c.id}`)}>
                            <Eye className="h-3.5 w-3.5 mr-2" /> Ver detalhe
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(c)}>
                            <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => {
                              if (
                                confirm(
                                  `Arquivar ${c.name}? Ele sai da carteira ativa mas o histórico de orçamentos é preservado.`,
                                )
                              ) {
                                deleteClient.mutate(c.id);
                              }
                            }}
                          >
                            <Archive className="h-3.5 w-3.5 mr-2" /> Arquivar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        </div>
      </Card>

      <ClientForm
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        onSaved={(c) => {
          if (!editing) navigate(`/admin/crm/${c.id}`);
        }}
      />
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
              "text-xl font-display font-bold mt-1 tabular-nums truncate",
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
