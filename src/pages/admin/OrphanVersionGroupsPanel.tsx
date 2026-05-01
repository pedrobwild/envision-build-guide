import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfirm } from "@/hooks/useConfirm";
import { GitMerge, RefreshCw, ExternalLink, Layers, ListChecks } from "lucide-react";

type OrphanRow = {
  budget_id: string;
  budget_code: string | null;
  project_name: string | null;
  client_id: string;
  client_name: string | null;
  property_id: string | null;
  property_label: string | null;
  current_version_group_id: string;
  target_version_group_id: string;
  target_group_size: number;
  internal_status: string | null;
  created_at: string;
};

export default function OrphanVersionGroupsPanel() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<OrphanRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const confirm = useConfirm();

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("list_orphan_version_groups");
    if (error) {
      toast.error("Falha ao listar órfãos", { description: error.message });
      setRows([]);
    } else {
      setRows((data as OrphanRow[] | null) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, OrphanRow[]>();
    for (const r of rows) {
      const k = `${r.client_id}|${r.property_id ?? "∅"}`;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    return Array.from(map.values());
  }, [rows]);

  const consolidateOne = async (r: OrphanRow, silent = false) => {
    setBusyId(r.budget_id);
    const { error } = await supabase.rpc("consolidate_orphan_version_group", {
      _budget_id: r.budget_id,
      _target_version_group_id: r.target_version_group_id,
    });
    setBusyId(null);
    if (error) {
      if (!silent) toast.error("Falha ao consolidar", { description: error.message });
      return false;
    }
    if (!silent) toast.success("Orçamento consolidado");
    return true;
  };

  const handleConsolidate = async (r: OrphanRow) => {
    const ok = await confirm({
      title: "Consolidar orçamento?",
      description: `O orçamento ${r.budget_code ?? r.budget_id.slice(0, 8)} será re-vinculado ao grupo principal e numerado como próxima versão. Não pode ser desfeito.`,
      confirmText: "Consolidar",
      destructive: true,
    });
    if (!ok) return;
    const ok2 = await consolidateOne(r);
    if (ok2) await load();
  };

  const handleConsolidateAll = async () => {
    if (rows.length === 0) return;
    const ok = await confirm({
      title: `Consolidar ${rows.length} orçamento(s)?`,
      description: "Todos os órfãos detectados serão re-vinculados ao respectivo grupo principal de cada cliente+imóvel. Esta ação não pode ser desfeita.",
      confirmText: "Consolidar todos",
      destructive: true,
    });
    if (!ok) return;
    setBulkBusy(true);
    let success = 0;
    let failed = 0;
    for (const r of rows) {
      const ok = await consolidateOne(r, true);
      if (ok) success++;
      else failed++;
    }
    setBulkBusy(false);
    toast.success(`${success} consolidado(s)`, {
      description: failed > 0 ? `${failed} falhou(aram)` : undefined,
    });
    await load();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="space-y-1">
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                Órfãos de grupo de versão
              </CardTitle>
              <CardDescription className="font-body">
                Orçamentos cujo grupo aponta para si mesmos, mas existe outro grupo válido para o mesmo cliente + imóvel.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{rows.length} órfão(s)</Badge>
              <Button variant="outline" size="sm" onClick={load} disabled={loading || bulkBusy}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Recarregar
              </Button>
              <Button
                size="sm"
                onClick={handleConsolidateAll}
                disabled={loading || bulkBusy || rows.length === 0}
              >
                <ListChecks className="h-4 w-4 mr-2" />
                {bulkBusy ? "Consolidando…" : "Consolidar todos"}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center space-y-2">
            <Layers className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nenhum orçamento órfão encontrado.</p>
            <p className="text-xs text-muted-foreground">
              Orçamentos isolados sem outro grupo no mesmo cliente+imóvel são considerados corretos.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {grouped.map((group) => {
            const head = group[0];
            return (
              <Card key={`${head.client_id}-${head.property_id ?? "none"}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="space-y-0.5 min-w-0">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Link to={`/admin/crm/${head.client_id}`} className="hover:underline truncate">
                          {head.client_name ?? "Cliente"}
                        </Link>
                        <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                      </CardTitle>
                      <CardDescription className="font-body text-xs">
                        {head.property_label ?? "(sem imóvel)"} · grupo alvo com {head.target_group_size} versão(ões)
                      </CardDescription>
                    </div>
                    <Badge variant="outline">{group.length} órfão(s)</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {group.map((r) => (
                    <div
                      key={r.budget_id}
                      className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2"
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <Link
                          to={`/admin/budget/${r.budget_id}`}
                          className="text-sm font-medium hover:underline truncate block"
                        >
                          {r.budget_code ?? r.budget_id.slice(0, 8)} — {r.project_name || "Sem nome"}
                        </Link>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground font-body">
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {r.internal_status ?? "—"}
                          </Badge>
                          <span>{new Date(r.created_at).toLocaleDateString("pt-BR")}</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleConsolidate(r)}
                        disabled={busyId === r.budget_id || bulkBusy}
                      >
                        <GitMerge className="h-3.5 w-3.5 mr-1.5" />
                        {busyId === r.budget_id ? "…" : "Consolidar"}
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
