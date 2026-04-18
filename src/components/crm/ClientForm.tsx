import { useState, useEffect } from "react";
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
import { Loader2, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { LOCATION_TYPES } from "@/lib/role-constants";
import {
  CLIENT_SOURCES,
  CLIENT_STATUSES,
  useUpsertClient,
  type Client,
  type ClientStatus,
} from "@/hooks/useClients";

interface ClientFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Partial<Client> | null;
  onSaved?: (client: Client) => void;
}

export function ClientForm({ open, onOpenChange, initial, onSaved }: ClientFormProps) {
  const { user } = useAuth();
  const { members: comerciais } = useTeamMembers("comercial");
  const upsert = useUpsertClient();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [docNum, setDocNum] = useState("");
  const [documentType, setDocumentType] = useState<"cpf" | "cnpj" | "">("");
  const [status, setStatus] = useState<ClientStatus>("lead");
  const [source, setSource] = useState("");
  const [referrerName, setReferrerName] = useState("");
  const [city, setCity] = useState("");
  const [bairro, setBairro] = useState("");
  const [condominio, setCondominio] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [locationType, setLocationType] = useState("");
  const [notes, setNotes] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [ownerId, setOwnerId] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setEmail(initial?.email ?? "");
    setPhone(initial?.phone ?? "");
    setDocNum(initial?.document ?? "");
    setDocumentType((initial?.document_type as "cpf" | "cnpj" | null) ?? "");
    setStatus((initial?.status as ClientStatus) ?? "lead");
    setSource(initial?.source ?? "");
    setReferrerName(initial?.referrer_name ?? "");
    setCity(initial?.city ?? "");
    setBairro(initial?.bairro ?? "");
    setCondominio(initial?.condominio_default ?? "");
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const payload = {
      ...(initial?.id ? { id: initial.id } : {}),
      name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      document: docNum.trim() || null,
      document_type: documentType || null,
      status,
      source: source || null,
      referrer_name: referrerName.trim() || null,
      city: city.trim() || null,
      bairro: bairro.trim() || null,
      condominio_default: condominio.trim() || null,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          <DialogDescription>
            Dados do cliente. Estes campos são usados em todos os orçamentos associados.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nome" required>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="João Silva"
                maxLength={255}
                required
              />
            </Field>
            <Field label="Status">
              <Select value={status} onValueChange={(v) => setStatus(v as ClientStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CLIENT_STATUSES).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

            <Field label="CPF / CNPJ">
              <Input
                value={docNum}
                onChange={(e) => setDocNum(e.target.value)}
                placeholder="000.000.000-00"
                maxLength={20}
              />
            </Field>
            <Field label="Tipo">
              <Select
                value={documentType || "none"}
                onValueChange={(v) => setDocumentType(v === "none" ? "" : (v as "cpf" | "cnpj"))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não informado</SelectItem>
                  <SelectItem value="cpf">CPF (Pessoa Física)</SelectItem>
                  <SelectItem value="cnpj">CNPJ (Pessoa Jurídica)</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Cidade">
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="São Paulo" />
            </Field>
            <Field label="Bairro">
              <Input value={bairro} onChange={(e) => setBairro(e.target.value)} placeholder="Brooklin" />
            </Field>

            <Field label="Condomínio padrão">
              <Input
                value={condominio}
                onChange={(e) => setCondominio(e.target.value)}
                placeholder="Ed. Aurora"
              />
            </Field>
            <Field label="Tipo de imóvel">
              <Select
                value={propertyType || "none"}
                onValueChange={(v) => setPropertyType(v === "none" ? "" : v)}
              >
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

            <Field label="Tipo de locação">
              <Select
                value={locationType || "none"}
                onValueChange={(v) => setLocationType(v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {LOCATION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Fonte do lead">
              <Select value={source || "none"} onValueChange={(v) => setSource(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {Object.entries(CLIENT_SOURCES).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Indicado por">
              <Input
                value={referrerName}
                onChange={(e) => setReferrerName(e.target.value)}
                placeholder="Nome do corretor, arquiteto, amigo..."
              />
            </Field>

            <Field label="Responsável comercial">
              <Select value={ownerId || "none"} onValueChange={(v) => setOwnerId(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o comercial" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {comerciais.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.full_name}
                    </SelectItem>
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
                <Button type="button" variant="outline" size="sm" onClick={addTag}>
                  Adicionar
                </Button>
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
