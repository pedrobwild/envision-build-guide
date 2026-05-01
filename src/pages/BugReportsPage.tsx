import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Bug, ArrowLeft, Loader2, AlertTriangle, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type BugRow = {
  id: string;
  title: string;
  description: string;
  steps_to_reproduce: string | null;
  expected_behavior: string | null;
  actual_behavior: string | null;
  severity: string;
  severity_ai: string | null;
  status: string;
  route: string | null;
  user_role: string | null;
  device_type: string | null;
  os_name: string | null;
  browser_name: string | null;
  area_ai: string | null;
  triage_summary: string | null;
  triage_tags: string[] | null;
  duplicate_of: string | null;
  reporter_id: string | null;
  reporter_name: string | null;
  reporter_email: string | null;
  created_at: string;
  triaged_at: string | null;
};

const SEVERITY_STYLES: Record<string, string> = {
  low:      "bg-blue-100 text-blue-900 border-blue-200",
  medium:   "bg-amber-100 text-amber-900 border-amber-200",
  high:     "bg-orange-100 text-orange-900 border-orange-200",
  critical: "bg-red-100 text-red-900 border-red-300",
};

const STATUS_STYLES: Record<string, string> = {
  open:      "bg-slate-100 text-slate-900 border-slate-200",
  triaging:  "bg-indigo-100 text-indigo-900 border-indigo-200",
  resolved:  "bg-emerald-100 text-emerald-900 border-emerald-200",
  dismissed: "bg-zinc-100 text-zinc-700 border-zinc-200",
};

const STATUS_LABEL: Record<string, string> = {
  open: "Aberto", triaging: "Em triagem", resolved: "Resolvido", dismissed: "Descartado",
};

export default function BugReportsPage() {
  const { bugId } = useParams<{ bugId?: string }>();
  return bugId ? <BugReportDetail bugId={bugId} /> : <BugReportsList />;
}

// ─── Lista ────────────────────────────────────────────────────────────────

function BugReportsList() {
  const [rows, setRows] = useState<BugRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [areaFilter, setAreaFilter] = useState("all");
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("v_bug_reports_admin")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      if (cancelled) return;
      if (error) {
        toast({ title: "Falha ao carregar bugs", description: error.message, variant: "destructive" });
      } else {
        setRows((data ?? []) as BugRow[]);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [toast]);

  const areas = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.area_ai) set.add(r.area_ai);
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (severityFilter !== "all" && (r.severity_ai ?? r.severity) !== severityFilter) return false;
      if (areaFilter !== "all" && r.area_ai !== areaFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${r.title} ${r.area_ai ?? ""} ${(r.triage_tags ?? []).join(" ")} ${r.route ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, statusFilter, severityFilter, areaFilter]);

  const counts = useMemo(() => {
    const total = rows.length;
    const open = rows.filter((r) => ["open", "triaging"].includes(r.status)).length;
    const critical = rows.filter((r) => (r.severity_ai ?? r.severity) === "critical" && r.status !== "resolved").length;
    const last7 = rows.filter((r) => Date.now() - new Date(r.created_at).getTime() < 7 * 86400_000).length;
    return { total, open, critical, last7 };
  }, [rows]);

  return (
    <div className="container mx-auto py-6 space-y-5 max-w-7xl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-semibold flex items-center gap-2">
            <Bug className="h-6 w-6 text-primary" /> Bug Reports
          </h1>
          <p className="text-sm text-muted-foreground">
            Reportes triados por IA. Use o botão flutuante (canto inferior direito) para reportar.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total" value={counts.total} />
        <KpiCard label="Em aberto" value={counts.open} tone="warning" />
        <KpiCard label="Críticos" value={counts.critical} tone="danger" />
        <KpiCard label="Últimos 7 dias" value={counts.last7} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              placeholder="Buscar por título, área, tag ou rota…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas severidades</SelectItem>
                <SelectItem value="critical">Crítica</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="low">Baixa</SelectItem>
              </SelectContent>
            </Select>
            {areas.length > 0 && (
              <Select value={areaFilter} onValueChange={setAreaFilter}>
                <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas áreas</SelectItem>
                  {areas.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[60vh]">
            {loading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-12">
                Nenhum bug report encontrado.
              </div>
            ) : (
              <ul className="divide-y">
                {filtered.map((r) => <BugRowItem key={r.id} row={r} />)}
              </ul>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function BugRowItem({ row }: { row: BugRow }) {
  const sev = row.severity_ai ?? row.severity;
  return (
    <li>
      <Link
        to={`/admin/bug-reports/${row.id}`}
        className="block px-4 py-3 hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-start gap-3">
          <Bug className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-medium text-sm truncate">{row.title}</span>
              <Badge className={cn("border text-xs", SEVERITY_STYLES[sev] ?? SEVERITY_STYLES.medium)}>
                {sev}
              </Badge>
              <Badge variant="outline" className={cn("text-xs", STATUS_STYLES[row.status])}>
                {STATUS_LABEL[row.status] ?? row.status}
              </Badge>
              {row.area_ai && <Badge variant="outline" className="text-xs">{row.area_ai}</Badge>}
              {row.duplicate_of && (
                <Badge variant="outline" className="text-xs border-amber-300 text-amber-900 bg-amber-50">
                  duplicata
                </Badge>
              )}
              {row.triaged_at && (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <Sparkles className="h-3 w-3" /> triado
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>{new Date(row.created_at).toLocaleString("pt-BR")}</span>
              <span>·</span>
              <span>{row.reporter_name ?? row.reporter_email ?? "—"}</span>
              {row.route && (<><span>·</span><span className="truncate font-mono text-[11px]">{row.route}</span></>)}
              {row.device_type && (<><span>·</span><span>{row.device_type}</span></>)}
            </div>
          </div>
        </div>
      </Link>
    </li>
  );
}

function KpiCard({ label, value, tone }: { label: string; value: number; tone?: "warning" | "danger" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={cn(
          "text-2xl font-semibold mt-1",
          tone === "warning" && "text-amber-600",
          tone === "danger"  && "text-red-600",
        )}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Detalhe ──────────────────────────────────────────────────────────────

function BugReportDetail({ bugId }: { bugId: string }) {
  const navigate = useNavigate();
  const [bug, setBug] = useState<BugRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [retriaging, setRetriaging] = useState(false);
  const { toast } = useToast();

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("v_bug_reports_admin")
      .select("*")
      .eq("id", bugId)
      .maybeSingle();
    if (error) {
      toast({ title: "Falha ao carregar", description: error.message, variant: "destructive" });
    } else {
      setBug(data as BugRow);
    }
    setLoading(false);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [bugId]);

  async function changeStatus(newStatus: string) {
    if (!bug) return;
    setUpdating(true);
    const { error } = await supabase
      .from("bug_reports")
      .update({ status: newStatus })
      .eq("id", bug.id);
    setUpdating(false);
    if (error) {
      toast({ title: "Falha ao atualizar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Status atualizado" });
      load();
    }
  }

  async function retriage() {
    if (!bug) return;
    setRetriaging(true);
    try {
      const { error } = await supabase.functions.invoke("bug-report-triage", {
        body: { bug_id: bug.id },
      });
      if (error) throw error;
      toast({ title: "Triagem refeita", description: "IA reclassificou o bug." });
      load();
    } catch (e) {
      toast({
        title: "Falha na triagem",
        description: e instanceof Error ? e.message : "Tente de novo em instantes.",
        variant: "destructive",
      });
    } finally {
      setRetriaging(false);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-6 max-w-4xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!bug) {
    return (
      <div className="container mx-auto py-12 max-w-4xl text-center">
        <AlertTriangle className="h-10 w-10 mx-auto text-amber-500 mb-3" />
        <p className="text-muted-foreground">Bug report não encontrado.</p>
        <Button variant="ghost" className="mt-3" onClick={() => navigate("/admin/bug-reports")}>
          Voltar para a lista
        </Button>
      </div>
    );
  }

  const sev = bug.severity_ai ?? bug.severity;

  return (
    <div className="container mx-auto py-6 max-w-4xl space-y-5">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/bug-reports")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <Button variant="outline" size="sm" onClick={retriage} disabled={retriaging} className="gap-2">
          {retriaging ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {retriaging ? "Triando…" : "Triar com IA"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <CardTitle className="text-lg flex items-center gap-2">
              <Bug className="h-5 w-5 text-primary" /> {bug.title}
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Badge className={cn("border", SEVERITY_STYLES[sev] ?? SEVERITY_STYLES.medium)}>
                {sev}
                {bug.severity_ai && bug.severity_ai !== bug.severity && (
                  <span className="ml-1 opacity-70">(IA)</span>
                )}
              </Badge>
              <Badge variant="outline" className={cn(STATUS_STYLES[bug.status])}>
                {STATUS_LABEL[bug.status] ?? bug.status}
              </Badge>
              {bug.area_ai && <Badge variant="outline">{bug.area_ai}</Badge>}
            </div>
          </div>
          {bug.triage_summary && (
            <div className="flex items-start gap-2 mt-2 p-3 rounded-md bg-primary/5 border border-primary/20">
              <Sparkles className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              <p className="text-sm italic">{bug.triage_summary}</p>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-5">
          <Section title="Descrição">
            <p className="text-sm whitespace-pre-wrap">{bug.description}</p>
          </Section>

          {bug.steps_to_reproduce && (
            <Section title="Passos para reproduzir">
              <pre className="whitespace-pre-wrap text-sm font-mono bg-muted/50 p-3 rounded-md">
                {bug.steps_to_reproduce}
              </pre>
            </Section>
          )}

          {(bug.expected_behavior || bug.actual_behavior) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bug.expected_behavior && (
                <Section title="Esperado"><p className="text-sm whitespace-pre-wrap">{bug.expected_behavior}</p></Section>
              )}
              {bug.actual_behavior && (
                <Section title="Atual"><p className="text-sm whitespace-pre-wrap">{bug.actual_behavior}</p></Section>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 pt-2 border-t">
            <Meta label="Reportado por" value={bug.reporter_name ?? bug.reporter_email ?? "—"} />
            <Meta label="Papel" value={bug.user_role ?? "—"} />
            <Meta label="Rota" value={bug.route ?? "—"} mono />
            <Meta label="Device" value={[bug.device_type, bug.os_name, bug.browser_name].filter(Boolean).join(" · ") || "—"} />
            <Meta label="Criado" value={new Date(bug.created_at).toLocaleString("pt-BR")} />
            {bug.triaged_at && <Meta label="Triado em" value={new Date(bug.triaged_at).toLocaleString("pt-BR")} />}
          </div>

          {(bug.triage_tags?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {bug.triage_tags!.map((t) => <Badge key={t} variant="outline">#{t}</Badge>)}
            </div>
          )}

          {bug.duplicate_of && (
            <div className="text-xs text-muted-foreground border-l-2 border-amber-400 pl-3">
              Possível duplicata de:{" "}
              <Link to={`/admin/bug-reports/${bug.duplicate_of}`} className="underline">
                {bug.duplicate_of.slice(0, 8)}…
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Workflow</CardTitle></CardHeader>
        <CardContent>
          <Tabs value={bug.status} onValueChange={changeStatus}>
            <TabsList className="flex-wrap h-auto">
              {Object.keys(STATUS_LABEL).map((s) => (
                <TabsTrigger key={s} value={s} disabled={updating}>{STATUS_LABEL[s]}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {updating && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-3">
              <Loader2 className="h-3 w-3 animate-spin" /> Atualizando…
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="w-28 text-muted-foreground shrink-0">{label}</span>
      <span className={cn("flex-1 break-words", mono && "font-mono text-xs")}>{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{title}</h3>
      {children}
    </div>
  );
}
