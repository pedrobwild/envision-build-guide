import { useState } from "react";
import { SectionSummaryRow } from "./SectionSummaryRow";
import { Drawer as VaulDrawer } from "vaul";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  AlertTriangle,
  Shield,
  CreditCard,
  MessageCircle,
  FileSignature,
  ChevronDown,
  TrendingUp,
} from "lucide-react";
import { formatBRL, formatDateLong } from "@/lib/formatBRL";
import { cn } from "@/lib/utils";

import { ContractRequestDialog } from "./ContractRequestDialog";
import type { CategorizedGroup } from "@/lib/scope-categories";

interface MobileFinancialSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  total: number;
  validity: {
    expired: boolean;
    daysLeft: number;
    expiresAt: Date;
  };
  categorizedGroups: CategorizedGroup[];
  projectName?: string;
  publicId: string;
  budgetId?: string;
}

const DEFAULT_PHONE = "5511911906183";
const SNAP_POINTS = [0.45, 0.88] as const;

/* ── Typography tokens (branding: Sora / Inter / Geist Mono) ── */
const LABEL = "text-[10px] uppercase tracking-[0.08em] font-body font-semibold text-muted-foreground/60";
const BODY_SM = "text-xs font-body leading-snug";
const MONO_STYLE: React.CSSProperties = { fontFeatureSettings: '"tnum" 1', letterSpacing: '-0.02em' };

export function MobileFinancialSheet({
  open,
  onOpenChange,
  total,
  validity,
  categorizedGroups,
  projectName,
  publicId,
  budgetId,
}: MobileFinancialSheetProps & { clientName?: string }) {
  const [snap, setSnap] = useState<number | string | null>(SNAP_POINTS[0]);
  const [installments, setInstallments] = useState(10);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  
  const [contractOpen, setContractOpen] = useState(false);

  const whatsappUpdateUrl = `https://wa.me/${DEFAULT_PHONE}?text=${encodeURIComponent(
    `Olá! O orçamento ${projectName || "do projeto"} (Ref: ${publicId}) expirou. Gostaria de solicitar uma atualização de valores.`
  )}`;

  return (
    <>
      <VaulDrawer.Root
        open={open}
        onOpenChange={onOpenChange}
        snapPoints={[...SNAP_POINTS]}
        activeSnapPoint={snap}
        setActiveSnapPoint={setSnap}
        modal={true}
      >
        <VaulDrawer.Portal>
          <VaulDrawer.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" />
          <VaulDrawer.Content
            className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl border-t border-border bg-card shadow-[0_-8px_30px_-10px_hsl(var(--foreground)/0.12)] outline-none"
            style={{ height: "85vh" }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1.5 w-12 rounded-full bg-muted-foreground/20" />
            </div>

            {/* Scrollable content */}
            <div
              className={cn(
                "flex-1 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]",
                snap === SNAP_POINTS[0] && "overflow-hidden"
              )}
            >
              {/* ── Total card ── */}
              <div
                className="relative rounded-2xl border border-primary/10 px-5 py-5 overflow-hidden mb-3"
                style={{
                  background: 'linear-gradient(135deg, hsl(var(--primary) / 0.07) 0%, hsl(var(--primary) / 0.03) 50%, hsl(var(--background)) 100%)',
                  boxShadow: '0 8px 32px -8px hsl(var(--primary) / 0.12), 0 2px 8px -2px hsl(var(--primary) / 0.06)',
                }}
              >
                <div
                  className="absolute -top-16 -right-16 w-40 h-40 rounded-full pointer-events-none"
                  style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.08) 0%, transparent 70%)' }}
                />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-3.5 w-3.5 text-primary/60" />
                    <p className={LABEL}>Investimento total</p>
                  </div>
                  <p
                    className="font-mono font-extrabold text-2xl text-primary tabular-nums leading-none"
                    style={{ letterSpacing: '-0.03em', fontFeatureSettings: '"tnum" 1' }}
                  >
                    {formatBRL(total)}
                  </p>
                  <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-primary/[0.08]">
                    <Shield className="h-3 w-3 text-primary/40" aria-hidden="true" />
                    <span className="text-[11px] text-muted-foreground/60 font-body">
                      Preço fixo · Sem custos ocultos
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Validity badge ── */}
              <div
                className={cn(
                  "rounded-xl px-3.5 py-2.5 flex items-center gap-2.5 mb-3",
                  validity.expired
                    ? "bg-destructive/[0.06] border border-destructive/[0.12]"
                    : validity.daysLeft <= 5
                      ? "bg-warning/[0.06] border border-warning/[0.12]"
                      : "bg-muted/50 border border-border"
                )}
              >
                {validity.expired ? (
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive flex-shrink-0" aria-hidden="true" />
                ) : (
                  <Clock
                    className={cn(
                      "h-3.5 w-3.5 flex-shrink-0",
                      validity.daysLeft <= 5 ? "text-warning" : "text-muted-foreground"
                    )}
                    aria-hidden="true"
                  />
                )}
                <p className={cn(BODY_SM, validity.expired ? "text-destructive" : "text-muted-foreground")}>
                  {validity.expired
                    ? "Condições expiradas — solicite valores atualizados."
                    : `Condições válidas até ${formatDateLong(validity.expiresAt)}`}
                </p>
              </div>

              {/* ── Category composition ── */}
              {categorizedGroups.length > 0 && (
                <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm mb-3">
                  <div className="px-4 pt-4 pb-1.5 flex items-center justify-between">
                    <p className={LABEL}>Composição do investimento</p>
                    <span className="text-[10px] font-mono text-muted-foreground/40 tabular-nums" style={MONO_STYLE}>
                      {categorizedGroups.reduce((acc, g) => acc + g.sections.length, 0)} seções
                    </span>
                  </div>
                  <div className="px-2 pb-2.5">
                    {categorizedGroups.flatMap((group) =>
                      group.sections.map((section) => (
                        <SectionSummaryRow
                          key={section.id}
                          section={section}
                          colorClass={group.category.colorClass}
                          bgClass={group.category.bgClass}
                          compact
                        />
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* ── Installment simulator ── */}
              <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm mb-4">
                <div className="px-4 pt-4 pb-2.5">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-3.5 w-3.5 text-primary/70" aria-hidden="true" />
                    <span className={LABEL}>Simule o parcelamento</span>
                  </div>
                </div>

                <div className="px-4 pb-4">
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl border border-border bg-muted/20 hover:bg-muted/40 active:bg-muted/60 transition-colors min-h-[48px]"
                  >
                    <span className="text-sm font-body font-medium text-foreground inline-flex items-baseline gap-1">
                      <span className="font-mono tabular-nums" style={MONO_STYLE}>{installments}</span>
                      <span>× {installments === 1 ? "parcela" : "parcelas"}</span>
                    </span>
                    <div className="flex items-center gap-2.5">
                      <span
                        className="text-sm font-mono font-semibold tabular-nums text-primary"
                        style={MONO_STYLE}
                      >
                        {formatBRL(total / installments)}
                      </span>
                      <ChevronDown className={cn(
                        "h-3.5 w-3.5 text-muted-foreground/50 transition-transform duration-200",
                        dropdownOpen && "rotate-180"
                      )} aria-hidden="true" />
                    </div>
                  </button>

                  <AnimatePresence>
                    {dropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="mt-2 max-h-[220px] overflow-y-auto rounded-xl border border-border/40 bg-card divide-y divide-border/20">
                          {Array.from({ length: 18 }, (_, i) => i + 1).map((n) => (
                            <button
                              key={n}
                              onClick={() => { setInstallments(n); setDropdownOpen(false); }}
                              className={cn(
                                "w-full flex items-center justify-between px-3.5 py-2.5 text-sm transition-colors min-h-[44px]",
                                installments === n
                                  ? "bg-primary/[0.06] text-primary font-medium"
                                  : "text-foreground hover:bg-muted/40"
                              )}
                            >
                              <span className="font-body inline-flex items-baseline gap-1">
                                <span className="font-mono tabular-nums" style={MONO_STYLE}>{n}</span>
                                <span>× {n === 1 ? "parcela" : "parcelas"}</span>
                              </span>
                              <span className="font-mono font-semibold tabular-nums" style={MONO_STYLE}>
                                {formatBRL(total / n)}
                                <span className="font-body font-normal text-muted-foreground/50 ml-1.5 text-[11px]">sem juros</span>
                              </span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <p className="text-[11px] text-muted-foreground/50 font-body mt-3 text-center">
                    Condições sob consulta com sua consultora
                  </p>
                </div>
              </div>

              {/* ── CTA ── */}
              {validity.expired ? (
                <motion.a
                  href={whatsappUpdateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileTap={{ scale: 0.97 }}
                  className="w-full min-h-[52px] rounded-xl bg-primary text-primary-foreground font-display font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-primary/15 active:shadow-sm transition-shadow"
                >
                  <MessageCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                  Solicitar atualização
                </motion.a>
              ) : (
                <motion.button
                  onClick={() => setContractOpen(true)}
                  whileTap={{ scale: 0.97 }}
                  className="w-full min-h-[52px] rounded-xl bg-primary text-primary-foreground font-display font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-primary/15 active:shadow-sm transition-shadow"
                >
                  <FileSignature className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                  Solicitar Contrato
                </motion.button>
              )}
            </div>
          </VaulDrawer.Content>
        </VaulDrawer.Portal>
      </VaulDrawer.Root>

      <ContractRequestDialog
        open={contractOpen}
        onOpenChange={setContractOpen}
        budgetId={budgetId || ""}
        publicId={publicId}
        projectName={projectName}
        total={total}
      />
    </>
  );
}
