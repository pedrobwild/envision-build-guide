import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  LayoutTemplate,
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  Loader2,
  ChevronRight,
  Copy,
  FileSpreadsheet,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────

interface Template {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

interface TemplateSection {
  id: string;
  template_id: string;
  title: string;
  subtitle: string | null;
  order_index: number;
  is_optional: boolean;
  notes: string | null;
}

interface TemplateItem {
  id: string;
  template_section_id: string;
  title: string;
  description: string | null;
  unit: string | null;
  qty: number | null;
  order_index: number;
  coverage_type: string;
}

// ─── Data hooks ──────────────────────────────────────────────────

function useTemplates() {
  return useQuery({
    queryKey: ["admin-budget-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budget_templates" as any)
        .select("*")
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as Template[];
    },
  });
}

function useTemplateSections(templateId: string | null) {
  return useQuery({
    queryKey: ["admin-budget-template-sections", templateId],
    enabled: !!templateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budget_template_sections" as any)
        .select("*")
        .eq("template_id", templateId!)
        .order("order_index");
      if (error) throw error;
      return (data ?? []) as unknown as TemplateSection[];
    },
  });
}

function useTemplateItems(sectionId: string | null) {
  return useQuery({
    queryKey: ["admin-budget-template-items", sectionId],
    enabled: !!sectionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budget_template_items" as any)
        .select("*")
        .eq("template_section_id", sectionId!)
        .order("order_index");
      if (error) throw error;
      return (data ?? []) as unknown as TemplateItem[];
    },
  });
}

// ─── Template Dialog ─────────────────────────────────────────────

function TemplateDialog({
  open,
  onOpenChange,
  template,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  template?: Template | null;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [saving, setSaving] = useState(false);

  const isEdit = !!template;

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    setSaving(true);
    const payload = { name: name.trim(), description: description.trim() || null };

    if (isEdit) {
      const { error } = await supabase
        .from("budget_templates" as any)
        .update(payload)
        .eq("id", template!.id);
      if (error) { toast.error("Erro ao atualizar"); setSaving(false); return; }
    } else {
      const { error } = await supabase
        .from("budget_templates" as any)
        .insert(payload);
      if (error) { toast.error("Erro ao criar"); setSaving(false); return; }
    }

    toast.success(isEdit ? "Template atualizado" : "Template criado");
    qc.invalidateQueries({ queryKey: ["admin-budget-templates"] });
    qc.invalidateQueries({ queryKey: ["budget-templates"] });
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">
            {isEdit ? "Editar Template" : "Novo Template"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="font-body text-sm">Nome *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Reforma Completa" />
          </div>
          <div className="space-y-1.5">
            <Label className="font-body text-sm">Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Breve descrição do template" rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Section Dialog ──────────────────────────────────────────────

function SectionDialog({
  open,
  onOpenChange,
  templateId,
  section,
  nextIndex,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  templateId: string;
  section?: TemplateSection | null;
  nextIndex: number;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(section?.title ?? "");
  const [subtitle, setSubtitle] = useState(section?.subtitle ?? "");
  const [isOptional, setIsOptional] = useState(section?.is_optional ?? false);
  const [saving, setSaving] = useState(false);

  const isEdit = !!section;

  const handleSave = async () => {
    if (!title.trim()) { toast.error("Título é obrigatório"); return; }
    setSaving(true);
    const payload = {
      title: title.trim(),
      subtitle: subtitle.trim() || null,
      is_optional: isOptional,
      ...(isEdit ? {} : { template_id: templateId, order_index: nextIndex }),
    };

    if (isEdit) {
      const { error } = await supabase.from("budget_template_sections" as any).update(payload).eq("id", section!.id);
      if (error) { toast.error("Erro ao atualizar seção"); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("budget_template_sections" as any).insert(payload);
      if (error) { toast.error("Erro ao criar seção"); setSaving(false); return; }
    }

    toast.success(isEdit ? "Seção atualizada" : "Seção criada");
    qc.invalidateQueries({ queryKey: ["admin-budget-template-sections", templateId] });
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">{isEdit ? "Editar Seção" : "Nova Seção"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="font-body text-sm">Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Elétrica e Iluminação" />
          </div>
          <div className="space-y-1.5">
            <Label className="font-body text-sm">Subtítulo</Label>
            <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Subtítulo opcional" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isOptional} onCheckedChange={setIsOptional} />
            <Label className="font-body text-sm">Seção opcional</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Item Dialog ─────────────────────────────────────────────────

function ItemDialog({
  open,
  onOpenChange,
  sectionId,
  templateId,
  item,
  nextIndex,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  sectionId: string;
  templateId: string;
  item?: TemplateItem | null;
  nextIndex: number;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(item?.title ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [unit, setUnit] = useState(item?.unit ?? "");
  const [saving, setSaving] = useState(false);

  const isEdit = !!item;

  const handleSave = async () => {
    if (!title.trim()) { toast.error("Título é obrigatório"); return; }
    setSaving(true);
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      unit: unit.trim() || null,
      ...(isEdit ? {} : { template_section_id: sectionId, order_index: nextIndex }),
    };

    if (isEdit) {
      const { error } = await supabase.from("budget_template_items" as any).update(payload).eq("id", item!.id);
      if (error) { toast.error("Erro ao atualizar item"); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("budget_template_items" as any).insert(payload);
      if (error) { toast.error("Erro ao criar item"); setSaving(false); return; }
    }

    toast.success(isEdit ? "Item atualizado" : "Item criado");
    qc.invalidateQueries({ queryKey: ["admin-budget-template-items", sectionId] });
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">{isEdit ? "Editar Item" : "Novo Item"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="font-body text-sm">Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Tomada 2P+T" />
          </div>
          <div className="space-y-1.5">
            <Label className="font-body text-sm">Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição opcional" rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label className="font-body text-sm">Unidade</Label>
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="un, m², m, vb..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Section Items List ──────────────────────────────────────────

function SectionItemsList({ section, templateId }: { section: TemplateSection; templateId: string }) {
  const { data: items = [], isLoading } = useTemplateItems(section.id);
  const qc = useQueryClient();
  const [itemDialog, setItemDialog] = useState<{ open: boolean; item?: TemplateItem | null }>({ open: false });

  const deleteItem = async (id: string) => {
    const { error } = await supabase.from("budget_template_items" as any).delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir item"); return; }
    toast.success("Item excluído");
    qc.invalidateQueries({ queryKey: ["admin-budget-template-items", section.id] });
  };

  return (
    <div className="pl-4 space-y-2">
      {isLoading && <p className="text-xs text-muted-foreground">Carregando itens...</p>}
      {items.map((item, idx) => (
        <div key={item.id} className="flex items-center gap-2 group rounded-md border border-border/50 bg-muted/30 px-3 py-2">
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-body text-foreground truncate">{item.title}</p>
            {item.description && <p className="text-xs text-muted-foreground truncate">{item.description}</p>}
          </div>
          {item.unit && <Badge variant="outline" className="text-[10px] shrink-0">{item.unit}</Badge>}
          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => setItemDialog({ open: true, item })}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => deleteItem(item.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setItemDialog({ open: true, item: null })}>
        <Plus className="h-3.5 w-3.5" /> Adicionar item
      </Button>

      {itemDialog.open && (
        <ItemDialog
          open={itemDialog.open}
          onOpenChange={(o) => setItemDialog({ open: o })}
          sectionId={section.id}
          templateId={templateId}
          item={itemDialog.item}
          nextIndex={items.length}
        />
      )}
    </div>
  );
}

// ─── Template Detail Panel ───────────────────────────────────────

function TemplateDetail({ template }: { template: Template }) {
  const { data: sections = [], isLoading } = useTemplateSections(template.id);
  const qc = useQueryClient();
  const [sectionDialog, setSectionDialog] = useState<{ open: boolean; section?: TemplateSection | null }>({ open: false });

  const deleteSection = async (id: string) => {
    const { error } = await supabase.from("budget_template_sections" as any).delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir seção"); return; }
    toast.success("Seção excluída");
    qc.invalidateQueries({ queryKey: ["admin-budget-template-sections", template.id] });
  };

  return (
    <div className="space-y-4">
      {isLoading && <p className="text-sm text-muted-foreground">Carregando seções...</p>}

      <Accordion type="multiple" className="space-y-2">
        {sections.map((section) => (
          <AccordionItem key={section.id} value={section.id} className="border border-border rounded-lg overflow-hidden">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-2 flex-1 text-left">
                <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                <span className="text-sm font-medium font-body">{section.title}</span>
                {section.is_optional && <Badge variant="secondary" className="text-[10px]">Opcional</Badge>}
                {section.subtitle && <span className="text-xs text-muted-foreground ml-1">— {section.subtitle}</span>}
              </div>
              <div className="flex items-center gap-1 mr-2">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setSectionDialog({ open: true, section }); }}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); deleteSection(section.id); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <SectionItemsList section={section} templateId={template.id} />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setSectionDialog({ open: true, section: null })}>
        <Plus className="h-3.5 w-3.5" /> Adicionar seção
      </Button>

      {sectionDialog.open && (
        <SectionDialog
          open={sectionDialog.open}
          onOpenChange={(o) => setSectionDialog({ open: o })}
          templateId={template.id}
          section={sectionDialog.section}
          nextIndex={sections.length}
        />
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────

export default function BudgetTemplatesPage() {
  const { data: templates = [], isLoading } = useTemplates();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [templateDialog, setTemplateDialog] = useState<{ open: boolean; template?: Template | null }>({ open: false });

  const selectedTemplate = templates.find((t) => t.id === selectedId) ?? null;

  const toggleActive = async (template: Template) => {
    const { error } = await supabase
      .from("budget_templates" as any)
      .update({ is_active: !template.is_active })
      .eq("id", template.id);
    if (error) { toast.error("Erro ao atualizar status"); return; }
    qc.invalidateQueries({ queryKey: ["admin-budget-templates"] });
    qc.invalidateQueries({ queryKey: ["budget-templates"] });
  };

  const deleteTemplate = async (id: string) => {
    const { error } = await supabase.from("budget_templates" as any).delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir template"); return; }
    toast.success("Template excluído");
    if (selectedId === id) setSelectedId(null);
    qc.invalidateQueries({ queryKey: ["admin-budget-templates"] });
    qc.invalidateQueries({ queryKey: ["budget-templates"] });
  };

  const duplicateTemplate = async (template: Template) => {
    // 1. Clone template
    const { data: newTpl, error: tplErr } = await supabase
      .from("budget_templates" as any)
      .insert({ name: `${template.name} (cópia)`, description: template.description })
      .select("id")
      .single();
    if (tplErr || !newTpl) { toast.error("Erro ao duplicar"); return; }
    const newId = (newTpl as any).id;

    // 2. Clone sections
    const { data: sections } = await supabase
      .from("budget_template_sections" as any)
      .select("*")
      .eq("template_id", template.id)
      .order("order_index");

    for (const sec of (sections ?? []) as any[]) {
      const { data: newSec } = await supabase
        .from("budget_template_sections" as any)
        .insert({ template_id: newId, title: sec.title, subtitle: sec.subtitle, order_index: sec.order_index, notes: sec.notes, tags: sec.tags, included_bullets: sec.included_bullets, excluded_bullets: sec.excluded_bullets, is_optional: sec.is_optional })
        .select("id")
        .single();
      if (!newSec) continue;

      // 3. Clone items
      const { data: items } = await supabase
        .from("budget_template_items" as any)
        .select("*")
        .eq("template_section_id", sec.id)
        .order("order_index");

      for (const item of (items ?? []) as any[]) {
        await supabase.from("budget_template_items" as any).insert({
          template_section_id: (newSec as any).id,
          title: item.title,
          description: item.description,
          unit: item.unit,
          qty: item.qty,
          order_index: item.order_index,
          coverage_type: item.coverage_type,
          reference_url: item.reference_url,
        });
      }
    }

    toast.success("Template duplicado");
    qc.invalidateQueries({ queryKey: ["admin-budget-templates"] });
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold font-display text-foreground flex items-center gap-2">
            <LayoutTemplate className="h-5 w-5 text-primary" />
            Templates de Orçamento
          </h1>
          <p className="text-sm text-muted-foreground font-body mt-1">
            Gerencie modelos reutilizáveis de seções e itens
          </p>
        </div>
        <Button onClick={() => setTemplateDialog({ open: true, template: null })} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Template
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* Templates list */}
        <div className="space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {templates.map((t) => (
            <Card
              key={t.id}
              className={`cursor-pointer transition-all hover:border-primary/50 ${selectedId === t.id ? "border-primary ring-1 ring-primary/20" : ""}`}
              onClick={() => setSelectedId(t.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium font-body text-foreground truncate">{t.name}</h3>
                      {!t.is_active && <Badge variant="outline" className="text-[10px] text-muted-foreground">Inativo</Badge>}
                    </div>
                    {t.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>}
                  </div>
                  <ChevronRight className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${selectedId === t.id ? "rotate-90" : ""}`} />
                </div>
                <div className="flex items-center gap-1 mt-3">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setTemplateDialog({ open: true, template: t }); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); duplicateTemplate(t); }}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <div className="flex-1" />
                  <Switch checked={t.is_active} onCheckedChange={() => toggleActive(t)} onClick={(e) => e.stopPropagation()} />
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); deleteTemplate(t.id); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {!isLoading && templates.length === 0 && (
            <div className="text-center py-12">
              <LayoutTemplate className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground font-body">Nenhum template criado</p>
              <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={() => setTemplateDialog({ open: true, template: null })}>
                <Plus className="h-3.5 w-3.5" /> Criar primeiro template
              </Button>
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div>
          {selectedTemplate ? (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-display flex items-center gap-2">
                  <LayoutTemplate className="h-4 w-4 text-primary" />
                  {selectedTemplate.name}
                  {!selectedTemplate.is_active && <Badge variant="outline" className="text-[10px]">Inativo</Badge>}
                </CardTitle>
                {selectedTemplate.description && (
                  <p className="text-sm text-muted-foreground font-body">{selectedTemplate.description}</p>
                )}
              </CardHeader>
              <Separator />
              <CardContent className="pt-4">
                <TemplateDetail template={selectedTemplate} />
              </CardContent>
            </Card>
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground font-body text-sm">
              Selecione um template para ver e editar suas seções
            </div>
          )}
        </div>
      </div>

      {templateDialog.open && (
        <TemplateDialog
          open={templateDialog.open}
          onOpenChange={(o) => setTemplateDialog({ open: o })}
          template={templateDialog.template}
        />
      )}
    </div>
  );
}
