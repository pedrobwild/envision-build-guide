import { useState } from "react";
import { Drawer as VaulDrawer } from "vaul";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  AlertTriangle,
  Shield,
  CreditCard,
  MessageCircle,
  FileSignature,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { formatBRL, formatDateLong } from "@/lib/formatBRL";
import { cn } from "@/lib/utils";
import { CategoryDetailDialog } from "./CategoryDetailDialog";
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
  const [detailGroup, setDetailGroup] = useState<CategorizedGroup | null>(null);
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
              {/* ── Total card — always visible at 40% snap ── */}
              <div className="rounded-xl bg-gradient-to-br from-primary/10 to-primary/4 border border-primary/15 px-4 py-4 shadow-sm mb-3">
                <p className="text-xs font-body font-medium text-muted-foreground mb-1">
                  Investimento total
                </p>
                <p className="font-display font-extrabold text-2xl text-primary tabular-nums leading-none">
                  {formatBRL(total)}
                </p>
                <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-primary/10">
                  <Shield className="h-3 w-3 text-primary/40" aria-hidden="true" />
                  <span className="text-xs text-muted-foreground/80 font-body">
                    Preço fixo · Sem custos ocultos
                  </span>
                </div>
              </div>

              {/* Validity badge */}
              <div
                className={cn(
                  "rounded-lg px-3 py-2.5 flex items-center gap-2 mb-3",
                  validity.expired
                    ? "bg-destructive/8 border border-destructive/15"
                    : validity.daysLeft <= 5
                      ? "bg-warning/8 border border-warning/15"
                      : "bg-success/8 border border-success/15"
                )}
              >
                {validity.expired ? (
                  <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" aria-hidden="true" />
                ) : (
                  <Clock
                    className={cn(
                      "h-4 w-4 flex-shrink-0",
                      validity.daysLeft <= 5 ? "text-warning" : "text-success"
                    )}
                    aria-hidden="true"
                  />
                )}
                <p
                  className={cn(
                    "text-xs font-body leading-snug",
                    validity.expired ? "text-destructive" : "text-foreground"
                  )}
                >
                  {validity.expired
                    ? "Condições expiradas — solicite valores atualizados."
                    : `Condições válidas até ${formatDateLong(validity.expiresAt)}`}
                </p>
              </div>

              {/* ── Category composition ── */}
              {categorizedGroups.length > 0 && (
                <div className="rounded-xl border border-border bg-background px-3 py-3 space-y-0.5 mb-3">
                  <p className="text-xs font-display font-semibold text-muted-foreground tracking-wider mb-2">
                    Composição do investimento
                  </p>
                  {categorizedGroups.map((group) => (
                    <button
                      key={group.category.id}
                      onClick={() => setDetailGroup(group)}
                      className="w-full flex items-center gap-2.5 py-2.5 px-1.5 rounded-lg hover:bg-muted/50 active:bg-muted/70 transition-colors min-h-[44px]"
                    >
                      <div
                        className={cn(
                          "w-1 h-4 rounded-full flex-shrink-0",
                          group.category.bgClass
                        )}
                      />
                      <span className="flex-1 text-[13px] font-body text-foreground leading-snug text-left">
                        {group.sections.length === 1 ? group.sections[0].title : group.category.label}
                      </span>
                      <span className="text-[13px] font-mono tabular-nums font-semibold text-foreground whitespace-nowrap">
                        {formatBRL(group.subtotal)}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )}

              {/* ── Installment simulator ── */}
              <div className="rounded-xl border border-border bg-background px-3 py-3 mb-4">
                <div className="flex items-center gap-2 mb-2.5">
                  <CreditCard className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  <span className="text-[13px] font-display font-bold text-foreground">
                    Simule o parcelamento
                  </span>
                </div>

                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors min-h-[44px]"
                >
                  <span className="text-[13px] font-body font-medium text-foreground">
                    {installments}× {installments === 1 ? "parcela" : "parcelas"}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold tabular-nums text-primary">
                      {formatBRL(total / installments)}
                    </span>
                    <ChevronDown className={cn(
                      "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
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
                      <div className="mt-1.5 max-h-[180px] overflow-y-auto rounded-lg border border-border/50 bg-muted/20 divide-y divide-border/30">
                        {Array.from({ length: 18 }, (_, i) => i + 1).map((n) => (
                          <button
                            key={n}
                            onClick={() => { setInstallments(n); setDropdownOpen(false); }}
                            className={cn(
                              "w-full flex items-center justify-between px-3 py-2 text-[13px] font-body transition-colors min-h-[40px]",
                              installments === n
                                ? "bg-primary/10 text-primary font-semibold"
                                : "text-foreground hover:bg-muted/50"
                            )}
                          >
                            <span>{n}× {n === 1 ? "parcela" : "parcelas"}</span>
                            <span className="font-semibold tabular-nums">{formatBRL(total / n)}</span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <p className="text-xs text-muted-foreground font-body mt-2.5 text-center">
                  Condições sob consulta com sua consultora
                </p>
              </div>

              {/* ── CTA ── */}
              {validity.expired ? (
                <motion.a
                  href={whatsappUpdateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileTap={{ scale: 0.97 }}
                  className="w-full min-h-[52px] rounded-xl bg-primary text-primary-foreground font-display font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-primary/20 active:shadow-sm transition-shadow"
                >
                  <MessageCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                  Solicitar atualização
                </motion.a>
              ) : (
                <motion.button
                  onClick={() => setContractOpen(true)}
                  whileTap={{ scale: 0.97 }}
                  className="w-full min-h-[52px] rounded-xl bg-primary text-primary-foreground font-display font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-primary/20 active:shadow-sm transition-shadow"
                >
                  <FileSignature className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                  Solicitar Contrato
                </motion.button>
              )}
            </div>
          </VaulDrawer.Content>
        </VaulDrawer.Portal>
      </VaulDrawer.Root>

      {/* Category detail dialog */}
      <CategoryDetailDialog
        open={!!detailGroup}
        onClose={() => setDetailGroup(null)}
        group={detailGroup}
      />

      {/* Contract request dialog */}
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
