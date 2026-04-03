import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Save, Copy, Check, Loader2, User, ChevronDown, DollarSign, GitCompare, Globe, Eye } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { MetadataStep } from "@/components/editor/MetadataStep";
import { SectionsEditor } from "@/components/editor/SectionsEditor";
import { getPublicBudgetUrl } from "@/lib/getPublicUrl";
import { VersionHistoryPanel } from "@/components/editor/VersionHistoryPanel";
import { ensureVersionGroup, publishVersion, duplicateBudgetAsVersion } from "@/lib/budget-versioning";
import { MediaUploadSection } from "@/components/editor/MediaUploadSection";
import { formatBRL } from "@/lib/formatBRL";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { WorkflowBar } from "@/components/editor/WorkflowBar";
import { PipelineProgress } from "@/components/editor/PipelineProgress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "react-router-dom";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Button } from "@/components/ui/button";
import { BriefingPanel } from "@/components/editor/BriefingPanel";
import { RevisionBanner } from "@/components/editor/RevisionBanner";
import { useAuth } from "@/hooks/useAuth";

export default function BudgetEditorV2() {
  const { budgetId } = useParams<{ budgetId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { isOrcamentista, isComercial } = useUserProfile();
  const { user } = useAuth();

  const backPath = (location.state as any)?.from
    || (isOrcamentista ? "/admin/producao" : isComercial ? "/admin/comercial" : "/admin");
  const [budget, setBudget] = useState<any>(null);
  const [sections, setSections] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [internalDataOpen, setInternalDataOpen] = useState(false);
  const [versionCount, setVersionCount] = useState(0);
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const [startingRevision, setStartingRevision] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

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
    } catch (err: any) {
      toast.error(err?.message || "Erro ao criar versão de revisão.");
    }
    setStartingRevision(false);
  };

  useEffect(() => {
    loadBudget();
  }, [budgetId]);

  const loadBudget = async () => {
    if (!budgetId) return;
    const { data: b } = await supabase.from("budgets").select("*").eq("id", budgetId).single();
    if (!b) { navigate("/admin"); return; }
    setBudget(b);

    if (b.version_group_id) {
      const { count } = await supabase
        .from("budgets")
        .select("id", { count: "exact", head: true })
        .eq("version_group_id", b.version_group_id);
      setVersionCount(count ?? 1);
    } else {
      setVersionCount(1);
    }

    const { data: secs } = await supabase
      .from("sections")
      .select("*, items(*, item_images(*))")
      .eq("budget_id", budgetId)
      .order("order_index", { ascending: true });

    const sorted = (secs || []).map(s => ({
      ...s,
      items: (s.items || [])
        .sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0))
        .map((item: any) => ({
          ...item,
          images: item.item_images || [],
        })),
    }));
    setSections(sorted);
  };

  const autoSaveBudgetField = useCallback((field: string, value: any) => {
    if (!budgetId) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      await supabase.from("budgets").update({ [field]: value } as any).eq("id", budgetId);
    }, 800);
  }, [budgetId]);

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
      console.error("Save error:", err);
      toast.error("Erro ao salvar. Tente novamente.");
    }

    setSaving(false);
  };

  const copyPublicLink = () => {
    if (!budget?.public_id) return;
    navigator.clipboard.writeText(getPublicBudgetUrl(budget.public_id));
    setLinkCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setLinkCopied(false), 2000);
  };

  if (!budget) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const statusLabel = budget.is_published_version
    ? "Publicada"
    : budget.status === "draft"
    ? "Rascunho"
    : budget.status;

  const statusColor = budget.is_published_version
    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
    : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";

  return (
    <div className="min-h-screen bg-background flex">
      <div className="flex-1 min-w-0 flex flex-col">
        {/* ── Minimal top bar ── */}
        <header className="bg-background/80 backdrop-blur-sm border-b border-border/60 sticky top-0 z-40">
          <div className="max-w-[1200px] mx-auto px-6 h-12 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(backPath)}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>

              {/* Breadcrumb-like path */}
              <div className="flex items-center gap-1.5 text-sm font-body text-muted-foreground">
                <span className="hidden sm:inline">Orçamentos</span>
                <span className="hidden sm:inline">/</span>
                <span className="text-foreground font-medium truncate max-w-[200px]">
                  {budget.project_name || "Sem nome"}
                </span>
              </div>

              {/* Version badge */}
              {versionCount > 1 ? (
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => navigate(`/admin/comparar?group=${budget.version_group_id}`)}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-body font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                      >
                        <GitCompare className="h-2.5 w-2.5" />
                        v{budget.version_number || 1}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{versionCount} versões — clique para comparar</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-body font-medium">
                  v{budget.version_number || 1}
                </span>
              )}

              {/* Status pill */}
              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-body font-medium ${statusColor}`}>
                {statusLabel}
              </span>
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-1">
              {budget.public_id && (
                <>
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={copyPublicLink}
                          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {linkCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Copiar link público</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <a
                          href={getPublicBudgetUrl(budget.public_id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </a>
                      </TooltipTrigger>
                      <TooltipContent>Visualizar orçamento público</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </>
              )}
            </div>
          </div>
        </header>

        {/* ── Content ── */}
        <main className="max-w-[1200px] w-full mx-auto px-6 py-8 space-y-8">
          {/* Pipeline Progress */}
          <PipelineProgress internalStatus={budget.internal_status ?? "requested"} />

          {/* Revision Banner */}
          {budget.internal_status === "revision_requested" && revisionRequest && (
            <RevisionBanner
              revisionData={revisionRequest}
              onStartRevision={handleStartRevision}
              startingRevision={startingRevision}
            />
          )}

          {/* Workflow Bar */}
          <WorkflowBar
            budget={budget}
            onBudgetUpdate={(fields) => setBudget({ ...budget, ...fields })}
          />

          {/* Version History */}
          <VersionHistoryPanel budgetId={budgetId!} onVersionChange={loadBudget} />

          {/* ── Notion-like page title ── */}
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

          {/* ── Metadata Properties ── */}
          <MetadataStep
            budget={budget}
            onFieldChange={(field, value) => {
              setBudget({ ...budget, [field]: value });
              autoSaveBudgetField(field, value);
            }}
            onNext={handleSaveAndPublish}
            saving={saving}
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
                  <label className="block text-xs text-muted-foreground mb-1 font-body">
                    Custo da Obra (interno) — R$
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={(budget as any).internal_cost ?? ""}
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : null;
                      setBudget({ ...budget, internal_cost: val });
                      autoSaveBudgetField("internal_cost", val);
                    }}
                    placeholder="0.00"
                    className="w-full px-3 py-2 rounded-lg border border-transparent hover:border-border focus:border-border bg-transparent text-foreground text-sm font-body placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all tabular-nums"
                  />
                  <p className="text-xs text-muted-foreground/60 font-body mt-1">
                    Custo real de execução. Nunca exposto ao cliente.
                  </p>
                </div>
                {(budget as any).internal_cost > 0 && (
                  <div className="text-sm font-body text-muted-foreground tabular-nums">
                    Custo: {formatBRL((budget as any).internal_cost)}
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          <MediaUploadSection publicId={budget.public_id || budget.id} budgetId={budgetId!} />

          <SectionsEditor
            budgetId={budgetId!}
            sections={sections}
            onSectionsChange={setSections}
          />
        </main>
      </div>

      {/* Briefing Side Panel */}
      <BriefingPanel
        budgetId={budgetId!}
        budget={budget}
        onBudgetFieldChange={(field, value) => {
          setBudget({ ...budget, [field]: value });
        }}
      />
    </div>
  );
}