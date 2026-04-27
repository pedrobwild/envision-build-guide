import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Package, Wrench, Sparkles, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { sanitizePostgrestPattern } from "@/lib/postgrest-escape";

interface DuplicateSuggestion {
  id: string;
  name: string;
  item_type: "product" | "service";
  unit_of_measure: string | null;
  similarity: number;
}

/** Normalize string for similarity comparison: lowercase, strip accents, collapse whitespace. */
function normalizeForCompare(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Token-based Jaccard similarity (0..1). Cheap and good enough for short item names. */
function tokenSimilarity(a: string, b: string): number {
  const ta = new Set(normalizeForCompare(a).split(" ").filter((t) => t.length >= 2));
  const tb = new Set(normalizeForCompare(b).split(" ").filter((t) => t.length >= 2));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  ta.forEach((t) => {
    if (tb.has(t)) inter += 1;
  });
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

interface CatalogCategory {
  id: string;
  name: string;
  category_type: string;
  is_active: boolean;
}

interface Supplier {
  id: string;
  name: string;
  is_active: boolean;
}

interface SuggestedItem {
  title: string;
  description: string | null;
  unit: string | null;
  internal_unit_price: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggested: SuggestedItem | null;
  /** Called after a catalog item is created so the editor can attach catalog_item_id to the inserted line. */
  onCreated?: (catalogItemId: string, itemType: "product" | "service") => void;
  /** Optional: pre-select section title to attach the new item to. */
  sectionTitle?: string;
}

const NONE_VALUE = "__none__";

export function AddToCatalogPromptDialog({ open, onOpenChange, suggested, onCreated, sectionTitle }: Props) {
  const queryClient = useQueryClient();
  const [itemType, setItemType] = useState<"product" | "service">("product");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [categoryId, setCategoryId] = useState<string>(NONE_VALUE);
  const [supplierId, setSupplierId] = useState<string>(NONE_VALUE);
  const [saving, setSaving] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateSuggestion[]>([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [duplicatesDismissed, setDuplicatesDismissed] = useState(false);

  // Reset when reopened with new suggested item
  useEffect(() => {
    if (!open || !suggested) return;
    setName(suggested.title || "");
    setUnit(suggested.unit ?? "");
    setUnitPrice(
      suggested.internal_unit_price != null ? String(suggested.internal_unit_price) : ""
    );
    setItemType("product");
    setCategoryId(NONE_VALUE);
    setSupplierId(NONE_VALUE);
    setDuplicates([]);
    setDuplicatesDismissed(false);
  }, [open, suggested]);

  // Debounced duplicate check by name similarity
  useEffect(() => {
    if (!open) return;
    const trimmed = name.trim();
    if (trimmed.length < 3) {
      setDuplicates([]);
      setCheckingDuplicates(false);
      return;
    }

    let cancelled = false;
    setCheckingDuplicates(true);
    const timer = setTimeout(async () => {
      try {
        const normalized = normalizeForCompare(trimmed);
        const tokens = normalized.split(" ").filter((t) => t.length >= 3);
        // Use the longest token as a fast prefilter on search_text
        const seedToken = tokens.sort((a, b) => b.length - a.length)[0] ?? normalized;
        const safe = sanitizePostgrestPattern(seedToken);
        if (!safe) {
          if (!cancelled) {
            setDuplicates([]);
            setCheckingDuplicates(false);
          }
          return;
        }
        const { data, error } = await supabase
          .from("catalog_items")
          .select("id, name, item_type, unit_of_measure")
          .eq("is_active", true)
          .ilike("search_text", `%${safe}%`)
          .limit(20);
        if (cancelled) return;
        if (error) {
          setDuplicates([]);
          setCheckingDuplicates(false);
          return;
        }
        const ranked: DuplicateSuggestion[] = (data ?? [])
          .map((row) => ({
            id: row.id,
            name: row.name,
            item_type: row.item_type as "product" | "service",
            unit_of_measure: row.unit_of_measure,
            similarity: tokenSimilarity(trimmed, row.name),
          }))
          .filter((d) => d.similarity >= 0.5)
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 4);
        setDuplicates(ranked);
        setCheckingDuplicates(false);
      } catch {
        if (!cancelled) {
          setDuplicates([]);
          setCheckingDuplicates(false);
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [name, open]);


  const { data: categories = [] } = useQuery({
    queryKey: ["catalog_categories", "prompt"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalog_categories")
        .select("id, name, category_type, is_active")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as CatalogCategory[];
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers", "prompt"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name, is_active")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Supplier[];
    },
  });

  const filteredCategories = useMemo(() => {
    const expectedType = itemType === "product" ? "Produtos" : "Prestadores";
    return categories.filter((c) => c.category_type === expectedType);
  }, [categories, itemType]);

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Informe um nome para o item");
      return;
    }

    setSaving(true);
    try {
      const insertPayload = {
        name: trimmedName,
        item_type: itemType,
        unit_of_measure: unit.trim() || null,
        category_id: categoryId !== NONE_VALUE ? categoryId : null,
        default_supplier_id: supplierId !== NONE_VALUE ? supplierId : null,
        description: suggested?.description ?? null,
        is_active: true,
      };

      const { data: newItem, error: insertError } = await supabase
        .from("catalog_items")
        .insert(insertPayload)
        .select("id")
        .single();

      if (insertError || !newItem) {
        throw insertError ?? new Error("Falha ao criar item no catálogo");
      }

      // Optional: link to section if provided
      if (sectionTitle) {
        await supabase
          .from("catalog_item_sections")
          .insert({ catalog_item_id: newItem.id, section_title: sectionTitle })
          .then(({ error }) => {
            if (error) logger.warn("Falha ao vincular seção ao novo item de catálogo", error);
          });
      }

      // Optional: register supplier price if provided
      const priceVal = parseFloat(unitPrice.replace(",", "."));
      if (supplierId !== NONE_VALUE && !Number.isNaN(priceVal) && priceVal > 0) {
        await supabase
          .from("catalog_item_supplier_prices")
          .insert({
            catalog_item_id: newItem.id,
            supplier_id: supplierId,
            unit_price: priceVal,
            is_primary: true,
            is_active: true,
          })
          .then(({ error }) => {
            if (error) logger.warn("Falha ao registrar preço do fornecedor", error);
          });
      }

      queryClient.invalidateQueries({ queryKey: ["catalog_items"] });
      toast.success(itemType === "product" ? "Produto adicionado ao catálogo" : "Serviço adicionado ao catálogo");
      onCreated?.(newItem.id, itemType);
      onOpenChange(false);
    } catch (error) {
      logger.error("Erro ao adicionar item ao catálogo", error);
      toast.error("Não foi possível adicionar ao catálogo");
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (saving ? null : onOpenChange(next))}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Adicionar ao catálogo?
          </DialogTitle>
          <DialogDescription>
            Este item ainda não existe no catálogo. Cadastre agora para reutilizar em próximos orçamentos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Tipo: Produto vs Serviço */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Tipo</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setItemType("product")}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-3 py-2.5 text-sm transition-colors text-left",
                  itemType === "product"
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border bg-card hover:bg-muted/40 text-muted-foreground"
                )}
                aria-pressed={itemType === "product"}
              >
                <Package className="h-4 w-4 text-primary" />
                <div>
                  <p className="font-medium leading-tight">Produto</p>
                  <p className="text-[11px] text-muted-foreground">Material, peça, mobiliário</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setItemType("service")}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-3 py-2.5 text-sm transition-colors text-left",
                  itemType === "service"
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border bg-card hover:bg-muted/40 text-muted-foreground"
                )}
                aria-pressed={itemType === "service"}
              >
                <Wrench className="h-4 w-4 text-primary" />
                <div>
                  <p className="font-medium leading-tight">Serviço / Fornecedor</p>
                  <p className="text-[11px] text-muted-foreground">Mão de obra, prestação</p>
                </div>
              </button>
            </div>
          </div>

          {/* Nome */}
          <div className="space-y-1.5">
            <Label htmlFor="catalog-prompt-name" className="text-xs uppercase tracking-wide text-muted-foreground">
              Nome *
            </Label>
            <Input
              id="catalog-prompt-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Tinta acrílica premium"
              autoFocus
            />
            {checkingDuplicates && name.trim().length >= 3 && duplicates.length === 0 && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Verificando se já existe no catálogo…
              </p>
            )}
          </div>

          {/* Aviso de possíveis duplicatas */}
          {duplicates.length > 0 && !duplicatesDismissed && (
            <div
              role="alert"
              className="rounded-md border border-warning/40 bg-warning/10 p-3 space-y-2"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {duplicates.length === 1
                      ? "Já existe um item parecido no catálogo"
                      : `${duplicates.length} itens parecidos no catálogo`}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Verifique se não está duplicando antes de criar um novo.
                  </p>
                </div>
              </div>
              <ul className="space-y-1">
                {duplicates.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center gap-2 rounded-sm bg-background/60 px-2 py-1.5 text-xs"
                  >
                    {d.item_type === "product" ? (
                      <Package className="h-3 w-3 text-primary flex-shrink-0" />
                    ) : (
                      <Wrench className="h-3 w-3 text-primary flex-shrink-0" />
                    )}
                    <span className="font-medium text-foreground truncate flex-1">{d.name}</span>
                    {d.unit_of_measure && (
                      <span className="text-[10px] text-muted-foreground">{d.unit_of_measure}</span>
                    )}
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {Math.round(d.similarity * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-end pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setDuplicatesDismissed(true)}
                >
                  Criar mesmo assim
                </Button>
              </div>
            </div>
          )}

          {/* Unidade + Preço base */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="catalog-prompt-unit" className="text-xs uppercase tracking-wide text-muted-foreground">
                Unidade
              </Label>
              <Input
                id="catalog-prompt-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="un, m², h"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="catalog-prompt-price" className="text-xs uppercase tracking-wide text-muted-foreground">
                Preço base
              </Label>
              <Input
                id="catalog-prompt-price"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="0,00"
                inputMode="decimal"
              />
            </div>
          </div>

          {/* Categoria */}
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Categoria</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Sem categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>Sem categoria</SelectItem>
                {filteredCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filteredCategories.length === 0 && (
              <p className="text-[11px] text-muted-foreground">
                Nenhuma categoria de {itemType === "product" ? "produtos" : "prestadores"} cadastrada ainda.
              </p>
            )}
          </div>

          {/* Fornecedor */}
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Fornecedor (opcional)</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger>
                <SelectValue placeholder="Sem fornecedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>Sem fornecedor</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {supplierId !== NONE_VALUE && (
              <p className="text-[11px] text-muted-foreground">
                O preço base será registrado como principal para este fornecedor.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={handleSkip} disabled={saving}>
            Agora não
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Adicionar ao catálogo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
