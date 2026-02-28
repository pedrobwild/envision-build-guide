import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Save, ExternalLink, Copy, Check, Loader2, User } from "lucide-react";
import { toast } from "sonner";
import { EditorStepper, type EditorStep } from "@/components/editor/EditorStepper";
import { FloorPlanUploadStep } from "@/components/editor/FloorPlanUploadStep";
import { RoomDrawingStep, type Room } from "@/components/editor/RoomDrawingStep";
import { SpreadsheetImportStep, type ParsedPackage } from "@/components/editor/SpreadsheetImportStep";
import { CoverageMappingStep } from "@/components/editor/CoverageMappingStep";

export default function BudgetEditorV2() {
  const { budgetId } = useParams<{ budgetId: string }>();
  const navigate = useNavigate();
  const [budget, setBudget] = useState<any>(null);
  const [currentStep, setCurrentStep] = useState<EditorStep>("floor-plan");
  const [completedSteps, setCompletedSteps] = useState<Set<EditorStep>>(new Set());
  const [floorPlanUrl, setFloorPlanUrl] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [packages, setPackages] = useState<ParsedPackage[]>([]);
  const [saving, setSaving] = useState(false);
  const [roomSaveStatus, setRoomSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadBudget();
  }, [budgetId]);

  const loadBudget = async () => {
    if (!budgetId) return;
    const { data: b } = await supabase.from("budgets").select("*").eq("id", budgetId).single();
    if (!b) { navigate("/admin"); return; }
    setBudget(b);
    setFloorPlanUrl((b as any).floor_plan_url || null);

    // Load existing rooms
    const { data: existingRooms } = await supabase
      .from("rooms")
      .select("*")
      .eq("budget_id", budgetId)
      .order("order_index");

    if (existingRooms && existingRooms.length > 0) {
      setRooms(existingRooms.map(r => ({
        id: r.id,
        name: r.name,
        polygon: (r.polygon as any) || [],
      })));
    }

    // Determine initial step based on existing data
    if ((b as any).floor_plan_url) {
      const completed = new Set<EditorStep>(["floor-plan"]);
      if (existingRooms && existingRooms.length > 0) {
        completed.add("rooms");
      }
      setCompletedSteps(completed);
    }
  };

  const completeStep = (step: EditorStep) => {
    setCompletedSteps(prev => new Set(prev).add(step));
  };

  const autoSaveBudgetField = useCallback((field: string, value: string) => {
    if (!budgetId) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      await supabase.from("budgets").update({ [field]: value }).eq("id", budgetId);
    }, 800);
  }, [budgetId]);

  const handleFloorPlanUploaded = (url: string) => {
    setFloorPlanUrl(url);
    if (url) completeStep("floor-plan");
  };

  const handleRoomsChange = useCallback(async (newRooms: Room[]) => {
    setRooms(newRooms);
    if (!budgetId) return;
    setRoomSaveStatus("saving");
    try {
      await supabase.from("rooms").delete().eq("budget_id", budgetId);
      if (newRooms.length > 0) {
        await supabase.from("rooms").insert(
          newRooms.map((r, i) => ({
            id: r.id,
            budget_id: budgetId,
            name: r.name,
            polygon: r.polygon,
            order_index: i,
          }))
        );
      }
      setRoomSaveStatus("saved");
      setTimeout(() => setRoomSaveStatus("idle"), 2000);
    } catch (err) {
      console.error("Auto-save rooms error:", err);
      setRoomSaveStatus("idle");
    }
  }, [budgetId]);

  const goToStep = (step: EditorStep) => {
    setCurrentStep(step);
  };

  const handleSaveAndPublish = async () => {
    if (!budgetId || !budget) return;
    setSaving(true);

    try {
      // Save rooms
      await supabase.from("rooms").delete().eq("budget_id", budgetId);
      if (rooms.length > 0) {
        await supabase.from("rooms").insert(
          rooms.map((r, i) => ({
            id: r.id,
            budget_id: budgetId,
            name: r.name,
            polygon: r.polygon,
            order_index: i,
          }))
        );
      }

      // Save sections (packages) and items
      // Delete existing sections/items first
      const { data: existingSections } = await supabase
        .from("sections")
        .select("id")
        .eq("budget_id", budgetId);
      
      if (existingSections && existingSections.length > 0) {
        const sectionIds = existingSections.map(s => s.id);
        await supabase.from("items").delete().in("section_id", sectionIds);
        await supabase.from("sections").delete().eq("budget_id", budgetId);
      }

      // Create new sections and items from packages
      for (let pi = 0; pi < packages.length; pi++) {
        const pkg = packages[pi];
        const { data: section } = await supabase
          .from("sections")
          .insert({
            budget_id: budgetId,
            title: pkg.name,
            section_price: pkg.price > 0 ? pkg.price : null,
            order_index: pi,
          })
          .select()
          .single();

        if (!section) continue;

        const itemInserts = pkg.items.map((item: any, ii: number) => ({
          section_id: section.id,
          title: item.name,
          description: item.description || null,
          qty: item.qty || null,
          unit: item.unit || null,
          internal_total: item.total || null,
          order_index: ii,
          coverage_type: item.coverageType || "geral",
          included_rooms: item.includedRooms || [],
          excluded_rooms: item.excludedRooms || [],
        }));

        await supabase.from("items").insert(itemInserts);
      }

      // Publish
      const publicId = budget.public_id || crypto.randomUUID().replace(/-/g, "").slice(0, 12);
      await supabase.from("budgets").update({
        status: "published",
        public_id: publicId,
        floor_plan_url: floorPlanUrl,
      }).eq("id", budgetId);

      setBudget({ ...budget, status: "published", public_id: publicId });
      completeStep("coverage");
      const publicUrl = `${window.location.origin}/o/${publicId}`;
      toast.success("Orçamento publicado com sucesso!", {
        description: "O link público foi copiado para a área de transferência.",
        duration: 5000,
      });
      navigator.clipboard.writeText(publicUrl);
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Erro ao salvar. Tente novamente.");
    }

    setSaving(false);
  };

  if (!budget) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground font-body">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/admin")}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex flex-col">
              <input
                value={budget.project_name}
                onChange={(e) => {
                  setBudget({ ...budget, project_name: e.target.value });
                  autoSaveBudgetField("project_name", e.target.value);
                }}
                className="font-display font-bold text-lg text-foreground bg-transparent border-none focus:outline-none w-48 sm:w-auto leading-tight"
                placeholder="Nome do projeto"
              />
              <div className="flex items-center gap-1.5">
                <User className="h-3 w-3 text-muted-foreground" />
                <input
                  value={budget.client_name}
                  onChange={(e) => {
                    setBudget({ ...budget, client_name: e.target.value });
                    autoSaveBudgetField("client_name", e.target.value);
                  }}
                  className="text-xs text-muted-foreground bg-transparent border-none focus:outline-none font-body w-32 sm:w-auto"
                  placeholder="Nome do cliente"
                />
              </div>
            </div>
          </div>

          <EditorStepper
            current={currentStep}
            onStepClick={goToStep}
            completedSteps={completedSteps}
          />

          <div className="flex items-center gap-2">
            {roomSaveStatus === "saving" && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-body animate-pulse">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando...
              </span>
            )}
            {roomSaveStatus === "saved" && (
              <span className="flex items-center gap-1.5 text-xs text-primary font-body">
                <Check className="h-3.5 w-3.5" /> Salvo
              </span>
            )}
            {budget.public_id && (
              <button
                onClick={() => navigator.clipboard.writeText(`${window.location.origin}/o/${budget.public_id}`)}
                className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                title="Copiar link público"
              >
                <Copy className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {currentStep === "floor-plan" && (
          <FloorPlanUploadStep
            budgetId={budgetId!}
            floorPlanUrl={floorPlanUrl}
            onUploaded={handleFloorPlanUploaded}
            onNext={() => {
              completeStep("floor-plan");
              setCurrentStep("rooms");
            }}
          />
        )}

        {currentStep === "rooms" && floorPlanUrl && (
          <RoomDrawingStep
            floorPlanUrl={floorPlanUrl}
            rooms={rooms}
            onRoomsChange={handleRoomsChange}
            onNext={() => {
              completeStep("rooms");
              setCurrentStep("spreadsheet");
            }}
            onBack={() => setCurrentStep("floor-plan")}
          />
        )}

        {currentStep === "spreadsheet" && (
          <SpreadsheetImportStep
            packages={packages}
            onImported={setPackages}
            onNext={() => {
              completeStep("spreadsheet");
              setCurrentStep("coverage");
            }}
            onBack={() => setCurrentStep("rooms")}
          />
        )}

        {currentStep === "coverage" && floorPlanUrl && (
          <CoverageMappingStep
            floorPlanUrl={floorPlanUrl}
            rooms={rooms}
            packages={packages}
            onPackagesChange={setPackages}
            onSave={handleSaveAndPublish}
            onBack={() => setCurrentStep("spreadsheet")}
            saving={saving}
          />
        )}
      </main>
    </div>
  );
}
