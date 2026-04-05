import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getSupplierPrices, type SupplierPrice } from "@/lib/catalog-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Star, StarOff, Edit2, Trash2 } from "lucide-react";

interface Supplier {
  id: string;
  name: string;
  is_active: boolean;
}

interface Props {
  catalogItemId: string;
  catalogItemName: string;
  suppliers: Supplier[];
}

function formatBRL(v: number | null) {
  if (v == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function PriceDialog({
  open, onOpenChange, price, catalogItemId, suppliers, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  price?: SupplierPrice | null;
  catalogItemId: string;
  suppliers: Supplier[];
  onSaved: () => void;
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

    // If setting as primary, unset others first
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
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{price ? "Editar Preço" : "Adicionar Fornecedor"}</DialogTitle>
          <DialogDescription>Configure preço e condições do fornecedor para este item.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div>
            <Label>Fornecedor *</Label>
            <Select value={form.supplier_id} onValueChange={(v) => set("supplier_id", v)} disabled={!!price}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {suppliers.filter((s) => s.is_active).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <Label>Preço unitário</Label>
              <Input type="number" step="0.01" min="0" value={form.unit_price} onChange={(e) => set("unit_price", e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <Label>Moeda</Label>
              <Select value={form.currency} onValueChange={(v) => set("currency", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">BRL</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>SKU fornecedor</Label>
              <Input value={form.supplier_sku} onChange={(e) => set("supplier_sku", e.target.value)} placeholder="Opcional" />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Qtd. mínima pedido</Label>
              <Input type="number" min="0" value={form.minimum_order_qty} onChange={(e) => set("minimum_order_qty", e.target.value)} placeholder="Opcional" />
            </div>
            <div>
              <Label>Prazo entrega (dias)</Label>
              <Input type="number" min="0" value={form.lead_time_days} onChange={(e) => set("lead_time_days", e.target.value)} placeholder="Opcional" />
            </div>
          </div>

          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <Switch checked={form.is_primary} onCheckedChange={(v) => set("is_primary", v)} id="sp-primary" />
              <Label htmlFor="sp-primary" className="cursor-pointer">Fornecedor principal</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} id="sp-active" />
              <Label htmlFor="sp-active" className="cursor-pointer">Ativo</Label>
            </div>
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

export function SupplierPricesPanel({ catalogItemId, catalogItemName, suppliers }: Props) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPrice, setEditingPrice] = useState<SupplierPrice | null>(null);

  const { data: prices = [], isLoading } = useQuery({
    queryKey: ["catalog_item_supplier_prices", catalogItemId],
    queryFn: () => getSupplierPrices(catalogItemId),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["catalog_item_supplier_prices", catalogItemId] });

  const handleDelete = async (id: string) => {
    if (!confirm("Remover fornecedor deste item?")) return;
    const { error } = await supabase.from("catalog_item_supplier_prices").delete().eq("id", id);
    if (error) { toast.error("Erro ao remover"); return; }
    toast.success("Removido");
    refresh();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">
          Fornecedores e Preços — <span className="text-muted-foreground">{catalogItemName}</span>
        </h3>
        <Button size="sm" variant="outline" onClick={() => { setEditingPrice(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Carregando...</p>
      ) : prices.length === 0 ? (
        <div className="py-6 text-center border rounded-lg border-dashed">
          <p className="text-sm text-muted-foreground">Nenhum fornecedor vinculado.</p>
          <Button size="sm" variant="link" onClick={() => { setEditingPrice(null); setDialogOpen(true); }}>
            Adicionar primeiro fornecedor
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Preço unit.</TableHead>
                <TableHead>Moeda</TableHead>
                <TableHead>Qtd. mín.</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead className="w-16">Status</TableHead>
                <TableHead className="w-20 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prices.map((p) => (
                <TableRow key={p.id} className={!p.is_active ? "opacity-50" : ""}>
                  <TableCell>
                    {p.is_primary ? (
                      <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                    ) : (
                      <StarOff className="h-4 w-4 text-muted-foreground/30" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {(p.suppliers as { name?: string } | null)?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.supplier_sku ?? "—"}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{formatBRL(p.unit_price)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.currency}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.minimum_order_qty ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p.lead_time_days ? `${p.lead_time_days}d` : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.is_active ? "default" : "secondary"} className="text-xs">
                      {p.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => { setEditingPrice(p); setDialogOpen(true); }}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                        onClick={() => handleDelete(p.id)}>
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

      {dialogOpen && (
        <PriceDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          price={editingPrice}
          catalogItemId={catalogItemId}
          suppliers={suppliers}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
