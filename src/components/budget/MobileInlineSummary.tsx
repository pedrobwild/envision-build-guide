import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

import { ProposalValidityCard } from "./summary/ProposalValidityCard";
import { InvestmentSummaryCard } from "./summary/InvestmentSummaryCard";
import { CategoryAccordionList } from "./summary/CategoryAccordionList";
import { InstallmentSimulator } from "./summary/InstallmentSimulator";
import { PrimaryCTAButton } from "./summary/PrimaryCTAButton";
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
  /** Show loading skeleton */
  loading?: boolean;
  /** Budget was revised with new validity */
  revised?: boolean;
  /** Contract already requested */
  contractRequested?: boolean;
  /** Promotional discount amount (positive number) */
  discount?: number;
  /** Credit/abatement amount (positive number) */
  credit?: number;
  /** Subtotal before discount+credit */
  subtotal?: number;
}

const DEFAULT_PHONE = "5511911906183";
const LABEL = "text-[10px] uppercase tracking-[0.08em] font-body font-semibold text-muted-foreground/50";
const HEADING = "font-display font-bold text-foreground tracking-tight";

export function MobileInlineSummary({
  total,
  validity,
  categorizedGroups,
  projectName,
  clientName,
  publicId,
  budgetId,
  onTotalCardVisibilityChange,
  loading,
  revised,
  contractRequested,
}: MobileInlineSummaryProps) {
  const [installments, setInstallments] = useState(12);
  const [contractOpen, setContractOpen] = useState(false);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const totalCardRef = useRef<HTMLDivElement>(null);

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
        {/* ── Heading ── */}
        <div className="space-y-1.5">
          <p className={LABEL}>Investimento</p>
          <h2 className={cn(HEADING, "text-xl")}>Resumo do investimento</h2>
        </div>

        {/* ── Hero total ── */}
        <InvestmentSummaryCard
          ref={totalCardRef}
          total={total}
          installments={installments}
          loading={loading}
        />

        {/* ── Validity ── */}
        <ProposalValidityCard
          expired={validity.expired}
          daysLeft={validity.daysLeft}
          expiresAt={validity.expiresAt}
          revised={revised}
        />

        {/* ── Composition accordion ── */}
        <CategoryAccordionList
          categorizedGroups={categorizedGroups}
          total={total}
          loading={loading}
        />

        {/* ── Installment simulator ── */}
        <InstallmentSimulator
          total={total}
          installments={installments}
          onInstallmentsChange={setInstallments}
        />

        {/* ── CTA ── */}
        <PrimaryCTAButton
          expired={validity.expired}
          whatsappUrl={whatsappUpdateUrl}
          contractRequested={contractRequested}
          onClick={() => setWhatsappOpen(true)}
        />
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
