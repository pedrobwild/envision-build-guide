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
  processed: { label: "Processado", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  pending: { label: "Pendente", color: "bg-amber-100 text-amber-700 border-amber-200", icon: Clock },
  failed: { label: "Falhou", color: "bg-rose-100 text-rose-700 border-rose-200", icon: AlertCircle },
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
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight">Leads de Integrações</h1>
          <p className="text-muted-foreground font-body mt-1">
            Captação automática via Meta Ads, Google Ads, formulários do site e outras integrações.
          </p>
        </div>
        <Button
          onClick={() => reprocess.mutate()}
          disabled={reprocess.isPending || failedCount === 0}
          variant={failedCount > 0 ? "default" : "outline"}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${reprocess.isPending ? "animate-spin" : ""}`} />
          Reprocessar falhas {failedCount > 0 && `(${failedCount})`}
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Recebidos (30d)</CardDescription>
            <CardTitle className="text-3xl">{metrics?.total ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Processados</CardDescription>
            <CardTitle className="text-3xl text-emerald-600">{metrics?.byStatus.processed ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pendentes</CardDescription>
            <CardTitle className="text-3xl text-amber-600">{metrics?.byStatus.pending ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Falharam</CardDescription>
            <CardTitle className="text-3xl text-rose-600">{metrics?.byStatus.failed ?? 0}</CardTitle>
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
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por ID, campanha, formulário..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
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
              <SelectTrigger className="w-[200px]">
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
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Lead</DialogTitle>
            <DialogDescription>
              {selectedLead && `Recebido em ${formatDateTime(selectedLead.received_at)}`}
            </DialogDescription>
          </DialogHeader>
          {selectedLead && (
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Fonte:</span> <strong>{CLIENT_SOURCES[selectedLead.source] ?? selectedLead.source}</strong></div>
                  <div><span className="text-muted-foreground">External ID:</span> <code className="text-xs">{selectedLead.external_id ?? "—"}</code></div>
                  <div><span className="text-muted-foreground">Campanha:</span> {selectedLead.campaign_name ?? "—"}</div>
                  <div><span className="text-muted-foreground">Conjunto:</span> {selectedLead.adset_name ?? "—"}</div>
                  <div><span className="text-muted-foreground">Anúncio:</span> {selectedLead.ad_name ?? "—"}</div>
                  <div><span className="text-muted-foreground">Formulário:</span> {selectedLead.form_id ?? "—"}</div>
                </div>
                {selectedLead.processing_error && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-sm">
                    <strong className="text-rose-700">Erro:</strong>
                    <p className="text-rose-600 mt-1">{selectedLead.processing_error}</p>
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
