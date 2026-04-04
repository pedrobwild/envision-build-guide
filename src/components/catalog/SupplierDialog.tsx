import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const CATEGORIAS = [
  "Outros", "Materiais", "Mão de obra", "Equipamentos", "Projetos",
  "Acabamentos", "Elétrica", "Hidráulica", "Marcenaria", "Vidros",
];

export interface Supplier {
  id: string;
  name: string;
  contact_info: string | null;
  is_active: boolean;
  razao_social?: string | null;
  cnpj_cpf?: string | null;
  categoria?: string | null;
  telefone?: string | null;
  email?: string | null;
  site?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  estado?: string | null;
  produtos_servicos?: string | null;
  condicoes_pagamento?: string | null;
  prazo_entrega_dias?: number | null;
  nota?: number | null;
  observacoes?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  supplier?: Supplier | null;
  onSaved: () => void;
}

export function SupplierDialog({ open, onOpenChange, supplier, onSaved }: Props) {
  const [form, setForm] = useState({
    name: "",
    razao_social: "",
    cnpj_cpf: "",
    categoria: "Outros",
    is_active: true,
    telefone: "",
    email: "",
    site: "",
    endereco: "",
    cidade: "",
    estado: "",
    produtos_servicos: "",
    condicoes_pagamento: "",
    prazo_entrega_dias: "",
    nota: "",
    observacoes: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        name: supplier?.name ?? "",
        razao_social: supplier?.razao_social ?? "",
        cnpj_cpf: supplier?.cnpj_cpf ?? "",
        categoria: supplier?.categoria ?? "Outros",
        is_active: supplier?.is_active ?? true,
        telefone: supplier?.telefone ?? "",
        email: supplier?.email ?? "",
        site: supplier?.site ?? "",
        endereco: supplier?.endereco ?? "",
        cidade: supplier?.cidade ?? "",
        estado: supplier?.estado ?? "",
        produtos_servicos: supplier?.produtos_servicos ?? "",
        condicoes_pagamento: supplier?.condicoes_pagamento ?? "",
        prazo_entrega_dias: supplier?.prazo_entrega_dias != null ? String(supplier.prazo_entrega_dias) : "",
        nota: supplier?.nota != null ? String(supplier.nota) : "",
        observacoes: supplier?.observacoes ?? "",
      });
    }
  }, [open, supplier]);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }
    setSaving(true);

    const payload: Record<string, any> = {
      name: form.name.trim(),
      contact_info: form.telefone.trim() || form.email.trim() || null,
      razao_social: form.razao_social.trim() || null,
      cnpj_cpf: form.cnpj_cpf.trim() || null,
      categoria: form.categoria,
      is_active: form.is_active,
      telefone: form.telefone.trim() || null,
      email: form.email.trim() || null,
      site: form.site.trim() || null,
      endereco: form.endereco.trim() || null,
      cidade: form.cidade.trim() || null,
      estado: form.estado.trim() || null,
      produtos_servicos: form.produtos_servicos.trim() || null,
      condicoes_pagamento: form.condicoes_pagamento.trim() || null,
      prazo_entrega_dias: form.prazo_entrega_dias ? Number(form.prazo_entrega_dias) : null,
      nota: form.nota ? Number(form.nota) : null,
      observacoes: form.observacoes.trim() || null,
    };

    const { error } = supplier
      ? await supabase.from("suppliers").update(payload).eq("id", supplier.id)
      : await supabase.from("suppliers").insert(payload);

    setSaving(false);
    if (error) { toast.error("Erro ao salvar fornecedor"); return; }
    toast.success(supplier ? "Fornecedor atualizado" : "Fornecedor cadastrado");
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{supplier ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
          <DialogDescription>Preencha os dados do fornecedor.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Row 1: Nome + Razão Social */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Nome *</Label>
              <Input value={form.name} onChange={set("name")} placeholder="Nome fantasia" />
            </div>
            <div>
              <Label>Razão Social</Label>
              <Input value={form.razao_social} onChange={set("razao_social")} />
            </div>
          </div>

          {/* Row 2: CNPJ/CPF + Categoria + Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label>CNPJ/CPF</Label>
              <Input value={form.cnpj_cpf} onChange={set("cnpj_cpf")} />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={form.categoria} onValueChange={(v) => setForm((p) => ({ ...p, categoria: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={form.is_active ? "ativo" : "inativo"}
                onValueChange={(v) => setForm((p) => ({ ...p, is_active: v === "ativo" }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 3: Telefone + Email + Site */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label>Telefone</Label>
              <Input value={form.telefone} onChange={set("telefone")} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={set("email")} />
            </div>
            <div>
              <Label>Site</Label>
              <Input value={form.site} onChange={set("site")} />
            </div>
          </div>

          {/* Row 4: Endereço + Cidade + Estado */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1">
              <Label>Endereço</Label>
              <Input value={form.endereco} onChange={set("endereco")} />
            </div>
            <div>
              <Label>Cidade</Label>
              <Input value={form.cidade} onChange={set("cidade")} />
            </div>
            <div>
              <Label>Estado</Label>
              <Input value={form.estado} onChange={set("estado")} />
            </div>
          </div>

          {/* Produtos / Serviços */}
          <div>
            <Label>Produtos / Serviços oferecidos</Label>
            <Textarea
              value={form.produtos_servicos}
              onChange={set("produtos_servicos")}
              rows={3}
            />
          </div>

          {/* Row 5: Condições + Prazo + Nota */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label>Condições de Pagamento</Label>
              <Input value={form.condicoes_pagamento} onChange={set("condicoes_pagamento")} placeholder="Ex: 30/60/90 dias" />
            </div>
            <div>
              <Label>Prazo de Entrega (dias)</Label>
              <Input type="number" value={form.prazo_entrega_dias} onChange={set("prazo_entrega_dias")} />
            </div>
            <div>
              <Label>Nota (0 a 5)</Label>
              <Input type="number" min={0} max={5} step={0.5} value={form.nota} onChange={set("nota")} />
            </div>
          </div>

          {/* Observações */}
          <div>
            <Label>Observações</Label>
            <Textarea
              value={form.observacoes}
              onChange={set("observacoes")}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : supplier ? "Salvar" : "Cadastrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
