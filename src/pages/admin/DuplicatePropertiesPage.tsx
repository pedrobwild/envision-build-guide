import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useConfirm } from "@/hooks/useConfirm";
import { Building2, Merge, RefreshCw, ExternalLink, ShieldCheck } from "lucide-react";

type DuplicateGroup = {
  client_id: string;
  client_name: string | null;
  empreendimento_norm: string;
  bairro_norm: string;
  metragem_norm: string;
  property_count: number;
  property_ids: string[];
  property_labels: string[];
  budget_counts: number[];
  primary_property_id: string;
};

export default function DuplicatePropertiesPage() {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [merging, setMerging] = useState<string | null>(null);
  const [primaryChoice, setPrimaryChoice] = useState<Record<string, string>>({});
  const confirm = useConfirm();

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("list_duplicate_properties");
    if (error) {
      toast.error("Falha ao listar duplicatas", { description: error.message });
      setGroups([]);
    } else {
      const rows = (data as DuplicateGroup[] | null) ?? [];
      setGroups(rows);
      // default primary = property com mais orçamentos (ou o primeiro)
      const defaults: Record<string, string> = {};
      for (const g of rows) {
        let bestIdx = 0;
        let bestCount = -1;
        g.property_ids.forEach((_, i) => {
          if ((g.budget_counts[i] ?? 0) > bestCount) {
            bestCount = g.budget_counts[i] ?? 0;
            bestIdx = i;
          }
        });
        const key = `${g.client_id}|${g.empreendimento_norm}|${g.bairro_norm}|${g.metragem_norm}`;
        defaults[key] = g.property_ids[bestIdx];
      }
      setPrimaryChoice(defaults);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const totalDuplicates = useMemo(
    () => groups.reduce((acc, g) => acc + (g.property_count - 1), 0),
    [groups]
  );

  const handleMerge = async (g: DuplicateGroup) => {
    const key = `${g.client_id}|${g.empreendimento_norm}|${g.bairro_norm}|${g.metragem_norm}`;
    const primary = primaryChoice[key] ?? g.primary_property_id;
    const dups = g.property_ids.filter((id) => id !== primary);
    const totalBudgets = g.budget_counts.reduce((a, b) => a + b, 0);

    const ok = await confirm({
      title: "Mesclar imóveis?",
      description: `Vou re-apontar ${totalBudgets} orçamento(s) para o imóvel primário e remover ${dups.length} duplicata(s). Esta ação não pode ser desfeita.`,
      confirmText: "Mesclar agora",
      variant: "destructive",
    });
    if (!ok) return;

    setMerging(key);
    const { data, error } = await supabase.rpc("merge_duplicate_properties", {
      _primary_id: primary,
      _duplicate_ids: dups,
    });
    setMerging(null);

    if (error) {
      toast.error("Falha ao mesclar", { description: error.message });
      return;
    }
    const result = data as { deleted_count?: number; relinked_budgets?: number } | null;
    toast.success("Imóveis mesclados", {
      description: `${result?.deleted_count ?? 0} duplicata(s) removida(s), ${result?.relinked_budgets ?? 0} orçamento(s) re-vinculado(s).`,
    });
    await load();
  };

  return (
    <div className="container max-w-5xl py-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h1 className="text-2xl font-display tracking-tight">Imóveis duplicados</h1>
          <p className="text-sm text-muted-foreground font-body">
            Detecta imóveis do mesmo cliente com mesmo empreendimento, bairro e metragem. Mesclar elimina cards duplicados no funil.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Recarregar
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Resumo
          </CardTitle>
          <CardDescription>
            {loading ? "Verificando…" : `${groups.length} grupo(s) com duplicatas · ${totalDuplicates} imóvel(is) excedente(s)`}
          </CardDescription>
        </CardHeader>
      </Card>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center space-y-2">
            <Building2 className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nenhum imóvel duplicado encontrado.</p>
            <p className="text-xs text-muted-foreground">O índice único do banco já bloqueia novas duplicatas automaticamente.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => {
            const key = `${g.client_id}|${g.empreendimento_norm}|${g.bairro_norm}|${g.metragem_norm}`;
            const selected = primaryChoice[key] ?? g.primary_property_id;
            return (
              <Card key={key}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="space-y-1 min-w-0">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Link
                          to={`/admin/crm/${g.client_id}`}
                          className="hover:underline truncate"
                        >
                          {g.client_name ?? "Cliente"}
                        </Link>
                        <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                      </CardTitle>
                      <CardDescription className="font-body">
                        {g.empreendimento_norm || "—"} · {g.bairro_norm || "—"} · {g.metragem_norm || "—"}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary">{g.property_count} imóveis</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2 font-body">
                      Selecione o imóvel primário (será mantido)
                    </p>
                    <RadioGroup
                      value={selected}
                      onValueChange={(val) => setPrimaryChoice((prev) => ({ ...prev, [key]: val }))}
                      className="space-y-2"
                    >
                      {g.property_ids.map((pid, i) => (
                        <div
                          key={pid}
                          className="flex items-center gap-3 rounded-md border bg-card px-3 py-2"
                        >
                          <RadioGroupItem value={pid} id={`${key}-${pid}`} />
                          <Label htmlFor={`${key}-${pid}`} className="flex-1 cursor-pointer flex items-center justify-between gap-2 font-body">
                            <span className="truncate text-sm">{g.property_labels[i] || "Sem nome"}</span>
                            <Badge variant="outline" className="text-xs shrink-0">
                              {g.budget_counts[i] ?? 0} orç.
                            </Badge>
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      onClick={() => handleMerge(g)}
                      disabled={merging === key}
                      size="sm"
                    >
                      <Merge className="h-4 w-4 mr-2" />
                      {merging === key ? "Mesclando…" : "Mesclar duplicatas"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
