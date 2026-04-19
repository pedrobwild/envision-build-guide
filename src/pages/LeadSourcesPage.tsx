import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  Inbox,
  Search,
  Filter,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useLeadSources,
  useLeadSourcesMetrics,
  useReprocessFailedLeads,
  type LeadSourceRow,
} from "@/hooks/useLeadSources";
import { CLIENT_SOURCES } from "@/hooks/useClients";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  processed: { label: "Processado", color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20", icon: CheckCircle2 },
  pending: { label: "Pendente", color: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20", icon: Clock },
  failed: { label: "Falhou", color: "bg-destructive/10 text-destructive border-destructive/20", icon: AlertCircle },
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function LeadSourcesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [selectedLead, setSelectedLead] = useState<LeadSourceRow | null>(null);

  const filters = useMemo(
    () => ({ search: search || undefined, status: statusFilter || undefined, source: sourceFilter || undefined }),
    [search, statusFilter, sourceFilter],
  );

  const { data: leads = [], isLoading } = useLeadSources(filters);
  const { data: metrics } = useLeadSourcesMetrics();
  const reprocess = useReprocessFailedLeads();

  const failedCount = metrics?.byStatus.failed ?? 0;

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-3xl font-bold font-display tracking-tight">Leads de Integrações</h1>
          <p className="text-xs sm:text-sm text-muted-foreground font-body mt-1">
            Captação automática via Meta Ads, Google Ads, formulários do site e outras integrações.
          </p>
        </div>
        <Button
          onClick={() => reprocess.mutate()}
          disabled={reprocess.isPending || failedCount === 0}
          variant={failedCount > 0 ? "default" : "outline"}
          className="w-full sm:w-auto h-10 sm:h-9"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${reprocess.isPending ? "animate-spin" : ""}`} />
          Reprocessar falhas {failedCount > 0 && `(${failedCount})`}
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
        <Card>
          <CardHeader className="pb-2 p-3 sm:p-4">
            <CardDescription className="text-[11px] sm:text-sm">Recebidos (30d)</CardDescription>
            <CardTitle className="text-xl sm:text-3xl">{metrics?.total ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2 p-3 sm:p-4">
            <CardDescription className="text-[11px] sm:text-sm">Processados</CardDescription>
            <CardTitle className="text-xl sm:text-3xl text-emerald-600 dark:text-emerald-400">{metrics?.byStatus.processed ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2 p-3 sm:p-4">
            <CardDescription className="text-[11px] sm:text-sm">Pendentes</CardDescription>
            <CardTitle className="text-xl sm:text-3xl text-amber-600 dark:text-amber-400">{metrics?.byStatus.pending ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2 p-3 sm:p-4">
            <CardDescription className="text-[11px] sm:text-sm">Falharam</CardDescription>
            <CardTitle className="text-xl sm:text-3xl text-destructive">{metrics?.byStatus.failed ?? 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="leads" className="space-y-4">
        <TabsList>
          <TabsTrigger value="leads">Todos os leads</TabsTrigger>
          <TabsTrigger value="campaigns">Top campanhas</TabsTrigger>
          <TabsTrigger value="sources">Por fonte</TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="space-y-4">
          {/* Filtros */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-3">
            <div className="relative flex-1 sm:min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por ID, campanha, formulário..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 sm:h-9"
              />
            </div>
            <div className="grid grid-cols-2 sm:flex gap-2">
              <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="w-full sm:w-[180px] h-10 sm:h-9">
                  <Filter className="h-4 w-4 mr-2 shrink-0" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="processed">Processados</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="failed">Falharam</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sourceFilter || "all"} onValueChange={(v) => setSourceFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="w-full sm:w-[200px] h-10 sm:h-9">
                  <SelectValue placeholder="Fonte" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as fontes</SelectItem>
                  {Object.entries(CLIENT_SOURCES).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-12 text-center text-muted-foreground">Carregando...</div>
              ) : leads.length === 0 ? (
                <div className="p-12 text-center">
                  <Inbox className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="font-medium">Nenhum lead encontrado</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Quando integrações enviarem leads, eles aparecerão aqui.
                  </p>
                </div>
              ) : (
                <>
                  {/* Mobile: card list */}
                  <div className="md:hidden divide-y divide-border">
                    {leads.map((lead) => {
                      const cfg = STATUS_CONFIG[lead.processing_status] ?? STATUS_CONFIG.pending;
                      const Icon = cfg.icon;
                      return (
                        <button
                          type="button"
                          key={lead.id}
                          onClick={() => setSelectedLead(lead)}
                          className="w-full text-left p-4 active:bg-muted/40 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-mono text-muted-foreground mb-1">
                                {formatDateTime(lead.received_at)}
                              </p>
                              <p className="font-medium text-sm text-foreground truncate">
                                {lead.campaign_name || lead.campaign_id || "Sem campanha"}
                              </p>
                            </div>
                            <Badge className={`${cfg.color} border gap-1 text-[10px] shrink-0`} variant="outline">
                              <Icon className="h-3 w-3" />
                              {cfg.label}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <Badge variant="outline" className="text-[10px]">
                              {CLIENT_SOURCES[lead.source] ?? lead.source}
                            </Badge>
                            {lead.client_id ? (
                              <Link
                                to={`/admin/crm/${lead.client_id}`}
                                className="text-primary hover:underline flex items-center gap-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Ver cliente <ExternalLink className="h-3 w-3" />
                              </Link>
                            ) : (
                              <span className="text-muted-foreground/60">Sem cliente</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Desktop: table */}
                  <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Recebido</TableHead>
                        <TableHead>Fonte</TableHead>
                        <TableHead>Campanha</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="w-[80px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leads.map((lead) => {
                        const cfg = STATUS_CONFIG[lead.processing_status] ?? STATUS_CONFIG.pending;
                        const Icon = cfg.icon;
                        return (
                          <TableRow key={lead.id} className="cursor-pointer" onClick={() => setSelectedLead(lead)}>
                            <TableCell className="text-sm font-mono text-muted-foreground">
                              {formatDateTime(lead.received_at)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{CLIENT_SOURCES[lead.source] ?? lead.source}</Badge>
                            </TableCell>
                            <TableCell className="max-w-[280px] truncate">
                              {lead.campaign_name || lead.campaign_id || (
                                <span className="text-muted-foreground/60">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge className={`${cfg.color} border gap-1`} variant="outline">
                                <Icon className="h-3 w-3" />
                                {cfg.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {lead.client_id ? (
                                <Link
                                  to={`/admin/crm/${lead.client_id}`}
                                  className="text-primary hover:underline text-sm flex items-center gap-1"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Ver cliente <ExternalLink className="h-3 w-3" />
                                </Link>
                              ) : (
                                <span className="text-muted-foreground/60 text-sm">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm">Detalhes</Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaigns">
          <Card>
            <CardHeader>
              <CardTitle>Top 10 campanhas (30 dias)</CardTitle>
              <CardDescription>Campanhas que mais geraram leads</CardDescription>
            </CardHeader>
            <CardContent>
              {!metrics || metrics.byCampaign.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhuma campanha registrada ainda.</p>
              ) : (
                <div className="space-y-2">
                  {metrics.byCampaign.map(([name, count]) => (
                    <div key={name} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent transition-colors">
                      <span className="font-medium truncate flex-1">{name}</span>
                      <Badge variant="secondary">{count} leads</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sources">
          <Card>
            <CardHeader>
              <CardTitle>Distribuição por fonte (30 dias)</CardTitle>
            </CardHeader>
            <CardContent>
              {!metrics || Object.keys(metrics.bySource).length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhum lead recebido ainda.</p>
              ) : (
                <div className="space-y-2">
                  {Object.entries(metrics.bySource)
                    .sort(([, a], [, b]) => b - a)
                    .map(([source, count]) => (
                      <div key={source} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                        <span className="font-medium">{CLIENT_SOURCES[source] ?? source}</span>
                        <Badge variant="secondary">{count} leads</Badge>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Drawer de detalhes */}
      <Dialog open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
        <DialogContent className="max-w-3xl w-[calc(100vw-1.5rem)] sm:w-full max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Detalhes do Lead</DialogTitle>
            <DialogDescription>
              {selectedLead && `Recebido em ${formatDateTime(selectedLead.received_at)}`}
            </DialogDescription>
          </DialogHeader>
          {selectedLead && (
            <ScrollArea className="max-h-[70vh] sm:max-h-[60vh] pr-2 sm:pr-4 -mx-2 px-2">
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-sm">
                  <div className="break-words"><span className="text-muted-foreground">Fonte:</span> <strong>{CLIENT_SOURCES[selectedLead.source] ?? selectedLead.source}</strong></div>
                  <div className="break-all"><span className="text-muted-foreground">External ID:</span> <code className="text-xs">{selectedLead.external_id ?? "—"}</code></div>
                  <div className="break-words"><span className="text-muted-foreground">Campanha:</span> {selectedLead.campaign_name ?? "—"}</div>
                  <div><span className="text-muted-foreground">Conjunto:</span> {selectedLead.adset_name ?? "—"}</div>
                  <div><span className="text-muted-foreground">Anúncio:</span> {selectedLead.ad_name ?? "—"}</div>
                  <div><span className="text-muted-foreground">Formulário:</span> {selectedLead.form_id ?? "—"}</div>
                </div>
                {selectedLead.processing_error && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm">
                    <strong className="text-destructive">Erro:</strong>
                    <p className="text-destructive/90 mt-1">{selectedLead.processing_error}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium mb-2">Payload bruto:</p>
                  <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto max-h-[300px]">
                    {JSON.stringify(selectedLead.raw_payload, null, 2)}
                  </pre>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
