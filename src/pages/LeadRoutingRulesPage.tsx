import { useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Route,
  GripVertical,
  Users,
  User,
  Inbox,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  useLeadRoutingRules,
  useUpsertRoutingRule,
  useDeleteRoutingRule,
  useToggleRoutingRule,
  type LeadRoutingRule,
} from "@/hooks/useLeadRoutingRules";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { CLIENT_SOURCES } from "@/hooks/useClients";

const EMPTY_RULE: Omit<LeadRoutingRule, "id" | "created_at" | "updated_at" | "round_robin_cursor"> = {
  name: "",
  is_active: true,
  priority: 100,
  match_source: null,
  match_campaign_id: null,
  match_campaign_name_ilike: null,
  match_form_id: null,
  match_city_ilike: null,
  assignment_strategy: "fixed",
  assigned_owner_id: null,
  round_robin_pool: null,
};

export default function LeadRoutingRulesPage() {
  const { data: rules = [], isLoading } = useLeadRoutingRules();
  const { members: comerciais } = useTeamMembers("comercial");
  const upsert = useUpsertRoutingRule();
  const remove = useDeleteRoutingRule();
  const toggle = useToggleRoutingRule();

  const [editing, setEditing] = useState<LeadRoutingRule | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const open = creating || !!editing;
  const initial = editing
    ? { ...editing }
    : { ...EMPTY_RULE, priority: (rules.at(-1)?.priority ?? 100) + 10 };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight flex items-center gap-2">
            <Route className="h-7 w-7" /> Regras de Roteamento
          </h1>
          <p className="text-muted-foreground font-body mt-1">
            Defina quem recebe cada lead com base em fonte, campanha, formulário ou cidade.
            Regras são avaliadas em ordem de prioridade (menor primeiro).
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-2" /> Nova regra
        </Button>
      </div>

      {isLoading ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Carregando...</CardContent></Card>
      ) : rules.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Inbox className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-medium">Nenhuma regra cadastrada</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Sem regras, leads recebidos via integração ficarão sem responsável atribuído.
              Crie ao menos uma regra padrão (sem filtros) para garantir cobertura.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              ownerName={comerciais.find((m) => m.id === rule.assigned_owner_id)?.full_name}
              poolNames={rule.round_robin_pool?.map(
                (id) => comerciais.find((m) => m.id === id)?.full_name ?? "?",
              )}
              onEdit={() => setEditing(rule)}
              onDelete={() => setDeleteId(rule.id)}
              onToggle={(v) => toggle.mutate({ id: rule.id, is_active: v })}
            />
          ))}
        </div>
      )}

      <RuleDialog
        open={open}
        initial={initial}
        members={comerciais}
        onClose={() => {
          setEditing(null);
          setCreating(false);
        }}
        onSave={(payload) => {
          upsert.mutate(
            editing ? { ...payload, id: editing.id } : payload,
            { onSuccess: () => { setEditing(null); setCreating(false); } },
          );
        }}
        saving={upsert.isPending}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover regra de roteamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Leads que se encaixariam nesta regra
              ficarão sem responsável até serem atribuídos manualmente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) remove.mutate(deleteId);
                setDeleteId(null);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RuleCard({
  rule,
  ownerName,
  poolNames,
  onEdit,
  onDelete,
  onToggle,
}: {
  rule: LeadRoutingRule;
  ownerName?: string;
  poolNames?: string[];
  onEdit: () => void;
  onDelete: () => void;
  onToggle: (v: boolean) => void;
}) {
  const filters: { label: string; value: string }[] = [];
  if (rule.match_source) filters.push({ label: "Fonte", value: CLIENT_SOURCES[rule.match_source] ?? rule.match_source });
  if (rule.match_campaign_id) filters.push({ label: "Campaign ID", value: rule.match_campaign_id });
  if (rule.match_campaign_name_ilike) filters.push({ label: "Campanha contém", value: rule.match_campaign_name_ilike.replace(/%/g, "") });
  if (rule.match_form_id) filters.push({ label: "Form ID", value: rule.match_form_id });
  if (rule.match_city_ilike) filters.push({ label: "Cidade", value: rule.match_city_ilike.replace(/%/g, "") });

  return (
    <Card className={!rule.is_active ? "opacity-60" : ""}>
      <CardContent className="p-4 flex items-start gap-4">
        <div className="flex flex-col items-center pt-1 gap-1">
          <GripVertical className="h-4 w-4 text-muted-foreground/40" />
          <span className="text-xs font-mono font-bold text-muted-foreground">#{rule.priority}</span>
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold tracking-tight">{rule.name}</h3>
            {rule.assignment_strategy === "round_robin" ? (
              <Badge variant="secondary" className="gap-1"><Users className="h-3 w-3" /> Round-robin</Badge>
            ) : (
              <Badge variant="secondary" className="gap-1"><User className="h-3 w-3" /> Fixo</Badge>
            )}
          </div>
          {filters.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {filters.map((f) => (
                <Badge key={f.label} variant="outline" className="text-xs">
                  <span className="text-muted-foreground mr-1">{f.label}:</span>
                  {f.value}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">Sem filtros — captura qualquer lead</p>
          )}
          <p className="text-sm text-muted-foreground">
            {rule.assignment_strategy === "fixed"
              ? <>Atribui para <strong className="text-foreground">{ownerName ?? "(usuário não encontrado)"}</strong></>
              : <>Distribui entre <strong className="text-foreground">{poolNames?.join(", ") || "(pool vazio)"}</strong></>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={rule.is_active} onCheckedChange={onToggle} />
          <Button variant="ghost" size="icon" onClick={onEdit}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={onDelete}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RuleDialog({
  open,
  initial,
  members,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  initial: Omit<LeadRoutingRule, "id" | "created_at" | "updated_at" | "round_robin_cursor">;
  members: { id: string; full_name: string }[];
  onClose: () => void;
  onSave: (r: typeof initial) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState(initial);

  // Reset state when dialog opens with a new rule
  const [openKey, setOpenKey] = useState(0);
  if (open && openKey === 0) {
    setForm(initial);
    setOpenKey(1);
  }
  if (!open && openKey === 1) setOpenKey(0);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const togglePool = (id: string) => {
    const cur = form.round_robin_pool ?? [];
    set("round_robin_pool", cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial.name ? "Editar regra" : "Nova regra de roteamento"}</DialogTitle>
          <DialogDescription>
            Regras de menor prioridade são avaliadas primeiro. A primeira regra com filtros
            compatíveis define o responsável.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Nome *</Label>
              <Input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Ex: Meta Ads → Maria"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Input
                type="number"
                value={form.priority}
                onChange={(e) => set("priority", Number(e.target.value) || 100)}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
            <p className="text-sm font-medium">Filtros (deixe vazio para "qualquer")</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Fonte</Label>
                <Select
                  value={form.match_source ?? "any"}
                  onValueChange={(v) => set("match_source", v === "any" ? null : v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Qualquer fonte</SelectItem>
                    {Object.entries(CLIENT_SOURCES).map(([k, label]) => (
                      <SelectItem key={k} value={k}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Cidade contém</Label>
                <Input
                  value={form.match_city_ilike?.replace(/%/g, "") ?? ""}
                  onChange={(e) => set("match_city_ilike", e.target.value ? `%${e.target.value}%` : null)}
                  placeholder="ex: São Paulo"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Campaign ID exato</Label>
                <Input
                  value={form.match_campaign_id ?? ""}
                  onChange={(e) => set("match_campaign_id", e.target.value || null)}
                  placeholder="ex: 23851234567890"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Nome da campanha contém</Label>
                <Input
                  value={form.match_campaign_name_ilike?.replace(/%/g, "") ?? ""}
                  onChange={(e) => set("match_campaign_name_ilike", e.target.value ? `%${e.target.value}%` : null)}
                  placeholder="ex: brooklin"
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Form ID exato</Label>
                <Input
                  value={form.match_form_id ?? ""}
                  onChange={(e) => set("match_form_id", e.target.value || null)}
                  placeholder="ex: 1234567890"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Estratégia de atribuição</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => set("assignment_strategy", "fixed")}
                className={`p-3 rounded-lg border-2 text-left transition ${
                  form.assignment_strategy === "fixed" ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <User className="h-4 w-4 mb-1" />
                <p className="font-medium text-sm">Fixo</p>
                <p className="text-xs text-muted-foreground">Sempre o mesmo responsável</p>
              </button>
              <button
                type="button"
                onClick={() => set("assignment_strategy", "round_robin")}
                className={`p-3 rounded-lg border-2 text-left transition ${
                  form.assignment_strategy === "round_robin" ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <Users className="h-4 w-4 mb-1" />
                <p className="font-medium text-sm">Round-robin</p>
                <p className="text-xs text-muted-foreground">Distribui entre vários</p>
              </button>
            </div>

            {form.assignment_strategy === "fixed" ? (
              <div className="space-y-1.5">
                <Label className="text-xs">Responsável</Label>
                <Select
                  value={form.assigned_owner_id ?? ""}
                  onValueChange={(v) => set("assigned_owner_id", v || null)}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs">Pool de comerciais</Label>
                <div className="border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                  {members.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum comercial cadastrado.</p>
                  ) : (
                    members.map((m) => (
                      <label key={m.id} className="flex items-center gap-2 cursor-pointer text-sm">
                        <Checkbox
                          checked={form.round_robin_pool?.includes(m.id) ?? false}
                          onCheckedChange={() => togglePool(m.id)}
                        />
                        {m.full_name}
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Switch checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} />
            <Label>Regra ativa</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => onSave(form)}
            disabled={
              saving ||
              !form.name.trim() ||
              (form.assignment_strategy === "fixed" && !form.assigned_owner_id) ||
              (form.assignment_strategy === "round_robin" && (form.round_robin_pool?.length ?? 0) === 0)
            }
          >
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
