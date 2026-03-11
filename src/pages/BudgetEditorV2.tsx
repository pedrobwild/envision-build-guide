import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Save, ExternalLink, Copy, Check, Loader2, User } from "lucide-react";
import { toast } from "sonner";
import { EditorStepper, type EditorStep } from "@/components/editor/EditorStepper";

import { RoomDrawingStep, type Room } from "@/components/editor/RoomDrawingStep";
import { SpreadsheetImportStep, type ParsedPackage } from "@/components/editor/SpreadsheetImportStep";
import { CoverageMappingStep } from "@/components/editor/CoverageMappingStep";
import { MetadataStep } from "@/components/editor/MetadataStep";
import { getPublicBudgetUrl } from "@/lib/getPublicUrl";

export default function BudgetEditorV2() {
  const { budgetId } = useParams<{ budgetId: string }>();
  const navigate = useNavigate();
  const [budget, setBudget] = useState<any>(null);
  const [currentStep, setCurrentStep] = useState<EditorStep>("metadata");
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
      const completed = new Set<EditorStep>(["metadata", "floor-plan"]);
      setCompletedSteps(completed);
    } else {
      // At minimum, metadata is completed if we have client data
      if (b.client_name && b.client_name !== 'Cliente') {
        setCompletedSteps(new Set<EditorStep>(["metadata"]));
      }
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

        const { data: insertedItems } = await supabase.from("items").insert(itemInserts).select("id");

        // Save item images
        if (insertedItems) {
          for (let ii = 0; ii < pkg.items.length; ii++) {
            const item = pkg.items[ii] as any;
            const itemId = insertedItems[ii]?.id;
            if (!itemId || !item.images?.length) continue;
            await supabase.from("item_images").insert(
              item.images.map((img: any) => ({
                item_id: itemId,
                url: img.url,
                is_primary: img.isPrimary || false,
              }))
            );
          }
        }
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
      const publicUrl = getPublicBudgetUrl(publicId);
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
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate("/admin")}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex flex-col min-w-0">
              <span className="font-display font-bold text-sm text-foreground leading-tight truncate">
                {budget.project_name || "Sem nome"}
              </span>
              {currentStep !== "metadata" && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-body flex-wrap">
                  {budget.client_name && budget.client_name !== "Cliente" && (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {budget.client_name}
                    </span>
                  )}
                  {budget.condominio && <span>• {budget.condominio}</span>}
                  {budget.bairro && <span>• {budget.bairro}</span>}
                  {budget.metragem && <span>• {budget.metragem}</span>}
                  {budget.versao && <span>• v{budget.versao}</span>}
                </div>
              )}
              {currentStep === "metadata" && (
                <span className="text-xs text-muted-foreground font-body">Preencha os dados do cabeçalho</span>
              )}
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
                onClick={() => navigator.clipboard.writeText(getPublicBudgetUrl(budget.public_id!))}
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
        {currentStep === "metadata" && (
          <MetadataStep
            budget={budget}
            onFieldChange={(field, value) => {
              setBudget({ ...budget, [field]: value });
              autoSaveBudgetField(field, value);
            }}
            onNext={() => {
              completeStep("metadata");
              setCurrentStep("floor-plan");
            }}
          />
        )}

        {currentStep === "floor-plan" && (
          <FloorPlanUploadStep
            budgetId={budgetId!}
            floorPlanUrl={floorPlanUrl}
            onUploaded={handleFloorPlanUploaded}
            onNext={() => {
              completeStep("floor-plan");
              setCurrentStep("spreadsheet");
            }}
          />
        )}

        {currentStep === "spreadsheet" && (
          <SpreadsheetImportStep
            packages={packages}
            onImported={setPackages}
            onNext={() => {
              completeStep("spreadsheet");
              handleSaveAndPublish();
            }}
            onBack={() => setCurrentStep("floor-plan")}
          />
        )}
      </main>
    </div>
  );
}
