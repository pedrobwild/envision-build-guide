import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Search, Plus, Edit2, Trash2, FolderOpen, ToggleLeft, ToggleRight, Wrench, Package,
  GripVertical,
} from "lucide-react";
import { CatalogEmptyState } from "@/components/catalog/CatalogEmptyState";
import { ConfirmDeleteDialog } from "@/components/catalog/ConfirmDeleteDialog";
import type { CatalogCategory } from "@/components/catalog/CategoryDialog";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Props {
  categories: CatalogCategory[];
  onNewCategory: () => void;
  onEditCategory: (cat: CatalogCategory) => void;
  onRefresh: () => void;
}

interface SortableRowProps {
  cat: CatalogCategory;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  draggable: boolean;
}

function SortableRow({ cat, onEdit, onDelete, onToggleActive, draggable }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: cat.id, disabled: !draggable });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : !cat.is_active ? 0.5 : 1,
  };

  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell className="w-8 px-2">
        {draggable && (
          <button
            type="button"
            className="cursor-grab text-muted-foreground hover:text-foreground"
            {...attributes}
            {...listeners}
            aria-label="Reordenar"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
      </TableCell>
      <TableCell className="font-medium">{cat.name}</TableCell>
      <TableCell>
        <Badge
          variant="secondary"
          className={
            cat.category_type === "Prestadores"
              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
              : "bg-muted text-muted-foreground"
          }
        >
          {cat.category_type === "Prestadores" ? (
            <Wrench className="h-3 w-3 mr-1" />
          ) : (
            <Package className="h-3 w-3 mr-1" />
          )}
          {cat.category_type}
        </Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{cat.description ?? "—"}</TableCell>
      <TableCell>
        <button
          type="button"
          onClick={onToggleActive}
          className="group flex items-center gap-1.5"
          aria-label={cat.is_active ? `Desativar categoria ${cat.name}` : `Ativar categoria ${cat.name}`}
          aria-pressed={cat.is_active}
        >
          {cat.is_active ? (
            <ToggleRight className="h-5 w-5 text-primary group-hover:text-primary/70 transition-colors" aria-hidden="true" />
          ) : (
            <ToggleLeft className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" aria-hidden="true" />
          )}
          <span className="text-xs">{cat.is_active ? "Ativo" : "Inativo"}</span>
        </button>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex gap-0.5 justify-end">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onEdit}
            aria-label={`Editar categoria ${cat.name}`}
          >
            <Edit2 className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={onDelete}
            aria-label={`Excluir categoria ${cat.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function CategoriesTab({ categories, onNewCategory, onEditCategory, onRefresh }: Props) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<CatalogCategory | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [orderedCats, setOrderedCats] = useState<CatalogCategory[]>(categories);

  useEffect(() => {
    setOrderedCats(categories);
  }, [categories]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const filtered = orderedCats.filter((c) => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) &&
        !c.description?.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter !== "all" && c.category_type !== typeFilter) return false;
    if (statusFilter === "active" && !c.is_active) return false;
    if (statusFilter === "inactive" && c.is_active) return false;
    return true;
  });

  const noFiltersActive = !search && typeFilter === "all" && statusFilter === "all";

  const prestadoresCount = categories.filter(c => c.category_type === "Prestadores").length;
  const produtosCount = categories.filter(c => c.category_type === "Produtos").length;

  const handleToggleActive = async (cat: CatalogCategory) => {
    const { error } = await supabase
      .from("catalog_categories")
      .update({ is_active: !cat.is_active })
      .eq("id", cat.id);
    if (error) { toast.error("Erro ao atualizar"); return; }
    toast.success(cat.is_active ? "Categoria desativada" : "Categoria ativada");
    onRefresh();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("catalog_categories").delete().eq("id", deleteTarget.id);
    setDeleting(false);
    if (error) {
      toast.error("Erro ao excluir. Pode haver itens vinculados.");
      return;
    }
    toast.success("Categoria excluída");
    setDeleteTarget(null);
    onRefresh();
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const oldIndex = orderedCats.findIndex((c) => c.id === active.id);
    const newIndex = orderedCats.findIndex((c) => c.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(orderedCats, oldIndex, newIndex);
    setOrderedCats(next);

    // Persist sort_order in batch
    const updates = next.map((c, idx) =>
      supabase.from("catalog_categories").update({ sort_order: idx }).eq("id", c.id),
    );
    const results = await Promise.all(updates);
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      toast.error("Erro ao salvar ordem");
      setOrderedCats(categories);
      return;
    }
    toast.success("Ordem atualizada");
    onRefresh();
  };

  return (
    <div className="space-y-4">
      {/* Summary chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="gap-1.5 px-2.5 py-1">
          <Wrench className="h-3 w-3 text-blue-500" />
          <span className="text-xs">{prestadoresCount} Prestadores</span>
        </Badge>
        <Badge variant="outline" className="gap-1.5 px-2.5 py-1">
          <Package className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs">{produtosCount} Produtos</span>
        </Badge>
        {noFiltersActive && (
          <span className="text-[11px] text-muted-foreground ml-1">
            Arraste pelo <GripVertical className="inline h-3 w-3 -mt-0.5" /> para reordenar
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar categorias..."
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="Prestadores">Prestadores</SelectItem>
            <SelectItem value="Produtos">Produtos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" onClick={onNewCategory}>
          <Plus className="h-4 w-4 mr-1" /> Nova Categoria
        </Button>
      </div>

      {filtered.length === 0 ? (
        <CatalogEmptyState
          icon={FolderOpen}
          title={search || typeFilter !== "all" ? "Nenhuma categoria encontrada" : "Nenhuma categoria"}
          description={search || typeFilter !== "all" ? "Tente outros filtros." : "Crie categorias para organizar os itens do catálogo."}
          action={!search && typeFilter === "all" ? (
            <Button size="sm" onClick={onNewCategory}>
              <Plus className="h-4 w-4 mr-1" /> Nova Categoria
            </Button>
          ) : undefined}
        />
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-8 px-2"></TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="w-32">Tipo</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-20">Status</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={filtered.map((c) => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {filtered.map((cat) => (
                    <SortableRow
                      key={cat.id}
                      cat={cat}
                      draggable={noFiltersActive}
                      onEdit={() => onEditCategory(cat)}
                      onDelete={() => setDeleteTarget(cat)}
                      onToggleActive={() => handleToggleActive(cat)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </TableBody>
          </Table>
        </div>
      )}
      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title={`Excluir "${deleteTarget?.name}"?`}
        description="Itens vinculados a esta categoria perderão a referência. Esta ação não pode ser desfeita."
        onConfirm={confirmDelete}
        loading={deleting}
      />
    </div>
  );
}
