import { useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileSignature, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { mockBudget } from "@/lib/orcamento-mock-data";
import { useOrcamentoBudget } from "@/hooks/useOrcamentoBudget";
import { BudgetHero } from "@/components/orcamento/BudgetHero";
import { ServicesSection } from "@/components/orcamento/ServicesSection";
import { JourneySection } from "@/components/orcamento/JourneySection";
import { ScopeSection } from "@/components/orcamento/ScopeSection";
import { PortalWarrantyNextSteps } from "@/components/orcamento/PortalWarrantyNextSteps";
import { StickyBudgetSummary } from "@/components/orcamento/StickyBudgetSummary";
import { ContractRequestDialog } from "@/components/budget/ContractRequestDialog";
import { WhatsAppButton } from "@/components/budget/WhatsAppButton";

const sectionVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
  },
};

const heroVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
  },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

const sidebarVariants = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.5, delay: 0.3, ease: "easeOut" as const } },
};

export default function OrcamentoPage() {
  const { publicId } = useParams<{ publicId: string }>();
  const { data: budget, isLoading, error } = useOrcamentoBudget(publicId);
  const [contractOpen, setContractOpen] = useState(false);

  // Demo só é permitido quando explicitamente habilitado por env.
  // Erros reais NÃO caem para mock — exibimos a tela de "não encontrado".
  const allowDemo = import.meta.env.VITE_ALLOW_DEMO === "true";
  const resolvedBudget =
    budget ?? (publicId === "demo" && allowDemo ? mockBudget : null);

  if (isLoading && !resolvedBudget) {
    return (
      <div
        className="min-h-screen bg-background flex items-center justify-center"
        role="status"
        aria-live="polite"
        aria-label="Carregando orçamento"
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
        <span className="sr-only">Carregando orçamento…</span>
      </div>
    );
  }

  if (!resolvedBudget) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center space-y-2 max-w-md">
          <p className="text-lg font-display font-semibold text-foreground">
            Orçamento não encontrado
          </p>
          <p className="text-sm text-muted-foreground font-body">
            {error
              ? "Não foi possível carregar este orçamento. O link pode ter expirado ou o orçamento ainda não foi publicado. Entre em contato com a equipe comercial."
              : "Verifique o link ou entre em contato com a equipe comercial."}
          </p>
        </div>
      </div>
    );
  }

  const hasScope = resolvedBudget.scope && resolvedBudget.scope.length > 0;
  const projectId = resolvedBudget.meta.projectId;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="flex gap-8">
          {/* Main content */}
          <motion.div
            className="flex-1 min-w-0 space-y-10 sm:space-y-14"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            <motion.div id="budget-hero" variants={heroVariants}>
              <BudgetHero meta={resolvedBudget.meta} included={resolvedBudget.included} />
            </motion.div>
            <div className="w-full border-t border-border/30" />
            <motion.div id="services-section" variants={sectionVariants} viewport={{ once: true, amount: 0.1, margin: "0px 0px -60px 0px" }} initial="hidden" whileInView="visible">
              <ServicesSection services={resolvedBudget.services} />
            </motion.div>
            <div className="w-full border-t border-border/30" />
            <motion.div id="journey-section" variants={sectionVariants} viewport={{ once: true, amount: 0.1, margin: "0px 0px -60px 0px" }} initial="hidden" whileInView="visible">
              <JourneySection steps={resolvedBudget.journey} />
            </motion.div>
            {hasScope && (
              <>
                <div className="w-full border-t border-border/30" />
                <motion.div id="scope-section" variants={sectionVariants} viewport={{ once: true, amount: 0.05, margin: "0px 0px -40px 0px" }} initial="hidden" whileInView="visible">
                  <ScopeSection scope={resolvedBudget.scope} />
                </motion.div>
              </>
            )}
            <div className="w-full border-t border-border/30" />
            <motion.div id="portal-section" variants={sectionVariants} viewport={{ once: true, amount: 0.1, margin: "0px 0px -60px 0px" }} initial="hidden" whileInView="visible">
              <PortalWarrantyNextSteps portalTabs={resolvedBudget.portalTabs} />
            </motion.div>

            {/* Bottom spacer for mobile CTA */}
            <div className="h-20 lg:hidden" />
          </motion.div>

          {/* Sidebar - desktop */}
          <motion.aside
            className="hidden lg:block w-[280px] flex-shrink-0"
            variants={sidebarVariants}
            initial="hidden"
            animate="visible"
            aria-label="Resumo do orçamento"
          >
            <div className="sticky top-6">
              <StickyBudgetSummary meta={resolvedBudget.meta} included={resolvedBudget.included} />
            </div>
          </motion.aside>
        </div>
      </div>

      {/* Floating WhatsApp (desktop + mobile) */}
      <WhatsAppButton projectName={resolvedBudget.meta.projectName} publicId={projectId} />

      {/* Mobile bottom CTA */}
      <div className="fixed bottom-0 inset-x-0 lg:hidden z-40 bg-card/95 backdrop-blur-md border-t border-border px-4 py-3">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <Button
            className="flex-1 gap-2"
            size="sm"
            onClick={() => setContractOpen(true)}
            aria-label="Solicitar contrato deste orçamento"
          >
            <FileSignature className="h-3.5 w-3.5" aria-hidden="true" />
            Solicitar contrato
          </Button>
        </div>
      </div>

      <ContractRequestDialog
        open={contractOpen}
        onOpenChange={setContractOpen}
        budgetId={projectId}
        publicId={projectId}
        projectName={resolvedBudget.meta.projectName}
        total={0}
        consultoraComercial={resolvedBudget.meta.architect}
      />
    </div>
  );
}
