import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { fetchPublicBudget, calculateSectionSubtotal, calculateBudgetTotal } from "@/lib/supabase-helpers";
import { formatBRL, formatDate } from "@/lib/formatBRL";
import { BudgetHeader } from "@/components/budget/BudgetHeader";
import { BudgetContext } from "@/components/budget/BudgetContext";
import { SectionCard } from "@/components/budget/SectionCard";
import { BudgetSummary } from "@/components/budget/BudgetSummary";
import { FloorPlanViewer } from "@/components/budget/FloorPlanViewer";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, List, LayoutGrid } from "lucide-react";
import { demoBudget } from "@/lib/demo-budget-data";

export default function PublicBudget() {
  const { publicId } = useParams<{ publicId: string }>();
  const [budget, setBudget] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [compactMode, setCompactMode] = useState(false);
  const [showMobileSummary, setShowMobileSummary] = useState(false);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);

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
      });
    }
  }, [publicId]);

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

  // Filter by search and active floor zone
  const filteredSections = sections.filter((s: any) => {
    const matchSearch = !searchQuery ||
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.items || []).some((item: any) =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase())
      );

    if (!matchSearch) return false;
    if (!activeRoom) return true;

    // Filter sections that have at least one item covering the active room
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
      <BudgetHeader projectName={budget.project_name} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <BudgetContext budget={budget} />

        {/* Search & controls */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
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
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Floor plan */}
            {budget.floor_plan_url && (
              <FloorPlanViewer
                floorPlanUrl={budget.floor_plan_url}
                rooms={rooms}
                sections={sections}
                activeRoom={activeRoom}
                onRoomClick={setActiveRoom}
              />
            )}

            {/* Active zone indicator */}
            {activeRoom && (() => {
              const roomName = rooms.find((r: any) => r.id === activeRoom)?.name || activeRoom;
              return (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <span className="text-sm font-body text-foreground">
                    Filtrando por: <strong className="text-primary">{roomName}</strong>
                  </span>
                  <button
                    onClick={() => setActiveRoom(null)}
                    className="ml-auto text-xs text-primary hover:text-primary/80 font-body font-medium"
                  >
                    Limpar
                  </button>
                </div>
              );
            })()}

            {filteredSections.map((section: any, idx: number) => (
              <div key={section.id} id={`section-${section.id}`} className="animate-fade-in" style={{ animationDelay: `${idx * 80}ms` }}>
                <SectionCard
                  section={section}
                  compact={compactMode}
                  showItemQty={budget.show_item_qty}
                  highlightZone={activeRoom}
                />
              </div>
            ))}
          </div>

          {/* Desktop summary */}
          <div className="hidden lg:block">
            <div className="sticky top-6 space-y-6">
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
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50">
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

        {/* Disclaimer */}
        {budget.disclaimer && (
          <div className="mt-12 mb-24 lg:mb-8 p-6 rounded-lg bg-muted/50 border border-border">
            <p className="text-sm text-muted-foreground font-body leading-relaxed">{budget.disclaimer}</p>
          </div>
        )}
      </main>
    </div>
  );
}
