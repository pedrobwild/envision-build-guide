/**
 * MetasHistoryPage — histórico mensal de metas e atingimento.
 *
 * Lista todas as metas globais (owner_id IS NULL) registradas em
 * `commercial_targets`, mostrando meta, resultado (override quando
 * presente, senão receita fechada calculada via budgets) e %
 * atingimento. Admin pode editar/criar metas direto da página.
 */

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Target, Pencil, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useUserProfile } from "@/hooks/useUserProfile";
import { formatBRL } from "@/lib/formatBRL";

interface TargetRow {
  id: string;
  target_month: string; // YYYY-MM-DD (1º dia)
  revenue_target_brl: number;
  revenue_override_brl: number | null;
  deals_target: number;
}

interface ClosedAgg {
  monthKey: string;
  closedRevenue: number;
  closedDeals: number;
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLong(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function attainmentTone(pct: number | null) {
  if (pct === null) return "bg-muted text-muted-foreground";
  if (pct >= 100) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/30";
  if (pct >= 80) return "bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30";
  return "bg-destructive/10 text-destructive ring-1 ring-destructive/30";
}

export default function MetasHistoryPage() {
  const { profile } = useUserProfile();
  const isAdmin = profile?.roles.includes("admin") ?? false;

  const [targets, setTargets] = useState<TargetRow[]>([]);
  const [closedByMonth, setClosedByMonth] = useState<Map<string, ClosedAgg>>(new Map());
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState<TargetRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [formMonth, setFormMonth] = useState<string>("");
  const [formTarget, setFormTarget] = useState<number | null>(null);
  const [formOverride, setFormOverride] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("commercial_targets")
        .select("id, target_month, revenue_target_brl, revenue_override_brl, deals_target")
        .is("owner_id", null)
        .order("target_month", { ascending: false });
      if (error) throw error;
      setTargets((data ?? []) as TargetRow[]);

      // Agrega receita fechada por mês com base em closed_at
      const { data: closed, error: closedErr } = await supabase
        .from("budgets")
        .select("manual_total, closed_at, internal_status")
        .eq("internal_status", "contrato_fechado")
        .not("closed_at", "is", null);
      if (closedErr) throw closedErr;

      const map = new Map<string, ClosedAgg>();
      (closed ?? []).forEach((b: any) => {
        const d = new Date(b.closed_at);
        const k = monthKey(d);
        const total = Number(b.manual_total ?? 0);
        const cur = map.get(k) ?? { monthKey: k, closedRevenue: 0, closedDeals: 0 };
        cur.closedRevenue += total;
        cur.closedDeals += 1;
        map.set(k, cur);
      });
      setClosedByMonth(map);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao carregar metas";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => {
    return targets.map((t) => {
      const k = t.target_month.slice(0, 7); // YYYY-MM
      const computed = closedByMonth.get(k)?.closedRevenue ?? 0;
      const displayed = t.revenue_override_brl ?? computed;
      const pct = t.revenue_target_brl > 0
        ? (displayed / t.revenue_target_brl) * 100
        : null;
      return {
        ...t,
        computed,
        displayed,
        usingOverride: t.revenue_override_brl !== null,
        pct,
      };
    });
  }, [targets, closedByMonth]);

  const openEdit = (t: TargetRow) => {
    setCreating(false);
    setEditing(t);
    setFormMonth(t.target_month.slice(0, 7));
    setFormTarget(Number(t.revenue_target_brl));
    setFormOverride(t.revenue_override_brl !== null ? Number(t.revenue_override_brl) : null);
  };

  const openCreate = () => {
    const now = new Date();
    setCreating(true);
    setEditing(null);
    setFormMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
    setFormTarget(null);
    setFormOverride(null);
  };

  const closeDialog = () => {
    setEditing(null);
    setCreating(false);
  };

  const handleSave = async () => {
    if (!formMonth || !/^\d{4}-\d{2}$/.test(formMonth)) {
      toast.error("Mês inválido. Use o formato AAAA-MM.");
      return;
    }
    if (formTarget === null || formTarget < 0) {
      toast.error("Informe uma meta válida.");
      return;
    }
    setSaving(true);
    try {
      const monthIso = `${formMonth}-01`;
      if (editing) {
        const { error } = await supabase
          .from("commercial_targets")
          .update({
            target_month: monthIso,
            revenue_target_brl: formTarget,
            revenue_override_brl: formOverride,
          })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        // checa duplicidade
        const { data: existing } = await supabase
          .from("commercial_targets")
          .select("id")
          .is("owner_id", null)
          .eq("target_month", monthIso)
          .maybeSingle();
        if (existing?.id) {
          toast.error("Já existe meta para este mês. Edite a existente.");
          setSaving(false);
          return;
        }
        const { error } = await supabase.from("commercial_targets").insert({
          owner_id: null,
          target_month: monthIso,
          revenue_target_brl: formTarget,
          revenue_override_brl: formOverride,
          deals_target: 0,
        });
        if (error) throw error;
      }
      toast.success(editing ? "Meta atualizada." : "Meta criada.");
      closeDialog();
      await reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao salvar";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-start justify-between gap-3 flex-wrap"
      >
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Target className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold font-display text-foreground tracking-tight">
              Histórico de Metas
            </h1>
            <p className="text-sm text-muted-foreground font-body mt-0.5">
              Meta mensal de receita comercial e atingimento histórico
            </p>
          </div>
        </div>
        {isAdmin && (
          <Button onClick={openCreate} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> Nova meta
          </Button>
        )}
      </motion.div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-2">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma meta registrada ainda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[10.5px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold">Mês</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Meta</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Resultado</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Atingimento</th>
                  <th className="text-right px-4 py-2.5 font-semibold w-16">{isAdmin ? "Ações" : ""}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-hairline/60 hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">
                      {formatMonthLong(r.target_month)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-mono">
                      {formatBRL(Number(r.revenue_target_brl))}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-mono">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <span>{formatBRL(r.displayed)}</span>
                        {r.usingOverride && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-amber-500/40 text-amber-700 dark:text-amber-300">
                            manual
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums ${attainmentTone(r.pct)}`}>
                        {r.pct === null ? "—" : `${r.pct.toFixed(0)}%`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEdit(r)}
                          aria-label="Editar meta"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={!!editing || creating} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar meta" : "Nova meta"}
            </DialogTitle>
            <DialogDescription>
              Meta mensal global de receita comercial. O resultado manual
              sobrescreve o cálculo automático baseado em contratos fechados.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="meta-month">Mês (AAAA-MM)</Label>
              <Input
                id="meta-month"
                type="month"
                value={formMonth}
                onChange={(e) => setFormMonth(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="meta-target">Meta de receita (R$)</Label>
              <CurrencyInput
                id="meta-target"
                placeholder="R$ 1.000.000,00"
                value={formTarget}
                onChange={setFormTarget}
                allowNegative={false}
                disabled={saving}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="meta-override">
                Resultado manual (R$){" "}
                <span className="text-muted-foreground font-normal">— opcional</span>
              </Label>
              <CurrencyInput
                id="meta-override"
                placeholder="Deixe em branco para usar o cálculo automático"
                value={formOverride}
                onChange={setFormOverride}
                allowNegative={false}
                disabled={saving}
              />
              <p className="text-[11px] text-muted-foreground">
                Use para registrar o resultado real de meses passados sem
                depender dos contratos fechados no sistema.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeDialog} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
