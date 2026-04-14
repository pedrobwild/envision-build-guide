import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, User, ChevronDown, DollarSign, RotateCcw, PackageCheck, Send, Handshake, MessageSquare, ClipboardList, Image as ImageIcon, ScrollText, AlertTriangle, Info, Copy, LayoutTemplate } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { MetadataStep } from "@/components/editor/MetadataStep";
import { SectionsEditor } from "@/components/editor/SectionsEditor";
import { getPublicBudgetUrl } from "@/lib/getPublicUrl";
import { VersionTimeline } from "@/components/editor/VersionTimeline";
import { ensureVersionGroup, publishVersion, duplicateBudgetAsVersion } from "@/lib/budget-versioning";
import { MediaUploadSection } from "@/components/editor/MediaUploadSection";
import { formatBRL } from "@/lib/formatBRL";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { WorkflowBar } from "@/components/editor/WorkflowBar";
import { PipelineProgress } from "@/components/editor/PipelineProgress";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Button } from "@/components/ui/button";
import { BriefingPanel } from "@/components/editor/BriefingPanel";
import { RevisionBanner } from "@/components/editor/RevisionBanner";
import { useAuth } from "@/hooks/useAuth";
import { StickyEditorHeader, type SaveStatus } from "@/components/editor/StickyEditorHeader";
import { INTERNAL_STATUSES, type InternalStatus } from "@/lib/role-constants";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { BudgetRow, EditorSection } from "@/types/budget-common";
import { TemplateSelectorDialog } from "@/components/editor/TemplateSelectorDialog";

export default function BudgetEditorV2() {
  const { budgetId } = useParams<{ budgetId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { isOrcamentista, isComercial, isAdmin, profile } = useUserProfile();
  const { user } = useAuth();

  const backPath = (location.state as { from?: string } | null)?.from
    || (isOrcamentista ? "/admin/producao" : isComercial ? "/admin/comercial" : "/admin");
  const [budget, setBudget] = useState<BudgetRow | null>(null);
  const [sections, setSections] = useState<EditorSection[]>([]);
  const [saving, setSaving] = useState(false);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [internalDataOpen, setInternalDataOpen] = useState(false);
  const [versionCount, setVersionCount] = useState(0);
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const [startingRevision, setStartingRevision] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const lastSavePayload = useRef<{ field: string; value: unknown } | null>(null);
  const saveErrorCount = useRef(0);
  const errorToastId = useRef<string | number | null>(null);
  const [activeTab, setActiveTab] = useState("planilha");
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [mediaCount, setMediaCount] = useState(0);
  const [creatingVersionFromBanner, setCreatingVersionFromBanner] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);

  // Query current version id for "go to current" banner
  const { data: currentVersionId } = useQuery({
    queryKey: ["current-version", budget?.version_group_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("budgets")
        .select("id")
        .eq("version_group_id", budget.version_group_id)
        .eq("is_current_version", true)
        .limit(1)
        .single();
      return data?.id ?? null;
    },
    enabled: !!budget?.version_group_id && budget?.is_current_version === false,
  });

  // Fetch latest revision request when status is revision_requested
  const { data: revisionRequest } = useQuery({
    queryKey: ["revision-request", budgetId],
    queryFn: async () => {
      const { data } = await supabase
        .from("budget_events")
        .select("id, metadata, created_at, note")
        .eq("budget_id", budgetId!)
        .eq("event_type", "revision_requested")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      return data ?? null;
    },
    enabled: budget?.internal_status === "revision_requested",
  });

  const handleStartRevision = async () => {
    if (!budgetId || !user) return;
    setStartingRevision(true);
    try {
      const meta = revisionRequest?.metadata as Record<string, unknown> | null;
      const reason = meta?.instructions
        ? `Revisão: ${String(meta.instructions).slice(0, 80)}`
        : "Revisão solicitada pelo comercial";
      const newId = await duplicateBudgetAsVersion(budgetId, user.id, reason);
      toast.success("Nova versão criada para revisão!");
      navigate(`/admin/budget/${newId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar versão de revisão.");
    }
    setStartingRevision(false);
  };

  useEffect(() => {
    let cancelled = false;

    async function loadBudgetData() {
      if (!budgetId) return;
      const { data: b, error: bErr } = await supabase.from("budgets").select("*").eq("id", budgetId).single();
      if (cancelled) return;
      if (bErr || !b) { navigate("/admin"); return; }
      setBudget(b);

      if (b.version_group_id) {
        const { count } = await supabase
          .from("budgets")
          .select("id", { count: "exact", head: true })
          .eq("version_group_id", b.version_group_id);
        if (!cancelled) setVersionCount(count ?? 1);
      } else {
        if (!cancelled) setVersionCount(1);
      }

      const { data: secs, error: secsErr } = await supabase
        .from("sections")
        .select("*, items(*, item_images(*))")
        .eq("budget_id", budgetId)
        .order("order_index", { ascending: true });

      if (cancelled) return;
      if (secsErr) toast.error(`Erro ao carregar seções: ${secsErr.message}`);

      const sorted = (secs || []).map(s => ({
        ...s,
        items: (s.items || [])
          .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
          .map((item) => ({
            ...item,
            images: item.item_images || [],
          })),
      })) as unknown as EditorSection[];
      setSections(sorted);
    }

    loadBudgetData();
    return () => { cancelled = true; };
  }, [budgetId, navigate]);

  // Reload sections from DB without full page reload
  const reloadSections = useCallback(async () => {
    if (!budgetId) return;
    setSectionsLoading(true);
    const { data: secs } = await supabase
      .from("sections")
      .select("*, items(*, item_images(*))")
      .eq("budget_id", budgetId)
      .order("order_index", { ascending: true });
    const sorted = (secs || []).map(s => ({
      ...s,
      items: (s.items || [])
        .sort((a: Record<string, unknown>, b: Record<string, unknown>) => ((a.order_index as number) || 0) - ((b.order_index as number) || 0))
        .map((item: Record<string, unknown>) => ({
          ...item,
          images: (item as Record<string, unknown>).item_images || [],
        })),
    })) as unknown as EditorSection[];
    setSections(sorted);
    setSectionsLoading(false);
  }, [budgetId]);

  // Reload callback for VersionTimeline — navigate to new version instead of full reload
  const reloadBudget = useCallback((newBudgetId?: string) => {
    if (newBudgetId && newBudgetId !== budgetId) {
      navigate(`/admin/budget/${newBudgetId}`);
    } else {
      // Re-fetch current budget data
      window.location.reload();
    }
  }, [budgetId, navigate]);

  // Count media files for badge
  useEffect(() => {
    if (!budgetId) return;
    const publicId = budget?.public_id || budget?.id;
    if (!publicId) return;
    let cancelled = false;
    const folders = ["3d", "fotos", "exec", "video"].map(f => `${publicId}/${f}`);
    Promise.all(
      folders.map(folder =>
        supabase.storage.from("media").list(folder, { limit: 100 }).then(({ data }) =>
          (data || []).filter(f => f.name !== ".emptyFolderPlaceholder" && f.name !== ".lovkeep").length
        )
      )
    ).then(counts => {
      if (!cancelled) setMediaCount(counts.reduce((a, b) => a + b, 0));
    });
    return () => { cancelled = true; };
  }, [budgetId, budget?.public_id, budget?.id]);

  // Fields that must never be changed via auto-save (only via WorkflowBar or explicit actions)
  const PROTECTED_FIELDS = useRef(new Set([
    "internal_status", "status", "is_published_version", "public_id",
    "is_current_version", "version_group_id", "version_number",
  ]));

  const isPublishedVersion = budget?.status === "published" && budget?.is_published_version === true;

  const autoSaveBudgetField = useCallback((field: string, value: unknown) => {
    if (!budgetId) return;
    if (PROTECTED_FIELDS.current.has(field)) {
      return;
    }
    lastSavePayload.current = { field, value };
    setSaveStatus("saving");
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      const { error } = await supabase.from("budgets").update({ [field]: value } as Record<string, unknown>).eq("id", budgetId);
      if (error) {
        saveErrorCount.current += 1;
        setSaveStatus("error");
        // Dismiss previous error toast if any
        if (errorToastId.current) toast.dismiss(errorToastId.current);
        const persistent = saveErrorCount.current >= 2;
        errorToastId.current = toast.error(
          "Não foi possível salvar as alterações.",
          {
            duration: Infinity,
            description: persistent
              ? "Se o problema continuar, copie o orçamento e recarregue a página."
              : undefined,
            action: {
              label: "Tentar novamente",
              onClick: () => {
                if (lastSavePayload.current) {
                  autoSaveBudgetField(lastSavePayload.current.field, lastSavePayload.current.value);
                }
              },
            },
          }
        );
      } else {
        saveErrorCount.current = 0;
        if (errorToastId.current) { toast.dismiss(errorToastId.current); errorToastId.current = null; }
        setSaveStatus("saved");
        setLastSavedAt(new Date());
        // Reset to idle after 3 seconds
        setTimeout(() => {
          setSaveStatus(prev => prev === "saved" ? "idle" : prev);
        }, 3000);
      }
    }, 600);
  }, [budgetId]);

  // C3: Cancel auto-save timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = null;
      }
    };
  }, []);

  const retrySave = useCallback(() => {
    if (lastSavePayload.current) {
      autoSaveBudgetField(lastSavePayload.current.field, lastSavePayload.current.value);
    }
  }, [autoSaveBudgetField]);

  const handleSaveAndPublish = async () => {
    if (!budgetId || !budget) return;
    setSaving(true);

    try {
      const groupId = await ensureVersionGroup(budgetId);
      const publicId = budget.public_id || crypto.randomUUID().replace(/-/g, "").slice(0, 12);
      const { data: { session } } = await supabase.auth.getSession();
      await publishVersion(budgetId, groupId, publicId, session?.user?.id);

      setBudget({ ...budget, status: "published", public_id: publicId, is_published_version: true });
      const publicUrl = getPublicBudgetUrl(publicId);
      toast.success("Orçamento publicado com sucesso!", {
        description: "O link público foi copiado para a área de transferência.",
        duration: 5000,
      });
      navigator.clipboard.writeText(publicUrl);
    } catch (err) {
      
      toast.error("Erro ao salvar. Tente novamente.");
    }

    setSaving(false);
  };

  if (!budget) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Skeleton header */}
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

  // Derive primary workflow action for sticky header
  const internalStatus = (budget.internal_status ?? "requested") as InternalStatus;
  const userRoles = (profile?.roles ?? []) as string[];

  const PRIMARY_TRANSITIONS: Record<string, { label: string; newStatus: InternalStatus; roles: string[]; icon?: React.ReactNode; className?: string }> = {
    assigned: { label: "Iniciar Produção", newStatus: "in_progress", roles: ["orcamentista", "admin"] },
    in_progress: { label: "Enviar para Revisão", newStatus: "ready_for_review", roles: ["orcamentista", "admin"] },
    ready_for_review: { label: "Entregar ao Comercial", newStatus: "delivered_to_sales", roles: ["orcamentista", "admin"], icon: <PackageCheck className="h-3.5 w-3.5" /> },
    delivered_to_sales: { label: "Enviar ao Cliente", newStatus: "sent_to_client", roles: ["comercial", "admin"], icon: <Send className="h-3.5 w-3.5" />, className: "bg-teal-600 hover:bg-teal-700 text-white" },
    revision_requested: { label: "Iniciar Revisão", newStatus: "in_progress", roles: ["orcamentista", "admin"], icon: <RotateCcw className="h-3.5 w-3.5" />, className: "bg-orange-500 hover:bg-orange-600 text-white" },
    minuta_solicitada: { label: "Contrato Fechado", newStatus: "contrato_fechado", roles: ["comercial", "admin"], icon: <Handshake className="h-3.5 w-3.5" />, className: "bg-emerald-600 hover:bg-emerald-700 text-white" },
  };

  const primaryTransitionDef = PRIMARY_TRANSITIONS[internalStatus];
  const canDoPrimary = primaryTransitionDef && primaryTransitionDef.roles.some(r => userRoles.includes(r));

  const stickyPrimaryAction = canDoPrimary && primaryTransitionDef ? {
    label: primaryTransitionDef.label,
    onClick: () => {
      const btn = document.querySelector<HTMLButtonElement>('[data-workflow-primary]');
      if (btn) btn.click();
    },
    icon: primaryTransitionDef.icon,
    className: primaryTransitionDef.className,
  } : null;

  // Check if MetadataStep has missing required fields
  const missingContextFields = !budget.client_name || budget.client_name === "Cliente" || !budget.project_name;

  return (
    <div className="min-h-screen bg-background flex">
      <div className="flex-1 min-w-0 flex flex-col">
        {/* ── Sticky two-layer header ── */}
        <StickyEditorHeader
          budget={budget}
          sections={sections}
          backPath={backPath}
          saveStatus={saveStatus}
          lastSavedAt={lastSavedAt}
          onRetrySave={retrySave}
          onPublish={handleSaveAndPublish}
          publishing={saving}
          primaryAction={stickyPrimaryAction}
          onProjectNameChange={(name) => {
            setBudget({ ...budget, project_name: name });
            autoSaveBudgetField("project_name", name);
          }}
        />

        {/* ── Content below sticky header ── */}
        <main className="max-w-[1200px] w-full mx-auto px-3 sm:px-6 py-4 flex-1 flex flex-col">
          {/* Pipeline Progress — always visible */}
          <PipelineProgress internalStatus={budget.internal_status ?? "requested"} />

          {/* ── Versioning context banners (priority: A > B > C) ── */}
          {/* Only show published-version warning if the budget was actually sent to the client */}
          {budget.is_published_version && ["sent_to_client", "minuta_solicitada", "contrato_fechado"].includes(budget.internal_status ?? "") ? (
            /* Scenario A — Editing published version */
            <Alert className="mt-4 border-warning/30 bg-warning/5">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <AlertDescription className="flex items-center justify-between gap-4">
                <span className="text-sm font-body text-foreground">
                  ⚠️ Esta é a versão publicada. O cliente pode ver suas edições em tempo real. Recomendamos criar uma nova versão para editar com segurança.
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1.5 border-border text-foreground hover:bg-muted"
                  disabled={creatingVersionFromBanner}
                  onClick={async () => {
                    if (!user) return;
                    setCreatingVersionFromBanner(true);
                    try {
                      const newId = await duplicateBudgetAsVersion(budgetId!, user.id, "Edição pós-publicação");
                      toast.success("Nova versão criada!");
                      navigate(`/admin/budget/${newId}`);
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Erro ao criar versão");
                    }
                    setCreatingVersionFromBanner(false);
                  }}
                >
                  {creatingVersionFromBanner ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
                  Criar Nova Versão
                </Button>
              </AlertDescription>
            </Alert>
          ) : budget.is_current_version === false ? (
            /* Scenario B — Viewing old version */
            <Alert className="mt-4 border-blue-500/40 bg-blue-500/10">
              <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertDescription className="flex items-center justify-between gap-4">
                <span className="text-sm font-body text-blue-800 dark:text-blue-300">
                  📌 Você está visualizando a versão v{budget.version_number ?? "?"} (não é a versão atual). Edições aqui não afetam a versão em uso.
                </span>
                {currentVersionId && currentVersionId !== budgetId && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5 border-blue-500/50 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20"
                    onClick={() => navigate(`/admin/budget/${currentVersionId}`)}
                  >
                    Ir para versão atual
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          ) : null}

          {/* Revision Banner — Scenario C (only if A/B not shown) */}
          {budget.internal_status === "revision_requested" && revisionRequest && !budget.is_published_version && budget.is_current_version !== false && (
            <div className="mt-4">
              <RevisionBanner
                revisionData={revisionRequest}
                onStartRevision={handleStartRevision}
                startingRevision={startingRevision}
              />
            </div>
          )}

          {/* Workflow Bar — always visible */}
          <div className="mt-4">
            <WorkflowBar
              budget={budget}
              onBudgetUpdate={(fields) => setBudget({ ...budget, ...fields })}
            />
          </div>

          {/* ── Tab navigation ── */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4 flex-1 flex flex-col">
            <TabsList className="w-full justify-start bg-transparent border-b border-border/60 rounded-none h-auto p-0 gap-0 overflow-x-auto scrollbar-none">
              {[
                { value: "planilha", label: "Planilha", icon: <ClipboardList className="h-3.5 w-3.5" />, badge: null },
                { value: "contexto", label: "Contexto", icon: <User className="h-3.5 w-3.5" />, badge: missingContextFields ? "!" : null, badgeClass: "bg-warning/10 text-warning" },
                { value: "midia", label: "Mídia", icon: <ImageIcon className="h-3.5 w-3.5" />, badge: mediaCount > 0 ? String(mediaCount) : null, badgeClass: "bg-primary/10 text-primary" },
                { value: "versoes", label: "Versões", icon: <ScrollText className="h-3.5 w-3.5" />, badge: null },
              ].map(tab => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 sm:px-4 pb-2.5 pt-2 text-xs sm:text-sm font-body font-medium gap-1 sm:gap-1.5 transition-colors whitespace-nowrap shrink-0"
                >
                  {tab.icon}
                  {tab.label}
                  {tab.badge && (
                    <span className={cn("ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full text-[10px] font-semibold px-1", tab.badgeClass)}>
                      {tab.badge}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* ── Tab: Planilha ── */}
            <TabsContent value="planilha" className="mt-0 flex-1">
              <div className="flex">
                <div className={cn("flex-1 min-w-0", briefingOpen && "mr-[320px]")}>
                  {/* Apply template button for orçamentista/admin */}
                  {(isOrcamentista || isAdmin) && sections.length === 0 && (
                    <div className="flex items-center justify-center py-8">
                      <Button
                        variant="outline"
                        className="gap-2 border-dashed border-2 border-primary/30 text-primary hover:bg-primary/5 hover:border-primary/50"
                        onClick={() => setTemplateDialogOpen(true)}
                      >
                        <LayoutTemplate className="h-4 w-4" />
                        Aplicar Template
                      </Button>
                    </div>
                  )}
                  {(isOrcamentista || isAdmin) && sections.length > 0 && (
                    <div className="flex justify-end py-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-xs text-muted-foreground hover:text-primary"
                        onClick={() => setTemplateDialogOpen(true)}
                      >
                        <LayoutTemplate className="h-3.5 w-3.5" />
                        Aplicar Template
                      </Button>
                    </div>
                  )}
                  <SectionsEditor
                    budgetId={budgetId!}
                    sections={sections}
                    onSectionsChange={setSections}
                    loading={sectionsLoading}
                    readOnly={false}
                  />
                </div>

                {/* Briefing toggle button — hidden on mobile */}
                {!briefingOpen && (
                  <div className="fixed right-4 top-36 z-30 hidden sm:block">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setBriefingOpen(true)}
                      className="h-8 text-xs gap-1.5 shadow-md bg-background"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      Briefing
                    </Button>
                  </div>
                )}

                {/* Briefing sidebar */}
                {briefingOpen && (
                  <div className="fixed right-0 top-[96px] bottom-0 w-[320px] z-30 border-l border-border bg-background overflow-y-auto">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-border">
                      <span className="text-sm font-body font-medium">Briefing & Histórico</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setBriefingOpen(false)}
                      >
                        ✕
                      </Button>
                    </div>
                    <BriefingPanel
                      budgetId={budgetId!}
                      budget={budget}
                      onBudgetFieldChange={(field, value) => {
                        setBudget({ ...budget, [field]: value });
                      }}
                    />
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── Tab: Contexto ── */}
            <TabsContent value="contexto" className="mt-6 space-y-8">
              {/* Editable title */}
              <div className="space-y-1">
                {editingTitle ? (
                  <input
                    autoFocus
                    value={budget.project_name || ""}
                    onChange={(e) => {
                      setBudget({ ...budget, project_name: e.target.value });
                      autoSaveBudgetField("project_name", e.target.value);
                    }}
                    onBlur={() => setEditingTitle(false)}
                    onKeyDown={(e) => e.key === "Enter" && setEditingTitle(false)}
                    className="w-full text-3xl font-display font-bold text-foreground bg-transparent border-none outline-none placeholder:text-muted-foreground/40 leading-tight"
                    placeholder="Nome do projeto"
                  />
                ) : (
                  <h1
                    onClick={() => setEditingTitle(true)}
                    className="text-3xl font-display font-bold text-foreground leading-tight cursor-text hover:bg-muted/30 rounded-md px-1 -mx-1 py-0.5 transition-colors"
                  >
                    {budget.project_name || <span className="text-muted-foreground/40">Nome do projeto</span>}
                  </h1>
                )}
                {/* Subtitle metadata */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground font-body flex-wrap px-1">
                  {budget.client_name && budget.client_name !== "Cliente" && (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {budget.client_name}
                    </span>
                  )}
                  {budget.condominio && <span className="text-muted-foreground/40">·</span>}
                  {budget.condominio && <span>{budget.condominio}</span>}
                  {budget.bairro && <span className="text-muted-foreground/40">·</span>}
                  {budget.bairro && <span>{budget.bairro}</span>}
                  {budget.metragem && <span className="text-muted-foreground/40">·</span>}
                  {budget.metragem && <span>{budget.metragem}</span>}
                </div>
              </div>

              {/* Metadata Properties */}
              <MetadataStep
                budget={budget}
                onFieldChange={(field, value) => {
                  setBudget({ ...budget, [field]: value });
                  autoSaveBudgetField(field, value);
                }}
              />

              {/* Internal Data - Collapsible */}
              <Collapsible open={internalDataOpen} onOpenChange={setInternalDataOpen}>
                <CollapsibleTrigger className="w-full group">
                  <div className="flex items-center gap-2 py-2 text-sm font-body text-muted-foreground hover:text-foreground transition-colors">
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${internalDataOpen ? 'rotate-0' : '-rotate-90'}`} />
                    <DollarSign className="h-3.5 w-3.5" />
                    <span className="font-medium">Dados Internos</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Uso interno</span>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="pl-7 pb-4 pt-1 space-y-3">
                    <div className="max-w-sm">
                      <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground block mb-1">
                        Custo da Obra (interno) — R$
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={budget.internal_cost ?? ""}
                        onChange={(e) => {
                          const val = e.target.value ? Number(e.target.value) : null;
                          setBudget({ ...budget, internal_cost: val });
                          autoSaveBudgetField("internal_cost", val);
                        }}
                        placeholder="0.00"
                        className="w-full h-9 px-3 rounded border border-transparent hover:border-border focus:border-border bg-transparent text-foreground text-sm font-mono placeholder:text-muted-foreground/40 focus:outline-none transition-colors duration-100 tabular-nums"
                      />
                      <p className="text-xs text-muted-foreground/60 font-body mt-1">
                        Custo real de execução. Nunca exposto ao cliente.
                      </p>
                    </div>
                    {Number(budget.internal_cost) > 0 && (
                      <div className="text-sm font-mono text-muted-foreground tabular-nums">
                        Custo: {formatBRL(Number(budget.internal_cost))}
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </TabsContent>

            {/* ── Tab: Mídia ── */}
            <TabsContent value="midia" className="mt-6">
              <MediaUploadSection publicId={budget.public_id || budget.id} budgetId={budgetId!} />
            </TabsContent>

            {/* ── Tab: Versões ── */}
            <TabsContent value="versoes" className="mt-6">
              <VersionTimeline budgetId={budgetId!} onVersionChange={reloadBudget} />
            </TabsContent>
          </Tabs>
        </main>
      </div>

      {/* Template Selector Dialog */}
      {budgetId && (
        <TemplateSelectorDialog
          open={templateDialogOpen}
          budgetId={budgetId}
          onOpenChange={setTemplateDialogOpen}
          onConfirm={() => {
            // Reload sections after template application without full page reload
            reloadSections();
          }}
        />
      )}
    </div>
  );
}