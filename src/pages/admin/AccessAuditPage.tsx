import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { logger } from "@/lib/logger";
import { toast } from "sonner";

type AuditRow = {
  id: string;
  created_at: string;
  event_type: string;
  budget_id: string | null;
  public_id: string | null;
  actor_user_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  referrer: string | null;
  route: string | null;
  metadata: Record<string, unknown> | null;
};

const EVENT_LABELS: Record<string, { label: string; tone: "default" | "secondary" | "destructive" | "outline" }> = {
  public_budget_view: { label: "Visualização", tone: "secondary" },
  public_budget_pdf_export: { label: "Exportou PDF", tone: "outline" },
  public_optional_selection: { label: "Selecionou opcional", tone: "default" },
  public_contract_request_started: { label: "Iniciou contrato", tone: "default" },
  public_contract_request_submitted: { label: "Enviou contrato", tone: "default" },
  public_link_invalid: { label: "Link inválido", tone: "destructive" },
};

export default function AccessAuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [eventFilter, setEventFilter] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("access_audit_log" as never)
      .select("id, created_at, event_type, budget_id, public_id, actor_user_id, ip_address, user_agent, referrer, route, metadata")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      toast.error("Falha ao carregar auditoria: " + error.message);
      logger.error("access_audit_log", error);
      setRows([]);
    } else {
      setRows((data as unknown as AuditRow[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return rows.filter((r) => {
      if (eventFilter !== "all" && r.event_type !== eventFilter) return false;
      if (!q) return true;
      return (
        r.public_id?.toLowerCase().includes(q) ||
        r.budget_id?.toLowerCase().includes(q) ||
        r.ip_address?.toLowerCase().includes(q) ||
        r.user_agent?.toLowerCase().includes(q)
      );
    });
  }, [rows, filter, eventFilter]);

  const eventTypes = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(r.event_type));
    return Array.from(set).sort();
  }, [rows]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6" /> Auditoria de acesso
          </h1>
          <p className="text-sm text-muted-foreground">
            Registros de visualização de orçamentos públicos, exports de PDF e solicitações de contrato.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2">Atualizar</span>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Eventos recentes</CardTitle>
          <CardDescription>Mostra os últimos 500 eventos. Use os filtros para refinar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Filtrar por public_id, budget_id, IP ou UA…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="max-w-sm"
            />
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
            >
              <option value="all">Todos os eventos</option>
              {eventTypes.map((t) => (
                <option key={t} value={t}>
                  {EVENT_LABELS[t]?.label ?? t}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">{filtered.length} registros</span>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Orçamento</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead className="max-w-[280px]">User-Agent</TableHead>
                  <TableHead>Referrer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin inline" />
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum evento encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => {
                    const meta = EVENT_LABELS[r.event_type] ?? { label: r.event_type, tone: "outline" as const };
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap font-mono text-xs">
                          {new Date(r.created_at).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          <Badge variant={meta.tone}>{meta.label}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {r.public_id ? (
                            <a
                              href={`/o/${r.public_id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="underline hover:text-primary"
                            >
                              {r.public_id}
                            </a>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{r.ip_address ?? "—"}</TableCell>
                        <TableCell className="max-w-[280px] truncate text-xs" title={r.user_agent ?? undefined}>
                          {r.user_agent ?? "—"}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs" title={r.referrer ?? undefined}>
                          {r.referrer ?? "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
