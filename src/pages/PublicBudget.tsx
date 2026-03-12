import { useState, useEffect, useRef, useMemo } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { fetchPublicBudget, calculateBudgetTotal, calculateSectionSubtotal } from "@/lib/supabase-helpers";
import { formatBRL, getValidityInfo } from "@/lib/formatBRL";
import { BudgetHeader } from "@/components/budget/BudgetHeader";
import { SectionCard } from "@/components/budget/SectionCard";
import { BudgetSummary } from "@/components/budget/BudgetSummary";
import { FloorPlanViewer } from "@/components/budget/FloorPlanViewer";
import { ReadingProgressBar } from "@/components/budget/ReadingProgressBar";
import { AnimatedSection } from "@/components/budget/AnimatedSection";
import { ScopeTransitionZone } from "@/components/budget/ScopeTransitionZone";
import { CategoryHeader } from "@/components/budget/CategoryHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { demoBudget } from "@/lib/demo-budget-data";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { WhatsAppButton } from "@/components/budget/WhatsAppButton";
import { ApprovalCTA } from "@/components/budget/ApprovalCTA";
import { InstallmentSimulator } from "@/components/budget/InstallmentSimulator";
import { MobileHeroCard } from "@/components/budget/MobileHeroCard";
import { MobileSectionNav } from "@/components/budget/MobileSectionNav";
import { MobileBottomBar } from "@/components/budget/MobileBottomBar";

import { BudgetFAQ } from "@/components/budget/BudgetFAQ";
import { ArquitetonicoExpander } from "@/components/budget/ArquitetonicoExpander";
import { EngenhariaExpander } from "@/components/budget/EngenhariaExpander";
import { PortalShowcase } from "@/components/budget/PortalShowcase";
import { NeighborhoodDensityMap } from "@/components/budget/NeighborhoodDensityMap";
import { ProjectGallery } from "@/components/budget/ProjectGallery";
import { ProjectConditions } from "@/components/budget/ProjectConditions";
import { NextSteps } from "@/components/budget/NextSteps";
import { TurnkeyComparison } from "@/components/budget/TurnkeyComparison";
import { WhatIsIncluded } from "@/components/budget/WhatIsIncluded";
import { InvestmentImpact } from "@/components/budget/InvestmentImpact";
import { RoomDetailModal } from "@/components/budget/RoomDetailModal";
import { Eye, EyeOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useScrollspy } from "@/hooks/useScrollspy";
import { categorizeSections } from "@/lib/scope-categories";
import type { BudgetData, BudgetSection, BudgetAdjustment, BudgetRoom } from "@/types/budget";

export default function PublicBudget() {
  const { publicId } = useParams<{ projectId?: string; publicId?: string }>();
  const [budget, setBudget] = useState<BudgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [showPrices, setShowPrices] = useState(true);
  const [exporting, setExporting] = useState(false);
  const viewTracked = useRef(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setIsAdmin(!!data.session?.user);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAdmin(!!session?.user);
    });
    return () => subscription.unsubscribe();
  }, []);

  const allSectionIds = useMemo(() => {
    const sections = budget?.sections || [];
    return sections.map((s) => `section-${s.id}`);
  }, [budget]);

  const activeSection = useScrollspy(allSectionIds);

  // Mobile nav scrollspy — must be before early returns
  const mobileNavIds = useMemo(() => [
    "mobile-included", "mobile-scope", "mobile-trust", "mobile-portal", "mobile-next-steps", "mobile-faq"
  ], []);
  const activeMobileNav = useScrollspy(mobileNavIds);

  useEffect(() => {
    if (budget) {
      document.title = budget.project_name
        ? `${budget.project_name} — Orçamento Bwild`
        : 'Bwild — Orçamento de Reforma';
    }
  }, [budget]);

  useEffect(() => {
    if (publicId === 'demo') {
      setBudget(demoBudget as unknown as BudgetData);
      setLoading(false);
      return;
    }
    if (publicId) {
      fetchPublicBudget(publicId).then((data) => {
        setBudget(data as BudgetData | null);
        setLoading(false);
        if (data && !viewTracked.current) {
          viewTracked.current = true;
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
          fetch(`${supabaseUrl}/rest/v1/budgets?public_id=eq.${encodeURIComponent(publicId)}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Prefer': 'return=minimal',
            },
            body: JSON.stringify({
              view_count: (data.view_count || 0) + 1,
              last_viewed_at: new Date().toISOString(),
            }),
          }).catch(() => {});
          if ((data.view_count || 0) === 0) {
            supabase.functions.invoke('notify-budget-view', {
              body: { public_id: publicId },
            }).catch(() => {});
          }
        }
      });
    }
  }, [publicId]);

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const { exportBudgetPdf } = await import("@/lib/pdf-export");
      const filename = `${budget?.project_name || 'orcamento'}.pdf`;
      await exportBudgetPdf("budget-content", filename);
      toast.success("PDF exportado com sucesso!");
    } catch (err) {
      console.error("PDF export error:", err);
      toast.error("Erro ao gerar PDF.");
    }
    setExporting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <Skeleton className="h-14 w-full mb-4" />
          <Skeleton className="h-24 w-full mb-4" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-48 w-full rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-80 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!budget) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground mb-2">Orçamento não encontrado</h1>
          <p className="text-sm text-muted-foreground font-body">O link pode estar expirado ou inválido.</p>
        </div>
      </div>
    );
  }

  const sections: BudgetSection[] = budget.sections || [];
  const adjustments: BudgetAdjustment[] = budget.adjustments || [];
  const rooms: BudgetRoom[] = budget.rooms || [];
  const total = calculateBudgetTotal(sections, adjustments);
  const validity = getValidityInfo(budget.date, budget.validity_days || 30);

  const categorizedGroups = categorizeSections(sections);
  const scopeTotal = sections.reduce((sum, s) => sum + calculateSectionSubtotal(s), 0);

  // Meta for mobile hero
  const heroNeighborhood = budget.bairro || budget.condominio || "";
  const rawArea = budget.metragem ? budget.metragem.toString().replace(/\s/g, '').replace(/m²?$/i, '') : "";
  const heroArea = rawArea ? `${rawArea}m²` : "";
  const heroVersion = budget.versao ? `v${budget.versao.replace(/^v/i, '').padStart(2, '0')}` : "";

  // Mobile nav items
  const mobileNavItems = [
    { id: "mobile-included", label: "Incluído", icon: "📋" },
    { id: "mobile-scope", label: "Escopo", icon: "🪑" },
    { id: "mobile-trust", label: "Portfólio", icon: "🏠" },
    { id: "mobile-portal", label: "Garantia", icon: "🛡️" },
    { id: "mobile-next-steps", label: "Próximos passos", icon: "🚀" },
    { id: "mobile-faq", label: "Dúvidas", icon: "❓" },
  ];

  // mobileNavIds and activeMobileNav already declared above early returns

  const handleRoomClick = (roomId: string | null) => {
    setActiveRoom(roomId || null);
    if (roomId) setRoomModalOpen(true);
  };

  const activeRoomData = rooms.find((r) => r.id === activeRoom);

  let globalSectionIdx = 0;

  return (
    <div className="min-h-screen bg-background">
      <ReadingProgressBar />
      <BudgetHeader
        budget={budget}
        onExportPdf={handleExportPdf}
        exporting={exporting}
      />

      {/* Room Detail Modal */}
      {activeRoom && activeRoomData && (
        <RoomDetailModal
          open={roomModalOpen}
          onClose={() => {
            setRoomModalOpen(false);
            setActiveRoom(null);
          }}
          roomName={activeRoomData.name}
          sections={sections}
          roomId={activeRoom}
        />
      )}

      <main id="budget-content" className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">

        {/* ═══ MOBILE HERO CARD — price + validity + CTA above the fold ═══ */}
        <MobileHeroCard
          total={total}
          validity={validity}
          projectName={budget.project_name}
          clientName={budget.client_name}
          publicId={publicId || "demo"}
          neighborhood={heroNeighborhood}
          area={heroArea}
          version={heroVersion}
        />

        {/* ═══ MOBILE SECTION NAV — sticky pills ═══ */}
        <MobileSectionNav items={mobileNavItems} activeId={activeMobileNav} />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 lg:gap-8 mt-3 lg:mt-0">
          {/* Content column */}
          <div className="min-w-0 space-y-3 sm:space-y-4">

            {/* ─── MOBILE ORDER 1: O que está incluído (Arq + Eng merged) ─── */}
            <div id="mobile-included" className="scroll-mt-20">
              <AnimatedSection id="arquitetonico-section" index={0}>
                <ArquitetonicoExpander />
              </AnimatedSection>

              <div className="mt-3">
                <AnimatedSection id="engenharia-section" index={0.5}>
                  <EngenhariaExpander />
                </AnimatedSection>
              </div>
            </div>

            {/* ─── MOBILE ORDER 2: Escopo técnico detalhado — early for decision ─── */}
            <div id="mobile-scope" className="scroll-mt-20">
              {sections.length > 0 && (
                <div className="rounded-xl">
                  <div className="flex items-center justify-between pt-2 pb-2 gap-3">
                    <div className="min-w-0">
                      <h2 className="text-lg lg:text-3xl font-display font-bold text-foreground tracking-tight leading-tight">
                        Detalhamento da Mobília e Eletros
                      </h2>
                      <p className="text-muted-foreground text-xs mt-0.5 font-body hidden sm:block">
                        Especificação completa dos itens selecionados
                      </p>
                    </div>
                    <label className="flex items-center gap-2 flex-shrink-0 min-h-[44px] cursor-pointer">
                      <span className="text-xs text-muted-foreground font-body hidden sm:inline">
                        {showPrices ? "Valores" : "Valores"}
                      </span>
                      <Switch
                        checked={showPrices}
                        onCheckedChange={setShowPrices}
                        aria-label="Mostrar ou ocultar valores"
                      />
                      {showPrices ? (
                        <Eye className="h-3.5 w-3.5 text-primary sm:hidden" />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5 text-muted-foreground sm:hidden" />
                      )}
                    </label>
                  </div>

                  {categorizedGroups.filter((g) => ["marcenaria", "mobiliario", "eletro"].includes(g.category.id)).map((group) => {
                    const groupSections = group.sections;
                    const totalItems = groupSections.reduce((sum, s) => sum + (s.items?.length || 0), 0);
                    return (
                      <div key={group.category.id} className="space-y-2 sm:space-y-3">
                        <CategoryHeader
                          category={group.category}
                          subtotal={group.subtotal}
                          sectionCount={groupSections.length}
                          itemCount={totalItems}
                        />
                        {groupSections.map((section) => {
                          const currentIdx = globalSectionIdx++;
                          return (
                            <AnimatedSection key={section.id} id={`section-${section.id}`} index={currentIdx + 1}>
                              <SectionCard
                                section={section}
                                compact={false}
                                showItemQty={budget.show_item_qty ?? true}
                                showItemPrices={showPrices}
                                sectionIndex={currentIdx}
                                categoryColor={group.category}
                                budgetId={budget.id}
                                editable={isAdmin}
                              />
                            </AnimatedSection>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ─── MOBILE ORDER 3: Trust / Confidence builders ─── */}
            <div id="mobile-trust" className="space-y-3 scroll-mt-20">
              <AnimatedSection id="gallery-section" index={0.25}>
                <ProjectGallery />
              </AnimatedSection>

              {/* Map — desktop only */}
              <div className="hidden lg:block">
                <AnimatedSection id="projetos-regiao" index={0.7}>
                  <NeighborhoodDensityMap clientNeighborhood={budget?.bairro ?? undefined} />
                </AnimatedSection>
              </div>
            </div>

            {/* ─── MOBILE ORDER 4: Portal + Garantia ─── */}
            <div id="mobile-portal" className="scroll-mt-20">
              <AnimatedSection id="portal-section" index={0.6}>
                <PortalShowcase />
              </AnimatedSection>
            </div>

            <AnimatedSection id="next-steps" index={100}>
              <NextSteps />
            </AnimatedSection>

          </div>

          {/* Desktop sidebar */}
          <div className="hidden lg:block">
            <div className="sticky top-4 space-y-4 max-h-[calc(100vh-2rem)] overflow-y-auto pb-4 scrollbar-thin">
              <BudgetSummary
                sections={sections}
                adjustments={adjustments}
                total={total}
                generatedAt={budget.generated_at || ""}
                budgetDate={budget.date}
                validityDays={budget.validity_days || 30}
                activeSection={activeSection}
                categorizedGroups={categorizedGroups}
                budgetId={budget.id}
                editable={isAdmin}
              />
              <InstallmentSimulator total={total} />
              <ApprovalCTA
                budgetId={budget.id}
                publicId={publicId || "demo"}
                expired={validity.expired}
                projectName={budget.project_name}
                clientName={budget.client_name}
              />
            </div>
          </div>
        </div>

        {/* Mobile sticky bottom bar + drawer */}
        <MobileBottomBar
          total={total}
          validity={validity}
          categorizedGroups={categorizedGroups}
          projectName={budget.project_name}
          clientName={budget.client_name}
          publicId={publicId || "demo"}
        />

        {/* FAQ */}
        <div className="mt-6 sm:mt-8 lg:col-span-2">
          <BudgetFAQ />
        </div>

        {budget.disclaimer && (
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mt-4 sm:mt-6 mb-28 lg:mb-8 p-4 rounded-xl bg-muted/50 border border-border"
          >
            <p className="text-xs text-muted-foreground font-body leading-relaxed">{budget.disclaimer}</p>
          </motion.div>
        )}
      </main>

      <WhatsAppButton
        projectName={budget.project_name || "Orçamento"}
        publicId={publicId || "demo"}
      />
    </div>
  );
}
