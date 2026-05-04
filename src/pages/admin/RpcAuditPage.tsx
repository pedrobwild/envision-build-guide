import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ShieldCheck, ShieldAlert, RefreshCw, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

type GrantRow = {
  function_name: string;
  function_schema: string;
  security_type: string;
  return_type: string;
  grantee: string;
  privilege_type: string;
  is_grantable: boolean;
};

type SmokeResult = {
  name: string;
  ok: boolean;
  rows?: number;
  error?: string;
  ms: number;
};

const SMOKE_RPCS: Array<{ name: string; args: Record<string, unknown> }> = [
  { name: "sales_kpis_dashboard", args: {} },
  { name: "sales_kpis_cohorts", args: {} },
  { name: "count_eligible_budgets", args: {} },
];

// Sensitive grantees that should NOT have EXECUTE on internal RPCs
const SENSITIVE_GRANTEES = new Set(["anon", "PUBLIC"]);
// RPCs that are intentionally public (used by /o/:publicId)
const PUBLIC_RPCS = new Set(["get_public_budget", "get_public_budget_total", "resolve_published_public_id", "increment_view_count"]);

export default function RpcAuditPage() {
  const [loading, setLoading] = useState(true);
  const [grants, setGrants] = useState<GrantRow[]>([]);
  const [filter, setFilter] = useState("");
  const [smoke, setSmoke] = useState<SmokeResult[]>([]);
  const [smokeRunning, setSmokeRunning] = useState(false);

  const loadGrants = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("audit_rpc_grants" as never);
    if (error) {
      toast.error("Falha ao carregar permissões: " + error.message);
      logger.error("audit_rpc_grants", error);
      setGrants([]);
    } else {
      setGrants((data as GrantRow[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadGrants();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, GrantRow[]>();
    for (const g of grants) {
      if (filter && !g.function_name.toLowerCase().includes(filter.toLowerCase())) continue;
      const arr = map.get(g.function_name) ?? [];
      arr.push(g);
      map.set(g.function_name, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [grants, filter]);

  const summary = useMemo(() => {
    const total = grouped.length;
    let exposed = 0;
    for (const [name, rows] of grouped) {
      if (PUBLIC_RPCS.has(name)) continue;
      if (rows.some((r) => SENSITIVE_GRANTEES.has(r.grantee))) exposed++;
    }
    return { total, exposed };
  }, [grouped]);

  const runSmoke = async () => {
    setSmokeRunning(true);
    const out: SmokeResult[] = [];
    for (const rpc of SMOKE_RPCS) {
      const t0 = performance.now();
      const { data, error } = await supabase.rpc(rpc.name as never, rpc.args as never);
      const ms = Math.round(performance.now() - t0);
      if (error) {
        out.push({ name: rpc.name, ok: false, error: error.message, ms });
      } else {
        const rows = Array.isArray(data) ? data.length : data ? 1 : 0;
        out.push({ name: rpc.name, ok: true, rows, ms });
      }
    }
    setSmoke(out);
    setSmokeRunning(false);
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-6xl">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold">Auditoria de RPCs</h1>
          <p className="text-sm text-ink-soft mt-1">
            Permissões EXECUTE das funções de KPIs e orçamentos, e teste rápido de acesso autenticado.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadGrants} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Recarregar
          </Button>
          <Button size="sm" onClick={runSmoke} disabled={smokeRunning}>
            {smokeRunning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlayCircle className="h-4 w-4 mr-2" />}
            Smoke test
          </Button>
        </div>
      </header>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-[10px] uppercase tracking-wider">RPCs auditadas</CardDescription>
            <CardTitle className="font-mono text-2xl">{summary.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-[10px] uppercase tracking-wider">Expostas a anon/PUBLIC</CardDescription>
            <CardTitle className="font-mono text-2xl flex items-center gap-2">
              {summary.exposed}
              {summary.exposed === 0 ? (
                <ShieldCheck className="h-5 w-5 text-success" />
              ) : (
                <ShieldAlert className="h-5 w-5 text-destructive" />
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-[10px] uppercase tracking-wider">Smoke test (autenticado)</CardDescription>
            <CardTitle className="font-mono text-2xl">
              {smoke.length === 0 ? "—" : `${smoke.filter((s) => s.ok).length}/${smoke.length} OK`}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Smoke test results */}
      {smoke.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Acesso autenticado às RPCs</CardTitle>
            <CardDescription>
              Verifica se a sessão atual consegue executar as funções e ler dados (RLS efetiva).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Função</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Linhas</TableHead>
                  <TableHead className="text-right">Tempo</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {smoke.map((s) => (
                  <TableRow key={s.name}>
                    <TableCell className="font-mono text-xs">{s.name}</TableCell>
                    <TableCell>
                      {s.ok ? (
                        <Badge className="bg-success/15 text-success border-success/30">PASS</Badge>
                      ) : (
                        <Badge variant="destructive">FAIL</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">{s.rows ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono text-ink-soft">{s.ms}ms</TableCell>
                    <TableCell className="text-xs text-destructive">{s.error ?? ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Grants */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Permissões EXECUTE por função</CardTitle>
              <CardDescription>
                Origem: <code className="font-mono">pg_proc</code> + <code className="font-mono">aclexplode</code>.
                RPCs marcadas como <em>públicas</em> são intencionais (orçamento público).
              </CardDescription>
            </div>
            <Input
              placeholder="Filtrar função…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="max-w-xs"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-ink-soft py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : grouped.length === 0 ? (
            <p className="text-sm text-ink-soft py-8 text-center">Nenhuma função encontrada.</p>
          ) : (
            <div className="space-y-4">
              {grouped.map(([name, rows]) => {
                const isPublicIntended = PUBLIC_RPCS.has(name);
                const exposedToAnon = rows.some((r) => SENSITIVE_GRANTEES.has(r.grantee));
                const flagged = exposedToAnon && !isPublicIntended;
                return (
                  <div key={name} className="border rounded-md p-3 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="font-mono text-sm font-semibold">{name}</div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {rows[0]?.security_type}
                        </Badge>
                        {isPublicIntended && (
                          <Badge variant="outline" className="text-[10px]">público (intencional)</Badge>
                        )}
                        {flagged ? (
                          <Badge variant="destructive" className="text-[10px]">
                            <ShieldAlert className="h-3 w-3 mr-1" />
                            Exposta sem auth
                          </Badge>
                        ) : (
                          <Badge className="bg-success/15 text-success border-success/30 text-[10px]">
                            <ShieldCheck className="h-3 w-3 mr-1" />
                            OK
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {rows.map((r, i) => (
                        <Badge
                          key={i}
                          variant={SENSITIVE_GRANTEES.has(r.grantee) && !isPublicIntended ? "destructive" : "secondary"}
                          className="font-mono text-[10px]"
                        >
                          {r.grantee}
                        </Badge>
                      ))}
                    </div>
                    <div className="text-[11px] text-ink-soft font-mono truncate">
                      retorno: {rows[0]?.return_type}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
