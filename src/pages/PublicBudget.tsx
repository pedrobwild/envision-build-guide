import { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense, Fragment } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { fetchPublicBudget, calculateBudgetTotal, calculateSectionSubtotal } from "@/lib/supabase-helpers";
import { formatBRL, getValidityInfo } from "@/lib/formatBRL";
import { BudgetHeader } from "@/components/budget/BudgetHeader";
import { ProductShowcaseCard } from "@/components/budget/ProductShowcaseCard";
import { BudgetSummary } from "@/components/budget/BudgetSummary";
import { ReadingProgressBar } from "@/components/budget/ReadingProgressBar";
import { MobileStepBreadcrumb } from "@/components/budget/MobileStepBreadcrumb";
import { AnimatedSection } from "@/components/budget/AnimatedSection";
import { CollapsingSectionHeader } from "@/components/budget/CollapsingSectionHeader";
import { PublicBudgetSkeleton } from "@/components/budget/PublicBudgetSkeleton";
import { demoBudget } from "@/lib/demo-budget-data";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { WhatsAppButton } from "@/components/budget/WhatsAppButton";
import { ScrollToTopButton } from "@/components/budget/ScrollToTopButton";
import { ApprovalCTA } from "@/components/budget/ApprovalCTA";
import { InstallmentSimulator } from "@/components/budget/InstallmentSimulator";
import { OptionalItemsSimulator } from "@/components/budget/OptionalItemsSimulator";
import { MobileHeroCard } from "@/components/budget/MobileHeroCard";
import { MobilePriceAnchor } from "@/components/budget/MobilePriceAnchor";
import { MobileTestimonialInline } from "@/components/budget/MobileTestimonialInline";

import { MobileBottomBar } from "@/components/budget/MobileBottomBar";
import { MobileInlineSummary } from "@/components/budget/MobileInlineSummary";

import { BudgetFAQ } from "@/components/budget/BudgetFAQ";
import { ArquitetonicoExpander } from "@/components/budget/ArquitetonicoExpander";
import { EngenhariaExpander } from "@/components/budget/EngenhariaExpander";
import { NextSteps } from "@/components/budget/NextSteps";
import { TrustStrip } from "@/components/budget/TrustStrip";
import { useScrollspy } from "@/hooks/useScrollspy";
import { categorizeSections } from "@/lib/scope-categories";
import { cn } from "@/lib/utils";
import { SectionDivider } from "@/components/budget/SectionDivider";

// ── Lazy-loaded heavy components (MapLibre, ReactPlayer, Lightbox, Embla) ──
const NeighborhoodDensityMap = lazy(() => import("@/components/budget/NeighborhoodDensityMap").then(m => ({ default: m.NeighborhoodDensityMap })));
const ProjectGallery = lazy(() => import("@/components/budget/ProjectGallery").then(m => ({ default: m.ProjectGallery })));
const PortalShowcase = lazy(() => import("@/components/budget/PortalShowcase").then(m => ({ default: m.PortalShowcase })));
const RoomDetailModal = lazy(() => import("@/components/budget/RoomDetailModal").then(m => ({ default: m.RoomDetailModal })));
const ReformTimeline = lazy(() => import("@/components/budget/ReformTimeline").then(m => ({ default: m.ReformTimeline })));

/** Lightweight placeholder while lazy chunks load */
function LazyFallback() {
  return <div className="rounded-xl bg-muted/30 animate-pulse h-48 w-full" />;
}

/** Collapsible photo group — collapses on mobile, always open on desktop */
function CollapsiblePhotoGroup({ group, allItems, budgetId, exporting }: {
  group: { category: { id: string; label: string }; sections: BudgetSection[] };
  allItems: (BudgetItem & { _sectionTitle: string })[];
  budgetId: string;
  exporting: boolean;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const showItems = !isMobile || isOpen || exporting;
  const itemCount = allItems.length;

  return (
    <div key={group.category.id} className="mb-8 last:mb-0" data-pdf-section>
      {/* Header — clickable on mobile */}
      <button
        type="button"
        onClick={() => isMobile && setIsOpen(prev => !prev)}
        className={cn(
          "flex items-center gap-2.5 mb-3 sm:mb-4 w-full text-left",
          isMobile && "active:opacity-70 transition-opacity"
        )}
      >
        <div className={cn("w-1 h-5 rounded-full", group.category.bgClass)} />
        <span className={cn("text-sm sm:text-base font-display font-bold tracking-tight flex-1", group.category.colorClass)}>
          {group.category.label}
        </span>
        {/* Mobile: item count badge + chevron */}
        <span className="flex items-center gap-1.5 sm:hidden">
          <span className="text-xs font-mono text-muted-foreground tabular-nums bg-muted/60 px-1.5 py-0.5 rounded-full">
            {itemCount}
          </span>
          <motion.svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted-foreground"
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <path d="m6 9 6 6 6-6" />
          </motion.svg>
        </span>
      </button>

      {/* Items */}
      <AnimatePresence initial={false}>
        {showItems && (
          <motion.div
            initial={isMobile ? { height: 0, opacity: 0 } : false}
            animate={{ height: "auto", opacity: 1 }}
            exit={isMobile ? { height: 0, opacity: 0 } : undefined}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            {exporting ? (
              <ul className="space-y-1">
                {allItems.map((item, idx: number) => (
                  <li
                    key={item.id}
                    className={cn(
                      "flex items-center gap-2 py-1.5 text-sm font-body text-foreground",
                      idx < allItems.length - 1 && "border-b border-border/30"
                    )}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 flex-shrink-0" />
                    <span className="flex-1">{item.title}</span>
                    {item.qty && (
                      <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0">
                        {item.qty} {item.unit || "un"}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {allItems.map((item: any) => (
                  <ProductShowcaseCard
                    key={item.id}
                    item={item}
                    budgetId={budgetId}
                    editable={false}
                    showGallery={false}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


import type { BudgetData, BudgetSection, BudgetAdjustment, BudgetRoom } from "@/types/budget";

export default function PublicBudget() {
  const { publicId } = useParams<{ projectId?: string; publicId?: string }>();
  const [budget, setBudget] = useState<BudgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [showPrices] = useState(true);
  const [exporting, setExporting] = useState(false);
  const viewTracked = useRef(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [bottomBarHidden, setBottomBarHidden] = useState(false);

  const handleTotalCardVisibility = useCallback((_visible: boolean) => {
    // Bottom bar is always visible now
  }, []);

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

  // Ensure page starts at top on mount (prevents map stealing scroll on mobile)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

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
      setLoadError(null);
      fetchPublicBudget(publicId)
        .then((data) => {
          setBudget(data as BudgetData | null);
          setLoading(false);
          if (data && !viewTracked.current) {
            viewTracked.current = true;
            supabase.rpc('increment_view_count', { p_public_id: publicId }).then(({ error }) => {
              if (error) console.error('increment_view_count failed:', error.message);
            });
            if ((data.view_count || 0) === 0) {
              supabase.functions.invoke('notify-budget-view', {
                body: { public_id: publicId },
              }).catch(() => {});
            }
          }
        })
        .catch((err) => {
          console.error('Failed to load public budget:', err);
          setLoadError('Não foi possível carregar o orçamento. Tente novamente.');
          setLoading(false);
        });
    }
  }, [publicId]);

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const { exportBudgetPdf } = await import("@/lib/pdf-export");
      const filename = `${budget?.project_name || 'orcamento'}.pdf`;
      await exportBudgetPdf("budget-content", filename, budget!);
      toast.success("PDF gerado com sucesso.");
    } catch (err) {
      console.error("PDF export error:", err);
      toast.error("Não foi possível gerar o PDF. Tente novamente.");
    }
    setExporting(false);
  };

  if (loading) {
    return <PublicBudgetSkeleton />;
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground mb-2">Erro ao carregar</h1>
          <p className="text-sm text-muted-foreground font-body">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!budget) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground mb-2">Proposta não encontrada</h1>
          <p className="text-sm text-muted-foreground font-body">Este link pode ter expirado ou estar incorreto. Entre em contato com sua consultora.</p>
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
  const heroVersionNum = budget.versao ? budget.versao.replace(/^v/i, '') : (budget.version_number ?? "1");
  const heroVersion = `v${String(heroVersionNum)}`;


  const handleRoomClick = (roomId: string | null) => {
    setActiveRoom(roomId || null);
    if (roomId) setRoomModalOpen(true);
  };

  const activeRoomData = rooms.find((r) => r.id === activeRoom);

  return (
    <div className="min-h-screen bg-background" style={{ scrollSnapType: 'y proximity' }}>
      {/* Skip to content — keyboard/screen reader */}
      <a
        href="#budget-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg focus:text-sm focus:font-display focus:font-bold"
      >
        Ir para o conteúdo
      </a>
      <ReadingProgressBar />
      <MobileStepBreadcrumb />
      <BudgetHeader
        budget={budget}
        onExportPdf={handleExportPdf}
        exporting={exporting}
      />

      {/* Room Detail Modal */}
      {activeRoom && activeRoomData && (
        <Suspense fallback={null}>
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
        </Suspense>
      )}

      <main id="budget-content" className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">

        {/* ═══ MOBILE HERO CARD — price + validity + CTA above the fold ═══ */}


        {/* ═══ MOBILE PRICE ANCHOR — above the fold before TrustStrip ═══ */}
        <MobilePriceAnchor
          total={total}
          validityDaysLeft={validity.daysLeft}
          expired={validity.expired}
        />

        {/* ═══ TRUST STRIP — scannable confidence chips ═══ */}
        <div className="mt-3" data-pdf-section>
          <TrustStrip prazoDiasUteis={budget.prazo_dias_uteis ?? 55} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 lg:gap-8 mt-3 lg:mt-0">
          {/* Content column */}
          <div className="min-w-0 space-y-3 sm:space-y-4">

            {/* ─── MOBILE ORDER 1: O que está incluído (Arq + Eng merged) ─── */}
            <div id="mobile-included" className="scroll-mt-20">
              <div data-pdf-section>
              <AnimatedSection id="arquitetonico-section" index={0}>
                <ArquitetonicoExpander />
              </AnimatedSection>
              </div>

              <div className="mt-3" data-pdf-section>
                <AnimatedSection id="engenharia-section" index={0.5}>
                  <EngenhariaExpander />
                </AnimatedSection>
              </div>

              {/* ─── Prova social inline — depoimento entre serviços e galeria ─── */}
              <SectionDivider className="lg:hidden" />
              <div className="mt-3">
                <MobileTestimonialInline />
              </div>

              {/* ─── Visual 3D + Portal logo após depoimento ─── */}
              <div id="mobile-trust" className="space-y-3 mt-3 scroll-mt-20">
                <div data-pdf-section>
                <AnimatedSection id="gallery-section" index={0.55}>
                  <Suspense fallback={<LazyFallback />}>
                    <ProjectGallery publicId={publicId} />
                  </Suspense>
                </AnimatedSection>
                </div>

                {/* Map — with entrance animation */}
                <div data-pdf-section>
                  <AnimatedSection id="projetos-regiao" index={0.7}>
                    <motion.div
                      initial={{ opacity: 0, scale: 0.97 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true, margin: "-40px" }}
                      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <Suspense fallback={<LazyFallback />}>
                        <NeighborhoodDensityMap clientNeighborhood={budget?.bairro ?? undefined} />
                      </Suspense>
                    </motion.div>
                  </AnimatedSection>
                </div>
              </div>
            </div>

            {/* ── Mobile inline summary — before items ── */}
            <SectionDivider className="lg:hidden" />
            <div id="resumo-financeiro" className="scroll-mt-20" data-pdf-section>
            <MobileInlineSummary
              total={total}
              validity={validity}
              categorizedGroups={categorizedGroups}
              projectName={budget.project_name}
              clientName={budget.client_name}
              publicId={publicId || "demo"}
              budgetId={budget.id}
              onTotalCardVisibilityChange={handleTotalCardVisibility}
            />
            </div>

            {/* ─── Escopo técnico detalhado — only items with photos, no values ─── */}
            {!["2aa034962039", "f865e54c9a5f", "7d9a7b268320"].includes(publicId || "") && (
              <div id="mobile-scope" className="scroll-mt-20 mt-4 sm:mt-6">
                {sections.length > 0 && (() => {
                  // Filter ALL categories to only show items with images
                  const photoGroups = categorizedGroups
                    .map(group => ({
                      ...group,
                      sections: group.sections.map(section => ({
                        ...section,
                        items: exporting
                          ? (section.items || [])
                          : (section.items || []).filter((item: any) => item.images && item.images.length > 0),
                      })).filter(section => section.items.length > 0),
                    }))
                    .filter(group => group.sections.length > 0);

                  if (photoGroups.length === 0) return null;

                  return (
                    <div className="rounded-xl">
                      <CollapsingSectionHeader
                        title="Itens do Projeto"
                        subtitle="Clique nas fotos para ampliar"
                      />

                      {/* Desktop-only static header */}
                      <div className="hidden lg:flex items-center justify-between pt-1 sm:pt-2 pb-2 sm:pb-3 gap-2 sm:gap-3">
                        <div className="min-w-0">
                          <h2 className="text-lg lg:text-3xl font-display font-bold text-foreground tracking-tight leading-tight">
                            Itens do Projeto
                          </h2>
                          <p className="text-muted-foreground text-xs mt-0.5 font-body">
                            Clique nas fotos para ampliar
                          </p>
                        </div>
                      </div>

                      {photoGroups.map((group) => {
                        const allItems = group.sections.flatMap(s => (s.items || []).map((item: any) => ({ ...item, _sectionTitle: s.title })));
                        if (allItems.length === 0) return null;

                        return (
                          <CollapsiblePhotoGroup
                            key={group.category.id}
                            group={group}
                            allItems={allItems}
                            budgetId={budget.id}
                            exporting={exporting}
                          />
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ── Mobile optional items simulator ── */}
            {budget.show_optional_items && (
              <div className="lg:hidden">
                <OptionalItemsSimulator
                  budgetId={budget.id}
                  sections={sections}
                  baseTotal={total}
                  clientName={budget.client_name}
                  projectName={budget.project_name}
                />
              </div>
            )}


            {/* mobile-portal anchor kept for nav */}
            <div id="mobile-portal" className="scroll-mt-20" />

            <div data-pdf-section>
              <AnimatedSection id="portal-section-inline" index={99}>
                <Suspense fallback={<LazyFallback />}>
                  <PortalShowcase />
                </Suspense>
              </AnimatedSection>
            </div>

            <div data-pdf-section>
              <AnimatedSection id="cronograma-section" index={99.5}>
                <Suspense fallback={<LazyFallback />}>
                  <ReformTimeline />
                </Suspense>
              </AnimatedSection>
            </div>

            <div id="mobile-next-steps" className="scroll-mt-20" data-pdf-section>
              <AnimatedSection id="next-steps" index={100}>
                <NextSteps />
              </AnimatedSection>
            </div>

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
                allCategoriesOpenSheet={["2aa034962039", "f865e54c9a5f", "7d9a7b268320"].includes(publicId || "")}
                forceExpandItems={exporting}
              />
              {budget.show_optional_items && (
                <OptionalItemsSimulator
                  budgetId={budget.id}
                  sections={sections}
                  baseTotal={total}
                  clientName={budget.client_name}
                  projectName={budget.project_name}
                />
              )}
              <InstallmentSimulator total={total} />
              <ApprovalCTA
                budgetId={budget.id}
                publicId={publicId || "demo"}
                expired={validity.expired}
                projectName={budget.project_name}
                clientName={budget.client_name}
                total={total}
              />
            </div>
          </div>
        </div>

        {/* Mobile sticky bottom bar */}
        <MobileBottomBar
          total={total}
          validity={validity}
          categorizedGroups={categorizedGroups}
          projectName={budget.project_name}
          clientName={budget.client_name}
          publicId={publicId || "demo"}
          budgetId={budget.id}
          hidden={bottomBarHidden}
          activeSection={null}
        />

        <div id="mobile-faq" className="mt-6 sm:mt-8 lg:col-span-2 scroll-mt-20" data-pdf-section>
          <BudgetFAQ />
        </div>

        {budget.disclaimer && (
          <motion.div
            data-pdf-section
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

      <ScrollToTopButton />
      <WhatsAppButton
        projectName={budget.project_name || "Orçamento"}
        publicId={publicId || "demo"}
      />
    </div>
  );
}
