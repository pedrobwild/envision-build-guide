import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Package, FolderOpen, Building2 } from "lucide-react";

import { ItemsTab } from "@/components/catalog/ItemsTab";
import { CategoriesTab } from "@/components/catalog/CategoriesTab";
import { SuppliersTab } from "@/components/catalog/SuppliersTab";
import { CatalogItemDialog, type CatalogItem } from "@/components/catalog/CatalogItemDialog";
import { CategoryDialog, type CatalogCategory } from "@/components/catalog/CategoryDialog";
import { SupplierDialog, type Supplier } from "@/components/catalog/SupplierDialog";

const PAGE_SIZE = 50;

// ─── Hooks ────────────────────────────────────────────────────────
function useCategories() {
  return useQuery({
    queryKey: ["catalog_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalog_categories")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as CatalogCategory[];
    },
  });
}

function useSuppliers() {
  return useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Supplier[];
    },
  });
}

/** Debounce hook */
function useDebouncedValue(value: string, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function useCatalogItems(search: string, typeFilter: string, categoryFilter: string, sectionFilter: string, statusFilter: string, page: number) {
  return useQuery({
    queryKey: ["catalog_items", search, typeFilter, categoryFilter, sectionFilter, statusFilter, page],
    queryFn: async () => {
      let allowedItemIds: string[] | null = null;
      if (sectionFilter && sectionFilter !== "all") {
        const { data: links } = await supabase
          .from("catalog_item_sections")
          .select("catalog_item_id")
          .eq("section_title", sectionFilter);
        allowedItemIds = (links ?? []).map((l) => l.catalog_item_id);
        if (allowedItemIds.length === 0) return { items: [], total: 0 };
      }

      let query = supabase
        .from("catalog_items")
        .select("*, catalog_categories(*), suppliers:default_supplier_id(*)", { count: "exact" })
        .order("name")
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (search) {
        query = query.ilike("search_text", `%${search.toLowerCase()}%`);
      }
      if (typeFilter && typeFilter !== "all") {
        query = query.eq("item_type", typeFilter as "product" | "service");
      }
      if (categoryFilter && categoryFilter !== "all") {
        query = query.eq("category_id", categoryFilter);
      }
      if (statusFilter === "active") {
        query = query.eq("is_active", true);
      } else if (statusFilter === "inactive") {
        query = query.eq("is_active", false);
      }
      if (allowedItemIds) {
        query = query.in("id", allowedItemIds);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { items: (data ?? []) as CatalogItem[], total: count ?? 0 };
    },
  });
}

// ─── Main Page ────────────────────────────────────────────────────
export default function CatalogPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);

  const debouncedSearch = useDebouncedValue(search);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, typeFilter, categoryFilter, sectionFilter, statusFilter]);

  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);

  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CatalogCategory | null>(null);

  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const { data: categories = [] } = useCategories();
  const { data: suppliers = [] } = useSuppliers();
  const { data: result, isLoading } = useCatalogItems(debouncedSearch, typeFilter, categoryFilter, sectionFilter, statusFilter, page);
  const items = result?.items ?? [];
  const totalCount = result?.total ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["catalog_items"] });
    queryClient.invalidateQueries({ queryKey: ["catalog_categories"] });
    queryClient.invalidateQueries({ queryKey: ["suppliers"] });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Catálogo Mestre</h1>
          <p className="text-sm text-muted-foreground">Base de produtos e serviços para orçamentos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setEditingCategory(null); setCategoryDialogOpen(true); }}>
            <FolderOpen className="h-4 w-4 mr-1" /> Categoria
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setEditingSupplier(null); setSupplierDialogOpen(true); }}>
            <Building2 className="h-4 w-4 mr-1" /> Fornecedor
          </Button>
          <Button size="sm" onClick={() => { setEditingItem(null); setItemDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Novo Item
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items" className="gap-1.5">
            <Package className="h-3.5 w-3.5" /> Itens ({items.length})
          </TabsTrigger>
          <TabsTrigger value="categories" className="gap-1.5">
            <FolderOpen className="h-3.5 w-3.5" /> Categorias ({categories.length})
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="gap-1.5">
            <Building2 className="h-3.5 w-3.5" /> Fornecedores ({suppliers.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="items">
          <ItemsTab
            items={items}
            categories={categories}
            suppliers={suppliers}
            isLoading={isLoading}
            search={search}
            onSearchChange={setSearch}
            typeFilter={typeFilter}
            onTypeFilterChange={setTypeFilter}
            categoryFilter={categoryFilter}
            onCategoryFilterChange={setCategoryFilter}
            sectionFilter={sectionFilter}
            onSectionFilterChange={setSectionFilter}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            onNewItem={() => { setEditingItem(null); setItemDialogOpen(true); }}
            onEditItem={(item) => { setEditingItem(item); setItemDialogOpen(true); }}
            onRefresh={invalidateAll}
          />
        </TabsContent>

        <TabsContent value="categories">
          <CategoriesTab
            categories={categories}
            onNewCategory={() => { setEditingCategory(null); setCategoryDialogOpen(true); }}
            onEditCategory={(cat) => { setEditingCategory(cat); setCategoryDialogOpen(true); }}
            onRefresh={invalidateAll}
          />
        </TabsContent>

        <TabsContent value="suppliers">
          <SuppliersTab
            suppliers={suppliers}
            onNewSupplier={() => { setEditingSupplier(null); setSupplierDialogOpen(true); }}
            onEditSupplier={(sup) => { setEditingSupplier(sup); setSupplierDialogOpen(true); }}
            onRefresh={invalidateAll}
          />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {itemDialogOpen && (
        <CatalogItemDialog
          open={itemDialogOpen}
          onOpenChange={setItemDialogOpen}
          item={editingItem}
          categories={categories}
          suppliers={suppliers}
          onSaved={invalidateAll}
        />
      )}
      {categoryDialogOpen && (
        <CategoryDialog
          open={categoryDialogOpen}
          onOpenChange={setCategoryDialogOpen}
          category={editingCategory}
          onSaved={invalidateAll}
        />
      )}
      {supplierDialogOpen && (
        <SupplierDialog
          open={supplierDialogOpen}
          onOpenChange={setSupplierDialogOpen}
          supplier={editingSupplier}
          onSaved={invalidateAll}
        />
      )}
    </div>
  );
}
