import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatBRL } from "@/lib/formatBRL";
import { calcItemSaleTotal, calcItemCostTotal } from "@/lib/budget-calc";
import { ArrowLeft, LayoutTemplate, Loader2, Save, Check, X } from "lucide-react";
import TemplateMediaManager, { type MediaConfig, EMPTY_MEDIA_CONFIG } from "@/components/editor/TemplateMediaManager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionsEditor, TEMPLATE_TABLE_CONFIG } from "@/components/editor/SectionsEditor";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────

interface TemplateData {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  media_config: MediaConfig;
}

interface SectionData {
  id: string;
  title: string;
  subtitle?: string | null;
  order_index: number;
  qty?: number | null;
  section_price?: number | null;
  is_optional?: boolean;
  items: ItemData[];
}

interface ItemData {
  id: string;
  title: string;
  description?: string | null;
  reference_url?: string | null;
  qty?: number | null;
  unit?: string | null;
  internal_unit_price?: number | null;
  internal_total?: number | null;
  bdi_percentage?: number | null;
  order_index?: number;
  images?: { id?: string; url: string; is_primary?: boolean | null }[];
}

// ─── Calc helpers (imported from budget-calc.ts) ────────────────

// ─── Auto-save status chip ──────────────────────────────────────

type AutoSaveStatus = "idle" | "saving" | "saved" | "error";

function AutoSaveChip({ status, onRetry }: { status: AutoSaveStatus; onRetry?: () => void }) {
  if (status === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground font-body px-2.5 py-1 rounded-full bg-muted/60">
        <Loader2 className="h-3 w-3 animate-spin" />
        Salvando…
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-destructive font-body px-2.5 py-1 rounded-full bg-destructive/10">
        <X className="h-3 w-3" />
        Erro
        {onRetry && (
          <button onClick={onRetry} className="underline hover:no-underline ml-0.5">
            Tentar novamente
          </button>
        )}
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-success font-body px-2.5 py-1 rounded-full bg-success/10">
        <Check className="h-3 w-3" />
        Salvo
      </span>
    );
  }
  return null;
}

// ─── Main page ───────────────────────────────────────────────────

export default function TemplateEditorPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const [template, setTemplate] = useState<TemplateData | null>(null);
  const [sections, setSections] = useState<SectionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>("idle");

  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const isInitialLoadRef = useRef(true);
  const templateRef = useRef(template);
  templateRef.current = template;

  // ─── Load ────────────────────────────────────────────────────
  const loadTemplate = useCallback(async () => {
    if (!templateId) return;
    setLoading(true);

    const { data: tpl } = await supabase
      .from("budget_templates")
      .select("id, name, description, is_active, media_config, created_at, updated_at")
      .eq("id", templateId)
      .single();
    if (!tpl) { navigate("/admin/templates"); return; }
    setTemplate({
      ...tpl,
      media_config: (tpl.media_config as unknown as MediaConfig | null) ?? { ...EMPTY_MEDIA_CONFIG },
    });

    const { data: secs } = await supabase
      .from("budget_template_sections")
      .select("id, template_id, title, subtitle, order_index, is_optional, tags, included_bullets, excluded_bullets, notes")
      .eq("template_id", templateId)
      .order("order_index");

    const sectionList = secs ?? [];
    const sectionIds = sectionList.map((s) => s.id);

    const { data: items } = await supabase
      .from("budget_template_items")
      .select("id, template_section_id, title, description, order_index, qty, unit, internal_unit_price, internal_total, bdi_percentage, coverage_type, reference_url")
      .in("template_section_id", sectionIds.length ? sectionIds : ["__none__"])
      .order("order_index");

    const enriched: SectionData[] = sectionList.map((sec) => ({
      ...sec,
      items: ((items ?? []).filter((i) => i.template_section_id === sec.id) as ItemData[]),
    }));

    setSections(enriched);
    setLoading(false);
    setTimeout(() => { isInitialLoadRef.current = false; }, 100);
  }, [templateId, navigate]);

  useEffect(() => { loadTemplate(); }, [loadTemplate]);

  // ─── Auto-save template metadata ──────────────────────────────
  const persistMeta = useCallback(async () => {
    const tpl = templateRef.current;
    if (!tpl) return;
    setAutoSaveStatus("saving");
    try {
      await supabase
        .from("budget_templates")
        .update({ name: tpl.name, description: tpl.description, media_config: tpl.media_config as any })
        .eq("id", tpl.id);
      setAutoSaveStatus("saved");
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setAutoSaveStatus("idle"), 3000);
    } catch {
      setAutoSaveStatus("error");
    }
  }, []);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => persistMeta(), 1500);
  }, [persistMeta]);

  useEffect(() => {
    if (isInitialLoadRef.current) return;
    scheduleSave();
  }, [template, scheduleSave]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  // ─── Totals ──────────────────────────────────────────────────
  const totalCost = useMemo(() => sections.reduce((s, sec) => s + sec.items.reduce((a, i) => a + calcItemCostTotal(i), 0), 0), [sections]);
  const totalSale = useMemo(() => sections.reduce((s, sec) => s + sec.items.reduce((a, i) => a + calcItemSaleTotal(i), 0), 0), [sections]);
  const totalMargin = totalSale - totalCost;
  const marginPercent = totalSale > 0 ? (totalMargin / totalSale) * 100 : 0;
  const bdiPercent = totalCost > 0 ? ((totalSale - totalCost) / totalCost) * 100 : 0;
  const totalItems = sections.reduce((s, sec) => s + sec.items.length, 0);
  const marginColor = marginPercent >= 15 ? "text-success" : marginPercent >= 10 ? "text-warning" : "text-destructive";

  // ─── Loading state ───────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="h-14 border-b border-border/40 bg-card/50 backdrop-blur-xl">
          <div className="max-w-[1200px] mx-auto px-6 h-full flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
            <div className="h-4 w-32 rounded bg-muted animate-pulse" />
            <div className="h-5 w-20 rounded-full bg-muted animate-pulse ml-2" />
          </div>
        </div>
        <div className="h-10 border-b border-border/20 bg-card/30">
          <div className="max-w-[1200px] mx-auto px-6 h-full flex items-center gap-6">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-3 w-16 rounded bg-muted animate-pulse" />
            ))}
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!template) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── Sticky two-layer header (matches BudgetEditorV2) ── */}
      <div className="sticky top-0 z-50 bg-card/85 backdrop-blur-xl border-b border-border/40 shadow-sm">
        {/* Layer 1 — Breadcrumb + template badge + auto-save */}
        <div className="max-w-[1200px] mx-auto px-3 sm:px-6 h-12 sm:h-14 flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <button
              onClick={() => navigate("/admin/templates")}
              className="p-1.5 sm:p-2 rounded-xl hover:bg-accent text-muted-foreground hover:text-foreground transition-all duration-200 shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            <LayoutTemplate className="h-4 w-4 text-primary shrink-0" />

            <input
              type="text"
              value={template.name}
              onChange={(e) => setTemplate({ ...template, name: e.target.value })}
              className="text-foreground font-semibold font-display text-sm tracking-tight min-w-0 bg-transparent border-none outline-none focus:ring-0 flex-1 truncate"
              placeholder="Nome do template"
            />

            <Badge className="text-[10px] font-body border shrink-0 rounded-full px-2 bg-primary/10 text-primary border-primary/20">
              <LayoutTemplate className="h-3 w-3 mr-1" />
              <span className="hidden sm:inline">Template</span>
            </Badge>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <div className="hidden sm:block">
              <AutoSaveChip status={autoSaveStatus} onRetry={persistMeta} />
            </div>

            <Button
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={persistMeta}
              disabled={autoSaveStatus === "saving"}
            >
              {autoSaveStatus === "saving" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">{autoSaveStatus === "saving" ? "Salvando…" : "Salvar"}</span>
            </Button>
          </div>
        </div>

        {/* Layer 2 — Financial totals (same grid as budget editor) */}
        <div className="border-t border-border/20">
          <div className="max-w-[1200px] mx-auto px-3 sm:px-6 py-1.5 sm:py-0 sm:h-10 flex items-center">
            <div className="grid grid-cols-5 gap-2 sm:flex sm:gap-6 w-full text-xs font-body">
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                <span className="text-muted-foreground uppercase tracking-widest text-[9px] sm:text-[10px] font-medium">Venda</span>
                <span className="font-bold tabular-nums text-success tracking-tight text-[11px] sm:text-xs">
                  {formatBRL(totalSale)}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                <span className="text-muted-foreground uppercase tracking-widest text-[9px] sm:text-[10px] font-medium">Custo</span>
                <span className="font-semibold tabular-nums text-muted-foreground tracking-tight text-[11px] sm:text-xs">
                  {formatBRL(totalCost)}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                <span className="text-muted-foreground uppercase tracking-widest text-[9px] sm:text-[10px] font-medium">BDI</span>
                <span className="font-semibold tabular-nums text-primary tracking-tight text-[11px] sm:text-xs">
                  {bdiPercent.toFixed(1)}%
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                <span className="text-muted-foreground uppercase tracking-widest text-[9px] sm:text-[10px] font-medium">Margem R$</span>
                <span className={cn("font-bold tabular-nums tracking-tight text-[11px] sm:text-xs", marginColor)}>
                  {formatBRL(totalMargin)}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                <span className="text-muted-foreground uppercase tracking-widest text-[9px] sm:text-[10px] font-medium">Margem %</span>
                <span className={cn("font-bold tabular-nums tracking-tight text-[11px] sm:text-xs", marginColor)}>
                  {marginPercent.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <main className="max-w-[1200px] w-full mx-auto px-3 sm:px-6 py-4 flex-1 flex flex-col">
        {/* Template info banner */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-primary/15 bg-primary/5 mb-4">
          <LayoutTemplate className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-body text-foreground font-medium">
              Você está editando um <strong>template</strong>
            </p>
            <p className="text-xs text-muted-foreground font-body mt-0.5">
              Alterações aqui não afetam orçamentos existentes. Este template será usado como base para novos orçamentos.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground font-body shrink-0">
            <span>{sections.length} seções</span>
            <span className="text-border">•</span>
            <span>{totalItems} itens</span>
          </div>
        </div>

        {/* Description field */}
        <div className="mb-4">
          <input
            type="text"
            value={template.description ?? ""}
            onChange={(e) => setTemplate({ ...template, description: e.target.value || null })}
            className="w-full text-sm text-muted-foreground bg-transparent border-none outline-none focus:ring-0 font-body px-1"
            placeholder="Descrição do template (opcional)..."
          />
        </div>

        {/* Media Manager */}
        <div className="mb-4">
          <TemplateMediaManager
            templateId={templateId!}
            mediaConfig={template.media_config}
            onChange={(mc) => setTemplate({ ...template, media_config: mc })}
          />
        </div>

        {/* Sections Editor — reuses the same component as BudgetEditorV2 */}
        <SectionsEditor
          budgetId={templateId!}
          sections={sections}
          onSectionsChange={setSections}
          tableConfig={TEMPLATE_TABLE_CONFIG}
        />
      </main>
    </div>
  );
}
