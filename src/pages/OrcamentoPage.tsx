import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Calendar, MessageCircle, Loader2 } from "lucide-react";
import { mockBudget } from "@/lib/orcamento-mock-data";
import { useOrcamentoBudget } from "@/hooks/useOrcamentoBudget";
import { BudgetHero } from "@/components/orcamento/BudgetHero";
import { ServicesSection } from "@/components/orcamento/ServicesSection";
import { JourneySection } from "@/components/orcamento/JourneySection";
import { ScopeSection } from "@/components/orcamento/ScopeSection";
import { PortalWarrantyNextSteps } from "@/components/orcamento/PortalWarrantyNextSteps";
import { StickyBudgetSummary } from "@/components/orcamento/StickyBudgetSummary";

export default function OrcamentoPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: budget, isLoading, error } = useOrcamentoBudget(projectId);

  // Fallback to mock for "demo" slug or while loading fails
  const resolvedBudget = budget ?? (projectId === "demo" || error ? mockBudget : null);

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
            Verifique o link ou entre em contato com a equipe.
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
          <div className="flex-1 min-w-0 space-y-10 sm:space-y-14">
            <div id="budget-hero">
              <BudgetHero meta={resolvedBudget.meta} included={resolvedBudget.included} />
            </div>
            <div id="services-section">
              <ServicesSection services={resolvedBudget.services} />
            </div>
            <div id="journey-section">
              <JourneySection steps={resolvedBudget.journey} />
            </div>
            <div id="scope-section">
              <ScopeSection scope={resolvedBudget.scope} />
            </div>
            <div id="portal-section">
              <PortalWarrantyNextSteps portalTabs={resolvedBudget.portalTabs} />
            </div>

            {/* Bottom spacer for mobile CTA */}
            <div className="h-20 lg:hidden" />
          </div>

          {/* Sidebar - desktop */}
          <aside className="hidden lg:block w-[280px] flex-shrink-0">
            <div className="sticky top-6">
              <StickyBudgetSummary meta={resolvedBudget.meta} included={resolvedBudget.included} />
            </div>
          </aside>
        </div>
      </div>

      {/* Mobile bottom CTA */}
      <div className="fixed bottom-0 inset-x-0 lg:hidden z-40 bg-card/95 backdrop-blur-md border-t border-border px-4 py-3">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <Button className="flex-1 gap-2" size="sm">
            <Calendar className="h-3.5 w-3.5" />
            Agendar briefing
          </Button>
          <Button variant="outline" size="icon" className="h-9 w-9 flex-shrink-0">
            <MessageCircle className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
