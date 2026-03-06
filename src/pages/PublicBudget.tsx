import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { fetchPublicBudget, calculateSectionSubtotal, calculateBudgetTotal } from "@/lib/supabase-helpers";
import { formatBRL, formatDate } from "@/lib/formatBRL";
import { BudgetHeader } from "@/components/budget/BudgetHeader";

import { SectionCard } from "@/components/budget/SectionCard";


import { PackageProgressBars } from "@/components/budget/PackageProgressBars";
import { BudgetSummary } from "@/components/budget/BudgetSummary";
import { FloorPlanViewer } from "@/components/budget/FloorPlanViewer";
import { ReadingProgressBar } from "@/components/budget/ReadingProgressBar";

import { AnimatedSection } from "@/components/budget/AnimatedSection";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, List, LayoutGrid } from "lucide-react";
import { demoBudget } from "@/lib/demo-budget-data";
import { exportBudgetPdf } from "@/lib/pdf-export";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { WhatsAppButton } from "@/components/budget/WhatsAppButton";
import { ApprovalCTA } from "@/components/budget/ApprovalCTA";
import { InstallmentSimulator } from "@/components/budget/InstallmentSimulator";
import { BudgetFAQ } from "@/components/budget/BudgetFAQ";

import { WhatIsIncluded } from "@/components/budget/WhatIsIncluded";
import { ClientJourney } from "@/components/budget/ClientJourney";
import { ArquitetonicoExpander } from "@/components/budget/ArquitetonicoExpander";
import { EngenhariaExpander } from "@/components/budget/EngenhariaExpander";
import { PortalShowcase } from "@/components/budget/PortalShowcase";
import { ProjectSecurity } from "@/components/budget/ProjectSecurity";
import { NextSteps } from "@/components/budget/NextSteps";
import { StickyTableOfContents } from "@/components/budget/StickyTableOfContents";

export default function PublicBudget() {
  const { publicId } = useParams<{ publicId: string }>();
  const [budget, setBudget] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [compactMode, setCompactMode] = useState(false);
  const [showMobileSummary, setShowMobileSummary] = useState(false);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const viewTracked = useRef(false);

  useEffect(() => {
    if (publicId === 'demo') {
      setBudget(demoBudget);
      setLoading(false);
      return;
    }
    if (publicId) {
      fetchPublicBudget(publicId).then(data => {
        setBudget(data);
        setLoading(false);
        if (data && !viewTracked.current) {
          viewTracked.current = true;
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
          fetch(`${supabaseUrl}/rest/v1/budgets?public_id=eq.${publicId}`, {
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
      const filename = `${budget.project_name || 'orcamento'}.pdf`;
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
          <Skeleton className="h-16 w-full mb-6" />
          <Skeleton className="h-32 w-full mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-64 w-full rounded-lg" />
              ))}
            </div>
            <Skeleton className="h-96 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (!budget) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-display font-bold text-foreground mb-2">Orçamento não encontrado</h1>
          <p className="text-muted-foreground">O link pode estar expirado ou inválido.</p>
        </div>
      </div>
    );
  }

  const sections = budget.sections || [];
  const adjustments = budget.adjustments || [];
  const rooms = budget.rooms || [];
  const total = calculateBudgetTotal(sections, adjustments);

  const filteredSections = sections.filter((s: any) => {
    if (!searchQuery) return true;
    return s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.items || []).some((item: any) =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
  });

  const handleRoomClick = (roomId: string | null) => {
    setActiveRoom(roomId || null);
  };

  return (
    <div className="min-h-screen bg-background">
      <StickyTableOfContents />
      <ReadingProgressBar />
      <BudgetHeader
        budget={budget}
        onExportPdf={handleExportPdf}
        exporting={exporting}
      />

      <main id="budget-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        


        {budget.show_progress_bars && (
          <PackageProgressBars sections={sections} total={total} />
        )}


        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <AnimatedSection id="arquitetonico-section" index={0}>
              <ArquitetonicoExpander />
            </AnimatedSection>

            <AnimatedSection id="engenharia-section" index={0.5}>
              <EngenhariaExpander />
            </AnimatedSection>

            <AnimatedSection id="portal-section" index={0.6}>
              <PortalShowcase />
            </AnimatedSection>

            {budget.floor_plan_url && (
              <AnimatedSection id="floor-plan-section" index={0.8}>
                <FloorPlanViewer
                  floorPlanUrl={budget.floor_plan_url}
                  rooms={rooms}
                  sections={sections}
                  activeRoom={activeRoom}
                  onRoomClick={handleRoomClick}
                />
              </AnimatedSection>
            )}

            {filteredSections
              .filter((section: any) => !section.title?.toLowerCase().includes("projetos"))
              .map((section: any, idx: number) => (
              <AnimatedSection key={section.id} id={`section-${section.id}`} index={idx + 1}>
                <SectionCard
                  section={section}
                  compact={compactMode}
                  showItemQty={budget.show_item_qty}
                />
              </AnimatedSection>
            ))}

            <AnimatedSection id="project-security" index={99}>
              <ProjectSecurity />
            </AnimatedSection>

            <AnimatedSection id="next-steps" index={100}>
              <NextSteps />
            </AnimatedSection>
          </div>

          <div className="hidden lg:block">
            <div className="sticky top-4 space-y-5 max-h-[calc(100vh-2rem)] overflow-y-auto pb-4 scrollbar-thin">
              
              <BudgetSummary
                sections={sections}
                adjustments={adjustments}
                total={total}
                generatedAt={budget.generated_at}
              />
              <InstallmentSimulator total={total} />
              <ApprovalCTA
                budgetId={budget.id}
                publicId={publicId || "demo"}
                approvedAt={budget.approved_at}
                approvedByName={budget.approved_by_name}
              />
            </div>
          </div>
        </div>

        {/* Mobile sticky bottom bar */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50" data-pdf-hide>
          {showMobileSummary && (
            <div className="bg-card border-t border-border p-6 max-h-[60vh] overflow-y-auto shadow-2xl">
              <BudgetSummary
                sections={sections}
                adjustments={adjustments}
                total={total}
                generatedAt={budget.generated_at}
              />
            </div>
          )}
          <button
            onClick={() => setShowMobileSummary(!showMobileSummary)}
            className="w-full text-center text-xs text-muted-foreground py-1.5 bg-card border-t border-border font-body hover:text-foreground transition-colors"
          >
            {showMobileSummary ? "Fechar detalhes ↓" : "Ver detalhes ↑"}
          </button>
          <div className="bg-charcoal flex items-center justify-between px-4 py-3">
            <div className="flex flex-col">
              <span className="font-display font-bold text-white text-base">{formatBRL(total)}</span>
              <span className="text-[10px] text-white/50 font-body">ou 10x de {formatBRL(total / 10)} sem juros</span>
            </div>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                document.getElementById("next-steps")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="px-4 py-2.5 rounded-lg bg-success text-success-foreground font-display font-bold text-xs"
            >
              Iniciar meu projeto
            </motion.button>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-12 lg:col-span-2">
          <BudgetFAQ />
        </div>

        {budget.disclaimer && (
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mt-8 mb-24 lg:mb-8 p-6 rounded-lg bg-muted/50 border border-border"
          >
            <p className="text-sm text-muted-foreground font-body leading-relaxed">{budget.disclaimer}</p>
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
