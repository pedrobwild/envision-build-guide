import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Search, Plus, Package, Wrench, Edit2, Trash2, Filter,
  ToggleLeft, ToggleRight,
} from "lucide-react";
import { CatalogEmptyState } from "@/components/catalog/CatalogEmptyState";
import { CATALOG_SECTION_OPTIONS } from "@/lib/catalog-helpers";
import type { CatalogItem } from "@/components/catalog/CatalogItemDialog";
import type { CatalogCategory } from "@/components/catalog/CategoryDialog";
import type { Supplier } from "@/components/catalog/SupplierDialog";

interface Props {
  items: CatalogItem[];
  categories: CatalogCategory[];
  suppliers: Supplier[];
  isLoading: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  typeFilter: string;
  onTypeFilterChange: (v: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (v: string) => void;
  sectionFilter: string;
  onSectionFilterChange: (v: string) => void;
  statusFilter: string;
  onStatusFilterChange: (v: string) => void;
  onNewItem: () => void;
  onEditItem: (item: CatalogItem) => void;
  onRefresh: () => void;
}

export function ItemsTab({
  items, categories, suppliers, isLoading,
  search, onSearchChange,
  typeFilter, onTypeFilterChange,
  categoryFilter, onCategoryFilterChange,
  sectionFilter, onSectionFilterChange,
  statusFilter, onStatusFilterChange,
  onNewItem, onEditItem, onRefresh,
}: Props) {
  

  const handleDeleteItem = async (id: string) => {
    if (!confirm("Excluir item do catálogo? Esta ação não pode ser desfeita.")) return;
    const { error } = await supabase.from("catalog_items").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Item excluído");
    onRefresh();
  };

  const handleToggleActive = async (item: CatalogItem) => {
    const { error } = await supabase
      .from("catalog_items")
      .update({ is_active: !item.is_active })
      .eq("id", item.id);
    if (error) { toast.error("Erro ao atualizar status"); return; }
    toast.success(item.is_active ? "Item desativado" : "Item ativado");
    onRefresh();
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por nome, descrição ou código..."
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={typeFilter} onValueChange={onTypeFilterChange}>
            <SelectTrigger className="w-36">
              <Filter className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos tipos</SelectItem>
              <SelectItem value="product">Produto</SelectItem>
              <SelectItem value="service">Serviço</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={onCategoryFilterChange}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sectionFilter} onValueChange={onSectionFilterChange}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Seção" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas seções</SelectItem>
              {CATALOG_SECTION_OPTIONS.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results count */}
      {!isLoading && items.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {items.length} {items.length === 1 ? "item encontrado" : "itens encontrados"}
        </p>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Carregando...</div>
      ) : items.length === 0 ? (
        <CatalogEmptyState
          icon={Package}
          title="Nenhum item encontrado"
          description={search || typeFilter !== "all" || categoryFilter !== "all"
            ? "Tente ajustar os filtros de busca."
            : "Comece cadastrando seu primeiro item no catálogo."}
          action={!search ? (
            <Button size="sm" onClick={onNewItem}>
              <Plus className="h-4 w-4 mr-1" /> Novo Item
            </Button>
          ) : undefined}
        />
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Nome</TableHead>
                <TableHead className="w-24">Tipo</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="w-20">Unidade</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead className="w-20">Status</TableHead>
                <TableHead className="w-28 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <>
                  <TableRow key={item.id} className={!item.is_active ? "opacity-50" : ""}>
                    <TableCell>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground truncate">{item.name}</span>
                          {item.internal_code && (
                            <span className="text-xs text-muted-foreground font-mono shrink-0">#{item.internal_code}</span>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{item.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs whitespace-nowrap">
                        {item.item_type === "product" ? (
                          <><Package className="h-3 w-3 mr-1" />Produto</>
                        ) : (
                          <><Wrench className="h-3 w-3 mr-1" />Serviço</>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {(item.catalog_categories as CatalogCategory | null)?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.unit_of_measure ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {(item.suppliers as Supplier | null)?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => handleToggleActive(item)}
                        className="group flex items-center gap-1.5"
                        title={item.is_active ? "Clique para desativar" : "Clique para ativar"}
                      >
                        {item.is_active ? (
                          <ToggleRight className="h-5 w-5 text-primary group-hover:text-primary/70 transition-colors" />
                        ) : (
                          <ToggleLeft className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                        )}
                        <span className="text-xs">{item.is_active ? "Ativo" : "Inativo"}</span>
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-0.5 justify-end">
                        <Button variant="ghost" size="icon" className="h-8 w-8"
                          onClick={() => setExpandedPricesItemId(expandedPricesItemId === item.id ? null : item.id)}
                          title="Preços por fornecedor">
                          <DollarSign className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8"
                          onClick={() => onEditItem(item)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteItem(item.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {expandedPricesItemId === item.id && (
                    <TableRow key={`${item.id}-prices`}>
                      <TableCell colSpan={7} className="bg-muted/20 p-4 border-l-2 border-l-primary">
                        <SupplierPricesPanel
                          catalogItemId={item.id}
                          catalogItemName={item.name}
                          suppliers={suppliers}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
