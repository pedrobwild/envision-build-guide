import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getPublicBudgetUrl } from "@/lib/getPublicUrl";
import { ContractUploadModal } from "@/components/commercial/ContractUploadModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
  ShoppingBag, Archive, Trash2, GitCompare, Loader2,
} from "lucide-react";

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

  const editPath = `/admin/budget/${budget.id}`;
  const hasPublicPage = !!budget.public_id;

  const copyLink = () => {
    if (!budget.public_id) return;
    navigator.clipboard.writeText(getPublicBudgetUrl(budget.public_id));
    toast.success("Link copiado!");
  };

  const openPublicPage = () => {
    if (!budget.public_id) return;
    window.open(getPublicBudgetUrl(budget.public_id), "_blank");
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
      // Get the budget data
      const { data: original } = await supabase
        .from("budgets")
        .select("*, sections(*, items(*))")
        .eq("id", budget.id)
        .single();
      if (!original) { toast.error("Orçamento não encontrado"); return; }

      const publicId = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
      const { data: newBudget } = await supabase
        .from("budgets")
        .insert({
          project_name: `${original.project_name} (cópia)`,
          client_name: original.client_name,
          created_by: original.created_by,
          public_id: publicId,
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
          commercial_owner_id: original.commercial_owner_id,
          estimator_owner_id: original.estimator_owner_id,
          internal_status: "delivered_to_sales",
          status: original.status,
        })
        .select("id")
        .single();

      if (!newBudget) { toast.error("Erro ao duplicar"); return; }

      // Clone sections and items
      type NestedSection = { title: string; subtitle?: string | null; order_index: number; notes?: string | null; tags?: unknown; included_bullets?: unknown; excluded_bullets?: unknown; is_optional?: boolean; section_price?: number | null; cover_image_url?: string | null; items?: Array<{ title: string; description?: string | null; unit?: string | null; qty?: number | null; order_index: number; coverage_type?: string; reference_url?: string | null; internal_unit_price?: number | null; internal_total?: number | null; bdi_percentage?: number | null; notes?: string | null }> };
      const nestedSections = ((original as Record<string, unknown>).sections ?? []) as NestedSection[];
      for (const section of nestedSections) {
        const { data: newSection } = await supabase
          .from("sections")
          .insert({
            budget_id: newBudget.id,
            title: section.title,
            subtitle: section.subtitle,
            order_index: section.order_index,
            notes: section.notes,
            tags: section.tags,
            included_bullets: section.included_bullets,
            excluded_bullets: section.excluded_bullets,
            is_optional: section.is_optional,
            section_price: section.section_price,
            cover_image_url: section.cover_image_url,
          })
          .select("id")
          .single();

        if (!newSection) continue;

        for (const item of section.items || []) {
          await supabase.from("items").insert({
            section_id: newSection.id,
            title: item.title,
            description: item.description,
            unit: item.unit,
            qty: item.qty,
            order_index: item.order_index,
            coverage_type: item.coverage_type,
            reference_url: item.reference_url,
            internal_unit_price: item.internal_unit_price,
            internal_total: item.internal_total,
            bdi_percentage: item.bdi_percentage,
            notes: item.notes,
          });
        }
      }

      toast.success("Orçamento duplicado!");
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
    try {
      // Delete items, sections, adjustments, then budget
      const { data: sections } = await supabase
        .from("sections")
        .select("id")
        .eq("budget_id", budget.id);

      if (sections && sections.length > 0) {
        const sectionIds = sections.map((s) => s.id);
        await supabase.from("items").delete().in("section_id", sectionIds);
        await supabase.from("sections").delete().eq("budget_id", budget.id);
      }
      await supabase.from("adjustments").delete().eq("budget_id", budget.id);
      await supabase.from("budgets").delete().eq("id", budget.id);
      toast.success("Orçamento excluído");
      onRefresh?.();
    } catch {
      toast.error("Erro ao excluir");
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

          {/* Version compare */}
          {budget.version_group_id && (budget.version_number ?? 1) > 1 && (
            <DropdownMenuItem onClick={() => navigate(`/admin/comparar?left=${budget.version_group_id}&right=${budget.id}`)}>
              <GitCompare className="h-4 w-4 mr-2" /> Comparar versões
            </DropdownMenuItem>
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
