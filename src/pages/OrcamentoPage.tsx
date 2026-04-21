import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileSignature, MessageCircle, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { mockBudget } from "@/lib/orcamento-mock-data";
import { useOrcamentoBudget } from "@/hooks/useOrcamentoBudget";
import { BudgetHero } from "@/components/orcamento/BudgetHero";
import { ServicesSection } from "@/components/orcamento/ServicesSection";
import { JourneySection } from "@/components/orcamento/JourneySection";
import { ScopeSection } from "@/components/orcamento/ScopeSection";
import { PortalWarrantyNextSteps } from "@/components/orcamento/PortalWarrantyNextSteps";
import { PortalDemoAccessCard } from "@/components/budget/PortalDemoAccessCard";
import { StickyBudgetSummary } from "@/components/orcamento/StickyBudgetSummary";
import { ReformTimeline } from "@/components/budget/ReformTimeline";

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
  const { projectId } = useParams<{ projectId: string }>();
  const { data: budget, isLoading, error } = useOrcamentoBudget(projectId);

  // Demo só é permitido quando explicitamente habilitado por env.
  // Erros reais NÃO caem para mock — exibimos a tela de "não encontrado".
  const allowDemo = import.meta.env.VITE_ALLOW_DEMO === "true";
  const resolvedBudget =
    budget ?? (projectId === "demo" && allowDemo ? mockBudget : null);

  if (isLoading && !resolvedBudget) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!resolvedBudget) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-lg font-display font-semibold text-foreground">Orçamento não encontrado</p>
          <p className="text-sm text-muted-foreground font-body">
            {error
              ? "Não foi possível carregar este orçamento. Verifique o link ou entre em contato com a equipe."
              : "Verifique o link ou entre em contato com a equipe."}
          </p>
        </div>
      </div>
    );
  }

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
            <div className="w-full border-t border-border/30" />
            <motion.div id="scope-section" variants={sectionVariants} viewport={{ once: true, amount: 0.05, margin: "0px 0px -40px 0px" }} initial="hidden" whileInView="visible">
              <ScopeSection scope={resolvedBudget.scope} />
            </motion.div>
            <div className="w-full border-t border-border/30" />
            <motion.div id="portal-section" variants={sectionVariants} viewport={{ once: true, amount: 0.1, margin: "0px 0px -60px 0px" }} initial="hidden" whileInView="visible">
              <PortalWarrantyNextSteps portalTabs={resolvedBudget.portalTabs} />
            </motion.div>
            <div className="w-full border-t border-border/30" />
            <motion.div id="cronograma-section" variants={sectionVariants} viewport={{ once: true, amount: 0.05, margin: "0px 0px -40px 0px" }} initial="hidden" whileInView="visible">
              <ReformTimeline />
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
          >
            <div className="sticky top-6">
              <StickyBudgetSummary meta={resolvedBudget.meta} included={resolvedBudget.included} />
            </div>
          </motion.aside>
        </div>
      </div>

      {/* Mobile bottom CTA */}
      <div className="fixed bottom-0 inset-x-0 lg:hidden z-40 bg-card/95 backdrop-blur-md border-t border-border px-4 py-3">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <Button className="flex-1 gap-2" size="sm" aria-label="Solicitar contrato do orçamento">
            <FileSignature className="h-3.5 w-3.5" />
            Solicitar Contrato
          </Button>
          <Button variant="outline" size="icon" className="h-9 w-9 flex-shrink-0" aria-label="Enviar mensagem via WhatsApp">
            <MessageCircle className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
