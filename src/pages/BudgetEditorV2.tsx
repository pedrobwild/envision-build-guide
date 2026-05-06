import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, User, ChevronDown, DollarSign, RotateCcw, PackageCheck, Send, Handshake, MessageSquare, ClipboardList, Image as ImageIcon, ScrollText, AlertTriangle, Info, Copy, LayoutTemplate } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MetadataStep } from "@/components/editor/MetadataStep";
import { SectionsEditor } from "@/components/editor/SectionsEditor";
import { getPublicBudgetUrl } from "@/lib/getPublicUrl";
import { VersionTimeline } from "@/components/editor/VersionTimeline";
import { ensureVersionGroup, publishVersion, duplicateBudgetAsVersion, deleteDraftVersion, setCurrentVersion } from "@/lib/budget-versioning";
import {
  hasActiveForkFor,
  tryAcquireForkLock,
  completeForkLock,
  releaseForkLock,
} from "@/lib/auto-fork-lock";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { BudgetRow, EditorSection } from "@/types/budget-common";
import { logger } from "@/lib/logger";
import { TemplateSelectorDialog } from "@/components/editor/TemplateSelectorDialog";
import { sendBudgetPublishedNotification } from "@/lib/digisac-notify";
import { enqueueOfflineSave, flushOfflineQueue, hasPending } from "@/lib/offline-save-queue";
import { PrazoExecucaoChip } from "@/components/admin/PrazoExecucaoChip";

export default function BudgetEditorV2() {
  const { budgetId } = useParams<{ budgetId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { isOrcamentista, isComercial, isAdmin, profile } = useUserProfile();
  const { user } = useAuth();
  const queryClient = useQueryClient();

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
  const pendingBudgetUpdates = useRef<Record<string, unknown>>({});
  const saveErrorCount = useRef(0);
  const errorToastId = useRef<string | number | null>(null);
  const [activeTab, setActiveTab] = useState("planilha");
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [mediaCount, setMediaCount] = useState(0);
  const [creatingVersionFromBanner, setCreatingVersionFromBanner] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);

  // Query base budget identification for addendum banner
  const { data: addendumBaseBudget } = useQuery({
    queryKey: ["addendum-base-budget", budget?.addendum_base_budget_id],
    queryFn: async () => {
      if (!budget?.addendum_base_budget_id) return null;
      const { data, error } = await supabase
        .from("budgets")
        .select("id, sequential_code, project_name, versao, version_number")
        .eq("id", budget.addendum_base_budget_id)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!budget?.is_addendum && !!budget?.addendum_base_budget_id,
  });

  // Query current version id for "go to current" banner
  const { data: currentVersionId } = useQuery({
    queryKey: ["current-version", budget?.version_group_id],
    queryFn: async () => {
      // Guard: budget e version_group_id são exigidos pelo `enabled` abaixo,
      // mas reasseguramos aqui para o type-checker e para resiliência em race conditions.
      // `maybeSingle()` evita exception quando o group não tem versão current
      // (estado intermediário durante fork/discard) — retornamos null e a UI segue.
      if (!budget?.version_group_id) return null;
      const { data } = await supabase
        .from("budgets")
        .select("id")
        .eq("version_group_id", budget.version_group_id)
        .eq("is_current_version", true)
        .limit(1)
        .maybeSingle();
      return data?.id ?? null;
    },
    enabled: !!budget?.version_group_id && budget?.is_current_version === false,
  });

  // Query published sibling in the same version group — used to enable "discard this draft"
  // when the user forked a published version, edited it, and now wants to revert.
  const { data: publishedSibling } = useQuery({
    queryKey: ["published-sibling", budget?.version_group_id, budgetId],
    queryFn: async () => {
      if (!budget?.version_group_id) return null;
      const { data } = await supabase
        .from("budgets")
        .select("id, version_number, public_id")
        .eq("version_group_id", budget.version_group_id)
        .eq("is_published_version", true)
        .neq("id", budgetId!)
        .limit(1)
        .maybeSingle();
      return data ?? null;
    },
    enabled:
      !!budget?.version_group_id &&
      budget?.status === "draft" &&
      budget?.is_published_version === false &&
      budget?.is_current_version === true,
  });

  const [discardingDraft, setDiscardingDraft] = useState(false);

  // Fetch latest revision request when status is revision_requested.
  // `maybeSingle()` evita exception se ainda não houver evento registrado
  // (race com transição de status) — retornamos `null` e a UI segue.
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
        .maybeSingle();
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

  // ── Cached fetches via React Query ────────────────────────────────────────
  // Budget header (single row). Cached por budgetId; staleTime herda do
  // QueryClient global (2 min). Evita refetch redundante em remounts rápidos
  // após import de template, navegação entre abas, etc.
  const {
    data: budgetData,
    error: budgetQueryError,
  } = useQuery({
    queryKey: ["budget-editor-budget", budgetId],
    queryFn: async () => {
      if (!budgetId) return null;
      const { data, error } = await supabase
        .from("budgets")
        .select("*")
        .eq("id", budgetId)
        .single();
      if (error) throw error;
      return data as BudgetRow;
    },
    enabled: !!budgetId,
  });

  // Version count (lookup leve). Só dispara quando há version_group_id.
  const { data: versionCountData } = useQuery({
    queryKey: ["budget-editor-version-count", budgetData?.version_group_id],
    queryFn: async () => {
      if (!budgetData?.version_group_id) return 1;
      const { count } = await supabase
        .from("budgets")
        .select("id", { count: "exact", head: true })
        .eq("version_group_id", budgetData.version_group_id);
      return count ?? 1;
    },
    enabled: !!budgetData?.version_group_id,
  });

  // Sections + items + item_images. Single nested query (1 round-trip),
  // resultado em cache por budgetId. Após import/template, o `invalidateQueries`
  // disparado por `reloadSections` garante refetch sem requests duplicados
  // simultâneos.
  // Retry com backoff exponencial: tenta até 3 vezes em erros transitórios
  // (5xx, network, timeout). Não retenta em 4xx (auth/permissão) — o usuário
  // precisa intervir. Backoff: 500ms, 1.5s, 4.5s.
  const isTransientError = (err: unknown): boolean => {
    if (!err) return false;
    const e = err as { status?: number; code?: string; message?: string };
    if (typeof e.status === "number" && e.status >= 400 && e.status < 500) return false;
    const msg = (e.message ?? "").toLowerCase();
    if (/jwt|permission|denied|row-level security|unauthorized|forbidden/.test(msg)) return false;
    return true;
  };
  const queryRetryConfig = {
    retry: (failureCount: number, error: unknown) => isTransientError(error) && failureCount < 3,
    retryDelay: (attemptIndex: number) => Math.min(500 * 3 ** attemptIndex, 5000),
  } as const;

  // Stage 1: sections (estrutura básica)
  const {
    data: sectionsRowsData,
    isLoading: sectionsRowsLoading,
    error: sectionsRowsError,
    isFetching: sectionsRowsFetching,
    refetch: refetchSectionsRows,
  } = useQuery({
    queryKey: ["budget-editor-sections-rows", budgetId],
    queryFn: async () => {
      if (!budgetId) return [] as EditorSection[];
      const { data, error } = await supabase
        .from("sections")
        .select("id, budget_id, title, subtitle, order_index, qty, section_price, cover_image_url, tags, included_bullets, excluded_bullets, notes, is_optional, addendum_action")
        .eq("budget_id", budgetId)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return (data ?? []) as EditorSection[];
    },
    enabled: !!budgetId,
    ...queryRetryConfig,
  });

  const sectionIdsKey = (sectionsRowsData ?? []).map((s) => s.id).join(",");

  // Stage 2: items das seções
  const {
    data: itemsRowsData,
    isLoading: itemsRowsLoading,
    error: itemsRowsError,
    isFetching: itemsRowsFetching,
    refetch: refetchItemsRows,
  } = useQuery({
    queryKey: ["budget-editor-items-rows", budgetId, sectionIdsKey],
    queryFn: async () => {
      const sectionIds = (sectionsRowsData ?? []).map((s) => s.id);
      if (!sectionIds.length) return [] as EditorSection["items"];
      const { data, error } = await supabase
        .from("items")
        .select("id, section_id, title, description, reference_url, qty, unit, internal_unit_price, internal_total, bdi_percentage, order_index, catalog_item_id, catalog_snapshot, notes, addendum_action")
        .in("section_id", sectionIds)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return (data ?? []) as EditorSection["items"];
    },
    enabled: !!budgetId && !!sectionsRowsData,
    ...queryRetryConfig,
  });

  const itemIdsKey = (itemsRowsData ?? []).map((i) => i.id).join(",");

  // Stage 3: imagens dos itens — fallback graceful (itens aparecem sem imagens)
  const {
    data: imageRowsData,
    isLoading: imagesRowsLoading,
    error: imagesRowsError,
    isFetching: imagesRowsFetching,
    refetch: refetchImagesRows,
  } = useQuery({
    queryKey: ["budget-editor-image-rows", budgetId, itemIdsKey],
    queryFn: async () => {
      const itemIds = (itemsRowsData ?? []).map((i) => i.id);
      if (!itemIds.length) return [] as { id?: string; item_id?: string; url: string; is_primary?: boolean | null }[];
      const { data, error } = await supabase
        .from("item_images")
        .select("id, item_id, url, is_primary")
        .in("item_id", itemIds);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!budgetId && !!itemsRowsData,
    ...queryRetryConfig,
  });

  // Toast inicial quando uma query crítica falhar mesmo após os retries
  useEffect(() => {
    if (sectionsRowsError) {
      toast.error("Falha ao carregar seções. Use 'Tentar novamente' para reconectar.");
    }
  }, [sectionsRowsError]);
  useEffect(() => {
    if (itemsRowsError) {
      toast.error("Falha ao carregar itens. Use 'Tentar novamente' para reconectar.");
    }
  }, [itemsRowsError]);
  useEffect(() => {
    if (imagesRowsError) {
      toast.warning("Algumas imagens não carregaram — exibindo itens sem fotos.");
    }
  }, [imagesRowsError]);

  // Compose nested structure progressively (sections show up before items/images).
  // Em caso de erro nos itens ou imagens, segue mostrando o que conseguiu carregar.
  const sectionsData = useMemo<EditorSection[] | undefined>(() => {
    if (!sectionsRowsData) return undefined;
    const items = itemsRowsData ?? [];
    const images = imageRowsData ?? [];

    const imagesByItemId = new Map<string, typeof images>();
    for (const image of images) {
      const bucket = imagesByItemId.get(image.item_id!) ?? [];
      bucket.push(image);
      imagesByItemId.set(image.item_id!, bucket);
    }

    const itemsBySectionId = new Map<string, EditorSection["items"]>();
    for (const item of items) {
      const bucket = itemsBySectionId.get(item.section_id ?? "") ?? [];
      bucket.push({
        ...item,
        images: imagesByItemId.get(item.id) ?? [],
      });
      itemsBySectionId.set(item.section_id ?? "", bucket);
    }

    return sectionsRowsData.map((section) => ({
      ...section,
      items: itemsBySectionId.get(section.id) ?? [],
    }));
  }, [sectionsRowsData, itemsRowsData, imageRowsData]);

  const sectionsInitialLoading = sectionsRowsLoading;
  const itemsInitialLoading = itemsRowsLoading;
  const imagesInitialLoading = imagesRowsLoading;

  const refetchSections = useCallback(async () => {
    await refetchSectionsRows();
    await refetchItemsRows();
    await refetchImagesRows();
  }, [refetchSectionsRows, refetchItemsRows, refetchImagesRows]);

  // Sync remote → local mutable state. Mantemos `setSections` para edição
  // local rápida (drag/drop, inline edits) sem reescrever o cache a cada keystroke.
  useEffect(() => {
    if (budgetQueryError) {
      navigate("/admin");
      return;
    }
    if (budgetData) setBudget(budgetData);
  }, [budgetData, budgetQueryError, navigate]);

  // Backfill: herda planta, HubSpot e dados do imóvel/cliente quando o orçamento
  // foi criado antes da herança automática e os campos ainda estão vazios.
  // Atualiza local + persiste em background. Não sobrescreve valores existentes.
  const backfilledRef = useRef<string | null>(null);
  useEffect(() => {
    if (!budget?.id || backfilledRef.current === budget.id) return;
    const propertyId = (budget as { property_id?: string | null }).property_id;
    const clientId = (budget as { client_id?: string | null }).client_id;
    if (!propertyId && !clientId) return;
    backfilledRef.current = budget.id;
    (async () => {
      const patch: Record<string, unknown> = {};
      if (propertyId) {
        const { data: prop } = await supabase
          .from("client_properties")
          .select("empreendimento, bairro, city, metragem, property_type, location_type, floor_plan_url")
          .eq("id", propertyId)
          .maybeSingle();
        if (prop) {
          if (!budget.condominio && prop.empreendimento) patch.condominio = prop.empreendimento;
          if (!budget.bairro && prop.bairro) patch.bairro = prop.bairro;
          if (!budget.city && prop.city) patch.city = prop.city;
          if (!budget.metragem && prop.metragem) patch.metragem = prop.metragem;
          if (!budget.property_type && prop.property_type) patch.property_type = prop.property_type;
          if (!budget.location_type && prop.location_type) patch.location_type = prop.location_type;
          if (!budget.floor_plan_url && prop.floor_plan_url) patch.floor_plan_url = prop.floor_plan_url;
        }
      }
      if (clientId && !budget.hubspot_deal_url) {
        const { data: cli } = await supabase
          .from("clients")
          .select("hubspot_contact_url")
          .eq("id", clientId)
          .maybeSingle();
        const hub = (cli as { hubspot_contact_url?: string | null } | null)?.hubspot_contact_url;
        if (hub) patch.hubspot_deal_url = hub;
      }
      // Fallback adicional: tenta herdar de orçamentos irmãos do mesmo cliente
      // quando os campos críticos do card ainda estão vazios (planta, links,
      // briefing, hubspot, telefone, contexto e notas internas).
      const stillMissing =
        (!budget.floor_plan_url && !patch.floor_plan_url) ||
        (!budget.hubspot_deal_url && !patch.hubspot_deal_url) ||
        !(budget.briefing && budget.briefing.trim()) ||
        !(budget.demand_context && budget.demand_context.trim()) ||
        !(budget.internal_notes && budget.internal_notes.trim()) ||
        !(budget.client_phone && budget.client_phone.trim()) ||
        !Array.isArray(budget.reference_links) ||
        (budget.reference_links as unknown[]).length === 0;
      if (clientId && stillMissing) {
        const { data: siblings } = await supabase
          .from("budgets")
          .select("floor_plan_url, hubspot_deal_url, briefing, demand_context, internal_notes, reference_links, client_phone, property_id, created_at")
          .eq("client_id", clientId)
          .neq("id", budget.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(20);
        const propertyMatch = (siblings ?? []).find((s) => s.property_id && s.property_id === (budget as { property_id?: string | null }).property_id);
        const ordered = propertyMatch ? [propertyMatch, ...(siblings ?? []).filter((s) => s !== propertyMatch)] : (siblings ?? []);
        for (const sib of ordered) {
          if (!budget.floor_plan_url && !patch.floor_plan_url && sib.floor_plan_url) patch.floor_plan_url = sib.floor_plan_url;
          if (!budget.hubspot_deal_url && !patch.hubspot_deal_url && sib.hubspot_deal_url) patch.hubspot_deal_url = sib.hubspot_deal_url;
          if (!(budget.briefing && budget.briefing.trim()) && !patch.briefing && sib.briefing) patch.briefing = sib.briefing;
          if (!(budget.demand_context && budget.demand_context.trim()) && !patch.demand_context && sib.demand_context) patch.demand_context = sib.demand_context;
          if (!(budget.internal_notes && budget.internal_notes.trim()) && !patch.internal_notes && sib.internal_notes) patch.internal_notes = sib.internal_notes;
          if (!(budget.client_phone && budget.client_phone.trim()) && !patch.client_phone && sib.client_phone) patch.client_phone = sib.client_phone;
          if ((!Array.isArray(budget.reference_links) || (budget.reference_links as unknown[]).length === 0) && !patch.reference_links && Array.isArray(sib.reference_links) && (sib.reference_links as unknown[]).length > 0) {
            patch.reference_links = sib.reference_links;
          }
        }
      }
      if (Object.keys(patch).length === 0) return;
      setBudget((prev) => (prev ? { ...prev, ...patch } as BudgetRow : prev));
      const { error } = await supabase.from("budgets").update(patch).eq("id", budget.id);
      if (error) logger.warn("[BudgetEditorV2] backfill imóvel/cliente falhou:", error.message);
    })();
  }, [budget?.id, budget?.condominio, budget?.bairro, budget?.city, budget?.metragem, budget?.property_type, budget?.location_type, budget?.floor_plan_url, budget?.hubspot_deal_url]);

  useEffect(() => {
    if (sectionsData) setSections(sectionsData);
  }, [sectionsData]);

  useEffect(() => {
    if (typeof versionCountData === "number") setVersionCount(versionCountData);
  }, [versionCountData]);

  // Reload sections from DB without full page reload. Invalida o cache para
  // forçar refetch e desduplicar múltiplas chamadas simultâneas.
  const reloadSections = useCallback(async () => {
    if (!budgetId) return;
    setSectionsLoading(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ["budget-editor-sections-rows", budgetId] });
      await queryClient.invalidateQueries({ queryKey: ["budget-editor-items-rows", budgetId] });
      await queryClient.invalidateQueries({ queryKey: ["budget-editor-image-rows", budgetId] });
      await refetchSections();
    } finally {
      setSectionsLoading(false);
    }
  }, [budgetId, queryClient, refetchSections]);

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

  const isPublishedVersion = budget?.is_published_version === true;
  const forkInProgress = useRef(false);

  // Após o navigate para a nova versão (rascunho), libera o lock do source
  // publicado — assim qualquer ação futura no mesmo source criaria um fork
  // novo, mas dentro desta sessão de edição reaproveita o rascunho recém-criado.
  const budgetParentId = (budget as { parent_budget_id?: string | null } | null)?.parent_budget_id ?? null;
  useEffect(() => {
    if (budgetParentId && budget?.id) {
      // pequeno delay para garantir que outros mutations em flight também
      // tenham tempo de hit no lock antes de removê-lo.
      const t = setTimeout(() => releaseForkLock(budgetParentId), 1500);
      return () => clearTimeout(t);
    }
  }, [budget?.id, budgetParentId]);

  // Quando o usuário edita uma versão publicada, criamos automaticamente uma nova
  // versão (rascunho) para que as alterações não fiquem visíveis ao cliente até
  // que ele clique em "Salvar e Publicar".
  //
  // Dedup cross-route: usamos `auto-fork-lock` (sessionStorage) para garantir
  // que múltiplas mutações em sequência reaproveitem o mesmo rascunho — sem
  // isso, cada delete/edit gerava uma versão nova porque o ref em memória
  // resetava no remount após o `navigate`.
  const forkPublishedThenEdit = useCallback(async (field: string, value: unknown) => {
    if (!budgetId || !user) return;

    const existing = hasActiveForkFor(budgetId);
    if (existing?.status === "ready" && existing.newId) {
      await supabase.from("budgets").update({ [field]: value } as Record<string, unknown>).eq("id", existing.newId);
      navigate(`/admin/budget/${existing.newId}`);
      return;
    }
    if (existing?.status === "pending" || forkInProgress.current) return;
    if (!tryAcquireForkLock(budgetId)) return;

    forkInProgress.current = true;
    setSaveStatus("saving");
    try {
      const newId = await duplicateBudgetAsVersion(budgetId, user.id, "Edição pós-publicação (rascunho automático)");
      await supabase.from("budgets").update({ [field]: value } as Record<string, unknown>).eq("id", newId);
      completeForkLock(budgetId, newId);
      toast.success("Rascunho criado para esta edição.", {
        description: "A versão pública continua online. Use 'Salvar e Publicar' para publicar.",
        duration: 5000,
      });
      navigate(`/admin/budget/${newId}`);
    } catch (err) {
      forkInProgress.current = false;
      releaseForkLock(budgetId);
      setSaveStatus("error");
      toast.error(err instanceof Error ? err.message : "Não foi possível criar rascunho para edição.");
    }
  }, [budgetId, user, navigate]);

  // Quando o usuário tenta editar/excluir itens ou seções numa versão publicada,
  // criamos automaticamente uma nova versão (rascunho) e navegamos para ela —
  // a operação pode ser refeita imediatamente sem o readOnly. Mesma estratégia
  // de dedup do `forkPublishedThenEdit`.
  const forkPublishedForStructuralEdit = useCallback(async () => {
    if (!budgetId || !user) return;

    const existing = hasActiveForkFor(budgetId);
    if (existing?.status === "ready" && existing.newId) {
      navigate(`/admin/budget/${existing.newId}`);
      return;
    }
    if (existing?.status === "pending" || forkInProgress.current) return;
    if (!tryAcquireForkLock(budgetId)) return;

    forkInProgress.current = true;
    const tid = toast.loading("Criando rascunho para edição…", {
      description: "A versão publicada continua online. Você poderá editar tudo na nova versão.",
    });
    try {
      const newId = await duplicateBudgetAsVersion(budgetId, user.id, "Edição pós-publicação (rascunho automático)");
      completeForkLock(budgetId, newId);
      toast.success("Rascunho criado — agora você pode editar.", {
        id: tid,
        description: "A versão pública continua online. Use 'Salvar e Publicar' para publicar.",
        duration: 5000,
      });
      navigate(`/admin/budget/${newId}`);
    } catch (err) {
      forkInProgress.current = false;
      releaseForkLock(budgetId);
      toast.error(err instanceof Error ? err.message : "Não foi possível criar rascunho para edição.", { id: tid });
    }
  }, [budgetId, user, navigate]);


  const flushPendingBudgetUpdates = useCallback(async () => {
    if (!budgetId) return true;

    const payload = {
      ...(() => {
        try {
          return JSON.parse(localStorage.getItem(`budget-offline-queue:${budgetId}`) || "{}");
        } catch {
          return {};
        }
      })(),
      ...pendingBudgetUpdates.current,
    } as Record<string, unknown>;

    if (Object.keys(payload).length === 0) return true;

    const { error } = await supabase
      .from("budgets")
      .update(payload)
      .eq("id", budgetId);

    if (error) {
      Object.entries(payload).forEach(([field, fieldValue]) => {
        enqueueOfflineSave(budgetId, field, fieldValue);
      });
      saveErrorCount.current += 1;
      setSaveStatus("error");
      if (errorToastId.current) toast.dismiss(errorToastId.current);
      const persistent = saveErrorCount.current >= 2;
      errorToastId.current = toast.error(
        "Sem conexão — alteração salva localmente.",
        {
          duration: Infinity,
          description: persistent
            ? "Vamos tentar enviar novamente automaticamente quando a conexão voltar."
            : "Sua edição não será perdida.",
          action: {
            label: "Tentar novamente",
            onClick: () => {
              void flushPendingBudgetUpdates();
            },
          },
        }
      );
      return false;
    }

    pendingBudgetUpdates.current = {};
    try { localStorage.removeItem(`budget-offline-queue:${budgetId}`); } catch { /* ignore */ }
    saveErrorCount.current = 0;
    if (errorToastId.current) { toast.dismiss(errorToastId.current); errorToastId.current = null; }
    setSaveStatus("saved");
    setLastSavedAt(new Date());
    setTimeout(() => {
      setSaveStatus(prev => prev === "saved" ? "idle" : prev);
    }, 3000);
    return true;
  }, [budgetId]);

  const persistPendingBudgetUpdatesLocally = useCallback(() => {
    if (!budgetId) return;
    Object.entries(pendingBudgetUpdates.current).forEach(([field, value]) => {
      enqueueOfflineSave(budgetId, field, value);
    });
  }, [budgetId]);

  const autoSaveBudgetField = useCallback((field: string, value: unknown) => {
    if (!budgetId) return;
    if (PROTECTED_FIELDS.current.has(field)) {
      return;
    }
    // Se este orçamento já está publicado (visível ao cliente), faz fork automático
    // em rascunho para que a edição não vá ao ar imediatamente.
    if (isPublishedVersion) {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      void forkPublishedThenEdit(field, value);
      return;
    }
    pendingBudgetUpdates.current = {
      ...pendingBudgetUpdates.current,
      [field]: value,
    };
    setSaveStatus("saving");
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      autoSaveTimer.current = null;
      await flushPendingBudgetUpdates();
    }, 600);
  }, [budgetId, isPublishedVersion, forkPublishedThenEdit, flushPendingBudgetUpdates]);

  // C3: Cancel auto-save timer on unmount
  useEffect(() => {
    const persistPendingOnPageExit = () => {
      persistPendingBudgetUpdatesLocally();
    };

    window.addEventListener("pagehide", persistPendingOnPageExit);
    window.addEventListener("beforeunload", persistPendingOnPageExit);

    return () => {
      window.removeEventListener("pagehide", persistPendingOnPageExit);
      window.removeEventListener("beforeunload", persistPendingOnPageExit);
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = null;
      }
      persistPendingBudgetUpdatesLocally();
    };
  }, [persistPendingBudgetUpdatesLocally]);

  // Sincroniza fila offline ao montar e ao reconectar — garante que edições
  // feitas durante quedas de rede (ex.: trocar responsável enquanto sections
  // carregam) sejam persistidas assim que possível.
  useEffect(() => {
    if (!budgetId) return;
    // Aguarda saber se este orçamento é a versão publicada antes de flushar.
    // Sem este guard, edições antigas em fila offline (de uma sessão anterior)
    // podem ser silenciosamente gravadas DIRETO na versão publicada — alterando
    // o que o cliente vê sem passar pelo fluxo de fork-em-rascunho.
    if (budget == null) return;

    const tryFlush = async () => {
      if (!hasPending(budgetId)) return;

      // Proteção crítica: nunca flushar offline queue diretamente em versão publicada.
      // Em vez disso, descartamos silenciosamente — a versão publicada é imutável
      // do ponto de vista do auto-save. Edições legítimas pós-publicação devem
      // passar por forkPublishedThenEdit (cria rascunho).
      if (isPublishedVersion) {
        try { localStorage.removeItem(`budget-offline-queue:${budgetId}`); } catch { /* ignore */ }
        return;
      }

      const ok = await flushOfflineQueue(budgetId);
      if (ok) {
        if (errorToastId.current) { toast.dismiss(errorToastId.current); errorToastId.current = null; }
        setSaveStatus("saved");
        setLastSavedAt(new Date());
        toast.success("Alterações salvas localmente foram sincronizadas.");
        setTimeout(() => setSaveStatus(prev => prev === "saved" ? "idle" : prev), 3000);
      }
    };

    void tryFlush();
    window.addEventListener("online", tryFlush);
    return () => window.removeEventListener("online", tryFlush);
  }, [budgetId, budget, isPublishedVersion]);

  const retrySave = useCallback(() => {
    void flushPendingBudgetUpdates();
  }, [flushPendingBudgetUpdates]);

  const handleSaveAndPublish = async () => {
    if (!budgetId || !budget) return;

    // Validação obrigatória: prazo de execução deve estar preenchido antes de publicar.
    // Garante que o cliente sempre veja uma previsão de obra realista, definida pela orçamentista.
    const prazo = Number(budget.prazo_dias_uteis);
    if (!Number.isFinite(prazo) || prazo <= 0) {
      toast.error("Defina o prazo de execução antes de publicar", {
        description: "Abra Metadados → Prazo da obra e informe os dias úteis.",
        duration: 6000,
      });
      return;
    }

    setSaving(true);

    try {
      // Garante o flush do auto-save pendente antes de publicar
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = null;
      }
      await flushPendingBudgetUpdates();

      const groupId = await ensureVersionGroup(budgetId);
      // Fallback de public_id caso seja a primeira publicação do grupo.
      const fallbackPublicId = budget.public_id || crypto.randomUUID().replace(/-/g, "").slice(0, 12);
      const { data: { session } } = await supabase.auth.getSession();

      // publishVersion herda automaticamente o public_id da versão anteriormente
      // publicada (se existir), substituindo-a — assim o link do cliente continua válido
      // e passa a apontar para o conteúdo novo.
      const { publicId: finalPublicId } = await publishVersion(
        budgetId,
        groupId,
        fallbackPublicId,
        session?.user?.id,
      );

      setBudget({
        ...budget,
        status: "published",
        public_id: finalPublicId,
        is_published_version: true,
        is_current_version: true,
      });
      const publicUrl = getPublicBudgetUrl(finalPublicId);
      toast.success("Orçamento publicado com sucesso!", {
        description: "A versão anterior foi substituída e o link foi copiado para a área de transferência.",
        duration: 5000,
      });
      navigator.clipboard.writeText(publicUrl);

      // Disparo automático de WhatsApp para o cliente
      void sendBudgetPublishedNotification({
        budgetId,
        clientName: budget.client_name,
        clientPhone: (budget as { client_phone?: string | null }).client_phone,
        publicId: finalPublicId,
      }).then((res) => {
        if (res.success) {
          toast.info("WhatsApp enviado ao cliente.");
        }
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Detecta JWT expirado/inválido e orienta o usuário a refazer login
      if (/jwt|sub claim|token|401|403/i.test(msg)) {
        toast.error("Sessão expirada. Recarregue a página e faça login novamente.");
      } else {
        toast.error(`Erro ao publicar: ${msg}`);
      }
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

          {/* Addendum banner */}
          {budget.is_addendum && (
            <Alert className="mt-4 border-primary/40 bg-primary/5">
              <Info className="h-4 w-4 text-primary" />
              <AlertDescription className="text-sm font-body text-foreground space-y-1">
                <div>
                  <strong>Aditivo Nº {budget.addendum_number ?? "?"}</strong>
                  {addendumBaseBudget && (
                    <span className="text-muted-foreground">
                      {" "}· Emendando o orçamento{" "}
                      <span className="font-medium text-foreground">
                        {addendumBaseBudget.sequential_code ?? "—"}
                      </span>
                      {addendumBaseBudget.project_name && (
                        <> — “{addendumBaseBudget.project_name}”</>
                      )}
                      {addendumBaseBudget.versao && (
                        <> (v{addendumBaseBudget.versao})</>
                      )}
                    </span>
                  )}
                </div>
                <div className="text-muted-foreground">
                  Marque itens com o botão <span className="font-mono px-1 rounded bg-destructive/10 text-destructive">−</span> para REMOVER (subtrai do total). Adicione novos itens — eles serão somados ao total. Ao publicar, o cliente verá o orçamento atualizado.
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* ── Versioning context banners (priority: A > B > C) ── */}
          {/* Only show published-version warning if the budget was actually sent to the client */}
          {budget.is_published_version ? (
            /* Scenario A — Editing published version (auto-fork on edit) */
            <Alert className="mt-4 border-warning/30 bg-warning/5">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <AlertDescription className="flex items-center justify-between gap-4">
                <span className="text-sm font-body text-foreground">
                  ⚠️ Esta é a versão publicada (visível ao cliente). Itens e valores estão protegidos. Ao editar metadados será criado um rascunho automaticamente — ou crie agora uma nova versão para editar tudo.
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

          {/* Scenario D — Draft forked from a published version. Allow discarding to revert. */}
          {publishedSibling && !budget.is_published_version && budget.is_current_version === true && budget.status === "draft" && (
            <Alert className="mt-4 border-destructive/30 bg-destructive/5">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <AlertDescription className="flex items-center justify-between gap-4">
                <span className="text-sm font-body text-foreground">
                  ✏️ Este é um rascunho criado a partir da versão publicada v{publishedSibling.version_number ?? "?"}. Ao publicar, ele substituirá a versão visível ao cliente. Se preferir descartar as alterações, volte para a versão publicada.
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1.5 border-destructive/50 text-destructive hover:bg-destructive/10"
                  disabled={discardingDraft}
                  onClick={async () => {
                    if (!user) return;
                    const confirmed = window.confirm(
                      `Descartar este rascunho?\n\nTodas as alterações feitas após a publicação da v${publishedSibling.version_number ?? "?"} serão perdidas. A versão publicada continuará intacta e voltará a ser a versão atual.\n\nEsta ação não pode ser desfeita.`
                    );
                    if (!confirmed) return;
                    setDiscardingDraft(true);
                    try {
                      const draftId = budgetId!;
                      const groupId = budget.version_group_id!;
                      const publishedId = publishedSibling.id;
                      // Promove a publicada para versão atual ANTES de excluir o rascunho
                      // (deleteDraftVersion recusa excluir a versão atual).
                      await setCurrentVersion(publishedId, groupId, user.id);
                      await deleteDraftVersion(draftId, user.id);
                      toast.success("Rascunho descartado. Voltando para a versão publicada.");
                      navigate(`/admin/budget/${publishedId}`, { replace: true });
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Erro ao descartar rascunho");
                      setDiscardingDraft(false);
                    }
                  }}
                >
                  {discardingDraft ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Descartar este rascunho
                </Button>
              </AlertDescription>
            </Alert>
          )}

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

          {/* Workflow Bar — always visible (não bloqueado por sections) */}
          <div className="mt-4">
            <WorkflowBar
              budget={budget}
              onBudgetUpdate={(fields) => setBudget({ ...budget, ...fields })}
            />
          </div>

          {/* Banner não-bloqueante: sections ainda chegando.
              UI continua editável (atribuição, prazo, status) — só a planilha
              mostra skeleton. Edições falhas são guardadas em fila local. */}
          {sectionsInitialLoading && (
            <div className="mt-3 flex items-center gap-2 text-xs font-body text-muted-foreground border border-border/40 bg-muted/30 rounded-md px-3 py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>
                Carregando seções… você já pode atribuir responsável e ajustar status — alterações serão salvas mesmo se a planilha demorar.
              </span>
            </div>
          )}

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
                <div className={cn("flex-1 min-w-0", briefingOpen && "sm:mr-[320px]")}>
                  {/* Apply template button for orçamentista/admin — só mostra "Aplicar Template" como CTA grande
                      quando temos certeza de que o orçamento está vazio (load concluído). Durante o
                      carregamento inicial mostramos um skeleton em vez do empty state, para evitar
                      o efeito visual de "Orçamento em branco" quando na verdade os dados ainda
                      estão chegando do servidor. */}
                  {(isOrcamentista || isAdmin) && sections.length === 0 && !sectionsInitialLoading && (
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
                  {sections.length > 0 && (itemsInitialLoading || imagesInitialLoading) && !itemsRowsError && !imagesRowsError && (
                    <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-md border border-border/60 bg-muted/30 text-xs text-muted-foreground font-body" role="status" aria-live="polite">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {itemsInitialLoading ? "Carregando itens das seções…" : "Carregando imagens dos itens…"}
                    </div>
                  )}
                  {/* Banners de erro com retry manual — não bloqueiam edição do que já carregou */}
                  {Boolean(sectionsRowsError) && (
                    <div className="flex items-center justify-between gap-3 px-3 py-2 mb-2 rounded-md border border-destructive/40 bg-destructive/5 text-xs font-body" role="alert">
                      <div className="flex items-center gap-2 min-w-0">
                        <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                        <span className="text-foreground truncate">Falha ao carregar seções do orçamento.</span>
                      </div>
                      <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs shrink-0" disabled={sectionsRowsFetching} onClick={() => refetchSectionsRows()}>
                        {sectionsRowsFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                        Tentar novamente
                      </Button>
                    </div>
                  )}
                  {!sectionsRowsError && Boolean(itemsRowsError) && (
                    <div className="flex items-center justify-between gap-3 px-3 py-2 mb-2 rounded-md border border-destructive/40 bg-destructive/5 text-xs font-body" role="alert">
                      <div className="flex items-center gap-2 min-w-0">
                        <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                        <span className="text-foreground truncate">Falha ao carregar itens. Seções aparecem sem conteúdo.</span>
                      </div>
                      <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs shrink-0" disabled={itemsRowsFetching} onClick={() => refetchItemsRows()}>
                        {itemsRowsFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                        Tentar novamente
                      </Button>
                    </div>
                  )}
                  {!sectionsRowsError && !itemsRowsError && Boolean(imagesRowsError) && (
                    <div className="flex items-center justify-between gap-3 px-3 py-2 mb-2 rounded-md border border-warning/40 bg-warning/5 text-xs font-body" role="status">
                      <div className="flex items-center gap-2 min-w-0">
                        <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />
                        <span className="text-foreground truncate">Algumas imagens não carregaram. Itens estão visíveis sem fotos.</span>
                      </div>
                      <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs shrink-0" disabled={imagesRowsFetching} onClick={() => refetchImagesRows()}>
                        {imagesRowsFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                        Recarregar imagens
                      </Button>
                    </div>
                  )}
                  <SectionsEditor
                    budgetId={budgetId!}
                    sections={sections}
                    onSectionsChange={setSections}
                    loading={sectionsLoading || (sectionsInitialLoading && sections.length === 0)}
                    loadingStage={
                      sectionsInitialLoading ? "sections" : itemsInitialLoading ? "items" : imagesInitialLoading ? "images" : null
                    }
                    readOnly={isPublishedVersion}
                    isAddendum={budget.is_addendum === true}
                    onProtectedEditAttempt={isPublishedVersion ? forkPublishedForStructuralEdit : undefined}
                    onSaveStatusChange={(status) => {
                      setSaveStatus(status);
                      if (status === "saved") {
                        setLastSavedAt(new Date());
                        setTimeout(() => setSaveStatus(prev => prev === "saved" ? "idle" : prev), 2000);
                      }
                    }}
                  />
                </div>

                {/* Briefing toggle — desktop chip à direita; mobile chip flutuante no canto inferior. */}
                {!briefingOpen && (
                  <>
                    <div className="hidden sm:block fixed right-4 top-36 z-30">
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
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={() => setBriefingOpen(true)}
                      aria-label="Abrir briefing e histórico"
                      className="sm:hidden fixed right-3 z-30 h-11 w-11 rounded-full p-0 shadow-lg"
                      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
                    >
                      <MessageSquare className="h-5 w-5" />
                    </Button>
                  </>
                )}

                {/* Briefing — desktop sidebar fixa; mobile vira Sheet/Drawer (acessibilidade nativa) */}
                {briefingOpen && (
                  <>
                    <div className="hidden sm:flex fixed right-0 top-[96px] bottom-0 w-[320px] z-30 border-l border-border bg-background overflow-y-auto flex-col">
                      <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
                        <span className="text-sm font-body font-medium">Briefing & Histórico</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => setBriefingOpen(false)}
                          aria-label="Fechar briefing"
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
                         autoSaveField={autoSaveBudgetField}
                      />
                    </div>
                    <Sheet open={briefingOpen} onOpenChange={setBriefingOpen}>
                      <SheetContent
                        side="right"
                        className="sm:hidden w-full p-0 flex flex-col"
                        aria-describedby={undefined}
                      >
                        <SheetHeader className="px-4 py-3 border-b border-border text-left shrink-0">
                          <SheetTitle className="text-sm font-body font-medium">Briefing & Histórico</SheetTitle>
                        </SheetHeader>
                        <div className="flex-1 overflow-y-auto">
                          <BriefingPanel
                            budgetId={budgetId!}
                            budget={budget}
                            onBudgetFieldChange={(field, value) => {
                              setBudget({ ...budget, [field]: value });
                            }}
                            autoSaveField={autoSaveBudgetField}
                          />
                        </div>
                      </SheetContent>
                    </Sheet>
                  </>
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
                    className="w-full text-xl sm:text-2xl lg:text-3xl font-display font-bold text-foreground bg-transparent border-none outline-none placeholder:text-muted-foreground/40 leading-tight"
                    placeholder="Nome do projeto"
                  />
                ) : (
                  <h1
                    onClick={() => setEditingTitle(true)}
                    className="text-xl sm:text-2xl lg:text-3xl font-display font-bold text-foreground leading-tight cursor-text hover:bg-muted/30 rounded-md px-1 -mx-1 py-0.5 transition-colors"
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
                {/* Prazo de execução — chip inline editável (espelha o campo em Metadados → Prazo da obra) */}
                <div className="pt-2 px-1">
                  <PrazoExecucaoChip
                    value={budget.prazo_dias_uteis ?? null}
                    onChange={(next) => {
                      setBudget({ ...budget, prazo_dias_uteis: next });
                      autoSaveBudgetField("prazo_dias_uteis", next);
                    }}
                  />
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