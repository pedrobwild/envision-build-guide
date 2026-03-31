import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export interface Supplier {
  id: string;
  name: string;
  contact_info: string | null;
  is_active: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  supplier?: Supplier | null;
  onSaved: () => void;
}

export function SupplierDialog({ open, onOpenChange, supplier, onSaved }: Props) {
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
