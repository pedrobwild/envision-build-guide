import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getPublicBudgetUrl } from "@/lib/getPublicUrl";
import { openPublicBudgetByPublicId } from "@/lib/openPublicBudget";
import { ContractUploadModal } from "@/components/commercial/ContractUploadModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Pencil, Eye, MoreHorizontal, Copy, Handshake,
  ShoppingBag, Archive, Trash2, GitCompare, Loader2, Layers, Check, FilePlus2, BadgePercent,
} from "lucide-react";
import { useDealPipelines, setBudgetPipeline } from "@/hooks/useDealPipelines";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useAuth } from "@/hooks/useAuth";
import { createAddendumFromBudget } from "@/lib/budget-addendum";
import { safeDeleteBudget } from "@/lib/budget-delete";
import { DiscountVersionDialog } from "@/components/admin/DiscountVersionDialog";

interface BudgetActionsMenuProps {
  budget: {
    id: string;
    project_name?: string;
    public_id?: string | null;
    status?: string;
    internal_status?: string;
    show_optional_items?: boolean;
    version_group_id?: string | null;
    version_number?: number | null;
    pipeline_id?: string | null;
  };
  /** Extra menu items rendered before the separator (page-specific actions) */
  extraItems?: React.ReactNode;
  /** Called after any mutation so the parent can refresh data */
  onRefresh?: () => void;
  /** Navigate-back path when editing */
  fromPath?: string;
  /** Override the trigger button */
  trigger?: React.ReactNode;
  /** Align dropdown */
  align?: "start" | "end" | "center";
}

export function BudgetActionsMenu({
  budget,
  extraItems,
  onRefresh,
  fromPath,
  trigger,
  align = "end",
}: BudgetActionsMenuProps) {
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [closingContract, setClosingContract] = useState(false);
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [creatingAddendum, setCreatingAddendum] = useState(false);
  const { data: pipelines = [] } = useDealPipelines();
  const { isAdmin, isOrcamentista } = useUserProfile();
  const { user } = useAuth();
  const canCreateAddendum = (isAdmin || isOrcamentista)
    && ["sent_to_client", "minuta_solicitada", "contrato_fechado"].includes(budget.internal_status || "");

  const handleCreateAddendum = async () => {
    if (!user) { toast.error("Sessão expirada"); return; }
    setCreatingAddendum(true);
    try {
      const newId = await createAddendumFromBudget(budget.id, user.id);
      toast.success("Aditivo criado — marque itens para remover ou adicione novos");
      navigate(`/admin/budget/${newId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar aditivo");
    } finally {
      setCreatingAddendum(false);
    }
  };

  const movePipeline = async (pipelineId: string | null) => {
    try {
      await setBudgetPipeline(budget.id, pipelineId);
      const target = pipelineId ? pipelines.find((p) => p.id === pipelineId)?.name ?? "pipeline" : "Sem pipeline";
      toast.success(`Movido para ${target}`);
      onRefresh?.();
    } catch {
      toast.error("Erro ao mover pipeline");
    }
  };

  const editPath = `/admin/budget/${budget.id}`;
  const hasPublicPage = !!budget.public_id;

  const copyLink = () => {
    if (!budget.public_id) return;
    navigator.clipboard.writeText(getPublicBudgetUrl(budget.public_id));
    toast.success("Link copiado!");
  };

  const openPublicPage = () => {
    if (!budget.public_id) return;
    void openPublicBudgetByPublicId(budget.public_id);
  };

  const markContractClosed = () => {
    setContractModalOpen(true);
  };

  const handleContractUploadSuccess = () => {
    onRefresh?.();
  };

  const toggleOptionals = async () => {
    const next = !budget.show_optional_items;
    await supabase
      .from("budgets")
      .update({ show_optional_items: next })
      .eq("id", budget.id);
    toast.success(next ? "Opcionais ativados" : "Opcionais desativados");
    onRefresh?.();
  };

  const duplicateAsNew = async () => {
    try {
      // 1. Load original budget
      const { data: original } = await supabase
        .from("budgets")
        .select("*")
        .eq("id", budget.id)
        .single();
      if (!original) { toast.error("Orçamento não encontrado"); return; }

      const newPublicId = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
      const oldPublicId = original.public_id;

      // 2. Create new budget (preserve media_config — refs are still valid since they're public URLs)
      const { data: newBudget, error: insertErr } = await supabase
        .from("budgets")
        .insert({
          project_name: `${original.project_name} (cópia)`,
          client_name: original.client_name,
          created_by: original.created_by,
          public_id: newPublicId,
          condominio: original.condominio,
          bairro: original.bairro,
          metragem: original.metragem,
          unit: original.unit,
          city: original.city,
          property_type: original.property_type,
          consultora_comercial: original.consultora_comercial,
          email_comercial: original.email_comercial,
          validity_days: original.validity_days,
          prazo_dias_uteis: original.prazo_dias_uteis,
          estimated_weeks: original.estimated_weeks,
          disclaimer: original.disclaimer,
          notes: original.notes,
          briefing: original.briefing,
          show_item_qty: original.show_item_qty,
          show_item_prices: original.show_item_prices,
          show_progress_bars: original.show_progress_bars,
          show_optional_items: original.show_optional_items,
          header_config: original.header_config,
          floor_plan_url: original.floor_plan_url,
          media_config: original.media_config,
          commercial_owner_id: original.commercial_owner_id,
          estimator_owner_id: original.estimator_owner_id,
          internal_status: "delivered_to_sales",
          status: original.status,
        })
        .select("id")
        .single();

      if (insertErr || !newBudget) { toast.error("Erro ao duplicar"); return; }

      // 3. Clone sections + items + item_images (batch, with ID maps)
      const { data: sections } = await supabase
        .from("sections")
        .select("*")
        .eq("budget_id", budget.id)
        .order("order_index");

      if (sections && sections.length > 0) {
        const sectionInserts = sections.map(({ id: _id, created_at: _ca, budget_id: _bid, ...rest }) => ({
          ...rest,
          budget_id: newBudget.id,
        }));
        const { data: newSections } = await supabase.from("sections").insert(sectionInserts).select();

        if (newSections && newSections.length > 0) {
          const sectionIdMap = new Map<string, string>();
          sections.forEach((s, i) => { if (newSections[i]) sectionIdMap.set(s.id, newSections[i].id); });

          const oldSectionIds = sections.map(s => s.id);
          const { data: allItems } = await supabase
            .from("items")
            .select("*")
            .in("section_id", oldSectionIds)
            .order("order_index");

          if (allItems && allItems.length > 0) {
            const itemInserts = allItems.map(({ id: _id, created_at: _ca, section_id, ...rest }) => ({
              ...rest,
              section_id: sectionIdMap.get(section_id) || section_id,
            }));
            const { data: newItems } = await supabase.from("items").insert(itemInserts).select();

            if (newItems && newItems.length > 0) {
              const itemIdMap = new Map<string, string>();
              allItems.forEach((it, i) => { if (newItems[i]) itemIdMap.set(it.id, newItems[i].id); });

              const oldItemIds = allItems.map(it => it.id);
              const { data: allImages } = await supabase
                .from("item_images")
                .select("*")
                .in("item_id", oldItemIds);

              if (allImages && allImages.length > 0) {
                const imageInserts = allImages.map(({ id: _id, created_at: _ca, item_id, ...rest }) => ({
                  ...rest,
                  item_id: itemIdMap.get(item_id) || item_id,
                }));
                await supabase.from("item_images").insert(imageInserts);
              }
            }
          }
        }
      }

      // 4. Clone adjustments
      const { data: adjustments } = await supabase
        .from("adjustments")
        .select("*")
        .eq("budget_id", budget.id);
      if (adjustments && adjustments.length > 0) {
        await supabase.from("adjustments").insert(
          adjustments.map(({ id: _id, created_at: _ca, budget_id: _bid, ...rest }) => ({
            ...rest,
            budget_id: newBudget.id,
          }))
        );
      }

      // 5. Clone budget_tours (3D tours)
      const { data: tours } = await supabase
        .from("budget_tours")
        .select("*")
        .eq("budget_id", budget.id);
      if (tours && tours.length > 0) {
        await supabase.from("budget_tours").insert(
          tours.map(({ id: _id, created_at: _ca, budget_id: _bid, ...rest }) => ({
            ...rest,
            budget_id: newBudget.id,
          }))
        );
      }

      // 6. Clone Storage media folders ({oldPublicId}/{3d,fotos,exec,video} -> {newPublicId}/...)
      if (oldPublicId) {
        const folders = ["3d", "fotos", "exec", "video"];
        await Promise.all(folders.map(async (folder) => {
          const { data: files } = await supabase.storage
            .from("media")
            .list(`${oldPublicId}/${folder}`, { limit: 1000 });
          if (!files || files.length === 0) return;
          await Promise.all(files
            .filter(f => f.name !== ".emptyFolderPlaceholder" && f.name !== ".lovkeep")
            .map(f => supabase.storage
              .from("media")
              .copy(`${oldPublicId}/${folder}/${f.name}`, `${newPublicId}/${folder}/${f.name}`)
            ));
        }));
      }

      toast.success("Orçamento duplicado com mídias!");
      navigate(`/admin/budget/${newBudget.id}`);
    } catch {
      toast.error("Erro ao duplicar orçamento");
    }
  };

  const archiveBudget = async () => {
    await supabase
      .from("budgets")
      .update({ status: "archived" })
      .eq("id", budget.id);
    toast.success("Orçamento arquivado");
    onRefresh?.();
  };

  const deleteBudget = async () => {
    setDeleting(true);
    const result = await safeDeleteBudget(budget.id);
    if (result.ok) {
      toast.success("Orçamento excluído");
      onRefresh?.();
    } else {
      toast.error(result.reason);
    }
    setDeleting(false);
    setDeleteOpen(false);
  };

  const isTerminal = ["contrato_fechado", "lost", "archived"].includes(budget.status || "");

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {trigger || (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} className="w-52" onClick={(e) => e.stopPropagation()}>
          {/* Core actions */}
          <DropdownMenuItem onClick={() => navigate(editPath, fromPath ? { state: { from: fromPath } } : undefined)}>
            <Pencil className="h-4 w-4 mr-2" /> Editar
          </DropdownMenuItem>
          {hasPublicPage && (
            <DropdownMenuItem onClick={openPublicPage}>
              <Eye className="h-4 w-4 mr-2" /> Ver página pública
            </DropdownMenuItem>
          )}
          {hasPublicPage && (
            <DropdownMenuItem onClick={copyLink}>
              <Copy className="h-4 w-4 mr-2" /> Copiar link
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          {/* Status / toggle actions */}
          {!isTerminal && (
            <DropdownMenuItem onClick={markContractClosed} disabled={closingContract}>
              <Handshake className="h-4 w-4 mr-2 text-primary" /> Contrato Fechado
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={toggleOptionals}>
            <ShoppingBag className="h-4 w-4 mr-2 text-amber-500" />
            {budget.show_optional_items ? "Desativar opcionais" : "Incluir opcionais"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={duplicateAsNew}>
            <Copy className="h-4 w-4 mr-2" /> Duplicar como novo
          </DropdownMenuItem>

          {canCreateAddendum && (
            <DropdownMenuItem onClick={handleCreateAddendum} disabled={creatingAddendum}>
              {creatingAddendum
                ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                : <FilePlus2 className="h-4 w-4 mr-2 text-primary" />}
              Criar Aditivo
            </DropdownMenuItem>
          )}

          {/* Version compare */}
          {budget.version_group_id && (budget.version_number ?? 1) > 1 && (
            <DropdownMenuItem onClick={() => navigate(`/admin/comparar?left=${budget.version_group_id}&right=${budget.id}`)}>
              <GitCompare className="h-4 w-4 mr-2" /> Comparar versões
            </DropdownMenuItem>
          )}

          {/* Move to pipeline */}
          {pipelines.length > 0 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Layers className="h-4 w-4 mr-2" /> Mover para pipeline
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-52">
                {pipelines.map((p) => (
                  <DropdownMenuItem key={p.id} onClick={() => movePipeline(p.id)}>
                    <span className="flex items-center gap-2 flex-1">
                      <span
                        className="h-2 w-2 rounded-full bg-muted-foreground"
                        style={p.color ? { backgroundColor: p.color } : undefined}
                      />
                      {p.name}
                    </span>
                    {budget.pipeline_id === p.id && <Check className="h-3.5 w-3.5 text-primary" />}
                  </DropdownMenuItem>
                ))}
                {budget.pipeline_id && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => movePipeline(null)}>
                      <span className="text-muted-foreground">Remover pipeline</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}

          {/* Page-specific extra items */}
          {extraItems}

          <DropdownMenuSeparator />

          {budget.status !== "archived" && (
            <DropdownMenuItem onClick={archiveBudget}>
              <Archive className="h-4 w-4 mr-2" /> Arquivar
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" /> Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir orçamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{budget.project_name || "Sem nome"}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteBudget}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Contract Upload Modal */}
      <ContractUploadModal
        open={contractModalOpen}
        onOpenChange={setContractModalOpen}
        budgetId={budget.id}
        projectName={budget.project_name || ""}
        onSuccess={handleContractUploadSuccess}
      />
    </>
  );
}
