import { useState } from "react";
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
} from "lucide-react";
import { CatalogEmptyState } from "@/components/catalog/CatalogEmptyState";
import { ConfirmDeleteDialog } from "@/components/catalog/ConfirmDeleteDialog";
import type { CatalogCategory } from "@/components/catalog/CategoryDialog";

interface Props {
  categories: CatalogCategory[];
  onNewCategory: () => void;
  onEditCategory: (cat: CatalogCategory) => void;
  onRefresh: () => void;
}

export function CategoriesTab({ categories, onNewCategory, onEditCategory, onRefresh }: Props) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<CatalogCategory | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = categories.filter((c) => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) &&
        !c.description?.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter !== "all" && c.category_type !== typeFilter) return false;
    if (statusFilter === "active" && !c.is_active) return false;
    if (statusFilter === "inactive" && c.is_active) return false;
    return true;
  });

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
                <TableHead>Nome</TableHead>
                <TableHead className="w-32">Tipo</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-20">Status</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((cat) => (
                <TableRow key={cat.id} className={!cat.is_active ? "opacity-50" : ""}>
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
                      onClick={() => handleToggleActive(cat)}
                      className="group flex items-center gap-1.5"
                      title={cat.is_active ? "Desativar" : "Ativar"}
                    >
                      {cat.is_active ? (
                        <ToggleRight className="h-5 w-5 text-primary group-hover:text-primary/70 transition-colors" />
                      ) : (
                        <ToggleLeft className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                      )}
                      <span className="text-xs">{cat.is_active ? "Ativo" : "Inativo"}</span>
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-0.5 justify-end">
                      <Button variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => onEditCategory(cat)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(cat)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
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
