import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { fetchPublicBudget, calculateSectionSubtotal, calculateBudgetTotal } from "@/lib/supabase-helpers";
import { formatBRL, formatDate } from "@/lib/formatBRL";
import { BudgetHeader } from "@/components/budget/BudgetHeader";
import { SectionCard } from "@/components/budget/SectionCard";
import { ExecutiveSummary } from "@/components/budget/ExecutiveSummary";
import { RoomChecklist } from "@/components/budget/RoomChecklist";
import { PackageProgressBars } from "@/components/budget/PackageProgressBars";
import { BudgetSummary } from "@/components/budget/BudgetSummary";
import { FloorPlanViewer } from "@/components/budget/FloorPlanViewer";
import { ReadingProgressBar } from "@/components/budget/ReadingProgressBar";
import { SectionNav } from "@/components/budget/SectionNav";
import { AnimatedSection } from "@/components/budget/AnimatedSection";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, List, LayoutGrid } from "lucide-react";
import { demoBudget } from "@/lib/demo-budget-data";
import { exportBudgetPdf } from "@/lib/pdf-export";
import { toast } from "sonner";
import { motion } from "framer-motion";

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
    const matchSearch = !searchQuery ||
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.items || []).some((item: any) =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    if (!matchSearch) return false;
    if (!activeRoom) return true;
    return (s.items || []).some((item: any) => {
      const coverageType = item.coverage_type || "geral";
      const included: string[] = item.included_rooms || [];
      const excluded: string[] = item.excluded_rooms || [];
      if (coverageType === "geral") return !excluded.includes(activeRoom);
      return included.includes(activeRoom);
    });
  });

  return (
    <div className="min-h-screen bg-background">
      <ReadingProgressBar />
      <BudgetHeader
        budget={budget}
        onExportPdf={handleExportPdf}
        exporting={exporting}
      />

      <main id="budget-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] as const }}
        >
          <ExecutiveSummary
            sections={sections}
            rooms={rooms}
            total={total}
            projectName={budget.project_name}
          />
        </motion.div>

        {budget.show_progress_bars && (
          <PackageProgressBars sections={sections} total={total} />
        )}

        {/* Search & controls */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          className="flex flex-col sm:flex-row gap-3 mb-8"
          data-pdf-hide
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar seção ou item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all font-body text-sm"
            />
          </div>
          <button
            onClick={() => setCompactMode(!compactMode)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all text-sm font-body"
          >
            {compactMode ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
            {compactMode ? "Detalhado" : "Compacto"}
          </button>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {budget.floor_plan_url && (
              <AnimatedSection id="floor-plan-section" index={0}>
                <FloorPlanViewer
                  floorPlanUrl={budget.floor_plan_url}
                  rooms={rooms}
                  sections={sections}
                  activeRoom={activeRoom}
                  onRoomClick={setActiveRoom}
                />
              </AnimatedSection>
            )}

            {activeRoom && (() => {
              const roomObj = rooms.find((r: any) => r.id === activeRoom);
              const roomName = roomObj?.name || activeRoom;
              return (
                <RoomChecklist
                  roomId={activeRoom}
                  roomName={roomName}
                  sections={sections}
                  onClear={() => setActiveRoom(null)}
                />
              );
            })()}

            {filteredSections.map((section: any, idx: number) => (
              <AnimatedSection key={section.id} id={`section-${section.id}`} index={idx + 1}>
                <SectionCard
                  section={section}
                  compact={compactMode}
                  showItemQty={budget.show_item_qty}
                  highlightZone={activeRoom}
                />
              </AnimatedSection>
            ))}
          </div>

          <div className="hidden lg:block space-y-6">
            <SectionNav sections={filteredSections} />
            <div className="sticky top-[480px]">
              <BudgetSummary
                sections={sections}
                adjustments={adjustments}
                total={total}
                generatedAt={budget.generated_at}
              />
            </div>
          </div>
        </div>

        {/* Mobile summary toggle */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50" data-pdf-hide>
          <button
            onClick={() => setShowMobileSummary(!showMobileSummary)}
            className="w-full py-4 px-6 bg-charcoal text-primary-foreground flex items-center justify-between font-body font-semibold"
          >
            <span>Resumo do Orçamento</span>
            <span className="text-primary font-display text-lg">{formatBRL(total)}</span>
          </button>
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
        </div>

        {budget.disclaimer && (
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mt-12 mb-24 lg:mb-8 p-6 rounded-lg bg-muted/50 border border-border"
          >
            <p className="text-sm text-muted-foreground font-body leading-relaxed">{budget.disclaimer}</p>
          </motion.div>
        )}
      </main>
    </div>
  );
}
