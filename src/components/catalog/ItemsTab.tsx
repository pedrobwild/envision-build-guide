import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { formatBRL } from "@/lib/formatBRL";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import {
  Search, Plus, Edit2, Trash2, Filter, ToggleLeft, ToggleRight, Package,
  SlidersHorizontal, X, FolderOpen, Truck, MoreVertical,
} from "lucide-react";
import { CatalogEmptyState } from "@/components/catalog/CatalogEmptyState";
import { ConfirmDeleteDialog } from "@/components/catalog/ConfirmDeleteDialog";
import { CATALOG_SECTION_OPTIONS } from "@/lib/catalog-helpers";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  evaluateCatalogIssues, useCatalogAlertsConfig,
} from "@/hooks/useCatalogAlerts";
import { CatalogItemAlertIcon } from "@/components/catalog/CatalogItemAlertIcon";
import { CatalogBulkActionsBar } from "@/components/catalog/CatalogBulkActionsBar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CatalogItem } from "@/components/catalog/CatalogItemDialog";
import type { CatalogCategory } from "@/components/catalog/CategoryDialog";
import type { Supplier } from "@/components/catalog/SupplierDialog";

interface AdvancedFilters {
  supplierIds: string[];
  priceMin: string;
  priceMax: string;
  leadMin: string;
  leadMax: string;
  onlyAlerts: boolean;
}

const DEFAULT_ADVANCED: AdvancedFilters = {
  supplierIds: [],
  priceMin: "",
  priceMax: "",
  leadMin: "",
  leadMax: "",
  onlyAlerts: false,
};

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
  page: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}

export function ItemsTab({
  items, categories, suppliers, isLoading,
  search, onSearchChange,
  typeFilter, onTypeFilterChange,
  categoryFilter, onCategoryFilterChange,
  sectionFilter, onSectionFilterChange,
  statusFilter, onStatusFilterChange,
  onNewItem, onEditItem, onRefresh,
  page, totalPages, totalCount, onPageChange,
}: Props) {
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: alertsConfig } = useCatalogAlertsConfig();

  // ─── Advanced filters (persisted in URL) ─────────────────────
  const [advanced, setAdvanced] = useState<AdvancedFilters>(() => {
    const supplierIds = searchParams.get("sup")?.split(",").filter(Boolean) ?? [];
    return {
      supplierIds,
      priceMin: searchParams.get("pmin") ?? "",
      priceMax: searchParams.get("pmax") ?? "",
      leadMin: searchParams.get("lmin") ?? "",
      leadMax: searchParams.get("lmax") ?? "",
      onlyAlerts: searchParams.get("alerts") === "1",
    };
  });
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Sync advanced filters back to URL
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    advanced.supplierIds.length ? next.set("sup", advanced.supplierIds.join(",")) : next.delete("sup");
    advanced.priceMin ? next.set("pmin", advanced.priceMin) : next.delete("pmin");
    advanced.priceMax ? next.set("pmax", advanced.priceMax) : next.delete("pmax");
    advanced.leadMin ? next.set("lmin", advanced.leadMin) : next.delete("lmin");
    advanced.leadMax ? next.set("lmax", advanced.leadMax) : next.delete("lmax");
    advanced.onlyAlerts ? next.set("alerts", "1") : next.delete("alerts");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advanced]);

  // ─── Suggestions for combobox ────────────────────────────────
  const [showSuggest, setShowSuggest] = useState(false);
  const suggestions = useMemo(() => {
    if (!search.trim()) return { items: [], cats: [], suppliers: [] as Supplier[] };
    const term = search.toLowerCase().trim();
    const itemSugs = items.filter((i) => i.name.toLowerCase().includes(term)).slice(0, 5);
    const catSugs = categories.filter((c) => c.name.toLowerCase().includes(term)).slice(0, 3);
    const supSugs = suppliers.filter((s) => s.name.toLowerCase().includes(term)).slice(0, 3);
    return { items: itemSugs, cats: catSugs, suppliers: supSugs };
  }, [search, items, categories, suppliers]);

  // ─── Primary prices ──────────────────────────────────────────
  const itemIds = useMemo(() => items.map((i) => i.id), [items]);
  const { data: primaryPrices = [] } = useQuery({
    queryKey: ["catalog_primary_prices", itemIds],
    queryFn: async () => {
      if (itemIds.length === 0) return [];
      const { data } = await supabase
        .from("catalog_item_supplier_prices")
        .select("catalog_item_id, supplier_id, unit_price, lead_time_days, is_active, updated_at")
        .in("catalog_item_id", itemIds)
        .eq("is_primary", true);
      return data ?? [];
    },
    enabled: itemIds.length > 0,
  });
  const priceMap = useMemo(
    () => new Map(primaryPrices.map((p) => [p.catalog_item_id, p])),
    [primaryPrices],
  );

  // ─── Apply advanced filters client-side ──────────────────────
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const price = priceMap.get(item.id);
      if (advanced.supplierIds.length > 0) {
        if (!price || !advanced.supplierIds.includes(price.supplier_id)) return false;
      }
      const minP = advanced.priceMin ? parseFloat(advanced.priceMin) : null;
      const maxP = advanced.priceMax ? parseFloat(advanced.priceMax) : null;
      if (minP != null && (price?.unit_price ?? -Infinity) < minP) return false;
      if (maxP != null && (price?.unit_price ?? Infinity) > maxP) return false;

      const minL = advanced.leadMin ? parseInt(advanced.leadMin) : null;
      const maxL = advanced.leadMax ? parseInt(advanced.leadMax) : null;
      if (minL != null && (price?.lead_time_days ?? -Infinity) < minL) return false;
      if (maxL != null && (price?.lead_time_days ?? Infinity) > maxL) return false;

      if (advanced.onlyAlerts) {
        const result = evaluateCatalogIssues(price ?? null, alertsConfig ?? null);
        if (result.worst === "none") return false;
      }
      return true;
    });
  }, [items, priceMap, advanced, alertsConfig]);

  // ─── Bulk selection (per page) ───────────────────────────────
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  useEffect(() => {
    setSelectedIds([]);
  }, [page, search, typeFilter, categoryFilter, sectionFilter, statusFilter]);

  const allOnPage = filteredItems.length > 0 && filteredItems.every((i) => selectedIds.includes(i.id));
  const someOnPage = filteredItems.some((i) => selectedIds.includes(i.id));
  const toggleAll = () => {
    setSelectedIds(allOnPage ? [] : filteredItems.map((i) => i.id));
  };
  const toggleOne = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  // ─── Delete single item ──────────────────────────────────────
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const confirmDeleteItem = async () => {
    if (!deleteId) return;
    setDeleting(true);
    const { error } = await supabase.from("catalog_items").delete().eq("id", deleteId);
    setDeleting(false);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Item excluído");
    setDeleteId(null);
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

  // ─── Active filter badges ───────────────────────────────────
  const activeBadges: Array<{ key: string; label: string; clear: () => void }> = [];
  if (typeFilter !== "all") {
    activeBadges.push({
      key: "type",
      label: `Tipo: ${typeFilter === "product" ? "Produto" : "Serviço"}`,
      clear: () => onTypeFilterChange("all"),
    });
  }
  if (categoryFilter !== "all") {
    const c = categories.find((c) => c.id === categoryFilter);
    activeBadges.push({
      key: "cat",
      label: `Categoria: ${c?.name ?? categoryFilter}`,
      clear: () => onCategoryFilterChange("all"),
    });
  }
  if (sectionFilter !== "all") {
    const s = CATALOG_SECTION_OPTIONS.find((s) => s.id === sectionFilter);
    activeBadges.push({
      key: "sec",
      label: `Seção: ${s?.label ?? sectionFilter}`,
      clear: () => onSectionFilterChange("all"),
    });
  }
  if (statusFilter !== "all") {
    activeBadges.push({
      key: "stat",
      label: `Status: ${statusFilter === "active" ? "Ativos" : "Inativos"}`,
      clear: () => onStatusFilterChange("all"),
    });
  }
  if (advanced.supplierIds.length > 0) {
    const names = advanced.supplierIds
      .map((id) => suppliers.find((s) => s.id === id)?.name)
      .filter(Boolean);
    activeBadges.push({
      key: "sup",
      label: `Fornecedor: ${names.length === 1 ? names[0] : `${names.length} selecionados`}`,
      clear: () => setAdvanced((a) => ({ ...a, supplierIds: [] })),
    });
  }
  if (advanced.priceMin || advanced.priceMax) {
    activeBadges.push({
      key: "price",
      label: `Preço: ${advanced.priceMin || "0"} – ${advanced.priceMax || "∞"}`,
      clear: () => setAdvanced((a) => ({ ...a, priceMin: "", priceMax: "" })),
    });
  }
  if (advanced.leadMin || advanced.leadMax) {
    activeBadges.push({
      key: "lead",
      label: `Lead time: ${advanced.leadMin || "0"} – ${advanced.leadMax || "∞"}d`,
      clear: () => setAdvanced((a) => ({ ...a, leadMin: "", leadMax: "" })),
    });
  }
  if (advanced.onlyAlerts) {
    activeBadges.push({
      key: "alerts",
      label: "Só com alerta",
      clear: () => setAdvanced((a) => ({ ...a, onlyAlerts: false })),
    });
  }

  return (
    <div className="space-y-4 pb-20">
      {/* Search + filters row */}
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Popover open={showSuggest && (search.trim().length > 0)} onOpenChange={setShowSuggest}>
            <PopoverTrigger asChild>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  value={search}
                  onChange={(e) => { onSearchChange(e.target.value); setShowSuggest(true); }}
                  onFocus={() => setShowSuggest(true)}
                  placeholder="Buscar itens, categorias ou fornecedores..."
                  className="pl-9"
                  autoComplete="off"
                />
              </div>
            </PopoverTrigger>
            <PopoverContent
              className="p-0 w-[--radix-popover-trigger-width]"
              align="start"
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <Command shouldFilter={false}>
                <CommandList>
                  {suggestions.items.length === 0 &&
                   suggestions.cats.length === 0 &&
                   suggestions.suppliers.length === 0 ? (
                    <CommandEmpty className="py-3 text-xs">Sem sugestões.</CommandEmpty>
                  ) : null}
                  {suggestions.items.length > 0 && (
                    <CommandGroup heading="Itens">
                      {suggestions.items.map((it) => (
                        <CommandItem
                          key={it.id}
                          onSelect={() => {
                            onEditItem(it);
                            setShowSuggest(false);
                          }}
                        >
                          <Package className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                          {it.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                  {suggestions.cats.length > 0 && (
                    <CommandGroup heading="Categorias">
                      {suggestions.cats.map((c) => (
                        <CommandItem
                          key={c.id}
                          onSelect={() => {
                            onCategoryFilterChange(c.id);
                            onSearchChange("");
                            setShowSuggest(false);
                          }}
                        >
                          <FolderOpen className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                          Filtrar por: {c.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                  {suggestions.suppliers.length > 0 && (
                    <CommandGroup heading="Fornecedores">
                      {suggestions.suppliers.map((s) => (
                        <CommandItem
                          key={s.id}
                          onSelect={() => {
                            setAdvanced((a) => ({ ...a, supplierIds: [s.id] }));
                            onSearchChange("");
                            setShowSuggest(false);
                          }}
                        >
                          <Truck className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                          Filtrar por: {s.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isMobile && (
            <>
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
                <SelectTrigger className="w-40">
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
            </>
          )}
          <Button variant="outline" size="sm" className="h-9" onClick={() => setFiltersOpen(true)}>
            <SlidersHorizontal className="h-3.5 w-3.5 mr-1" />
            Filtros{isMobile ? "" : " avançados"}
          </Button>
        </div>
      </div>

      {/* Active filter badges */}
      {activeBadges.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {activeBadges.map((b) => (
            <Badge
              key={b.key}
              variant="secondary"
              className="gap-1.5 pl-2 pr-1 py-0.5 cursor-pointer"
              onClick={b.clear}
            >
              <span className="text-[11px]">{b.label}</span>
              <X className="h-3 w-3" />
            </Badge>
          ))}
        </div>
      )}

      {/* Results count */}
      {!isLoading && totalCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {filteredItems.length} de {totalCount} {totalCount === 1 ? "item" : "itens"}
          {totalPages > 1 && ` · Página ${page + 1} de ${totalPages}`}
        </p>
      )}

      {/* Table or cards */}
      {isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Carregando...</div>
      ) : filteredItems.length === 0 ? (
        <CatalogEmptyState
          icon={Package}
          title="Nenhum item encontrado"
          description={search || activeBadges.length > 0
            ? "Tente ajustar os filtros de busca."
            : "Comece cadastrando seu primeiro item no catálogo."}
          action={!search && activeBadges.length === 0 ? (
            <Button size="sm" onClick={onNewItem}>
              <Plus className="h-4 w-4 mr-1" /> Novo Item
            </Button>
          ) : undefined}
        />
      ) : isMobile ? (
        <div className="grid gap-2">
          {filteredItems.map((item) => {
            const price = priceMap.get(item.id);
            const result = evaluateCatalogIssues(price ?? null, alertsConfig ?? null);
            const checked = selectedIds.includes(item.id);
            return (
              <div
                key={item.id}
                className={`rounded-lg border border-border p-3 ${!item.is_active ? "opacity-60" : ""}`}
              >
                <div className="flex items-start gap-2">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleOne(item.id)}
                    className="mt-0.5"
                  />
                  <button
                    className="flex-1 min-w-0 text-left"
                    onClick={() => onEditItem(item)}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-sm text-foreground truncate">{item.name}</span>
                      <CatalogItemAlertIcon result={result} />
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                      {(item.catalog_categories as CatalogCategory | null)?.name && (
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                          {(item.catalog_categories as CatalogCategory).name}
                        </Badge>
                      )}
                      <span className="font-mono">{formatBRL(price?.unit_price ?? null)}</span>
                    </div>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label={`Mais ações para ${item.name}`}
                      >
                        <MoreVertical className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEditItem(item)}>
                        <Edit2 className="h-3.5 w-3.5 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggleActive(item)}>
                        {item.is_active ? (
                          <><ToggleLeft className="h-3.5 w-3.5 mr-2" /> Desativar</>
                        ) : (
                          <><ToggleRight className="h-3.5 w-3.5 mr-2" /> Ativar</>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(item.id)}>
                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-10">
                  <Checkbox
                    checked={allOnPage}
                    onCheckedChange={toggleAll}
                    aria-label="Selecionar todos"
                    {...(someOnPage && !allOnPage ? { "data-state": "indeterminate" } : {})}
                  />
                </TableHead>
                <TableHead className="w-24">Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="w-28 text-right">Preço unit.</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead className="w-20">Status</TableHead>
                <TableHead className="w-28 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item) => {
                const price = priceMap.get(item.id);
                const result = evaluateCatalogIssues(price ?? null, alertsConfig ?? null);
                const checked = selectedIds.includes(item.id);
                return (
                  <TableRow key={item.id} className={!item.is_active ? "opacity-50" : ""}>
                    <TableCell>
                      <Checkbox checked={checked} onCheckedChange={() => toggleOne(item.id)} />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {item.internal_code ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-foreground truncate">{item.name}</span>
                          <CatalogItemAlertIcon result={result} />
                        </div>
                        {item.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{item.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatBRL(price?.unit_price ?? null)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {(item.catalog_categories as CatalogCategory | null)?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {(item.suppliers as Supplier | null)?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(item)}
                        className="group flex items-center gap-1.5"
                        aria-label={
                          item.is_active
                            ? `Desativar item ${item.name}`
                            : `Ativar item ${item.name}`
                        }
                        aria-pressed={item.is_active}
                      >
                        {item.is_active ? (
                          <ToggleRight className="h-5 w-5 text-primary group-hover:text-primary/70 transition-colors" aria-hidden="true" />
                        ) : (
                          <ToggleLeft className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" aria-hidden="true" />
                        )}
                        <span className="text-xs">{item.is_active ? "Ativo" : "Inativo"}</span>
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-0.5 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onEditItem(item)}
                          aria-label={`Editar item ${item.name}`}
                        >
                          <Edit2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(item.id)}
                          aria-label={`Excluir item ${item.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => onPageChange(page - 1)}>
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">{page + 1} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => onPageChange(page + 1)}>
            Próxima
          </Button>
        </div>
      )}

      {/* Delete one */}
      <ConfirmDeleteDialog
        open={!!deleteId}
        onOpenChange={(v) => !v && setDeleteId(null)}
        title="Excluir item do catálogo?"
        description="Esta ação não pode ser desfeita. Orçamentos existentes que referenciam este item não serão afetados."
        onConfirm={confirmDeleteItem}
        loading={deleting}
      />

      {/* Bulk actions */}
      <CatalogBulkActionsBar
        selectedIds={selectedIds}
        categories={categories}
        onClear={() => setSelectedIds([])}
        onDone={() => { setSelectedIds([]); onRefresh(); }}
      />

      {/* Advanced filters sheet */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Filtros avançados</SheetTitle>
            <SheetDescription>Refine a busca por fornecedor, preço ou prazo.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-4">
            {isMobile && (
              <>
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <Select value={typeFilter} onValueChange={onTypeFilterChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos tipos</SelectItem>
                      <SelectItem value="product">Produto</SelectItem>
                      <SelectItem value="service">Serviço</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Categoria</Label>
                  <Select value={categoryFilter} onValueChange={onCategoryFilterChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas categorias</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Seção</Label>
                  <Select value={sectionFilter} onValueChange={onSectionFilterChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas seções</SelectItem>
                      {CATALOG_SECTION_OPTIONS.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={statusFilter} onValueChange={onStatusFilterChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="active">Ativos</SelectItem>
                      <SelectItem value="inactive">Inativos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div>
              <Label className="text-xs">Fornecedores</Label>
              <div className="max-h-44 overflow-y-auto border border-border rounded-md p-2 space-y-1">
                {suppliers.filter((s) => s.is_active).map((s) => {
                  const checked = advanced.supplierIds.includes(s.id);
                  return (
                    <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer rounded px-1 py-0.5 hover:bg-muted">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => setAdvanced((a) => ({
                          ...a,
                          supplierIds: checked
                            ? a.supplierIds.filter((x) => x !== s.id)
                            : [...a.supplierIds, s.id],
                        }))}
                      />
                      <span className="truncate">{s.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Preço mín.</Label>
                <Input
                  inputMode="decimal"
                  value={advanced.priceMin}
                  onChange={(e) => setAdvanced((a) => ({ ...a, priceMin: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div>
                <Label className="text-xs">Preço máx.</Label>
                <Input
                  inputMode="decimal"
                  value={advanced.priceMax}
                  onChange={(e) => setAdvanced((a) => ({ ...a, priceMax: e.target.value }))}
                  placeholder="∞"
                />
              </div>
              <div>
                <Label className="text-xs">Lead time mín. (d)</Label>
                <Input
                  inputMode="numeric"
                  value={advanced.leadMin}
                  onChange={(e) => setAdvanced((a) => ({ ...a, leadMin: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div>
                <Label className="text-xs">Lead time máx. (d)</Label>
                <Input
                  inputMode="numeric"
                  value={advanced.leadMax}
                  onChange={(e) => setAdvanced((a) => ({ ...a, leadMax: e.target.value }))}
                  placeholder="∞"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={advanced.onlyAlerts}
                onCheckedChange={(v) => setAdvanced((a) => ({ ...a, onlyAlerts: v === true }))}
              />
              Só com alerta
            </label>
          </div>
          <SheetFooter className="gap-2 sm:gap-2 flex-row">
            <Button variant="outline" className="flex-1" onClick={() => setAdvanced(DEFAULT_ADVANCED)}>
              Limpar
            </Button>
            <Button className="flex-1" onClick={() => setFiltersOpen(false)}>
              Aplicar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
