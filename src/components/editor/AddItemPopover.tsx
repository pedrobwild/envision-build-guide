import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Plus, Search, Package, Wrench, PenLine, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPrimarySupplierPrice, buildSupplierPriceSnapshot } from "@/lib/catalog-helpers";
import { AddToCatalogPromptDialog } from "./AddToCatalogPromptDialog";

interface CatalogSuggestion {
  id: string;
  name: string;
  description: string | null;
  unit_of_measure: string | null;
  item_type: "product" | "service";
  image_url: string | null;
}

interface AddItemResult {
  title: string;
  description: string | null;
  unit: string | null;
  qty: number | null;
  internal_unit_price: number | null;
  internal_total: number | null;
  catalog_item_id: string | null;
  catalog_snapshot: Record<string, unknown> | null;
}

interface Props {
  sectionTitle: string;
  onAddItem: (item: AddItemResult) => Promise<string | null> | string | null | void;
  /** Called after the catalog prompt creates a catalog item. Lets the editor link the just-inserted budget row. */
  onLinkCatalog?: (insertedRowId: string, catalogItemId: string) => void | Promise<void>;
}

export function AddItemPopover({ sectionTitle, onAddItem, onLinkCatalog }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<CatalogSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptSuggestion, setPromptSuggestion] = useState<{
    title: string;
    description: string | null;
    unit: string | null;
    internal_unit_price: number | null;
  } | null>(null);
  const [manualPrice, setManualPrice] = useState("");
  const [pendingRowId, setPendingRowId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Focus input when popover opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setSearch("");
      setSuggestions([]);
      setManualPrice("");
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!search.trim() || search.length < 2) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        // Get allowed item IDs for this section
        const { data: links } = await supabase
          .from("catalog_item_sections")
          .select("catalog_item_id")
          .eq("section_title", sectionTitle);

        const allowedIds = (links ?? []).map((l) => l.catalog_item_id);

        let query = supabase
          .from("catalog_items")
          .select("id, name, description, unit_of_measure, item_type, image_url")
          .eq("is_active", true)
          .ilike("search_text", `%${search.toLowerCase()}%`)
          .order("name")
          .limit(8);

        // If there are allowed IDs, filter by them; otherwise show all active items
        if (allowedIds.length > 0) {
          query = query.in("id", allowedIds);
        }

        const { data } = await query;
        setSuggestions((data ?? []) as CatalogSuggestion[]);
      } catch {
        setSuggestions([]);
      }
      setLoading(false);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, sectionTitle]);

  const handleSelectCatalogItem = async (item: CatalogSuggestion) => {
    setSelecting(item.id);
    try {
      // Get primary supplier price for snapshot
      const primaryPrice = await getPrimarySupplierPrice(item.id);
      const snapshot = primaryPrice ? buildSupplierPriceSnapshot(primaryPrice) : null;

      onAddItem({
        title: item.name,
        description: item.description,
        unit: item.unit_of_measure,
        qty: 1,
        internal_unit_price: primaryPrice?.unit_price ?? null,
        internal_total: primaryPrice?.unit_price ?? null,
        catalog_item_id: item.id,
        catalog_snapshot: snapshot ? { ...snapshot, item_type: item.item_type, image_url: item.image_url } : { item_type: item.item_type, image_url: item.image_url },
      });
      setOpen(false);
    } catch {
      // Fallback: add without price
      onAddItem({
        title: item.name,
        description: item.description,
        unit: item.unit_of_measure,
        qty: 1,
        internal_unit_price: null,
        internal_total: null,
        catalog_item_id: item.id,
        catalog_snapshot: { item_type: item.item_type, image_url: item.image_url },
      });
      setOpen(false);
    }
    setSelecting(null);
  };

  const handleAddManual = async () => {
    const title = search.trim() || "Novo Item";
    const parsedPrice = parseFloat(manualPrice.replace(",", "."));
    const priceVal = !Number.isNaN(parsedPrice) && parsedPrice > 0 ? parsedPrice : null;

    const insertedId = await Promise.resolve(
      onAddItem({
        title,
        description: null,
        unit: null,
        qty: priceVal != null ? 1 : null,
        internal_unit_price: priceVal,
        internal_total: priceVal,
        catalog_item_id: null,
        catalog_snapshot: null,
      }),
    );
    setPendingRowId(typeof insertedId === "string" ? insertedId : null);
    setOpen(false);

    // Offer to add this manual item to the global catalog for reuse
    setPromptSuggestion({
      title,
      description: null,
      unit: null,
      internal_unit_price: priceVal,
    });
    // Defer to allow popover close animation to settle
    setTimeout(() => setPromptOpen(true), 80);
  };

  return (
    <>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1.5 text-sm font-body text-primary hover:text-primary/80 transition-colors">
          <Plus className="h-3.5 w-3.5" /> Adicionar item
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start" sideOffset={4}>
        {/* Search input */}
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar no catálogo..."
              className="pl-8 h-9 text-sm"
            />
          </div>
        </div>

        {/* Results */}
        <div className="max-h-60 overflow-y-auto">
          {loading && (
            <div className="py-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando...
            </div>
          )}

          {!loading && suggestions.length > 0 && (
            <div className="py-1">
              <p className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Do catálogo
              </p>
              {suggestions.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelectCatalogItem(item)}
                  disabled={selecting === item.id}
                  className={cn(
                    "w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors flex items-start gap-2.5",
                    selecting === item.id && "opacity-50"
                  )}
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {item.item_type === "product" ? (
                      <Package className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <Wrench className="h-3.5 w-3.5 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                    {item.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1">{item.description}</p>
                    )}
                    {item.unit_of_measure && (
                      <span className="text-xs text-muted-foreground">Unidade: {item.unit_of_measure}</span>
                    )}
                  </div>
                  {selecting === item.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground mt-0.5" />}
                </button>
              ))}
            </div>
          )}

          {!loading && search.length >= 2 && suggestions.length === 0 && (
            <div className="py-3 px-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Nenhum item encontrado no catálogo</p>
            </div>
          )}
        </div>

        {/* Manual item option - always visible */}
        <div className="border-t border-border p-2 space-y-2">
          <button
            onClick={handleAddManual}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors text-left"
          >
            <PenLine className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">
                {search.trim() ? `Criar "${search.trim()}"` : "Item manual"}
              </p>
              <p className="text-xs text-muted-foreground">Adicionar item customizado</p>
            </div>
          </button>
          <div className="px-3 pb-1">
            <label
              htmlFor="manual-item-price"
              className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
            >
              Preço unitário (opcional)
            </label>
            <Input
              id="manual-item-price"
              value={manualPrice}
              onChange={(e) => setManualPrice(e.target.value)}
              placeholder="0,00"
              inputMode="decimal"
              className="h-8 text-sm mt-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddManual();
                }
              }}
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Se informar, o preço base poderá ser registrado no catálogo automaticamente.
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
    <AddToCatalogPromptDialog
      open={promptOpen}
      onOpenChange={setPromptOpen}
      suggested={promptSuggestion}
      sectionTitle={sectionTitle}
    />
    </>
  );
}
