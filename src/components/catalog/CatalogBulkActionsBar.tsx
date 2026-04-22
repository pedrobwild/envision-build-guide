import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { X, FolderOpen, Ruler, ToggleRight, ToggleLeft, Trash2 } from "lucide-react";
import type { CatalogCategory } from "@/components/catalog/CategoryDialog";

interface Props {
  selectedIds: string[];
  categories: CatalogCategory[];
  onClear: () => void;
  onDone: () => void;
}

const COMMON_UNITS = ["un", "m²", "m", "ml", "kg", "h", "vb", "pç", "cx", "L"];

export function CatalogBulkActionsBar({ selectedIds, categories, onClear, onDone }: Props) {
  const [openAction, setOpenAction] = useState<"category" | "unit" | "delete" | null>(null);
  const [pendingCategory, setPendingCategory] = useState<string>("");
  const [pendingUnit, setPendingUnit] = useState<string>("");
  const [confirmText, setConfirmText] = useState("");
  const [working, setWorking] = useState(false);

  const count = selectedIds.length;
  if (count === 0) return null;

  const expectedConfirm = `DELETE ${count}`;

  const finish = (msg: string) => {
    toast.success(msg);
    setOpenAction(null);
    setPendingCategory("");
    setPendingUnit("");
    setConfirmText("");
    onDone();
  };

  const applyCategory = async () => {
    if (!pendingCategory) return;
    setWorking(true);
    const { error } = await supabase
      .from("catalog_items")
      .update({ category_id: pendingCategory })
      .in("id", selectedIds);
    setWorking(false);
    if (error) return toast.error("Erro ao atualizar categoria");
    finish(`${count} ${count === 1 ? "item atualizado" : "itens atualizados"}`);
  };

  const applyUnit = async () => {
    if (!pendingUnit) return;
    setWorking(true);
    const { error } = await supabase
      .from("catalog_items")
      .update({ unit_of_measure: pendingUnit })
      .in("id", selectedIds);
    setWorking(false);
    if (error) return toast.error("Erro ao atualizar unidade");
    finish(`${count} ${count === 1 ? "item atualizado" : "itens atualizados"}`);
  };

  const setActive = async (active: boolean) => {
    setWorking(true);
    const { error } = await supabase
      .from("catalog_items")
      .update({ is_active: active })
      .in("id", selectedIds);
    setWorking(false);
    if (error) return toast.error("Erro ao atualizar status");
    finish(`${count} ${count === 1 ? "item" : "itens"} ${active ? "ativado(s)" : "desativado(s)"}`);
  };

  const applyDelete = async () => {
    if (confirmText.trim() !== expectedConfirm) return;
    setWorking(true);
    const { error } = await supabase.from("catalog_items").delete().in("id", selectedIds);
    setWorking(false);
    if (error) return toast.error("Erro ao excluir");
    finish(`${count} ${count === 1 ? "item excluído" : "itens excluídos"}`);
  };

  return (
    <>
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[min(94vw,42rem)]">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background/95 backdrop-blur-sm shadow-xl px-3 py-2">
          <span className="text-sm font-medium text-foreground">
            {count} {count === 1 ? "item selecionado" : "itens selecionados"}
          </span>
          <div className="h-4 w-px bg-border" />
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setOpenAction("category")}>
            <FolderOpen className="h-3.5 w-3.5 mr-1" /> Mudar categoria
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setOpenAction("unit")}>
            <Ruler className="h-3.5 w-3.5 mr-1" /> Mudar unidade
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setActive(true)} disabled={working}>
            <ToggleRight className="h-3.5 w-3.5 mr-1" /> Ativar
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setActive(false)} disabled={working}>
            <ToggleLeft className="h-3.5 w-3.5 mr-1" /> Inativar
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs text-destructive hover:text-destructive" onClick={() => setOpenAction("delete")}>
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
          </Button>
          <div className="ml-auto">
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={onClear}>
              <X className="h-3.5 w-3.5 mr-1" /> Limpar
            </Button>
          </div>
        </div>
      </div>

      {/* Category dialog */}
      <Dialog open={openAction === "category"} onOpenChange={(v) => !v && setOpenAction(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Mudar categoria de {count} {count === 1 ? "item" : "itens"}</DialogTitle>
            <DialogDescription>A categoria será aplicada a todos os itens selecionados.</DialogDescription>
          </DialogHeader>
          <div>
            <Label className="text-sm">Nova categoria</Label>
            <Select value={pendingCategory} onValueChange={setPendingCategory}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {categories.filter((c) => c.is_active).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenAction(null)}>Cancelar</Button>
            <Button onClick={applyCategory} disabled={!pendingCategory || working}>
              {working ? "Aplicando..." : "Aplicar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unit dialog */}
      <Dialog open={openAction === "unit"} onOpenChange={(v) => !v && setOpenAction(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Mudar unidade de {count} {count === 1 ? "item" : "itens"}</DialogTitle>
            <DialogDescription>Escolha uma unidade ou digite uma personalizada.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {COMMON_UNITS.map((u) => (
                <Button
                  key={u}
                  size="sm"
                  variant={pendingUnit === u ? "default" : "outline"}
                  className="h-7 text-xs"
                  onClick={() => setPendingUnit(u)}
                >
                  {u}
                </Button>
              ))}
            </div>
            <Input
              placeholder="Outra unidade..."
              value={pendingUnit}
              onChange={(e) => setPendingUnit(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenAction(null)}>Cancelar</Button>
            <Button onClick={applyUnit} disabled={!pendingUnit.trim() || working}>
              {working ? "Aplicando..." : "Aplicar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={openAction === "delete"} onOpenChange={(v) => !v && setOpenAction(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive">Excluir {count} {count === 1 ? "item" : "itens"}?</DialogTitle>
            <DialogDescription>
              Esta ação não pode ser desfeita. Para confirmar, digite{" "}
              <code className="font-mono bg-muted px-1.5 py-0.5 rounded">{expectedConfirm}</code>.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={expectedConfirm}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenAction(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={applyDelete}
              disabled={confirmText.trim() !== expectedConfirm || working}
            >
              {working ? "Excluindo..." : "Excluir definitivamente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
