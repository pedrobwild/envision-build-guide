/**
 * EditableMetaCard — bloco "Meta do mês" do painel comercial.
 *
 * Mostra a meta e o resultado do mês corrente. Para admin, expõe
 * um popover de edição que permite:
 *   - Definir a meta de receita do mês (commercial_targets.revenue_target_brl)
 *   - Sobrescrever manualmente o resultado exibido
 *     (commercial_targets.revenue_override_brl). Quando o override está
 *     definido, ele substitui o cálculo automático e a UI sinaliza isso.
 *
 * Para não-admin, é apenas leitura.
 */

import { useEffect, useMemo, useState } from "react";
import { Pencil, Target, Info } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Surface } from "@/components/dashboard/Surface";
import { MetaProgressBar } from "@/components/dashboard/MetaProgressBar";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";

interface EditableMetaCardProps {
  /** Receita fechada do mês calculada automaticamente. */
  computedRevenue: number;
  /** Loading do cálculo automático. */
  computedLoading?: boolean;
  /** Quando true habilita edição. */
  canEdit: boolean;
  /** Owner para escopo da meta. null = global (organização). */
  ownerId?: string | null;
}

interface TargetRow {
  revenue_target_brl: number | null;
  revenue_override_brl: number | null;
}

const DEFAULT_TARGET = 250_000;

function monthStartISO(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function monthLabel(): string {
  // Mostra o mês anterior (último mês fechado), com inicial maiúscula.
  // Ex.: "Abril 2026"
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const month = prev.toLocaleDateString("pt-BR", { month: "long" });
  const capitalized = month.charAt(0).toUpperCase() + month.slice(1);
  return `${capitalized} ${prev.getFullYear()}`;
}

function parseBRL(input: string): number | null {
  if (!input.trim()) return null;
  const normalized = input.replace(/\./g, "").replace(",", ".").replace(/[^0-9.-]/g, "");
  const v = Number.parseFloat(normalized);
  return Number.isFinite(v) ? v : null;
}

export function EditableMetaCard({
  computedRevenue,
  computedLoading,
  canEdit,
  ownerId = null,
}: EditableMetaCardProps) {
  const qc = useQueryClient();
  const targetMonth = monthStartISO();
  const queryKey = ["commercial-target", ownerId ?? "global", targetMonth] as const;

  const { data: row, isLoading } = useQuery<TargetRow | null>({
    queryKey,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const query = sb
        .from("commercial_targets")
        .select("revenue_target_brl, revenue_override_brl")
        .eq("target_month", targetMonth)
        .limit(1)
        .maybeSingle();
      const { data, error } = ownerId
        ? await query.eq("owner_id", ownerId)
        : await query.is("owner_id", null);
      if (error) throw error;
      return (data ?? null) as TargetRow | null;
    },
    staleTime: 30_000,
  });

  const target = row?.revenue_target_brl ?? DEFAULT_TARGET;
  const override = row?.revenue_override_brl ?? null;
  const displayedRevenue = override ?? computedRevenue;
  const usingOverride = override !== null && override !== undefined;

  // ─── Dialog state ───
  const [open, setOpen] = useState(false);
  const [targetInput, setTargetInput] = useState("");
  const [resultInput, setResultInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTargetInput(target ? String(target) : "");
      setResultInput(override !== null && override !== undefined ? String(override) : "");
    }
  }, [open, target, override]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const targetValue = parseBRL(targetInput);
      const resultValue = resultInput.trim() === "" ? null : parseBRL(resultInput);

      if (targetValue === null || targetValue < 0) {
        toast.error("Informe uma meta válida (em reais).");
        setSaving(false);
        return;
      }
      if (resultInput.trim() !== "" && (resultValue === null || resultValue < 0)) {
        toast.error("Resultado manual inválido. Deixe em branco para usar o cálculo automático.");
        setSaving(false);
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;

      // Não usamos upsert+onConflict aqui porque a UNIQUE original
      // (owner_id, target_month) trata NULLs como distintos (NULLS DISTINCT),
      // então metas globais (owner_id IS NULL) não disparam o ON CONFLICT e
      // colidem com o índice parcial commercial_targets_global_month_uniq.
      const lookup = sb
        .from("commercial_targets")
        .select("id")
        .eq("target_month", targetMonth)
        .limit(1)
        .maybeSingle();
      const { data: existing, error: lookupError } = ownerId
        ? await lookup.eq("owner_id", ownerId)
        : await lookup.is("owner_id", null);
      if (lookupError) throw lookupError;

      if (existing?.id) {
        const { error } = await sb
          .from("commercial_targets")
          .update({
            revenue_target_brl: targetValue,
            revenue_override_brl: resultValue,
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("commercial_targets").insert({
          owner_id: ownerId ?? null,
          target_month: targetMonth,
          revenue_target_brl: targetValue,
          revenue_override_brl: resultValue,
          deals_target: 0,
        });
        if (error) throw error;
      }

      toast.success("Meta atualizada.");
      await qc.invalidateQueries({ queryKey });
      setOpen(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao salvar";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const monthName = useMemo(() => monthLabel(), []);

  return (
    <Surface variant="raised" padding="md">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Target className="h-4 w-4 text-info shrink-0" aria-hidden />
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-soft font-body truncate">
            Meta do mês
          </span>
          {usingOverride && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider"
                    aria-label="Resultado manual"
                  >
                    <Info className="h-2.5 w-2.5" aria-hidden /> manual
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Resultado sobrescrito manualmente. Limpe o campo para voltar
                  ao cálculo automático.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        {canEdit && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpen(true)}
            className="h-7 px-2 -mr-1 -mt-1 text-[11px] gap-1.5"
            aria-label={`Editar meta de ${monthName}`}
          >
            <Pencil className="h-3 w-3" aria-hidden /> Editar
          </Button>
        )}
      </div>

      <MetaProgressBar
        current={displayedRevenue}
        target={target}
        label={`Meta de ${monthName}`}
        format="currency"
        loading={computedLoading || isLoading}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar meta — {monthName}</DialogTitle>
            <DialogDescription>
              Defina a meta de receita do mês e, se necessário, sobrescreva
              manualmente o resultado exibido.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="meta-target">Meta de receita (R$)</Label>
              <Input
                id="meta-target"
                inputMode="decimal"
                placeholder="250000"
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
                disabled={saving}
              />
              <p className="text-[11px] text-muted-foreground">
                Valor total a alcançar no mês.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="meta-override">
                Resultado manual (R$){" "}
                <span className="text-muted-foreground font-normal">— opcional</span>
              </Label>
              <Input
                id="meta-override"
                inputMode="decimal"
                placeholder={`Automático: ${new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                  maximumFractionDigits: 0,
                }).format(computedRevenue)}`}
                value={resultInput}
                onChange={(e) => setResultInput(e.target.value)}
                disabled={saving}
              />
              <p className="text-[11px] text-muted-foreground">
                Deixe em branco para usar o cálculo automático a partir dos
                negócios fechados.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Surface>
  );
}
