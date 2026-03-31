import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import {
  Search, Plus, Package, Wrench, Edit2, Trash2, Building2, FolderOpen, Filter, DollarSign, ChevronDown,
} from "lucide-react";
import { SupplierPricesPanel } from "@/components/catalog/SupplierPricesPanel";
import { CATALOG_SECTION_OPTIONS, getItemSections, setItemSections } from "@/lib/catalog-helpers";
import { Checkbox } from "@/components/ui/checkbox";

// ─── Types ────────────────────────────────────────────────────────
interface CatalogCategory {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

interface Supplier {
  id: string;
  name: string;
  contact_info: string | null;
  is_active: boolean;
}

interface CatalogItem {
  id: string;
  name: string;
  description: string | null;
  item_type: "product" | "service";
  category_id: string | null;
  unit_of_measure: string | null;
  internal_code: string | null;
  is_active: boolean;
  default_supplier_id: string | null;
  catalog_categories?: CatalogCategory | null;
  suppliers?: Supplier | null;
}

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

function useCatalogItems(search: string, typeFilter: string, categoryFilter: string) {
  return useQuery({
    queryKey: ["catalog_items", search, typeFilter, categoryFilter],
    queryFn: async () => {
      let query = supabase
        .from("catalog_items")
        .select("*, catalog_categories(*), suppliers:default_supplier_id(*)")
        .order("name");

      if (search) {
        query = query.ilike("search_text", `%${search.toLowerCase()}%`);
      }
      if (typeFilter && typeFilter !== "all") {
        query = query.eq("item_type", typeFilter as "product" | "service");
      }
      if (categoryFilter && categoryFilter !== "all") {
        query = query.eq("category_id", categoryFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CatalogItem[];
    },
  });
}

// ─── Category Dialog ──────────────────────────────────────────────
function CategoryDialog({
  open, onOpenChange, category, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  category?: CatalogCategory | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Nome é obrigatório"); return; }
    setSaving(true);
    const payload = { name: name.trim(), description: description.trim() || null };

    const { error } = category
      ? await supabase.from("catalog_categories").update(payload).eq("id", category.id)
      : await supabase.from("catalog_categories").insert(payload);

    setSaving(false);
    if (error) { toast.error("Erro ao salvar categoria"); return; }
    toast.success(category ? "Categoria atualizada" : "Categoria criada");
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{category ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
          <DialogDescription>Preencha os dados da categoria do catálogo.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Pintura" />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opcional" rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Supplier Dialog ──────────────────────────────────────────────
function SupplierDialog({
  open, onOpenChange, supplier, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  supplier?: Supplier | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState(supplier?.name ?? "");
  const [contactInfo, setContactInfo] = useState(supplier?.contact_info ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Nome é obrigatório"); return; }
    setSaving(true);
    const payload = { name: name.trim(), contact_info: contactInfo.trim() || null };

    const { error } = supplier
      ? await supabase.from("suppliers").update(payload).eq("id", supplier.id)
      : await supabase.from("suppliers").insert(payload);

    setSaving(false);
    if (error) { toast.error("Erro ao salvar fornecedor"); return; }
    toast.success(supplier ? "Fornecedor atualizado" : "Fornecedor criado");
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{supplier ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
          <DialogDescription>Preencha os dados do fornecedor.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Tintas São Paulo" />
          </div>
          <div>
            <Label>Contato</Label>
            <Textarea value={contactInfo} onChange={(e) => setContactInfo(e.target.value)} placeholder="Telefone, email, etc." rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Item Dialog ──────────────────────────────────────────────────
function ItemDialog({
  open, onOpenChange, item, categories, suppliers, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item?: CatalogItem | null;
  categories: CatalogCategory[];
  suppliers: Supplier[];
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: item?.name ?? "",
    description: item?.description ?? "",
    item_type: item?.item_type ?? "product" as "product" | "service",
    category_id: item?.category_id ?? "",
    unit_of_measure: item?.unit_of_measure ?? "",
    internal_code: item?.internal_code ?? "",
    default_supplier_id: item?.default_supplier_id ?? "",
    is_active: item?.is_active ?? true,
  });
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [sectionsLoaded, setSectionsLoaded] = useState(!item);
  const [saving, setSaving] = useState(false);

  // Load existing sections for edit mode
  useState(() => {
    if (item) {
      getItemSections(item.id).then((sections) => {
        setSelectedSections(sections);
        setSectionsLoaded(true);
      });
    }
  });

  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const toggleSection = (sectionId: string) => {
    setSelectedSections((prev) =>
      prev.includes(sectionId) ? prev.filter((s) => s !== sectionId) : [...prev, sectionId]
    );
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }
    setSaving(true);

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      item_type: form.item_type,
      category_id: form.category_id || null,
      unit_of_measure: form.unit_of_measure.trim() || null,
      internal_code: form.internal_code.trim() || null,
      default_supplier_id: form.default_supplier_id || null,
      is_active: form.is_active,
    };

    let itemId = item?.id;

    if (item) {
      const { error } = await supabase.from("catalog_items").update(payload).eq("id", item.id);
      if (error) { toast.error("Erro ao salvar item"); setSaving(false); return; }
    } else {
      const { data, error } = await supabase.from("catalog_items").insert(payload).select("id").single();
      if (error) { toast.error("Erro ao salvar item"); setSaving(false); return; }
      itemId = data.id;
    }

    // Save section links
    try {
      await setItemSections(itemId!, selectedSections);
    } catch {
      toast.error("Item salvo, mas erro ao vincular seções");
    }

    setSaving(false);
    toast.success(item ? "Item atualizado" : "Item criado");
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? "Editar Item" : "Novo Item do Catálogo"}</DialogTitle>
          <DialogDescription>Preencha os dados do item de produto ou serviço.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex: Tinta Acrílica Premium" />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.item_type} onValueChange={(v) => set("item_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="product">Produto</SelectItem>
                  <SelectItem value="service">Serviço</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} placeholder="Detalhes do item" />
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <Label>Categoria</Label>
              <Select value={form.category_id} onValueChange={(v) => set("category_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {categories.filter((c) => c.is_active).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Unidade</Label>
              <Input value={form.unit_of_measure} onChange={(e) => set("unit_of_measure", e.target.value)} placeholder="m², un, vb..." />
            </div>
            <div>
              <Label>Código interno</Label>
              <Input value={form.internal_code} onChange={(e) => set("internal_code", e.target.value)} placeholder="Opcional" />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Fornecedor principal</Label>
              <Select value={form.default_supplier_id} onValueChange={(v) => set("default_supplier_id", v)}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  {suppliers.filter((s) => s.is_active).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-3 pb-1">
              <Switch checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} id="item-active" />
              <Label htmlFor="item-active" className="cursor-pointer">Ativo</Label>
            </div>
          </div>

          {/* Section linking */}
          <div>
            <Label className="mb-2 block">Seções permitidas do orçamento</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Selecione em quais seções este item pode ser inserido no orçamento.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {CATALOG_SECTION_OPTIONS.map((section) => (
                <label key={section.id} className="flex items-center gap-2 text-sm cursor-pointer rounded-md border px-3 py-2 hover:bg-muted/50 transition-colors">
                  <Checkbox
                    checked={selectedSections.includes(section.id)}
                    onCheckedChange={() => toggleSection(section.id)}
                  />
                  {section.label}
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !sectionsLoaded}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Empty State ──────────────────────────────────────────────────
function EmptyState({ icon: Icon, title, description, action }: {
  icon: React.ElementType; title: string; description: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      <p className="text-xs text-muted-foreground max-w-xs">{description}</p>
      {action}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────
export default function CatalogPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [expandedPricesItemId, setExpandedPricesItemId] = useState<string | null>(null);

  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CatalogCategory | null>(null);

  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const { data: categories = [] } = useCategories();
  const { data: suppliers = [] } = useSuppliers();
  const { data: items = [], isLoading } = useCatalogItems(search, typeFilter, categoryFilter);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["catalog_items"] });
    queryClient.invalidateQueries({ queryKey: ["catalog_categories"] });
    queryClient.invalidateQueries({ queryKey: ["suppliers"] });
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm("Excluir item do catálogo?")) return;
    const { error } = await supabase.from("catalog_items").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Item excluído");
    invalidateAll();
  };

  return (
    <div className="space-y-6">
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

      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items">Itens ({items.length})</TabsTrigger>
          <TabsTrigger value="categories">Categorias ({categories.length})</TabsTrigger>
          <TabsTrigger value="suppliers">Fornecedores ({suppliers.length})</TabsTrigger>
        </TabsList>

        {/* ── Items Tab ─────────────────────────────── */}
        <TabsContent value="items" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, descrição ou código..."
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40">
                <Filter className="h-4 w-4 mr-1" />
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="product">Produto</SelectItem>
                <SelectItem value="service">Serviço</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Nenhum item encontrado"
              description={search ? "Tente ajustar os filtros de busca." : "Comece cadastrando seu primeiro item no catálogo."}
              action={!search ? <Button size="sm" onClick={() => { setEditingItem(null); setItemDialogOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Novo Item</Button> : undefined}
            />
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead className="w-24">Tipo</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead className="w-20">Status</TableHead>
                    <TableHead className="w-20 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <>
                      <TableRow key={item.id} className={!item.is_active ? "opacity-50" : ""}>
                        <TableCell>
                          <div>
                            <span className="font-medium text-foreground">{item.name}</span>
                            {item.internal_code && (
                              <span className="ml-2 text-xs text-muted-foreground">#{item.internal_code}</span>
                            )}
                            {item.description && (
                              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{item.description}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
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
                          <Badge variant={item.is_active ? "default" : "secondary"} className="text-xs">
                            {item.is_active ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="icon" className="h-8 w-8"
                              onClick={() => setExpandedPricesItemId(expandedPricesItemId === item.id ? null : item.id)}
                              title="Preços por fornecedor">
                              <DollarSign className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8"
                              onClick={() => { setEditingItem(item); setItemDialogOpen(true); }}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                              onClick={() => handleDeleteItem(item.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {expandedPricesItemId === item.id && (
                        <TableRow key={`${item.id}-prices`}>
                          <TableCell colSpan={7} className="bg-muted/30 p-4">
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
        </TabsContent>

        {/* ── Categories Tab ────────────────────────── */}
        <TabsContent value="categories" className="space-y-4">
          {categories.length === 0 ? (
            <EmptyState
              icon={FolderOpen}
              title="Nenhuma categoria"
              description="Crie categorias para organizar os itens do catálogo."
              action={<Button size="sm" onClick={() => { setEditingCategory(null); setCategoryDialogOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Nova Categoria</Button>}
            />
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="w-20">Status</TableHead>
                    <TableHead className="w-20 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((cat) => (
                    <TableRow key={cat.id}>
                      <TableCell className="font-medium">{cat.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{cat.description ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={cat.is_active ? "default" : "secondary"} className="text-xs">
                          {cat.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8"
                          onClick={() => { setEditingCategory(cat); setCategoryDialogOpen(true); }}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ── Suppliers Tab ─────────────────────────── */}
        <TabsContent value="suppliers" className="space-y-4">
          {suppliers.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="Nenhum fornecedor"
              description="Cadastre fornecedores para vincular aos itens do catálogo."
              action={<Button size="sm" onClick={() => { setEditingSupplier(null); setSupplierDialogOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Novo Fornecedor</Button>}
            />
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead className="w-20">Status</TableHead>
                    <TableHead className="w-20 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map((sup) => (
                    <TableRow key={sup.id}>
                      <TableCell className="font-medium">{sup.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{sup.contact_info ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={sup.is_active ? "default" : "secondary"} className="text-xs">
                          {sup.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8"
                          onClick={() => { setEditingSupplier(sup); setSupplierDialogOpen(true); }}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {itemDialogOpen && (
        <ItemDialog
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
