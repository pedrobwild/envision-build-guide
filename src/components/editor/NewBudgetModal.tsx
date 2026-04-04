import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Loader2,
  User,
  Building2,
  FileText,
  Calendar,
  AlertTriangle,
  Link as LinkIcon,
  Plus,
  X,
  CheckCircle2,
  UserCheck,
} from "lucide-react";
import { PRIORITIES, LOCATION_TYPES, type Priority } from "@/lib/role-constants";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { seedFromTemplate } from "@/lib/seed-from-template";
import { useBudgetTemplates } from "@/hooks/useBudgetTemplates";
import { LayoutTemplate } from "lucide-react";

interface NewBudgetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (budgetId: string) => void;
}

export function NewBudgetModal({ open, onOpenChange, onSuccess }: NewBudgetModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const { members: comerciais } = useTeamMembers("comercial");
  const { members: orcamentistas } = useTeamMembers("orcamentista");
  const { data: templates = [] } = useBudgetTemplates();
  const [nextEstimatorId, setNextEstimatorId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  // Form state
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [condominio, setCondominio] = useState("");
  const [bairro, setBairro] = useState("");
  const [metargemRaw, setMetragemRaw] = useState("");
  const [locationType, setLocationType] = useState("");
  const [demandContext, setDemandContext] = useState("");
  const [briefing, setBriefing] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [internalNotes, setInternalNotes] = useState("");
  const [referenceLinks, setReferenceLinks] = useState<string[]>([""]);
  const [commercialOwnerId, setCommercialOwnerId] = useState("");
  const [estimatorOwnerId, setEstimatorOwnerId] = useState("");
  const [hubspotDealUrl, setHubspotDealUrl] = useState("");

  const projectName = useMemo(() => {
    const parts = [
      clientName.trim(),
      condominio.trim(),
      metargemRaw.trim() ? `${metargemRaw.trim()}m²` : "",
    ].filter(Boolean);
    return parts.join(" - ") || "";
  }, [clientName, condominio, metargemRaw]);

  const handleMetragemChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9.,]/g, "");
    setMetragemRaw(val);
  };

  // Round-robin estimator
  useEffect(() => {
    if (orcamentistas.length === 0) return;
    async function findNextEstimator() {
      const { data } = await supabase
        .from("budgets")
        .select("estimator_owner_id")
        .not("estimator_owner_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1);
      const lastEstimatorId = data?.[0]?.estimator_owner_id;
      if (!lastEstimatorId) {
        setNextEstimatorId(orcamentistas[0].id);
        setEstimatorOwnerId(orcamentistas[0].id);
        return;
      }
      const lastIdx = orcamentistas.findIndex((m) => m.id === lastEstimatorId);
      const nextIdx = (lastIdx + 1) % orcamentistas.length;
      setNextEstimatorId(orcamentistas[nextIdx].id);
      setEstimatorOwnerId(orcamentistas[nextIdx].id);
    }
    findNextEstimator();
  }, [orcamentistas]);

  const resetForm = () => {
    setClientName("");
    setClientEmail("");
    setClientPhone("");
    setCondominio("");
    setBairro("");
    setMetragemRaw("");
    setLocationType("");
    setDemandContext("");
    setBriefing("");
    setDueAt("");
    setPriority("normal");
    setInternalNotes("");
    setReferenceLinks([""]);
    setCommercialOwnerId("");
    setHubspotDealUrl("");
    setSelectedTemplateId("");
    // Keep estimator from round-robin
    if (nextEstimatorId) setEstimatorOwnerId(nextEstimatorId);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !loading) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const addLink = () => setReferenceLinks((prev) => [...prev, ""]);
  const removeLink = (i: number) =>
    setReferenceLinks((prev) => prev.filter((_, idx) => idx !== i));
  const updateLink = (i: number, val: string) =>
    setReferenceLinks((prev) => prev.map((l, idx) => (idx === i ? val : l)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!clientName.trim()) {
      toast.error("Preencha ao menos o nome do cliente.");
      return;
    }
    setLoading(true);

    const links = referenceLinks.filter((l) => l.trim().length > 0);
    const metragemFormatted = metargemRaw.trim() ? `${metargemRaw.trim()}m²` : null;

    const { data, error } = await supabase
      .from("budgets")
      .insert({
        client_name: clientName.trim(),
        project_name: projectName || clientName.trim(),
        lead_email: clientEmail.trim() || null,
        client_phone: clientPhone.trim() || null,
        condominio: condominio.trim() || null,
        bairro: bairro.trim() || null,
        metragem: metragemFormatted,
        location_type: locationType || null,
        demand_context: demandContext.trim() || null,
        briefing: briefing.trim() || null,
        due_at: dueAt || null,
        priority: priority,
        internal_notes: internalNotes.trim() || null,
        reference_links: links.length > 0 ? links : [],
        hubspot_deal_url: hubspotDealUrl.trim() || null,
        internal_status: "requested",
        status: "draft",
        commercial_owner_id: commercialOwnerId || user.id,
        estimator_owner_id: estimatorOwnerId || null,
        created_by: user.id,
      } as any)
      .select("id")
      .single();

    if (error || !data) {
      console.error(error);
      toast.error("Erro ao criar solicitação. Tente novamente.");
      setLoading(false);
      return;
    }

    try {
      const tplId = selectedTemplateId && selectedTemplateId !== "none" ? selectedTemplateId : null;
      await seedFromTemplate(data.id, tplId);
    } catch (seedErr) {
      console.error("Erro ao criar seções padrão:", seedErr);
    }

    setLoading(false);

    toast.success("Solicitação criada com sucesso!", {
      description: "O orçamento entrará na fila de triagem.",
    });
    resetForm();
    onOpenChange(false);
    onSuccess?.(data.id);
  };

  // Progress calculation
  const filledFields = [
    clientName.trim(),
    condominio.trim() || bairro.trim(),
    metargemRaw.trim(),
    briefing.trim() || demandContext.trim(),
    estimatorOwnerId,
  ].filter(Boolean).length;
  const progressPercent = Math.round((filledFields / 5) * 100);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border relative">
          <DialogTitle className="text-lg font-display flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Plus className="h-4 w-4 text-primary" />
            </div>
            Nova Solicitação de Orçamento
          </DialogTitle>
          <DialogDescription className="text-sm font-body text-muted-foreground">
            Preencha o briefing para iniciar a produção
          </DialogDescription>
          {/* Progress bar */}
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-border/40">
            <div
              className="h-full bg-primary rounded-r-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-180px)]">
          <form id="new-budget-form" onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
            {/* Template */}
            {templates.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-sm font-semibold font-display flex items-center gap-2 text-foreground">
                  <LayoutTemplate className="h-4 w-4 text-primary" />
                  Template do Orçamento
                </h3>
                <div className="space-y-1.5">
                  <Label className="font-body text-xs">Modelo base</Label>
                  <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um template (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem template (seções padrão)</SelectItem>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedTemplateId && selectedTemplateId !== "none" && (
                    <p className="text-xs text-muted-foreground font-body">
                      {templates.find((t) => t.id === selectedTemplateId)?.description}
                    </p>
                  )}
                </div>
              </section>
            )}

            {/* Cliente */}
            <section className="space-y-3 rounded-xl border border-border/50 bg-muted/20 p-4">
              <h3 className="text-xs font-semibold font-display flex items-center gap-2 text-foreground uppercase tracking-widest">
                <User className="h-3.5 w-3.5 text-primary" />
                Cliente e Projeto
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="font-body text-xs">
                    Nome do cliente <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Ex: João Silva"
                    maxLength={255}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-body text-xs">E-mail</Label>
                  <Input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="cliente@email.com"
                    maxLength={255}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-body text-xs">Telefone</Label>
                  <Input
                    type="tel"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="(11) 99999-9999"
                    maxLength={20}
                  />
                </div>
              </div>
              {projectName && (
                <p className="text-xs text-muted-foreground font-body">
                  Projeto: <span className="font-medium text-foreground">{projectName}</span>
                </p>
              )}
            </section>

            {/* Imóvel */}
            <section className="space-y-3 rounded-xl border border-border/50 bg-muted/20 p-4">
              <h3 className="text-xs font-semibold font-display flex items-center gap-2 text-foreground uppercase tracking-widest">
                <Building2 className="h-3.5 w-3.5 text-primary" />
                Detalhes do Imóvel
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="font-body text-xs">Condomínio</Label>
                  <Input
                    value={condominio}
                    onChange={(e) => setCondominio(e.target.value)}
                    placeholder="Ex: Ed. Aurora"
                    maxLength={255}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-body text-xs">Bairro</Label>
                  <Input
                    value={bairro}
                    onChange={(e) => setBairro(e.target.value)}
                    placeholder="Brooklin"
                    maxLength={100}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-body text-xs">Metragem</Label>
                  <div className="relative">
                    <Input
                      value={metargemRaw}
                      onChange={handleMetragemChange}
                      placeholder="82"
                      maxLength={10}
                      className="pr-10"
                    />
                    {metargemRaw && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                        m²
                      </span>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="font-body text-xs">Tipo de locação</Label>
                  <Select value={locationType} onValueChange={setLocationType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {LOCATION_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            {/* Briefing */}
            <section className="space-y-3 rounded-xl border border-border/50 bg-muted/20 p-4">
              <h3 className="text-xs font-semibold font-display flex items-center gap-2 text-foreground uppercase tracking-widest">
                <FileText className="h-3.5 w-3.5 text-primary" />
                Briefing e Contexto
              </h3>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="font-body text-xs">Contexto da demanda</Label>
                  <Textarea
                    value={demandContext}
                    onChange={(e) => setDemandContext(e.target.value)}
                    placeholder="Ex: Cliente indicado pelo corretor X, quer reforma completa..."
                    rows={2}
                    maxLength={2000}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-body text-xs">Briefing detalhado</Label>
                  <Textarea
                    value={briefing}
                    onChange={(e) => setBriefing(e.target.value)}
                    placeholder="Descreva o escopo desejado, preferências do cliente..."
                    rows={3}
                    maxLength={5000}
                  />
                </div>
              </div>
            </section>

            {/* Hubspot */}
            <section className="space-y-3 rounded-xl border border-border/50 bg-muted/20 p-4">
              <h3 className="text-xs font-semibold font-display flex items-center gap-2 text-foreground uppercase tracking-widest">
                <LinkIcon className="h-3.5 w-3.5 text-primary" />
                Negócio Hubspot
              </h3>
              <div className="space-y-1.5">
                <Label className="font-body text-xs">URL do negócio</Label>
                <Input
                  value={hubspotDealUrl}
                  onChange={(e) => setHubspotDealUrl(e.target.value)}
                  placeholder="https://app.hubspot.com/contacts/.../deal/..."
                  type="url"
                />
              </div>
            </section>

            {/* Responsáveis */}
            <section className="space-y-3 rounded-xl border border-border/50 bg-muted/20 p-4">
              <h3 className="text-xs font-semibold font-display flex items-center gap-2 text-foreground uppercase tracking-widest">
                <UserCheck className="h-3.5 w-3.5 text-primary" />
                Responsáveis
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="font-body text-xs">Comercial responsável</Label>
                  <Select value={commercialOwnerId} onValueChange={setCommercialOwnerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o comercial" />
                    </SelectTrigger>
                    <SelectContent>
                      {comerciais.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="font-body text-xs">Orçamentista responsável</Label>
                  <Select value={estimatorOwnerId} onValueChange={setEstimatorOwnerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o orçamentista" />
                    </SelectTrigger>
                    <SelectContent>
                      {orcamentistas.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {nextEstimatorId && estimatorOwnerId === nextEstimatorId && (
                    <p className="text-xs text-blue-600 font-body">
                      ↻ Atribuído automaticamente por rodízio
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* Prazo e Prioridade */}
            <section className="space-y-3 rounded-xl border border-border/50 bg-muted/20 p-4">
              <h3 className="text-xs font-semibold font-display flex items-center gap-2 text-foreground uppercase tracking-widest">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                Prazo e Prioridade
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="font-body text-xs">Prazo desejado</Label>
                  <Input
                    type="date"
                    value={dueAt}
                    onChange={(e) => setDueAt(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-body text-xs flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> Prioridade
                  </Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PRIORITIES).map(([key, { label }]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            {/* Links de Referência */}
            <section className="space-y-3 rounded-xl border border-border/50 bg-muted/20 p-4">
              <h3 className="text-xs font-semibold font-display flex items-center gap-2 text-foreground uppercase tracking-widest">
                <LinkIcon className="h-3.5 w-3.5 text-primary" />
                Links de Referência
              </h3>
              <div className="space-y-2">
                {referenceLinks.map((link, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={link}
                      onChange={(e) => updateLink(i, e.target.value)}
                      placeholder="https://..."
                      type="url"
                      className="flex-1"
                    />
                    {referenceLinks.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeLink(i)}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addLink} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Adicionar link
                </Button>
              </div>
            </section>

            {/* Observações Internas */}
            <section className="space-y-3 rounded-xl border border-border/50 bg-muted/20 p-4">
              <h3 className="text-xs font-semibold font-display flex items-center gap-2 text-foreground uppercase tracking-widest">
                📝 Observações Internas
              </h3>
              <Textarea
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Notas visíveis apenas internamente..."
                rows={2}
                maxLength={2000}
              />
            </section>
          </form>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="new-budget-form"
            disabled={loading}
            className="gap-2 min-w-[160px]"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {loading ? "Salvando..." : "Criar Solicitação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
