import { useState, useRef, useEffect } from "react";
import { SectionSummaryRow } from "./SectionSummaryRow";
import { CountUpValue } from "./CountUpValue";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  AlertTriangle,
  Shield,
  CreditCard,
  MessageCircle,
  ChevronDown,
  TrendingUp,
} from "lucide-react";
import { formatBRL, formatDateLong } from "@/lib/formatBRL";
import { cn } from "@/lib/utils";

import { ContractRequestDialog } from "./ContractRequestDialog";
import { WhatsAppCommentDialog } from "./WhatsAppCommentDialog";
import type { CategorizedGroup } from "@/lib/scope-categories";

interface MobileInlineSummaryProps {
  total: number;
  validity: {
    expired: boolean;
    daysLeft: number;
    expiresAt: Date;
  };
  categorizedGroups: CategorizedGroup[];
  projectName?: string;
  clientName?: string;
  publicId: string;
  budgetId?: string;
  onTotalCardVisibilityChange?: (visible: boolean) => void;
}

const DEFAULT_PHONE = "5511911906183";

export function MobileInlineSummary({
  total,
  validity,
  categorizedGroups,
  projectName,
  clientName,
  publicId,
  budgetId,
  onTotalCardVisibilityChange,
}: MobileInlineSummaryProps) {
  const [installments, setInstallments] = useState(18);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  
  const [contractOpen, setContractOpen] = useState(false);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const totalCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!totalCardRef.current || !onTotalCardVisibilityChange) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        onTotalCardVisibilityChange(entry.isIntersecting);
      },
      { threshold: 0.5 }
    );

    observer.observe(totalCardRef.current);
    return () => observer.disconnect();
  }, [onTotalCardVisibilityChange]);

  const whatsappUpdateUrl = `https://wa.me/${DEFAULT_PHONE}?text=${encodeURIComponent(
    `Olá! O orçamento ${projectName || "do projeto"} (Ref: ${publicId}) expirou. Gostaria de solicitar uma atualização de valores.`
  )}`;

  return (
    <div
      id="resumo-mobile"
      className="lg:hidden scroll-mt-24"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="space-y-4"
      >
        {/* Section title */}
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.08em] font-body font-semibold text-muted-foreground/60">
            Investimento
          </p>
          <h2 className="text-xl font-display font-bold text-foreground tracking-tight">
            Resumo do investimento
          </h2>
        </div>

        {/* Validity badge */}
        <div
          className={cn(
            "rounded-xl px-3.5 py-2.5 flex items-center gap-2.5",
            validity.expired
              ? "bg-destructive/[0.06] border border-destructive/[0.12]"
              : validity.daysLeft <= 5
                ? "bg-warning/[0.06] border border-warning/[0.12]"
                : "bg-muted/50 border border-border"
          )}
        >
          {validity.expired ? (
            <AlertTriangle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
          ) : (
            <Clock
              className={cn(
                "h-3.5 w-3.5 flex-shrink-0",
                validity.daysLeft <= 5 ? "text-warning" : "text-muted-foreground"
              )}
            />
          )}
          <p
            className={cn(
              "text-xs font-body leading-snug",
              validity.expired ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {validity.expired
              ? "Condições expiradas — solicite valores atualizados."
              : `Condições válidas até ${formatDateLong(validity.expiresAt)}`}
          </p>
        </div>

        {/* ── Total card — premium glassmorphism ── */}
        <motion.div
          ref={totalCardRef}
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative rounded-2xl border border-primary/10 px-5 py-5 overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, hsl(var(--primary) / 0.07) 0%, hsl(var(--primary) / 0.03) 50%, hsl(var(--background)) 100%)',
            boxShadow: '0 8px 32px -8px hsl(var(--primary) / 0.12), 0 2px 8px -2px hsl(var(--primary) / 0.06)',
          }}
        >
          {/* Subtle glow accent */}
          <div
            className="absolute -top-20 -right-20 w-48 h-48 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.08) 0%, transparent 70%)' }}
          />
          {/* Bottom glow */}
          <div
            className="absolute -bottom-12 -left-12 w-32 h-32 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.05) 0%, transparent 70%)' }}
          />

          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-3.5 w-3.5 text-primary/60" />
              <p className="text-[10px] uppercase tracking-[0.08em] font-body font-semibold text-muted-foreground/60">
                Investimento total
              </p>
            </div>
            <CountUpValue
              value={total}
              className="font-mono font-extrabold text-[2rem] text-primary leading-none block tabular-nums"
              style={{ letterSpacing: '-0.03em', fontFeatureSettings: '"tnum" 1' }}
            />
            <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-primary/[0.08]">
              <Shield className="h-3 w-3 text-primary/40" />
              <span className="text-[11px] text-muted-foreground/60 font-body">
                Preço fixo · Sem custos ocultos
              </span>
            </div>
          </div>
        </motion.div>

        {/* ── Composition breakdown ── */}
        {categorizedGroups.length > 0 && (
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="px-4 pt-4 pb-2">
              <p className="text-[10px] uppercase tracking-[0.08em] font-body font-semibold text-muted-foreground/60">
                Composição do investimento
              </p>
            </div>
            <motion.div
              className="px-3 pb-3"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.15 }}
              variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
            >
              {categorizedGroups.flatMap((group) =>
                group.sections.map((section) => (
                  <motion.div
                    key={section.id}
                    variants={{
                      hidden: { opacity: 0, y: 8 },
                      visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
                    }}
                  >
                    <SectionSummaryRow
                      section={section}
                      colorClass={group.category.colorClass}
                      bgClass={group.category.bgClass}
                      compact
                    />
                  </motion.div>
                ))
              )}
            </motion.div>
          </div>
        )}

        {/* ── Installment simulator ── */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="px-4 pt-4 pb-2.5">
            <div className="flex items-center gap-2">
              <CreditCard className="h-3.5 w-3.5 text-primary/70" />
              <span className="text-[10px] uppercase tracking-[0.08em] font-body font-semibold text-muted-foreground/60">
                Simule o parcelamento
              </span>
            </div>
          </div>

          <div className="px-4 pb-4">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl border border-border bg-muted/20 hover:bg-muted/40 active:bg-muted/60 transition-colors min-h-[48px]"
            >
              <span className="text-sm font-body font-medium text-foreground">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={installments}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="inline-block"
                  >
                    {installments}× {installments === 1 ? "parcela" : "parcelas"}
                  </motion.span>
                </AnimatePresence>
              </span>
              <div className="flex items-center gap-2.5">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={installments}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    className="text-sm font-mono font-semibold tabular-nums text-primary inline-block"
                  >
                    {formatBRL(total / installments)}
                  </motion.span>
                </AnimatePresence>
                <ChevronDown className={cn(
                  "h-3.5 w-3.5 text-muted-foreground/50 transition-transform duration-200",
                  dropdownOpen && "rotate-180"
                )} />
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
                        <span className="font-body">{n}× {n === 1 ? "parcela" : "parcelas"}</span>
                        <span className="font-mono font-semibold tabular-nums">
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

        {/* ── Inline CTA ── */}
        {validity.expired ? (
          <motion.a
            href={whatsappUpdateUrl}
            target="_blank"
            rel="noopener noreferrer"
            whileTap={{ scale: 0.97 }}
            className="w-full min-h-[52px] rounded-xl bg-primary text-primary-foreground font-display font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-primary/15 active:shadow-sm transition-shadow"
          >
            <MessageCircle className="h-4 w-4 flex-shrink-0" />
            Solicitar atualização
          </motion.a>
        ) : (
          <motion.button
            onClick={() => setWhatsappOpen(true)}
            whileTap={{ scale: 0.97 }}
            className="w-full min-h-[52px] rounded-xl bg-primary text-primary-foreground font-display font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-primary/15 active:shadow-sm transition-shadow"
          >
            <MessageCircle className="h-4 w-4 flex-shrink-0" />
            Falar com comercial
          </motion.button>
        )}
      </motion.div>

      <ContractRequestDialog
        open={contractOpen}
        onOpenChange={setContractOpen}
        budgetId={budgetId || ""}
        publicId={publicId}
        projectName={projectName}
        total={total}
      />

      <WhatsAppCommentDialog
        open={whatsappOpen}
        onOpenChange={setWhatsappOpen}
        publicId={publicId}
        projectName={projectName}
      />
    </div>
  );
}
