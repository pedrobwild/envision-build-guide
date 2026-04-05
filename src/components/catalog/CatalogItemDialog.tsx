import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { CATALOG_SECTION_OPTIONS, getItemSections, setItemSections, getSupplierPrices, getPrimarySupplierPrice, type SupplierPrice } from "@/lib/catalog-helpers";
import { ImagePlus, X, Loader2, Plus, Star, StarOff, Edit2, Trash2 } from "lucide-react";

const SUBCATEGORIAS_PRESTADORES = [
  "Marcenaria", "Empreita", "Vidraçaria Box", "Vidraçaria Sacada",
  "Eletricista", "Pintor", "Instalador de Piso", "Técnico Ar-Condicionado",
  "Gesseiro", "Serviços Gerais", "Limpeza", "Pedreiro",
  "Instalador Fechadura Digital", "Cortinas", "Marmoraria", "Jardim Vertical",
];

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
  categoria?: string | null;
}

function normalizeCategoryName(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function mergeCategories(...groups: CatalogCategory[][]) {
  const map = new Map<string, CatalogCategory>();
  groups.flat().forEach((category) => {
    map.set(category.id, category);
  });
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

function getItemTypeFromSupplierCategoria(categoria: string | null): "product" | "service" | null {
  if (!categoria) return null;
  if (SUBCATEGORIAS_PRESTADORES.includes(categoria)) return "service";
  return "product";
}

export interface CatalogItem {
  id: string;
  name: string;
  description: string | null;
  item_type: "product" | "service";
  category_id: string | null;
  unit_of_measure: string | null;
  internal_code: string | null;
  is_active: boolean;
  default_supplier_id: string | null;
  image_url?: string | null;
  catalog_categories?: CatalogCategory | null;
  suppliers?: Supplier | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item?: CatalogItem | null;
  categories: CatalogCategory[];
  suppliers: Supplier[];
  onSaved: () => void;
}

function formatBRL(v: number | null) {
  if (v == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

// ─── Inline price row editor ────────────────────────────────────
function InlinePriceForm({
  price,
  suppliers,
  catalogItemId,
  onSaved,
  onCancel,
}: {
  price?: SupplierPrice | null;
  suppliers: Supplier[];
  catalogItemId: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    supplier_id: price?.supplier_id ?? "",
    supplier_sku: price?.supplier_sku ?? "",
    unit_price: price?.unit_price?.toString() ?? "",
    currency: price?.currency ?? "BRL",
    minimum_order_qty: price?.minimum_order_qty?.toString() ?? "",
    lead_time_days: price?.lead_time_days?.toString() ?? "",
    is_primary: price?.is_primary ?? false,
    is_active: price?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.supplier_id) { toast.error("Selecione um fornecedor"); return; }
    setSaving(true);

    const payload = {
      catalog_item_id: catalogItemId,
      supplier_id: form.supplier_id,
      supplier_sku: form.supplier_sku.trim() || null,
      unit_price: form.unit_price ? parseFloat(form.unit_price) : null,
      currency: form.currency,
      minimum_order_qty: form.minimum_order_qty ? parseFloat(form.minimum_order_qty) : null,
      lead_time_days: form.lead_time_days ? parseInt(form.lead_time_days) : null,
      is_primary: form.is_primary,
      is_active: form.is_active,
    };

    if (form.is_primary) {
      await supabase
        .from("catalog_item_supplier_prices")
        .update({ is_primary: false })
        .eq("catalog_item_id", catalogItemId)
        .neq("id", price?.id ?? "00000000-0000-0000-0000-000000000000");
    }

    const { error } = price
      ? await supabase.from("catalog_item_supplier_prices").update(payload).eq("id", price.id)
      : await supabase.from("catalog_item_supplier_prices").insert(payload);

    setSaving(false);
    if (error) {
      if (error.code === "23505") toast.error("Fornecedor já cadastrado para este item");
      else toast.error("Erro ao salvar");
      return;
    }
    toast.success(price ? "Preço atualizado" : "Fornecedor adicionado");
    onSaved();
  };

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Fornecedor *</Label>
          <Select value={form.supplier_id} onValueChange={(v) => set("supplier_id", v)} disabled={!!price}>
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {suppliers.filter((s) => s.is_active).map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">SKU fornecedor</Label>
          <Input className="h-8 text-sm" value={form.supplier_sku} onChange={(e) => set("supplier_sku", e.target.value)} placeholder="Opcional" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <Label className="text-xs">Preço unit.</Label>
          <Input className="h-8 text-sm" type="number" step="0.01" min="0" value={form.unit_price} onChange={(e) => set("unit_price", e.target.value)} placeholder="0,00" />
        </div>
        <div>
          <Label className="text-xs">Moeda</Label>
          <Select value={form.currency} onValueChange={(v) => set("currency", v)}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="BRL">BRL</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Qtd. mín.</Label>
          <Input className="h-8 text-sm" type="number" min="0" value={form.minimum_order_qty} onChange={(e) => set("minimum_order_qty", e.target.value)} placeholder="—" />
        </div>
        <div>
          <Label className="text-xs">Prazo (dias)</Label>
          <Input className="h-8 text-sm" type="number" min="0" value={form.lead_time_days} onChange={(e) => set("lead_time_days", e.target.value)} placeholder="—" />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex gap-4">
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <Switch checked={form.is_primary} onCheckedChange={(v) => set("is_primary", v)} className="scale-75" />
            Principal
          </label>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <Switch checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} className="scale-75" />
            Ativo
          </label>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel}>Cancelar</Button>
          <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Supplier prices section (inline in dialog) ─────────────────
function SupplierPricesSection({ catalogItemId, suppliers }: { catalogItemId: string; suppliers: Supplier[] }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingPrice, setEditingPrice] = useState<SupplierPrice | null>(null);

  const { data: prices = [], isLoading } = useQuery({
    queryKey: ["catalog_item_supplier_prices", catalogItemId],
    queryFn: () => getSupplierPrices(catalogItemId),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["catalog_item_supplier_prices", catalogItemId] });
    setShowForm(false);
    setEditingPrice(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover fornecedor deste item?")) return;
    const { error } = await supabase.from("catalog_item_supplier_prices").delete().eq("id", id);
    if (error) { toast.error("Erro ao remover"); return; }
    toast.success("Removido");
    refresh();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Fornecedores e Preços</Label>
        {!showForm && !editingPrice && (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setEditingPrice(null); setShowForm(true); }}>
            <Plus className="h-3 w-3 mr-1" /> Adicionar
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground py-2 text-center">Carregando...</p>
      ) : prices.length === 0 && !showForm ? (
        <div className="py-4 text-center border rounded-lg border-dashed border-border">
          <p className="text-xs text-muted-foreground mb-1">Nenhum fornecedor vinculado.</p>
          <Button size="sm" variant="link" className="text-xs h-auto p-0" onClick={() => setShowForm(true)}>
            Adicionar primeiro fornecedor
          </Button>
        </div>
      ) : (
        <>
          {prices.length > 0 && (
            <div className="border rounded-lg border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-6 px-2"></TableHead>
                    <TableHead className="text-xs">Fornecedor</TableHead>
                    <TableHead className="text-xs text-right">Preço unit.</TableHead>
                    <TableHead className="text-xs w-16">Prazo</TableHead>
                    <TableHead className="text-xs w-16">Status</TableHead>
                    <TableHead className="text-xs w-16 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prices.map((p) => (
                    <TableRow key={p.id} className={!p.is_active ? "opacity-50" : ""}>
                      <TableCell className="px-2">
                        {p.is_primary ? (
                          <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                        ) : (
                          <StarOff className="h-3.5 w-3.5 text-muted-foreground/30" />
                        )}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {(p.suppliers as any)?.name ?? "—"}
                        {p.supplier_sku && <span className="text-xs text-muted-foreground ml-1">({p.supplier_sku})</span>}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatBRL(p.unit_price)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {p.lead_time_days ? `${p.lead_time_days}d` : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.is_active ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                          {p.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-0.5 justify-end">
                          <Button variant="ghost" size="icon" className="h-6 w-6"
                            onClick={() => { setShowForm(false); setEditingPrice(p); }}>
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                            onClick={() => handleDelete(p.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {/* Inline form for adding/editing */}
      {(showForm || editingPrice) && (
        <InlinePriceForm
          price={editingPrice}
          suppliers={suppliers}
          catalogItemId={catalogItemId}
          onSaved={refresh}
          onCancel={() => { setShowForm(false); setEditingPrice(null); }}
        />
      )}
    </div>
  );
}

// ─── Main Dialog ────────────────────────────────────────────────
export function CatalogItemDialog({ open, onOpenChange, item, categories, suppliers, onSaved }: Props) {
  const queryClient = useQueryClient();
  const [localCategories, setLocalCategories] = useState<CatalogCategory[]>([]);
  const availableCategories = mergeCategories(categories, localCategories);
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
  const [imageUrl, setImageUrl] = useState<string | null>(item?.image_url ?? null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [sectionsLoaded, setSectionsLoaded] = useState(!item);
  const [saving, setSaving] = useState(false);
  const [savedItemId, setSavedItemId] = useState<string | null>(item?.id ?? null);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);

  const currentItemId = item?.id ?? savedItemId;

  const ensureCategoryForSupplier = useCallback(async (supplierCategoria: string) => {
    const normalizedSupplierCategory = normalizeCategoryName(supplierCategoria);
    const existingCategory = availableCategories.find(
      (category) => normalizeCategoryName(category.name) === normalizedSupplierCategory
    );

    if (existingCategory) {
      set("category_id", existingCategory.id);
      return existingCategory.id;
    }

    const { data, error } = await supabase
      .from("catalog_categories")
      .insert({ name: supplierCategoria.trim() })
      .select("id, name, description, is_active")
      .single();

    if (error) {
      toast.error("Não foi possível vincular a categoria automaticamente");
      return null;
    }

    setLocalCategories((prev) => mergeCategories(prev, [data as CatalogCategory]));
    queryClient.invalidateQueries({ queryKey: ["catalog_categories"] });
    set("category_id", data.id);
    toast.success("Categoria criada automaticamente a partir do fornecedor");
    return data.id;
  }, [availableCategories, queryClient]);

  const handleSupplierChange = useCallback(async (supplierId: string) => {
    set("default_supplier_id", supplierId);

    const supplier = suppliers.find((entry) => entry.id === supplierId);
    if (!supplier?.categoria) return;

    const autoType = getItemTypeFromSupplierCategoria(supplier.categoria);
    if (autoType) set("item_type", autoType);

    await ensureCategoryForSupplier(supplier.categoria);
  }, [suppliers, ensureCategoryForSupplier]);

  const handleCreateCategory = useCallback(async () => {
    const name = newCategoryName.trim();
    if (!name) { toast.error("Nome da categoria é obrigatório"); return; }
    setSavingCategory(true);
    const { data, error } = await supabase
      .from("catalog_categories")
      .insert({ name })
      .select("id, name, description, is_active")
      .single();
    setSavingCategory(false);
    if (error) { toast.error("Erro ao criar categoria"); return; }
    const createdCategory = data as CatalogCategory;
    setLocalCategories((prev) => mergeCategories(prev, [createdCategory]));
    queryClient.invalidateQueries({ queryKey: ["catalog_categories"] });
    toast.success("Categoria criada");
    setCreatingCategory(false);
    setNewCategoryName("");
    set("category_id", createdCategory.id);
    onSaved();
  }, [newCategoryName, onSaved, queryClient]);

  useEffect(() => {
    if (item) {
      setImageUrl(item.image_url ?? null);
      setSavedItemId(item.id);
      getItemSections(item.id).then((sections) => {
        setSelectedSections(sections);
        setSectionsLoaded(true);
      });
    }
  }, [item]);

  useEffect(() => {
    setLocalCategories([]);
    if (form.default_supplier_id) {
      void handleSupplierChange(form.default_supplier_id);
    }
  }, [form.default_supplier_id, handleSupplierChange, open]);

  const persistImageOnExistingItem = async (nextImageUrl: string | null) => {
    const targetId = item?.id ?? savedItemId;
    if (!targetId) return;

    const { error } = await supabase
      .from("catalog_items")
      .update({ image_url: nextImageUrl })
      .eq("id", targetId);

    if (error) throw error;
    onSaved();
  };

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith("image/")) { toast.error("Selecione uma imagem"); return; }

    setUploadingImage(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `catalog/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("media").upload(path, file, { upsert: true });
      if (error) {
        toast.error(error.message || "Erro no upload");
        return;
      }

      const { data: urlData } = supabase.storage.from("media").getPublicUrl(path);
      const nextImageUrl = urlData.publicUrl;
      setImageUrl(nextImageUrl);

      if (currentItemId) {
        await persistImageOnExistingItem(nextImageUrl);
      }

      toast.success("Imagem carregada");
    } catch {
      toast.error("Erro ao fazer upload");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = async () => {
    const previousImageUrl = imageUrl;
    setImageUrl(null);

    if (!currentItemId) return;

    try {
      await persistImageOnExistingItem(null);
      toast.success("Imagem removida");
    } catch {
      setImageUrl(previousImageUrl);
      toast.error("Erro ao remover imagem");
    }
  };

  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const toggleSection = (sectionId: string) => {
    setSelectedSections((prev) =>
      prev.includes(sectionId) ? prev.filter((s) => s !== sectionId) : [...prev, sectionId]
    );
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }
    setSaving(true);

    const payload: Record<string, any> = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      item_type: form.item_type,
      category_id: form.category_id || null,
      unit_of_measure: form.unit_of_measure.trim() || null,
      default_supplier_id: form.default_supplier_id || null,
      is_active: form.is_active,
      image_url: imageUrl,
    };

    const isUpdate = Boolean(currentItemId);
    let itemId = currentItemId;

    if (isUpdate && itemId) {
      const { error } = await supabase.from("catalog_items").update(payload).eq("id", itemId);
      if (error) { toast.error("Erro ao salvar item"); setSaving(false); return; }
    } else {
      const { data, error } = await supabase.from("catalog_items").insert(payload).select("id").single();
      if (error) { toast.error("Erro ao salvar item"); setSaving(false); return; }
      itemId = data.id;
      setSavedItemId(data.id);
    }

    try {
      await setItemSections(itemId!, selectedSections);
    } catch {
      toast.error("Item salvo, mas erro ao vincular seções");
    }

    setSaving(false);
    toast.success(isUpdate ? "Item atualizado" : "Item criado");
    onSaved();

    if (item) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? "Editar Item" : savedItemId ? "Novo Item — Continue Editando" : "Novo Item do Catálogo"}</DialogTitle>
          <DialogDescription>Preencha os dados do item e configure fornecedores e preços.</DialogDescription>
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
              {creatingCategory ? (
                <div className="flex gap-1.5">
                  <Input
                    autoFocus
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Nome da categoria"
                    className="h-9 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateCategory();
                      if (e.key === "Escape") { setCreatingCategory(false); setNewCategoryName(""); }
                    }}
                  />
                  <Button size="sm" className="h-9 px-2.5" onClick={handleCreateCategory} disabled={savingCategory}>
                    {savingCategory ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-9 px-2" onClick={() => { setCreatingCategory(false); setNewCategoryName(""); }}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-1.5">
                  <Select value={form.category_id} onValueChange={(v) => set("category_id", v)}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {availableCategories.filter((c) => c.is_active).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" className="h-9 px-2.5 shrink-0" onClick={() => setCreatingCategory(true)} title="Criar nova categoria">
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
            <div>
              <Label>Unidade</Label>
              <Input value={form.unit_of_measure} onChange={(e) => set("unit_of_measure", e.target.value)} placeholder="m², un, vb..." />
            </div>
            <div>
              <Label>Código</Label>
              <Input
                value={item ? (item.internal_code ?? "—") : savedItemId ? "Gerado ao criar" : "Automático"}
                readOnly
                disabled
                className="font-mono bg-muted/50"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Fornecedor principal</Label>
              <Select value={form.default_supplier_id} onValueChange={(value) => { void handleSupplierChange(value); }}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  {suppliers.filter((s) => s.is_active).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

          <div>
            <Label className="mb-2 block">Imagem do item</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Esta imagem será exibida automaticamente no orçamento público ao selecionar este item.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleImageUpload(e.target.files)}
            />
            {imageUrl ? (
              <div className="relative inline-block">
                <img src={imageUrl} alt="Preview" className="h-24 w-24 object-cover rounded-lg border border-border" />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5 hover:opacity-80"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="flex items-center gap-2 px-4 py-3 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                {uploadingImage ? "Enviando..." : "Adicionar imagem"}
              </button>
            )}
          </div>

          <div>
            <Label className="mb-2 block">Seções permitidas do orçamento</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Selecione em quais seções este item pode ser inserido no orçamento.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {CATALOG_SECTION_OPTIONS.map((section) => (
                <label key={section.id} className="flex items-center gap-2 text-sm cursor-pointer rounded-md border border-border px-3 py-2 hover:bg-muted/50 transition-colors">
                  <Checkbox
                    checked={selectedSections.includes(section.id)}
                    onCheckedChange={() => toggleSection(section.id)}
                  />
                  {section.label}
                </label>
              ))}
            </div>
          </div>

          {savedItemId && (
            <>
              <div className="border-t border-border" />
              <SupplierPricesSection catalogItemId={savedItemId} suppliers={suppliers} />
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {savedItemId || item ? "Fechar" : "Cancelar"}
          </Button>
          <Button onClick={handleSave} disabled={saving || uploadingImage || !sectionsLoaded}>
            {saving ? "Salvando..." : currentItemId ? "Salvar alterações" : "Criar item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
