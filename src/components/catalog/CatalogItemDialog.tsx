import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { CATALOG_SECTION_OPTIONS, getItemSections, setItemSections } from "@/lib/catalog-helpers";
import { ImagePlus, X, Loader2 } from "lucide-react";

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

export function CatalogItemDialog({ open, onOpenChange, item, categories, suppliers, onSaved }: Props) {
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

  useEffect(() => {
    if (item) {
      setImageUrl(item.image_url ?? null);
      getItemSections(item.id).then((sections) => {
        setSelectedSections(sections);
        setSectionsLoaded(true);
      });
    }
  }, [item]);

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith("image/")) { toast.error("Selecione uma imagem"); return; }
    setUploadingImage(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `catalog/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("budget-assets").upload(path, file, { upsert: true });
      if (error) { toast.error("Erro no upload"); setUploadingImage(false); return; }
      const { data: urlData } = supabase.storage.from("budget-assets").getPublicUrl(path);
      setImageUrl(urlData.publicUrl);
      toast.success("Imagem carregada");
    } catch { toast.error("Erro ao fazer upload"); }
    setUploadingImage(false);
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

    let itemId = item?.id;

    if (item) {
      const { error } = await supabase.from("catalog_items").update(payload).eq("id", item.id);
      if (error) { toast.error("Erro ao salvar item"); setSaving(false); return; }
    } else {
      const { data, error } = await supabase.from("catalog_items").insert(payload).select("id").single();
      if (error) { toast.error("Erro ao salvar item"); setSaving(false); return; }
      itemId = data.id;
    }

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

          {/* Image */}
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
                  onClick={() => setImageUrl(null)}
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

          {/* Section linking */}
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !sectionsLoaded}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
