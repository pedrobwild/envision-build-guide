import { useState, useRef, useEffect, useMemo } from "react";
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
  CheckCircle2,
  Layers,
} from "lucide-react";
import { formatBRL, formatDateLong } from "@/lib/formatBRL";
import { cn } from "@/lib/utils";
import { calculateSectionSubtotal } from "@/lib/supabase-helpers";

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

/* ── Typography tokens (Sora / Inter / Geist Mono) ── */
const LABEL = "text-[10px] uppercase tracking-[0.08em] font-body font-semibold text-muted-foreground/50";
const HEADING = "font-display font-bold text-foreground tracking-tight";
const BODY_SM = "text-xs font-body leading-snug";
const MONO_VALUE = "font-mono tabular-nums font-semibold text-primary";
const MONO_STYLE: React.CSSProperties = { fontFeatureSettings: '"tnum" 1', letterSpacing: '-0.02em' };

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
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(null);
  const [installments, setInstallments] = useState(18);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const totalCardRef = useRef<HTMLDivElement>(null);

  // Flatten sections for accordion
  const allSections = useMemo(() =>
    categorizedGroups.flatMap((group) =>
      group.sections.map((section) => ({
        section,
        colorClass: group.category.colorClass,
        bgClass: group.category.bgClass,
        subtotal: calculateSectionSubtotal(section),
      }))
    ), [categorizedGroups]
  );

  const totalSections = allSections.length;
  const totalItems = allSections.reduce((acc, s) => acc + (s.section.items?.length || 0), 0);

  useEffect(() => {
    if (!totalCardRef.current || !onTotalCardVisibilityChange) return;
    const observer = new IntersectionObserver(
      ([entry]) => onTotalCardVisibilityChange(entry.isIntersecting),
      { threshold: 0.5 }
    );
    observer.observe(totalCardRef.current);
    return () => observer.disconnect();
  }, [onTotalCardVisibilityChange]);

  const whatsappUpdateUrl = `https://wa.me/${DEFAULT_PHONE}?text=${encodeURIComponent(
    `Olá! O orçamento ${projectName || "do projeto"} (Ref: ${publicId}) expirou. Gostaria de solicitar uma atualização de valores.`
  )}`;

  return (
    <div id="resumo-mobile" className="lg:hidden scroll-mt-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="space-y-6"
      >
        {/* ────── Section heading ────── */}
        <div className="space-y-1.5">
          <p className={LABEL}>Investimento</p>
          <h2 className={cn(HEADING, "text-xl")}>Resumo do investimento</h2>
        </div>

        {/* ────── HERO: Total investment card ────── */}
        <motion.div
          ref={totalCardRef}
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative rounded-2xl border border-primary/10 px-6 py-7 overflow-hidden"
          style={{
            background: 'linear-gradient(145deg, hsl(var(--primary) / 0.06) 0%, hsl(var(--primary) / 0.02) 40%, hsl(var(--background)) 100%)',
            boxShadow: '0 12px 40px -12px hsl(var(--primary) / 0.12), 0 4px 12px -4px hsl(var(--primary) / 0.05)',
          }}
        >
          {/* Decorative glows */}
          <div
            className="absolute -top-24 -right-24 w-56 h-56 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.07) 0%, transparent 70%)' }}
          />
          <div
            className="absolute -bottom-16 -left-16 w-40 h-40 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.04) 0%, transparent 70%)' }}
          />

          <div className="relative space-y-5">
            {/* Total value — hero treatment */}
            <div className="space-y-2">
              <p className={cn(LABEL, "text-muted-foreground/40")}>Investimento total</p>
              <CountUpValue
                value={total}
                className="font-mono font-extrabold text-[2.25rem] text-primary leading-none block tabular-nums"
                style={{ letterSpacing: '-0.03em', fontFeatureSettings: '"tnum" 1' }}
              />
            </div>

            {/* Installment preview — inline, not a separate card */}
            <div className="flex items-baseline gap-1.5">
              <span className="text-[12px] font-body text-muted-foreground/50">ou</span>
              <span className="font-mono text-sm font-semibold text-foreground tabular-nums" style={MONO_STYLE}>
                {formatBRL(total / installments)}
              </span>
              <span className="text-[12px] font-body text-muted-foreground/50">
                em {installments}× sem juros
              </span>
            </div>

            {/* Trust signals */}
            <div className="flex items-center gap-4 pt-4 border-t border-primary/[0.06]">
              <div className="flex items-center gap-1.5">
                <Shield className="h-3 w-3 text-primary/35" />
                <span className="text-[11px] text-muted-foreground/50 font-body">Preço fixo</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-primary/35" />
                <span className="text-[11px] text-muted-foreground/50 font-body">Sem custos ocultos</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ────── Validity ────── */}
        <div
          className={cn(
            "rounded-xl px-3.5 py-2.5 flex items-center gap-2.5",
            validity.expired
              ? "bg-destructive/[0.05] border border-destructive/[0.10]"
              : validity.daysLeft <= 5
                ? "bg-warning/[0.05] border border-warning/[0.10]"
                : "bg-muted/30 border border-border/60"
          )}
        >
          {validity.expired ? (
            <AlertTriangle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
          ) : (
            <Clock className={cn(
              "h-3.5 w-3.5 flex-shrink-0",
              validity.daysLeft <= 5 ? "text-warning" : "text-muted-foreground/60"
            )} />
          )}
          <p className={cn(BODY_SM, validity.expired ? "text-destructive" : "text-muted-foreground/70")}>
            {validity.expired
              ? "Condições expiradas — solicite valores atualizados."
              : `Válido até ${formatDateLong(validity.expiresAt)}`}
          </p>
        </div>

        {/* ────── Composition breakdown (accordion) ────── */}
        {allSections.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-3.5 w-3.5 text-muted-foreground/40" />
                <p className={LABEL}>O que está incluído</p>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground/35 tabular-nums" style={MONO_STYLE}>
                {totalSections} {totalSections === 1 ? "categoria" : "categorias"} · {totalItems} itens
              </span>
            </div>

            <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
              {/* Distribution bar */}
              <div className="px-3 pt-3 pb-1">
                <div className="flex h-[3px] rounded-full overflow-hidden bg-muted/30">
                  {allSections.map((s) => {
                    const pct = total > 0 ? (s.subtotal / total) * 100 : 0;
                    if (pct <= 0) return null;
                    return (
                      <div
                        key={s.section.id}
                        className={cn("transition-all duration-500", s.bgClass)}
                        style={{ width: `${pct}%` }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Section rows — one expanded at a time */}
              <div className="divide-y divide-border/[0.06]">
                {allSections.map((s) => (
                  <SectionSummaryRow
                    key={s.section.id}
                    section={s.section}
                    colorClass={s.colorClass}
                    bgClass={s.bgClass}
                    compact
                    isExpanded={expandedSectionId === s.section.id}
                    onToggle={() =>
                      setExpandedSectionId((prev) =>
                        prev === s.section.id ? null : s.section.id
                      )
                    }
                    percentage={total > 0 ? (s.subtotal / total) * 100 : 0}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ────── Installment simulator (collapsed by default) ────── */}
        <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-full flex items-center justify-between px-4 py-3.5 min-h-[48px]"
          >
            <div className="flex items-center gap-2">
              <CreditCard className="h-3.5 w-3.5 text-muted-foreground/50" />
              <span className="text-[13px] font-body font-medium text-foreground">Simular parcelamento</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn(MONO_VALUE, "text-[13px]")} style={MONO_STYLE}>
                {installments}×
              </span>
              <ChevronDown className={cn(
                "h-3.5 w-3.5 text-muted-foreground/40 transition-transform duration-200",
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
                <div className="px-4 pb-4">
                  <div className="max-h-[240px] overflow-y-auto rounded-xl border border-border/30 bg-background divide-y divide-border/[0.06]">
                    {[1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 18].map((n) => (
                      <button
                        key={n}
                        onClick={() => { setInstallments(n); setDropdownOpen(false); }}
                        className={cn(
                          "w-full flex items-center justify-between px-3.5 py-2.5 text-sm transition-colors min-h-[44px]",
                          installments === n
                            ? "bg-primary/[0.05] text-primary"
                            : "text-foreground hover:bg-muted/30"
                        )}
                      >
                        <span className="font-body text-[13px]">
                          <span className="font-mono tabular-nums" style={MONO_STYLE}>{n}</span>
                          <span className="text-muted-foreground/60 ml-1">× {n === 1 ? "parcela" : "parcelas"}</span>
                        </span>
                        <span className="font-mono font-semibold tabular-nums text-[13px]" style={MONO_STYLE}>
                          {formatBRL(total / n)}
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground/40 font-body mt-2.5 text-center">
                    Condições sob consulta
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ────── Inline CTA ────── */}
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
