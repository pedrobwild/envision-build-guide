import { useState, useEffect, useRef, useMemo, lazy, Suspense, Fragment } from "react";
import { Download } from "lucide-react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useBudgetMedia } from "@/hooks/useBudgetMedia";
import { fetchPublicBudget, fetchPublicBudgetStreaming, calculateBudgetTotal, calculateSectionSubtotal, calculateAddendumDelta } from "@/lib/supabase-helpers";
import { resolveBudgetGrandTotal } from "@/lib/budget-total";
import { computePublicAbatements, assertPublicAbatementParity } from "@/lib/public-abatements";
import { buildPublicScopeGroups } from "@/lib/public-scope";
import { AddendumDeltaCard } from "@/components/budget/AddendumDeltaCard";
import { formatBRL, getValidityInfo } from "@/lib/formatBRL";
import { BudgetHeader } from "@/components/budget/BudgetHeader";
import { ProductShowcaseCard } from "@/components/budget/ProductShowcaseCard";
import { BudgetSummary } from "@/components/budget/BudgetSummary";
import { ReadingProgressBar } from "@/components/budget/ReadingProgressBar";
import { MobileStepBreadcrumb } from "@/components/budget/MobileStepBreadcrumb";
import { AnimatedSection } from "@/components/budget/AnimatedSection";
import { CollapsingSectionHeader } from "@/components/budget/CollapsingSectionHeader";
import { PublicBudgetSkeleton } from "@/components/budget/PublicBudgetSkeleton";
import { PublicBudgetErrorBoundary } from "@/components/budget/PublicBudgetErrorBoundary";
import { demoBudget } from "@/lib/demo-budget-data";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

import { ScrollToTopButton } from "@/components/budget/ScrollToTopButton";
import { ApprovalCTA } from "@/components/budget/ApprovalCTA";
import { InstallmentSimulator } from "@/components/budget/InstallmentSimulator";
import { OptionalItemsSimulator } from "@/components/budget/OptionalItemsSimulator";
import { ROISimulator } from "@/components/budget/ROISimulator";
import { MobileHeroCard } from "@/components/budget/MobileHeroCard";
import { MobilePriceAnchor } from "@/components/budget/MobilePriceAnchor";
import { MobileTestimonialInline } from "@/components/budget/MobileTestimonialInline";

import { MobileBottomBar } from "@/components/budget/MobileBottomBar";
import { MobileInlineSummary } from "@/components/budget/MobileInlineSummary";


import { ArquitetonicoExpander } from "@/components/budget/ArquitetonicoExpander";
import { EngenhariaExpander } from "@/components/budget/EngenhariaExpander";
import { NextSteps } from "@/components/budget/NextSteps";
import { TrustStrip } from "@/components/budget/TrustStrip";
import { useScrollspy } from "@/hooks/useScrollspy";
import { categorizeSections } from "@/lib/scope-categories";
import { cn } from "@/lib/utils";
import { SectionDivider } from "@/components/budget/SectionDivider";

const DEMO_PORTFOLIO_IDS = (import.meta.env.VITE_DEMO_PORTFOLIO_IDS ?? "2aa034962039,f865e54c9a5f,7d9a7b268320").split(",").filter(Boolean);

// ── Lazy-loaded heavy components (MapLibre, ReactPlayer, Lightbox, Embla) ──
const NeighborhoodDensityMap = lazy(() => import("@/components/budget/NeighborhoodDensityMap").then(m => ({ default: m.NeighborhoodDensityMap })));
const ProjectGallery = lazy(() => import("@/components/budget/ProjectGallery").then(m => ({ default: m.ProjectGallery })));
const PortalShowcase = lazy(() => import("@/components/budget/PortalShowcase").then(m => ({ default: m.PortalShowcase })));
const PortalDemoAccessCard = lazy(() => import("@/components/budget/PortalDemoAccessCard").then(m => ({ default: m.PortalDemoAccessCard })));
const RoomDetailModal = lazy(() => import("@/components/budget/RoomDetailModal").then(m => ({ default: m.RoomDetailModal })));
const ReformTimeline = lazy(() => import("@/components/budget/ReformTimeline").then(m => ({ default: m.ReformTimeline })));

/** Lightweight placeholder while lazy chunks load */
function LazyFallback() {
  return <div className="rounded-xl bg-muted/30 animate-pulse h-48 w-full" />;
}

/** Collapsible photo group — collapses on mobile, always open on desktop */
import type { ScopeCategory, CategorizedGroup } from "@/lib/scope-categories";

function CollapsiblePhotoGroup({ group, allItems, budgetId, exporting }: {
  group: CategorizedGroup;
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
          "flex items-center gap-2.5 mb-3 sm:mb-4 w-full text-left -mx-1 px-1 py-1.5 rounded-md min-h-[44px] sm:min-h-0 sm:py-0",
          isMobile && "active:bg-foreground/[0.02] transition-colors"
        )}
        aria-expanded={isMobile ? isOpen : undefined}
      >
        <div className="w-1 h-5 rounded-full bg-border flex-shrink-0" />
        <span className="text-sm sm:text-base budget-heading font-bold tracking-[-0.01em] flex-1 text-foreground leading-tight">
          {group.category.label}
        </span>
        {/* Mobile: item count badge + chevron */}
        <span className="flex items-center gap-2 sm:hidden">
          <span className="text-[10.5px] budget-numeric text-muted-foreground/70 bg-muted/50 px-2 py-0.5 rounded-full tabular-nums font-medium tracking-[0.01em]">
            {itemCount} {itemCount === 1 ? "item" : "itens"}
          </span>
          <motion.svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted-foreground/60"
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
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
                      <span className="text-xs text-muted-foreground budget-numeric flex-shrink-0">
                        {item.qty} {item.unit || "un"}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {allItems.map((item) => (
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


import type { BudgetData, BudgetSection, BudgetItem, BudgetAdjustment, BudgetRoom } from "@/types/budget";

export default function PublicBudget() {
  const { publicId } = useParams<{ projectId?: string; publicId?: string }>();
  const [budget, setBudget] = useState<BudgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const viewTracked = useRef(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { media: budgetMedia, loading: mediaLoading } = useBudgetMedia(publicId, budget?.id);
  const hasRealMedia = !mediaLoading && budgetMedia && (
    !!budgetMedia.video3d || budgetMedia.projeto3d.length > 0 || budgetMedia.projetoExecutivo.length > 0 || budgetMedia.fotos.length > 0
  );

  // SECURITY (B13): previously this flag was set to "any logged-in user", which
  // exposed admin-only edit controls (editable={isAdmin}) to commercial users
  // and even authenticated leads. Now it checks the real `admin` role.
  useEffect(() => {
    let active = true;
    async function check(userId: string | undefined) {
      if (!userId) {
        if (active) setIsAdmin(false);
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      if (active) setIsAdmin(!!data);
    }
    supabase.auth.getSession().then(({ data }) => check(data.session?.user?.id));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      check(session?.user?.id);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
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
    const allowDemo = import.meta.env.VITE_ALLOW_DEMO === 'true';
    if (publicId === 'demo') {
      if (allowDemo) {
        setBudget(demoBudget as unknown as BudgetData);
        setLoading(false);
      } else {
        setBudget(null);
        setLoadError('Orçamento não encontrado.');
        setLoading(false);
      }
      return;
    }
    if (publicId) {
      setLoadError(null);
      let firstPaintDone = false;
      fetchPublicBudgetStreaming(publicId, (partial) => {
        // Phase 1: render immediately with budget + sections + items (no item images yet).
        firstPaintDone = true;
        setBudget(partial as BudgetData);
        setLoading(false);
      })
        .then(async (data) => {
          // Phase 2: hydrate with item images. If first paint never fired
          // (e.g. RPC returned no budget), tenta resolver para a versão publicada
          // do mesmo grupo de versionamento — link antigo continua funcionando.
          if (!firstPaintDone && !data) {
            try {
              const { data: resolved } = await supabase.rpc(
                'resolve_published_public_id',
                { p_public_id: publicId },
              );
              if (resolved && typeof resolved === 'string' && resolved !== publicId) {
                // Redireciona preservando query string (ex: ?utm_*).
                const search = window.location.search || '';
                const hash = window.location.hash || '';
                window.location.replace(`/o/${resolved}${search}${hash}`);
                return;
              }
            } catch {
              // segue para o estado de "não encontrado" abaixo.
            }
          }
          if (data) {
            setBudget(data as BudgetData);
          }
          if (!firstPaintDone) {
            setLoading(false);
          }
          if (data && !viewTracked.current) {
            viewTracked.current = true;
            supabase.rpc('increment_view_count', { p_public_id: publicId }).then(({ error }) => {
              if (error) { /* view count increment failed silently */ }
            });
            if ((data.view_count || 0) === 0) {
              supabase.functions.invoke('notify-budget-view', {
                body: { public_id: publicId },
              }).catch(() => {});
            }
          }
        })
        .catch((err) => {
          if (!firstPaintDone) {
            setLoadError('Não foi possível carregar o orçamento. Tente novamente.');
            setLoading(false);
          }
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
          <h1 className="text-2xl sm:text-3xl budget-heading font-bold text-foreground mb-2">Erro ao carregar</h1>
          <p className="text-sm text-muted-foreground font-body">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!budget) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl budget-heading font-bold text-foreground mb-2">Proposta não encontrada</h1>
          <p className="text-sm text-muted-foreground font-body">Este link pode ter expirado ou estar incorreto. Entre em contato com sua consultora.</p>
        </div>
      </div>
    );
  }

  const sections: BudgetSection[] = budget.sections || [];
  const adjustments: BudgetAdjustment[] = budget.adjustments || [];
  const rooms: BudgetRoom[] = budget.rooms || [];
  const computedTotal = calculateBudgetTotal(sections, adjustments);
  // Fonte da verdade unificada: público ↔ fallback ↔ interno ↔ PDF ↔ XLSX.
  // Ver src/lib/budget-total.ts e mem://logic/budget/manual-total-source-of-truth.
  const { total } = resolveBudgetGrandTotal({
    manualTotal: (budget as { manual_total?: number | string | null }).manual_total,
    computedTotal,
  });
  const validity = getValidityInfo(budget.date, budget.validity_days || 30);

  // Visible sections: filter out items/sections removed by an addendum.
  // The financial total already accounts for removals via `calculateBudgetTotal`,
  // so the client should not see the removed entries in the visual breakdown.
  const visibleSections: BudgetSection[] = sections
    .filter((s) => s.addendum_action !== "remove")
    .map((s) => ({
      ...s,
      items: (s.items || []).filter((i) => i.addendum_action !== "remove"),
    }));

  const categorizedGroups = categorizeSections(visibleSections);
  const scopeTotal = visibleSections.reduce((sum, s) => sum + calculateSectionSubtotal(s), 0);

  // Split abatements by item label — mesma fonte de verdade do desktop
  // (BudgetSummary). Antes o mobile recalculava por seção via
  // calculateSectionSubtotal e ignorava descontos dentro de seções com saldo
  // positivo, gerando subtotal/desconto inconsistentes entre desktop e mobile.
  const abatementBreakdown = aggregateAbatementsByLabel(visibleSections);
  const publicDiscountTotal = abatementBreakdown.discountTotal;
  const publicCreditTotal = abatementBreakdown.creditTotal;
  const publicSubtotalBeforeAbatements = total + publicDiscountTotal + publicCreditTotal;

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
    <PublicBudgetErrorBoundary budget={budget}>
    <div className="min-h-screen bg-background" style={{ scrollSnapType: 'y proximity' }}>
      {/* Skip to content — keyboard/screen reader */}
      <a
        href="#budget-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg focus:text-sm focus:font-body focus:font-bold"
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
            sections={visibleSections}
            roomId={activeRoom}
          />
        </Suspense>
      )}

      <main id="budget-content" className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">

        {/* ═══ ADITIVO BANNER — só aparece quando o orçamento é um aditivo ═══ */}
        {budget.is_addendum && (
          <>
            <div className="mb-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 flex items-start gap-3">
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider bg-primary text-primary-foreground uppercase shrink-0 mt-0.5">
                Aditivo Nº {budget.addendum_number ?? 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-body font-semibold text-foreground leading-snug">
                  Esta proposta inclui alterações contratuais
                </p>
                {budget.addendum_summary ? (
                  <p className="text-xs text-muted-foreground font-body mt-0.5 leading-relaxed">
                    {budget.addendum_summary}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground font-body mt-0.5 leading-relaxed">
                    Itens novos aparecem com selo <span className="font-semibold text-success">NOVO</span>. Itens removidos do escopo já não constam mais nesta versão e o investimento foi atualizado.
                  </p>
                )}
              </div>
            </div>

            {/* Card de delta financeiro do aditivo */}
            {(() => {
              const delta = calculateAddendumDelta(sections);
              return (
                <AddendumDeltaCard
                  added={delta.added}
                  removed={delta.removed}
                  net={delta.net}
                />
              );
            })()}
          </>
        )}

        {/* ═══ MOBILE HERO CARD — price + validity + CTA above the fold ═══ */}

      {/* PDF download banner for imported budgets */}
      {budget.budget_pdf_url && (
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 mt-3">
          <a
            href={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/budget-pdfs/${budget.budget_pdf_url}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-primary/5 border border-primary/15 hover:bg-primary/10 transition-colors group"
          >
            <Download className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-body font-medium text-foreground">Baixar orçamento em PDF</span>
            <span className="text-xs text-muted-foreground font-body ml-auto group-hover:text-primary transition-colors">Abrir →</span>
          </a>
        </div>
      )}
        {/* ═══ MOBILE PRICE ANCHOR — above the fold before TrustStrip ═══ */}
        <MobilePriceAnchor
          total={total}
          validityDaysLeft={validity.daysLeft}
          expired={validity.expired}
        />

        {/* ═══ TRUST STRIP — scannable confidence chips ═══ */}
        <div className="mt-3" data-pdf-section>
          <TrustStrip prazoDiasUteis={budget.prazo_dias_uteis ?? undefined} />
        </div>


        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 lg:gap-8 mt-3 lg:mt-0">
          {/* Content column */}
          <div className="min-w-0 space-y-3 sm:space-y-4">

            {/* ─── MOBILE ORDER 1: Resumo do investimento (centro no desktop) ─── */}
            <div id="mobile-included" className="scroll-mt-20">
              <div data-pdf-section>
                <AnimatedSection id="budget-summary-section" index={0}>
                  <BudgetSummary
                    sections={visibleSections}
                    adjustments={adjustments}
                    total={total}
                    generatedAt={budget.generated_at || ""}
                    budgetDate={budget.date}
                    validityDays={budget.validity_days || 30}
                    activeSection={activeSection}
                    categorizedGroups={categorizedGroups}
                    budgetId={budget.id}
                    editable={isAdmin}
                    allCategoriesOpenSheet={DEMO_PORTFOLIO_IDS.includes(publicId || "")}
                    forceExpandItems={exporting}
                  />
                </AnimatedSection>
              </div>

              {/* Arquitetura e Engenharia agora ficam na sidebar direita no desktop;
                  no mobile aparecem aqui logo abaixo do resumo. */}
              <div className="lg:hidden mt-3" data-pdf-section>
                <AnimatedSection id="arquitetonico-section" index={0.4}>
                  <ArquitetonicoExpander />
                </AnimatedSection>
              </div>

              <div className="lg:hidden mt-3" data-pdf-section>
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
              discount={publicDiscountTotal}
              credit={publicCreditTotal}
              subtotal={publicSubtotalBeforeAbatements}
              discounts={abatementBreakdown.discounts}
              credits={abatementBreakdown.credits}
            />
            </div>

            {/* ─── Escopo técnico detalhado — todos os itens da seção ─── */}
            {/*
              Antes este bloco filtrava itens sem imagem fora do export, fazendo
              com que o cliente visse o valor cheio do orçamento mas pouquíssimos
              itens (ou nenhum). Agora exibimos sempre todos os itens; o
              ProductShowcaseCard já tem fallback visual para itens sem imagem.
              Ver: https://github.com/pedrobwild/envision-build-guide/pull/(este PR)
            */}
            {!DEMO_PORTFOLIO_IDS.includes(publicId || "") && (
              <div id="mobile-scope" className="scroll-mt-20 mt-4 sm:mt-6">
                {visibleSections.length > 0 && (() => {
                  // Mostra TODOS os itens das seções, com ou sem imagem.
                  const photoGroups = buildPublicScopeGroups(categorizedGroups);

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
                          <h2 className="text-lg lg:text-3xl budget-heading font-bold text-foreground tracking-tight leading-tight">
                            Itens do Projeto
                          </h2>
                          <p className="text-muted-foreground text-xs mt-0.5 font-body">
                            Clique nas fotos para ampliar
                          </p>
                        </div>
                      </div>

                      {photoGroups.map((group) => {
                        const allItems = group.sections.flatMap(s => (s.items || []).map((item) => ({ ...item, _sectionTitle: s.title })));
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
                  sections={visibleSections}
                  baseTotal={total}
                  clientName={budget.client_name}
                  projectName={budget.project_name}
                />
              </div>
            )}

            {/* ── Mobile ROI simulator (inteligência de mercado por bairro) ── */}
            <div className="lg:hidden" data-pdf-section>
              <AnimatedSection id="roi-simulator-mobile" index={90}>
                <ROISimulator
                  total={total}
                  bairro={budget.bairro}
                  metragem={budget.metragem}
                />
              </AnimatedSection>
            </div>


            {/* mobile-portal anchor kept for nav */}
            <div id="mobile-portal" className="scroll-mt-20" />

            <div data-pdf-section>
              <AnimatedSection id="portal-section-inline" index={99}>
                <Suspense fallback={<LazyFallback />}>
                  <PortalShowcase />
                </Suspense>
              </AnimatedSection>
            </div>

            {/* Card "Veja o Portal em ação" ocultado a pedido
            <div data-pdf-section>
              <AnimatedSection id="portal-demo-access" index={99.2}>
                <Suspense fallback={<LazyFallback />}>
                  <PortalDemoAccessCard />
                </Suspense>
              </AnimatedSection>
            </div>
            */}

            {/* Cronograma de Reforma ocultado a pedido
            <div data-pdf-section>
              <AnimatedSection id="cronograma-section" index={99.5}>
                <Suspense fallback={<LazyFallback />}>
                  <ReformTimeline />
                </Suspense>
              </AnimatedSection>
            </div>
            */}

            <div id="mobile-next-steps" className="scroll-mt-20" data-pdf-section>
              <AnimatedSection id="next-steps" index={100}>
                <NextSteps />
              </AnimatedSection>
            </div>

          </div>

          {/* Desktop sidebar: Arquitetura + Engenharia + simuladores + CTA */}
          <div className="hidden lg:block">
            <div className="sticky top-4 space-y-4 pb-4">
              <ArquitetonicoExpander />
              <EngenhariaExpander />
              {budget.show_optional_items && (
                <OptionalItemsSimulator
                  budgetId={budget.id}
                  sections={visibleSections}
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
                isAddendum={budget.is_addendum === true}
                addendumNumber={budget.addendum_number ?? null}
                addendumApprovedAt={budget.addendum_approved_at ?? null}
                addendumApprovedByName={budget.addendum_approved_by_name ?? null}
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
          hidden={false}
          activeSection={null}
        />

        <div id="roi-full" className="mt-6 sm:mt-8 lg:col-span-2 scroll-mt-20" data-pdf-section>
          <ROISimulator
            total={total}
            bairro={budget.bairro}
            metragem={budget.metragem}
          />
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
    </div>
    </PublicBudgetErrorBoundary>
  );
}
