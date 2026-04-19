import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Building2,
  MapPin,
  Plus,
  Pencil,
  Trash2,
  Star,
  StarOff,
  FileText,
  Upload,
  Loader2,
  Home,
  Ruler,
} from "lucide-react";
import {
  useClientProperties,
  useUpsertClientProperty,
  useDeleteClientProperty,
  useSetPrimaryProperty,
  summarizeProperty,
  type ClientProperty,
} from "@/hooks/useClientProperties";
import { LOCATION_TYPES } from "@/lib/role-constants";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const BR_STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

const PROPERTY_TYPES = [
  { value: "apartamento", label: "Apartamento" },
  { value: "casa", label: "Casa" },
  { value: "cobertura", label: "Cobertura" },
  { value: "studio", label: "Studio / Kitnet" },
  { value: "comercial", label: "Espaço Comercial" },
  { value: "outro", label: "Outro" },
];

interface DraftProperty {
  id?: string;
  label: string;
  empreendimento: string;
  address: string;
  address_complement: string;
  bairro: string;
  city: string;
  state: string;
  zip_code: string;
  metragem: string;
  property_type: string;
  location_type: string;
  floor_plan_url: string;
  notes: string;
}

const EMPTY_DRAFT: DraftProperty = {
  label: "",
  empreendimento: "",
  address: "",
  address_complement: "",
  bairro: "",
  city: "",
  state: "",
  zip_code: "",
  metragem: "",
  property_type: "",
  location_type: "",
  floor_plan_url: "",
  notes: "",
};

function toDraft(p: ClientProperty): DraftProperty {
  return {
    id: p.id,
    label: p.label ?? "",
    empreendimento: p.empreendimento ?? "",
    address: p.address ?? "",
    address_complement: p.address_complement ?? "",
    bairro: p.bairro ?? "",
    city: p.city ?? "",
    state: p.state ?? "",
    zip_code: p.zip_code ?? "",
    metragem: p.metragem ?? "",
    property_type: p.property_type ?? "",
    location_type: p.location_type ?? "",
    floor_plan_url: p.floor_plan_url ?? "",
    notes: p.notes ?? "",
  };
}

export function ClientPropertiesManager({
  clientId,
  budgetCountByProperty,
}: {
  clientId: string;
  budgetCountByProperty?: Record<string, number>;
}) {
  const { data: properties = [], isLoading } = useClientProperties(clientId);
  const upsert = useUpsertClientProperty();
  const del = useDeleteClientProperty();
  const setPrimary = useSetPrimaryProperty();

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DraftProperty>(EMPTY_DRAFT);
  const [confirmDelete, setConfirmDelete] = useState<ClientProperty | null>(null);
  const [uploadingPlan, setUploadingPlan] = useState(false);
  const planInputRef = useRef<HTMLInputElement>(null);

  function startCreate() {
    setDraft(EMPTY_DRAFT);
    setOpen(true);
  }
  function startEdit(p: ClientProperty) {
    setDraft(toDraft(p));
    setOpen(true);
  }

  function patch<K extends keyof DraftProperty>(key: K, value: DraftProperty[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function handleUploadPlan(file: File) {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx. 20MB).");
      return;
    }
    setUploadingPlan(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${clientId}/properties/plan-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("client-assets")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("client-assets").getPublicUrl(path);
      patch("floor_plan_url", data.publicUrl);
      toast.success("Planta anexada.");
    } catch (err) {
      toast.error(err instanceof Error ? `Falha: ${err.message}` : "Erro no upload.");
    } finally {
      setUploadingPlan(false);
      if (planInputRef.current) planInputRef.current.value = "";
    }
  }

  async function handleSave() {
    const payload = {
      client_id: clientId,
      ...(draft.id ? { id: draft.id } : {}),
      label: draft.label.trim() || null,
      empreendimento: draft.empreendimento.trim() || null,
      address: draft.address.trim() || null,
      address_complement: draft.address_complement.trim() || null,
      bairro: draft.bairro.trim() || null,
      city: draft.city.trim() || null,
      state: draft.state || null,
      zip_code: draft.zip_code.trim() || null,
      metragem: draft.metragem.trim() || null,
      property_type: draft.property_type || null,
      location_type: draft.location_type || null,
      floor_plan_url: draft.floor_plan_url || null,
      notes: draft.notes.trim() || null,
      // Se for o primeiro imóvel, marcar como primary
      ...(properties.length === 0 ? { is_primary: true } : {}),
    };
    try {
      await upsert.mutateAsync(payload);
      setOpen(false);
    } catch {
      /* hook mostra toast */
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground font-body">
          {properties.length === 0
            ? "Nenhum imóvel cadastrado."
            : `${properties.length} imóvel${properties.length > 1 ? "is" : ""} cadastrado${properties.length > 1 ? "s" : ""}.`}
        </p>
        <Button size="sm" onClick={startCreate} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Novo imóvel
        </Button>
      </div>

      {isLoading ? (
        <Card className="p-6 text-center">
          <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
        </Card>
      ) : properties.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <Building2 className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Cadastre o(s) imóvel(is) deste cliente para vincular orçamentos.
          </p>
          <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={startCreate}>
            <Plus className="h-3.5 w-3.5" /> Cadastrar primeiro imóvel
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {properties.map((p) => {
            const summary = summarizeProperty(p);
            const count = budgetCountByProperty?.[p.id] ?? 0;
            return (
              <Card key={p.id} className="p-4 group">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h4 className="text-sm font-display font-semibold truncate">{summary}</h4>
                      {p.is_primary && (
                        <Badge variant="outline" className="text-[10px] gap-0.5 border-primary/40 text-primary font-normal">
                          <Star className="h-2.5 w-2.5 fill-current" /> Principal
                        </Badge>
                      )}
                      {count > 0 && (
                        <Badge variant="secondary" className="text-[10px] font-normal">
                          {count} orçamento{count > 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-0.5 text-xs text-muted-foreground font-body">
                      {p.address && (
                        <p className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{[p.address, p.address_complement].filter(Boolean).join(", ")}</span>
                        </p>
                      )}
                      {(p.city || p.state) && (
                        <p className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {[p.city, p.state].filter(Boolean).join(" / ")}
                        </p>
                      )}
                      {p.property_type && (
                        <p className="flex items-center gap-1">
                          <Home className="h-3 w-3 shrink-0" />
                          {PROPERTY_TYPES.find((t) => t.value === p.property_type)?.label ?? p.property_type}
                          {p.location_type && ` · ${p.location_type}`}
                        </p>
                      )}
                      {p.floor_plan_url && (
                        <a
                          href={p.floor_plan_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          <FileText className="h-3 w-3" /> Ver planta
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border/40">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => startEdit(p)}
                  >
                    <Pencil className="h-3 w-3" /> Editar
                  </Button>
                  {!p.is_primary && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => setPrimary.mutate({ id: p.id, clientId })}
                      disabled={setPrimary.isPending}
                    >
                      <StarOff className="h-3 w-3" /> Tornar principal
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1 text-destructive hover:text-destructive ml-auto"
                    onClick={() => setConfirmDelete(p)}
                    disabled={count > 0}
                    title={count > 0 ? "Não é possível excluir: há orçamentos vinculados." : undefined}
                  >
                    <Trash2 className="h-3 w-3" /> Excluir
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog de criação/edição */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Editar imóvel" : "Novo imóvel"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Rótulo (opcional)</Label>
              <Input
                value={draft.label}
                onChange={(e) => patch("label", e.target.value)}
                placeholder='Ex: "Apto Brooklin", "Casa de Campo"'
                maxLength={120}
              />
              <p className="text-[11px] text-muted-foreground/60">
                Deixe em branco para gerar automaticamente a partir do empreendimento + bairro + metragem.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Empreendimento / Condomínio</Label>
                <Input
                  value={draft.empreendimento}
                  onChange={(e) => patch("empreendimento", e.target.value)}
                  placeholder="Ed. Aurora"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Metragem</Label>
                <Input
                  value={draft.metragem}
                  onChange={(e) => patch("metragem", e.target.value)}
                  placeholder="120m²"
                />
              </div>
              <div className="md:col-span-2 space-y-1">
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Endereço</Label>
                <Input
                  value={draft.address}
                  onChange={(e) => patch("address", e.target.value)}
                  placeholder="Rua, número"
                />
              </div>
              <div className="md:col-span-2 space-y-1">
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Complemento</Label>
                <Input
                  value={draft.address_complement}
                  onChange={(e) => patch("address_complement", e.target.value)}
                  placeholder="Apto, bloco..."
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Bairro</Label>
                <Input value={draft.bairro} onChange={(e) => patch("bairro", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Cidade</Label>
                <Input value={draft.city} onChange={(e) => patch("city", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Estado</Label>
                <Select value={draft.state || "none"} onValueChange={(v) => patch("state", v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {BR_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">CEP</Label>
                <Input value={draft.zip_code} onChange={(e) => patch("zip_code", e.target.value)} maxLength={10} />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Tipo de imóvel</Label>
                <Select
                  value={draft.property_type || "none"}
                  onValueChange={(v) => patch("property_type", v === "none" ? "" : v)}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {PROPERTY_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Tipo de locação</Label>
                <Select
                  value={draft.location_type || "none"}
                  onValueChange={(v) => patch("location_type", v === "none" ? "" : v)}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {LOCATION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Planta */}
            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Planta do imóvel</Label>
              <input
                ref={planInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUploadPlan(f);
                }}
              />
              {draft.floor_plan_url ? (
                <div className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/30">
                  <FileText className="h-4 w-4 text-primary" />
                  <a
                    href={draft.floor_plan_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex-1 truncate"
                  >
                    Ver planta anexada
                  </a>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => planInputRef.current?.click()} disabled={uploadingPlan}>
                    {uploadingPlan ? <Loader2 className="h-3 w-3 animate-spin" /> : "Trocar"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => patch("floor_plan_url", "")}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2 border-dashed h-14"
                  onClick={() => planInputRef.current?.click()}
                  disabled={uploadingPlan}
                >
                  {uploadingPlan ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Anexar planta (PDF/imagem)
                </Button>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Observações</Label>
              <Textarea
                value={draft.notes}
                onChange={(e) => patch("notes", e.target.value)}
                placeholder="Restrições do condomínio, particularidades..."
                rows={3}
                maxLength={2000}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={upsert.isPending}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={upsert.isPending} className="gap-1.5">
              {upsert.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {draft.id ? "Salvar alterações" : "Criar imóvel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir imóvel?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Apenas administradores podem excluir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDelete) {
                  del.mutate({ id: confirmDelete.id, clientId });
                  setConfirmDelete(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
