import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Search, Plus, Edit2, Trash2, FolderOpen, ToggleLeft, ToggleRight,
} from "lucide-react";
import { CatalogEmptyState } from "@/components/catalog/CatalogEmptyState";
import type { CatalogCategory } from "@/components/catalog/CategoryDialog";

interface Props {
  categories: CatalogCategory[];
  onNewCategory: () => void;
  onEditCategory: (cat: CatalogCategory) => void;
  onRefresh: () => void;
}

export function CategoriesTab({ categories, onNewCategory, onEditCategory, onRefresh }: Props) {
  const [search, setSearch] = useState("");

  const filtered = categories.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.description?.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggleActive = async (cat: CatalogCategory) => {
    const { error } = await supabase
      .from("catalog_categories")
      .update({ is_active: !cat.is_active })
      .eq("id", cat.id);
    if (error) { toast.error("Erro ao atualizar"); return; }
    toast.success(cat.is_active ? "Categoria desativada" : "Categoria ativada");
    onRefresh();
  };

  const handleDelete = async (cat: CatalogCategory) => {
    if (!confirm(`Excluir a categoria "${cat.name}"? Itens vinculados perderão a referência.`)) return;
    const { error } = await supabase.from("catalog_categories").delete().eq("id", cat.id);
    if (error) {
      toast.error("Erro ao excluir. Pode haver itens vinculados.");
      return;
    }
    toast.success("Categoria excluída");
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar categorias..."
            className="pl-9"
          />
        </div>
        <Button size="sm" onClick={onNewCategory}>
          <Plus className="h-4 w-4 mr-1" /> Nova Categoria
        </Button>
      </div>

      {filtered.length === 0 ? (
        <CatalogEmptyState
          icon={FolderOpen}
          title={search ? "Nenhuma categoria encontrada" : "Nenhuma categoria"}
          description={search ? "Tente outro termo de busca." : "Crie categorias para organizar os itens do catálogo."}
          action={!search ? (
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
                <TableHead>Descrição</TableHead>
                <TableHead className="w-20">Status</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((cat) => (
                <TableRow key={cat.id} className={!cat.is_active ? "opacity-50" : ""}>
                  <TableCell className="font-medium">{cat.name}</TableCell>
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
                        onClick={() => handleDelete(cat)}>
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
    </div>
  );
}
