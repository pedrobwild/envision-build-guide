import { useState, useEffect } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  User,
  Building2,
  MapPin,
  FileText,
  Calendar,
  AlertTriangle,
  Link as LinkIcon,
  Plus,
  X,
  CheckCircle2,
  UserCheck,
} from "lucide-react";
import { PRIORITIES, PROPERTY_TYPES, type Priority } from "@/lib/role-constants";
import { useTeamMembers } from "@/hooks/useTeamMembers";

export default function NewBudgetRequest() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  // Team members for assignment
  const { members: comerciais } = useTeamMembers("comercial");
  const { members: orcamentistas } = useTeamMembers("orcamentista");
  const [nextEstimatorId, setNextEstimatorId] = useState<string | null>(null);

  // Form state
  const [clientName, setClientName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [city, setCity] = useState("");
  const [bairro, setBairro] = useState("");
  const [metragem, setMetragem] = useState("");
  const [demandContext, setDemandContext] = useState("");
  const [briefing, setBriefing] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [internalNotes, setInternalNotes] = useState("");
  const [referenceLinks, setReferenceLinks] = useState<string[]>([""]);
  const [commercialOwnerId, setCommercialOwnerId] = useState("");
  const [estimatorOwnerId, setEstimatorOwnerId] = useState("");
  const [hubspotDealUrl, setHubspotDealUrl] = useState("");

  // Round-robin: determine next estimator based on last assignment
  useEffect(() => {
    if (orcamentistas.length === 0) return;

    async function findNextEstimator() {
      // Get the most recently created budget that has an estimator assigned
      const { data } = await supabase
        .from("budgets")
        .select("estimator_owner_id")
        .not("estimator_owner_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1);

      const lastEstimatorId = data?.[0]?.estimator_owner_id;

      if (!lastEstimatorId) {
        // No previous assignment, pick the first
        setNextEstimatorId(orcamentistas[0].id);
        setEstimatorOwnerId(orcamentistas[0].id);
        return;
      }

      // Find the index of the last assigned estimator
      const lastIdx = orcamentistas.findIndex((m) => m.id === lastEstimatorId);
      const nextIdx = (lastIdx + 1) % orcamentistas.length;
      setNextEstimatorId(orcamentistas[nextIdx].id);
      setEstimatorOwnerId(orcamentistas[nextIdx].id);
    }

    findNextEstimator();
  }, [orcamentistas]);

  const addLink = () => setReferenceLinks((prev) => [...prev, ""]);
  const removeLink = (i: number) =>
    setReferenceLinks((prev) => prev.filter((_, idx) => idx !== i));
  const updateLink = (i: number, val: string) =>
    setReferenceLinks((prev) => prev.map((l, idx) => (idx === i ? val : l)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!clientName.trim() || !projectName.trim()) {
      toast.error("Preencha ao menos o nome do cliente e do projeto.");
      return;
    }

    setLoading(true);

    const links = referenceLinks.filter((l) => l.trim().length > 0);

    const { error } = await supabase.from("budgets").insert({
      client_name: clientName.trim(),
      project_name: projectName.trim(),
      property_type: propertyType || null,
      city: city.trim() || null,
      bairro: bairro.trim() || null,
      metragem: metragem.trim() || null,
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
    } as any);

    setLoading(false);

    if (error) {
      console.error(error);
      toast.error("Erro ao criar solicitação. Tente novamente.");
      return;
    }

    toast.success("Solicitação criada com sucesso!", {
      description: "O orçamento entrará na fila de triagem.",
    });
    navigate("/admin/solicitacoes");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin/solicitacoes")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold font-display text-foreground">
              Nova Solicitação de Orçamento
            </h1>
            <p className="text-sm text-muted-foreground font-body">
              Preencha o briefing para iniciar a produção
            </p>
          </div>
        </div>
      </header>

      <form
        onSubmit={handleSubmit}
        className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6"
      >
        {/* Client & Project */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Cliente e Projeto
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="client_name" className="font-body text-sm">
                Nome do cliente <span className="text-destructive">*</span>
              </Label>
              <Input
                id="client_name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ex: João Silva"
                maxLength={255}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project_name" className="font-body text-sm">
                Nome do projeto / imóvel{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="project_name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Ex: Apto 82 - Ed. Aurora"
                maxLength={255}
                required
              />
            </div>
          </CardContent>
        </Card>

        {/* Property details */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Detalhes do Imóvel
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="font-body text-sm">Tipo de imóvel</Label>
              <Select value={propertyType} onValueChange={setPropertyType}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {PROPERTY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="font-body text-sm flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> Cidade
              </Label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="São Paulo"
                maxLength={100}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-body text-sm">Bairro</Label>
              <Input
                value={bairro}
                onChange={(e) => setBairro(e.target.value)}
                placeholder="Brooklin"
                maxLength={100}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-body text-sm">Metragem</Label>
              <Input
                value={metragem}
                onChange={(e) => setMetragem(e.target.value)}
                placeholder="82m²"
                maxLength={20}
              />
            </div>
          </CardContent>
        </Card>

        {/* Briefing */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Briefing e Contexto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="font-body text-sm">Contexto da demanda</Label>
              <Textarea
                value={demandContext}
                onChange={(e) => setDemandContext(e.target.value)}
                placeholder="Ex: Cliente indicado pelo corretor X, quer reforma completa antes da mudança..."
                rows={3}
                maxLength={2000}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-body text-sm">Briefing detalhado</Label>
              <Textarea
                value={briefing}
                onChange={(e) => setBriefing(e.target.value)}
                placeholder="Descreva o escopo desejado, preferências do cliente, restrições do condomínio, referências de estilo..."
                rows={5}
                maxLength={5000}
              />
            </div>
          </CardContent>
        </Card>

        {/* Responsáveis */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-primary" />
              Responsáveis
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="font-body text-sm">Comercial responsável</Label>
              <Select value={commercialOwnerId} onValueChange={setCommercialOwnerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o comercial" />
                </SelectTrigger>
                <SelectContent>
                  {comerciais.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="font-body text-sm">Orçamentista responsável</Label>
              <Select value={estimatorOwnerId} onValueChange={setEstimatorOwnerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o orçamentista" />
                </SelectTrigger>
                <SelectContent>
                  {orcamentistas.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Prazo e Prioridade */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Prazo e Prioridade
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="font-body text-sm">Prazo desejado</Label>
              <Input
                type="date"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-body text-sm flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" /> Prioridade
              </Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as Priority)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITIES).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Reference links */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <LinkIcon className="h-4 w-4 text-primary" />
              Links de Referência
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLink(i)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addLink}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar link
            </Button>
          </CardContent>
        </Card>

        {/* Internal Notes */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-display flex items-center gap-2">
              📝 Observações Internas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Notas visíveis apenas internamente..."
              rows={3}
              maxLength={2000}
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3 pb-10">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/admin/solicitacoes")}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={loading} className="gap-2 min-w-[180px]">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {loading ? "Salvando..." : "Criar Solicitação"}
          </Button>
        </div>
      </form>
    </div>
  );
}
