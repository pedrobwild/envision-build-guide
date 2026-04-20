import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { Loader2, X, Upload, FileText, Image as ImageIcon, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { LOCATION_TYPES } from "@/lib/role-constants";
import {
  CLIENT_SOURCES,
  CLIENT_STATUSES,
  useUpsertClient,
  findOrphanBudgetsForClient,
  linkBudgetsToClient,
  type Client,
  type ClientStatus,
} from "@/hooks/useClients";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface ClientFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Partial<Client> | null;
  onSaved?: (client: Client) => void;
}

const MARITAL_STATUSES = [
  "Solteiro(a)",
  "Casado(a)",
  "União estável",
  "Divorciado(a)",
  "Viúvo(a)",
  "Separado(a)",
];

const BR_STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

export function ClientForm({ open, onOpenChange, initial, onSaved }: ClientFormProps) {
  const { user } = useAuth();
  const { members: comerciais } = useTeamMembers("comercial");
  const upsert = useUpsertClient();

  // Dados do cliente
  const [name, setName] = useState("");
  const [nationality, setNationality] = useState("");
  const [maritalStatus, setMaritalStatus] = useState("");
  const [profession, setProfession] = useState("");
  const [docNum, setDocNum] = useState("");
  const [documentType, setDocumentType] = useState<"cpf" | "cnpj" | "">("");
  const [rg, setRg] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  // Endereço residencial
  const [address, setAddress] = useState("");
  const [addressComplement, setAddressComplement] = useState("");
  const [bairro, setBairro] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");

  // Dados do imóvel
  const [propertyAddress, setPropertyAddress] = useState("");
  const [propertyAddressComplement, setPropertyAddressComplement] = useState("");
  const [propertyBairro, setPropertyBairro] = useState("");
  const [propertyCity, setPropertyCity] = useState("");
  const [propertyState, setPropertyState] = useState("");
  const [propertyZipCode, setPropertyZipCode] = useState("");
  const [propertyMetragem, setPropertyMetragem] = useState("");
  const [propertyEmpreendimento, setPropertyEmpreendimento] = useState("");
  const [propertyFloorPlanUrl, setPropertyFloorPlanUrl] = useState<string | null>(null);
  const [uploadingPlan, setUploadingPlan] = useState(false);
  const planInputRef = useRef<HTMLInputElement>(null);

  // CRM / relacionamento
  const [status, setStatus] = useState<ClientStatus>("lead");
  const [source, setSource] = useState("");
  const [referrerName, setReferrerName] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [locationType, setLocationType] = useState("");
  const [notes, setNotes] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [ownerId, setOwnerId] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    const c = initial as Record<string, unknown> | null | undefined;
    const get = (k: string) => (c?.[k] as string | null | undefined) ?? "";

    setName(initial?.name ?? "");
    setNationality(get("nationality"));
    setMaritalStatus(get("marital_status"));
    setProfession(get("profession"));
    setDocNum(initial?.document ?? "");
    setDocumentType((initial?.document_type as "cpf" | "cnpj" | null) ?? "");
    setRg(get("rg"));
    setEmail(initial?.email ?? "");
    setPhone(initial?.phone ?? "");

    setAddress(get("address"));
    setAddressComplement(get("address_complement"));
    setBairro(initial?.bairro ?? "");
    setCity(initial?.city ?? "");
    setState(get("state"));
    setZipCode(get("zip_code"));

    setPropertyAddress(get("property_address"));
    setPropertyAddressComplement(get("property_address_complement"));
    setPropertyBairro(get("property_bairro"));
    setPropertyCity(get("property_city"));
    setPropertyState(get("property_state"));
    setPropertyZipCode(get("property_zip_code"));
    setPropertyMetragem(get("property_metragem"));
    setPropertyEmpreendimento(
      get("property_empreendimento") || (initial?.condominio_default ?? ""),
    );
    setPropertyFloorPlanUrl(get("property_floor_plan_url") || null);

    setStatus((initial?.status as ClientStatus) ?? "lead");
    setSource(initial?.source ?? "");
    setReferrerName(initial?.referrer_name ?? "");
    setPropertyType(initial?.property_type_default ?? "");
    setLocationType(initial?.location_type_default ?? "");
    setNotes(initial?.notes ?? "");
    setTags(initial?.tags ?? []);
    setOwnerId(initial?.commercial_owner_id ?? "");
  }, [open, initial]);

  function addTag() {
    const v = tagInput.trim();
    if (!v) return;
    if (!tags.includes(v)) setTags((prev) => [...prev, v]);
    setTagInput("");
  }
  function removeTag(t: string) {
    setTags((prev) => prev.filter((x) => x !== t));
  }

  async function handleUploadPlan(file: File) {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx. 20MB).");
      return;
    }
    const allowed = ["image/", "application/pdf"];
    if (!allowed.some((p) => file.type.startsWith(p))) {
      toast.error("Use uma imagem ou PDF.");
      return;
    }
    setUploadingPlan(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const folder = initial?.id || "new";
      const path = `${folder}/floor-plan-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("client-assets")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("client-assets").getPublicUrl(path);
      setPropertyFloorPlanUrl(data.publicUrl);
      toast.success("Planta anexada.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro no upload";
      toast.error(`Falha ao anexar: ${msg}`);
    } finally {
      setUploadingPlan(false);
      if (planInputRef.current) planInputRef.current.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const payload: Record<string, unknown> = {
      ...(initial?.id ? { id: initial.id } : {}),
      name: name.trim(),
      nationality: nationality.trim() || null,
      marital_status: maritalStatus || null,
      profession: profession.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      document: docNum.trim() || null,
      document_type: documentType || null,
      rg: rg.trim() || null,
      // Endereço residencial
      address: address.trim() || null,
      address_complement: addressComplement.trim() || null,
      bairro: bairro.trim() || null,
      city: city.trim() || null,
      state: state || null,
      zip_code: zipCode.trim() || null,
      // Imóvel
      property_address: propertyAddress.trim() || null,
      property_address_complement: propertyAddressComplement.trim() || null,
      property_bairro: propertyBairro.trim() || null,
      property_city: propertyCity.trim() || null,
      property_state: propertyState || null,
      property_zip_code: propertyZipCode.trim() || null,
      property_metragem: propertyMetragem.trim() || null,
      property_empreendimento: propertyEmpreendimento.trim() || null,
      property_floor_plan_url: propertyFloorPlanUrl || null,
      // Mantém compatibilidade legada
      condominio_default: propertyEmpreendimento.trim() || null,
      // CRM
      status,
      source: source || null,
      referrer_name: referrerName.trim() || null,
      property_type_default: propertyType || null,
      location_type_default: locationType || null,
      notes: notes.trim() || null,
      tags,
      commercial_owner_id: ownerId || null,
      created_by: initial?.id ? undefined : user?.id ?? null,
    };
    try {
      const result = await upsert.mutateAsync(payload as Parameters<typeof upsert.mutateAsync>[0]);
      onSaved?.(result);
      onOpenChange(false);
    } catch {
      /* toast já é exibido pelo hook */
    }
  }

  const isPdf = propertyFloorPlanUrl?.toLowerCase().includes(".pdf");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          <DialogDescription>
            Dados completos do cliente e do imóvel. Estes campos são compartilhados com todos os orçamentos.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-2">
          {/* === DADOS DO CLIENTE === */}
          <SectionGroup title="Dados do cliente">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Nome completo" required>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="João da Silva"
                  maxLength={255}
                  required
                />
              </Field>
              <Field label="Nacionalidade">
                <Input
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  placeholder="Brasileiro(a)"
                  maxLength={100}
                />
              </Field>
              <Field label="Estado civil">
                <Select value={maritalStatus || "none"} onValueChange={(v) => setMaritalStatus(v === "none" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {MARITAL_STATUSES.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Profissão">
                <Input
                  value={profession}
                  onChange={(e) => setProfession(e.target.value)}
                  placeholder="Engenheiro, Médica..."
                  maxLength={120}
                />
              </Field>
              <Field label="CPF / CNPJ">
                <Input
                  value={docNum}
                  onChange={(e) => setDocNum(e.target.value)}
                  placeholder="000.000.000-00"
                  maxLength={20}
                />
              </Field>
              <Field label="Tipo de documento">
                <Select
                  value={documentType || "none"}
                  onValueChange={(v) => setDocumentType(v === "none" ? "" : (v as "cpf" | "cnpj"))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    <SelectItem value="cpf">CPF (Pessoa Física)</SelectItem>
                    <SelectItem value="cnpj">CNPJ (Pessoa Jurídica)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="RG">
                <Input
                  value={rg}
                  onChange={(e) => setRg(e.target.value)}
                  placeholder="00.000.000-0"
                  maxLength={30}
                />
              </Field>
              <Field label="E-mail">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="cliente@email.com"
                  maxLength={255}
                />
              </Field>
              <Field label="Telefone">
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  maxLength={20}
                />
              </Field>
              <Field label="Status">
                <Select value={status} onValueChange={(v) => setStatus(v as ClientStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CLIENT_STATUSES)
                      .filter(([key]) => key !== "mql")
                      .map(([key, { label }]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </SectionGroup>

          {/* === ENDEREÇO RESIDENCIAL === */}
          <SectionGroup title="Endereço residencial">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div className="md:col-span-4">
                <Field label="Endereço">
                  <Input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Rua, número"
                  />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Complemento">
                  <Input
                    value={addressComplement}
                    onChange={(e) => setAddressComplement(e.target.value)}
                    placeholder="Apto, bloco..."
                  />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Bairro">
                  <Input value={bairro} onChange={(e) => setBairro(e.target.value)} placeholder="Brooklin" />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Cidade">
                  <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="São Paulo" />
                </Field>
              </div>
              <div className="md:col-span-1">
                <Field label="Estado">
                  <Select value={state || "none"} onValueChange={(v) => setState(v === "none" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="UF" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {BR_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="md:col-span-1">
                <Field label="CEP">
                  <Input value={zipCode} onChange={(e) => setZipCode(e.target.value)} placeholder="00000-000" maxLength={10} />
                </Field>
              </div>
            </div>
          </SectionGroup>

          {/* === DADOS DO IMÓVEL === */}
          <SectionGroup title="Dados do imóvel">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div className="md:col-span-4">
                <Field label="Endereço do imóvel">
                  <Input
                    value={propertyAddress}
                    onChange={(e) => setPropertyAddress(e.target.value)}
                    placeholder="Rua, número"
                  />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Complemento">
                  <Input
                    value={propertyAddressComplement}
                    onChange={(e) => setPropertyAddressComplement(e.target.value)}
                    placeholder="Apto, bloco..."
                  />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Bairro">
                  <Input value={propertyBairro} onChange={(e) => setPropertyBairro(e.target.value)} placeholder="Brooklin" />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Cidade">
                  <Input value={propertyCity} onChange={(e) => setPropertyCity(e.target.value)} placeholder="São Paulo" />
                </Field>
              </div>
              <div className="md:col-span-1">
                <Field label="Estado">
                  <Select value={propertyState || "none"} onValueChange={(v) => setPropertyState(v === "none" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="UF" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {BR_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="md:col-span-1">
                <Field label="CEP">
                  <Input value={propertyZipCode} onChange={(e) => setPropertyZipCode(e.target.value)} placeholder="00000-000" maxLength={10} />
                </Field>
              </div>

              <div className="md:col-span-2">
                <Field label="Metragem">
                  <Input value={propertyMetragem} onChange={(e) => setPropertyMetragem(e.target.value)} placeholder="120m²" />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Empreendimento">
                  <Input
                    value={propertyEmpreendimento}
                    onChange={(e) => setPropertyEmpreendimento(e.target.value)}
                    placeholder="Ed. Aurora"
                  />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Tipo de imóvel">
                  <Select value={propertyType || "none"} onValueChange={(v) => setPropertyType(v === "none" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      <SelectItem value="apartamento">Apartamento</SelectItem>
                      <SelectItem value="casa">Casa</SelectItem>
                      <SelectItem value="cobertura">Cobertura</SelectItem>
                      <SelectItem value="studio">Studio / Kitnet</SelectItem>
                      <SelectItem value="comercial">Espaço Comercial</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </div>

            {/* Anexar planta */}
            <div className="mt-4 space-y-2">
              <Label className="text-xs text-muted-foreground font-body">Planta do imóvel (imagem ou PDF)</Label>
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
              {propertyFloorPlanUrl ? (
                <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
                  {isPdf ? (
                    <FileText className="h-8 w-8 text-primary shrink-0" />
                  ) : (
                    <img
                      src={propertyFloorPlanUrl}
                      alt="Planta do imóvel"
                      className="h-12 w-12 rounded object-cover shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <a
                      href={propertyFloorPlanUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-body text-primary hover:underline truncate block"
                    >
                      Visualizar planta
                    </a>
                    <p className="text-[11px] text-muted-foreground">{isPdf ? "PDF" : "Imagem"} anexada</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => planInputRef.current?.click()}
                    disabled={uploadingPlan}
                  >
                    {uploadingPlan ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Trocar"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => setPropertyFloorPlanUrl(null)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2 border-dashed h-20"
                  onClick={() => planInputRef.current?.click()}
                  disabled={uploadingPlan}
                >
                  {uploadingPlan ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      <span className="flex flex-col items-start text-left">
                        <span className="text-sm">Anexar planta do imóvel</span>
                        <span className="text-[11px] text-muted-foreground font-normal">Imagem ou PDF · até 20MB</span>
                      </span>
                    </>
                  )}
                </Button>
              )}
            </div>
          </SectionGroup>

          {/* === RELACIONAMENTO === */}
          <SectionGroup title="Relacionamento (CRM)">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Tipo de locação">
                <Select value={locationType || "none"} onValueChange={(v) => setLocationType(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {LOCATION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Fonte do lead">
                <Select value={source || "none"} onValueChange={(v) => setSource(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {Object.entries(CLIENT_SOURCES).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Indicado por">
                <Input
                  value={referrerName}
                  onChange={(e) => setReferrerName(e.target.value)}
                  placeholder="Nome do corretor, arquiteto..."
                />
              </Field>
              <Field label="Responsável comercial">
                <Select value={ownerId || "none"} onValueChange={(v) => setOwnerId(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione o comercial" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {comerciais.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field label="Tags">
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    placeholder="Ex: VIP, Arquiteto, Reforma"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addTag}>Adicionar</Button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((t) => (
                      <Badge key={t} variant="secondary" className="gap-1 pr-1">
                        {t}
                        <button
                          type="button"
                          onClick={() => removeTag(t)}
                          className="ml-0.5 rounded-sm hover:bg-muted p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </Field>

            <Field label="Observações">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Preferências, restrições, histórico de contato..."
                rows={4}
                maxLength={4000}
              />
            </Field>
          </SectionGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!name.trim() || upsert.isPending}>
              {upsert.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {initial?.id ? "Salvar alterações" : "Criar cliente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SectionGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-display font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">
        {title}
      </h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground font-body">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}
