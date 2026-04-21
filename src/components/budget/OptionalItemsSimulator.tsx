import { useState, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/formatBRL";
import { calculateSectionSubtotal } from "@/lib/supabase-helpers";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus, Check, Loader2, ShoppingBag, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { BudgetSection } from "@/types/budget";

interface OptionalItemsSimulatorProps {
  budgetId: string;
  sections: BudgetSection[];
  baseTotal: number;
  clientName?: string;
  projectName?: string;
}

export function OptionalItemsSimulator({
  budgetId,
  sections,
  baseTotal,
  clientName,
  projectName,
}: OptionalItemsSimulatorProps) {
  const optionalSections = useMemo(
    () => sections.filter((s) => s.is_optional),
    [sections]
  );

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState(clientName || "");
  const [formEmail, setFormEmail] = useState("");
  // Atomic guard against double-submit (B11): React state update is async,
  // so two clicks within the same tick can both pass the `if (confirming)` check.
  const submittingRef = useRef(false);

  if (optionalSections.length === 0) return null;

  const toggleSection = (id: string) => {
    if (confirmed) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const selectedTotal = optionalSections
    .filter((s) => selectedIds.has(s.id))
    .reduce((sum, s) => sum + calculateSectionSubtotal(s), 0);

  const simulatedTotal = baseTotal + selectedTotal;

  const handleConfirm = async () => {
    if (submittingRef.current) return;
    if (selectedIds.size === 0) {
      toast.error("Selecione ao menos um item opcional");
      return;
    }
    if (!formName.trim()) {
      toast.error("Informe seu nome");
      return;
    }
    submittingRef.current = true;
    setConfirming(true);
    try {
      const inserts = Array.from(selectedIds).map((sectionId) => ({
        budget_id: budgetId,
        section_id: sectionId,
        client_name: formName.trim(),
        client_email: formEmail.trim() || null,
        confirmed: true,
        confirmed_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from("budget_optional_selections")
        .insert(inserts);

      if (error) throw error;

      // Notify admin
      supabase.functions
        .invoke("notify-budget-view", {
          body: {
            type: "optional_selection",
            budget_id: budgetId,
            client_name: formName.trim(),
            selected_sections: optionalSections
              .filter((s) => selectedIds.has(s.id))
              .map((s) => s.title),
            selected_total: selectedTotal,
          },
        })
        .catch(() => {});

      setConfirmed(true);
      setShowForm(false);
      toast.success("Seleção confirmada! Entraremos em contato.");
    } catch (err) {
      if (import.meta.env.DEV) console.error(err);
      toast.error("Erro ao confirmar seleção. Tente novamente.");
      submittingRef.current = false;
    }
    setConfirming(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="rounded-2xl border border-border bg-card overflow-hidden shadow-lg"
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-start gap-3">
        <div className="p-2 rounded-xl bg-warning/10">
          <ShoppingBag className="h-5 w-5 text-warning" />
        </div>
        <div>
          <h3 className="budget-heading font-bold text-base text-foreground">
            Itens Opcionais
          </h3>
          <p className="text-xs text-muted-foreground font-body mt-0.5">
            Simule a inclusão de itens extras e veja o impacto no total
          </p>
        </div>
      </div>

      <div className="mx-5 border-t border-border" />

      {/* Optional items list */}
      <div className="px-5 py-4 space-y-2">
        {optionalSections.map((section) => {
          const sectionTotal = calculateSectionSubtotal(section);
          const isSelected = selectedIds.has(section.id);

          return (
            <button
              key={section.id}
              onClick={() => toggleSection(section.id)}
              disabled={confirmed}
              className={cn(
                "w-full flex items-center gap-3 py-3 px-3 -mx-1 rounded-xl transition-all duration-200",
                "border",
                isSelected
                  ? "bg-primary/5 border-primary/20 shadow-sm"
                  : "bg-transparent border-transparent hover:bg-muted/50",
                confirmed && "opacity-60 cursor-not-allowed"
              )}
            >
              {/* Toggle indicator */}
              <div
                className={cn(
                  "w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 transition-all",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/60 text-muted-foreground"
                )}
              >
                {isSelected ? (
                  <Minus className="h-3.5 w-3.5" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
              </div>

              {/* Label */}
              <span
                className={cn(
                  "flex-1 text-sm font-body font-medium text-left leading-snug",
                  isSelected ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {section.title}
              </span>

              {/* Value */}
              <span
                className={cn(
                  "text-sm budget-currency font-semibold whitespace-nowrap",
                  isSelected ? "text-primary" : "text-muted-foreground"
                )}
              >
                + {formatBRL(sectionTotal)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Simulated total */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mx-5 border-t border-border" />
            <div className="px-5 py-4">
              <div className="rounded-xl bg-gradient-to-br from-primary/8 to-primary/3 border border-primary/12 p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground font-body">
                    Total base
                  </span>
                  <span className="text-sm budget-currency text-muted-foreground">
                    {formatBRL(baseTotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-warning font-body font-medium flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Opcionais selecionados
                  </span>
                  <span className="text-sm budget-currency text-warning font-semibold">
                    + {formatBRL(selectedTotal)}
                  </span>
                </div>
                <div className="border-t border-primary/10 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-body font-medium text-foreground">
                      Novo Total Simulado
                    </span>
                    <motion.span
                      key={simulatedTotal}
                      initial={{ scale: 0.95 }}
                      animate={{ scale: 1 }}
                      className="budget-currency font-extrabold text-lg text-primary"
                    >
                      {formatBRL(simulatedTotal)}
                    </motion.span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm section */}
      {!confirmed && selectedIds.size > 0 && (
        <div className="px-5 pb-5">
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-body font-semibold text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
            >
              <Check className="h-4 w-4" />
              Confirmar inclusão dos opcionais
            </button>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Seu nome"
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm font-body placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="Seu e-mail (opcional)"
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm font-body placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-border text-muted-foreground font-body text-sm hover:bg-muted/50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={confirming}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-body font-semibold text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {confirming ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Confirmar
                </button>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Confirmed state */}
      {confirmed && (
        <div className="px-5 pb-5">
          <div className="rounded-xl bg-success/10 border border-success/20 p-4 text-center">
            <Check className="h-6 w-6 text-success mx-auto mb-2" />
            <p className="text-sm font-body font-medium text-foreground">
              Seleção confirmada!
            </p>
            <p className="text-xs text-muted-foreground font-body mt-1">
              Nossa equipe entrará em contato para atualizar seu orçamento.
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
}
