import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
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
  LayoutTemplate,
  MapPin,
  Ruler,
  Phone,
  Mail,
  Home,
  ExternalLink,
  StickyNote,
  Sparkles,
  Upload,
  DollarSign,
  PackageCheck,
} from "lucide-react";
import { PRIORITIES, LOCATION_TYPES, type Priority } from "@/lib/role-constants";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { seedFromTemplate } from "@/lib/seed-from-template";
import { useBudgetTemplates } from "@/hooks/useBudgetTemplates";
import { cn } from "@/lib/utils";

/* ── Notion-like property row ── */
function PropertyRow({
  icon: Icon,
  label,
  required,
  children,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-1.5 group/row rounded-lg hover:bg-muted/30 px-1 -mx-1 transition-colors">
      <div className="flex items-center gap-2 w-[140px] shrink-0 pt-2.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 group-hover/row:text-muted-foreground/80 transition-colors" />
        <span className="text-[13px] text-muted-foreground font-body truncate">
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        {children}
        {hint && (
          <p className="text-[11px] text-muted-foreground/50 font-body mt-0.5 ml-0.5">{hint}</p>
        )}
      </div>
    </div>
  );
}

/* ── Clean input styled like Notion ── */
function NotionInput({
  value,
  onChange,
  placeholder,
  type = "text",
  maxLength,
  required,
  suffix,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
  maxLength?: number;
  required?: boolean;
  suffix?: string;
}) {
  return (
    <div className="relative">
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        required={required}
        className="w-full px-2.5 py-2 rounded-lg border border-transparent hover:border-border focus:border-primary/40 bg-transparent text-sm font-body text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all"
      />
      {suffix && value && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/50 pointer-events-none font-body">
          {suffix}
        </span>
      )}
    </div>
  );
}

/* ── Section divider with title ── */
function SectionTitle({ icon: Icon, title }: { icon: React.ComponentType<{ className?: string }>; title: string }) {
  return (
    <div className="flex items-center gap-2.5 pt-6 pb-2 first:pt-0">
      <div className="h-6 w-6 rounded-md bg-primary/8 flex items-center justify-center">
        <Icon className="h-3.5 w-3.5 text-primary" />
      </div>
      <h2 className="text-xs font-display font-bold text-foreground uppercase tracking-[0.08em]">{title}</h2>
      <div className="flex-1 h-px bg-gradient-to-r from-border/40 to-transparent ml-1" />
    </div>
  );
}

interface NewBudgetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (budgetId: string) => void;
}

export function NewBudgetModal({ open, onOpenChange, onSuccess }: NewBudgetModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"new" | "import">("new");

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

  // Import mode fields
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [manualTotalRaw, setManualTotalRaw] = useState("");
  const [importNotes, setImportNotes] = useState("");

  const projectName = useMemo(() => {
    const parts = [
      clientName.trim(),
      condominio.trim(),
      metargemRaw.trim() ? `${metargemRaw.trim()}m²` : "",
    ].filter(Boolean);
    return parts.join(" · ") || "";
  }, [clientName, condominio, metargemRaw]);

  const handleMetragemChange = (val: string) => {
    setMetragemRaw(val.replace(/[^0-9.,]/g, ""));
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
    setPdfFile(null);
    setManualTotalRaw("");
    setImportNotes("");
    setMode("new");
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

  const parseManualTotal = useCallback((): number | null => {
    const raw = manualTotalRaw.replace(/[R$\s.]/g, "").replace(",", ".");
    const num = Number(raw);
    return Number.isFinite(num) && num > 0 ? num : null;
  }, [manualTotalRaw]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!clientName.trim()) {
      toast.error("Preencha ao menos o nome do cliente.");
      return;
    }

    const isImport = mode === "import";
    if (isImport) {
      if (!pdfFile) { toast.error("Anexe o PDF do orçamento."); return; }
      const total = parseManualTotal();
      if (!total) { toast.error("Informe o valor total do orçamento."); return; }
    }

    setLoading(true);

    const links = referenceLinks.filter((l) => l.trim().length > 0);
    const metragemFormatted = metargemRaw.trim() ? `${metargemRaw.trim()}m²` : null;

    // Upload PDF if import mode
    let budgetPdfPath: string | null = null;
    if (isImport && pdfFile) {
      const timestamp = Date.now();
      const safeName = clientName.trim().replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30);
      const fileName = `${safeName}_${timestamp}.pdf`;
      const filePath = `imports/${fileName}`;
      const { error: uploadErr } = await supabase.storage
        .from("budget-pdfs")
        .upload(filePath, pdfFile, { contentType: "application/pdf" });
      if (uploadErr) {
        console.error("PDF upload error:", uploadErr);
        toast.error("Erro ao fazer upload do PDF.");
        setLoading(false);
        return;
      }
      budgetPdfPath = filePath;
    }

    const manualTotal = isImport ? parseManualTotal() : null;
    const publicId = isImport ? crypto.randomUUID().replace(/-/g, "").slice(0, 12) : null;

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
        due_at: isImport ? null : (dueAt || null),
        priority: isImport ? "normal" : priority,
        internal_notes: (isImport && importNotes.trim()) ? importNotes.trim() : (internalNotes.trim() || null),
        reference_links: links.length > 0 ? links : [],
        hubspot_deal_url: hubspotDealUrl.trim() || null,
        internal_status: isImport ? "delivered_to_sales" : "requested",
        status: "draft",
        commercial_owner_id: commercialOwnerId || user.id,
        estimator_owner_id: isImport ? null : (estimatorOwnerId || null),
        created_by: user.id,
        budget_pdf_url: budgetPdfPath,
        manual_total: manualTotal,
        public_id: publicId,
      } as Record<string, unknown>)
      .select("id")
      .single();

    if (error || !data) {
      console.error("Budget insert error:", error?.message, error?.details, error?.hint, error);
      toast.error(`Erro ao criar solicitação: ${error?.message || "resposta vazia"}`);
      setLoading(false);
      return;
    }

    if (isImport) {
      await supabase.from("budget_events").insert([{
        budget_id: data.id,
        user_id: user.id,
        event_type: "imported_ready",
        to_status: "delivered_to_sales",
        metadata: { manual_total: manualTotal, pdf_file: pdfFile?.name },
      }]);
    } else {
      try {
        const tplId = selectedTemplateId && selectedTemplateId !== "none" ? selectedTemplateId : null;
        await seedFromTemplate(data.id, tplId);
      } catch (seedErr) {
        console.error("Erro ao criar seções padrão:", seedErr);
      }
    }

    setLoading(false);

    if (isImport) {
      toast.success("Orçamento importado!", {
        description: "Aparece na coluna \"Entregue\" do pipeline comercial.",
        duration: 6000,
      });
    } else {
      const estimatorName = orcamentistas.find((m) => m.id === estimatorOwnerId)?.full_name;
      toast.success("Solicitação criada!", {
        description: estimatorName ? `Atribuída para ${estimatorName}` : "O orçamento entrará na fila de triagem.",
        action: {
          label: "Abrir orçamento",
          onClick: () => navigate(`/admin/budget/${data.id}`),
        },
        duration: 8000,
      });
    }

    resetForm();
    onOpenChange(false);
    onSuccess?.(data.id);
  };

  // Progress calculation
  const completionItems = [
    { done: !!clientName.trim(), label: "Cliente" },
    { done: !!condominio.trim() || !!bairro.trim(), label: "Local" },
    { done: !!metargemRaw.trim(), label: "Metragem" },
    { done: !!briefing.trim() || !!demandContext.trim(), label: "Briefing" },
  ];
  const progressPercent = Math.round(
    (completionItems.filter((i) => i.done).length / completionItems.length) * 100
  );

  const selectTriggerClass = "border-transparent hover:border-border shadow-none h-auto py-2 px-2.5 text-sm font-body bg-transparent focus:ring-1 focus:ring-primary/20";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/40 relative">
          <DialogTitle className="text-base font-display font-bold flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
              {mode === "import" ? <Upload className="h-3.5 w-3.5 text-primary" /> : <Plus className="h-3.5 w-3.5 text-primary" />}
            </div>
            {mode === "import" ? "Importar Orçamento Pronto" : "Nova Solicitação"}
          </DialogTitle>
          <DialogDescription className="text-xs font-body text-muted-foreground">
            {mode === "import" ? "Anexe o PDF e registre no pipeline" : "Preencha o briefing para iniciar a produção"}
          </DialogDescription>
          {/* Progress bar */}
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-transparent">
            <div
              className="h-full bg-primary/60 rounded-r-full transition-all duration-700 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-160px)]">
          <form id="new-budget-form" onSubmit={handleSubmit} className="px-6 py-4">
            {/* Mode toggle */}
            <div className="flex items-center gap-2 mb-4 p-1 rounded-xl bg-muted/50 border border-border/30">
              <button
                type="button"
                onClick={() => setMode("new")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-body font-medium transition-all",
                  mode === "new" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <FileText className="h-3.5 w-3.5" />
                Nova solicitação
              </button>
              <button
                type="button"
                onClick={() => setMode("import")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-body font-medium transition-all",
                  mode === "import" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Upload className="h-3.5 w-3.5" />
                Importar pronto
              </button>
            </div>

            {/* Project name preview */}
            {projectName && (
              <div className="mb-4 px-3 py-2 rounded-lg bg-primary/3 border border-primary/8">
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-body">
                  <Sparkles className="h-3 w-3 text-primary/50" />
                  <span>Projeto:</span>
                  <span className="font-semibold text-foreground font-display tracking-tight">{projectName}</span>
                </div>
              </div>
            )}

            {/* ── Import-specific fields ── */}
            {mode === "import" && (
              <>
                <SectionTitle icon={Upload} title="Orçamento (PDF)" />
                <div className="border-b border-border/30 pb-1 mb-1">
                  <PropertyRow icon={Upload} label="Arquivo PDF" required>
                    <div className="space-y-2">
                      {pdfFile ? (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-success/5 border border-success/20">
                          <FileText className="h-4 w-4 text-success shrink-0" />
                          <span className="text-sm font-body text-foreground truncate flex-1">{pdfFile.name}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">{(pdfFile.size / 1024 / 1024).toFixed(1)}MB</span>
                          <button type="button" onClick={() => setPdfFile(null)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center gap-2 px-4 py-5 rounded-lg border-2 border-dashed border-border/60 hover:border-primary/40 cursor-pointer transition-colors bg-muted/20">
                          <Upload className="h-5 w-5 text-muted-foreground" />
                          <span className="text-xs font-body text-muted-foreground">Clique ou arraste o PDF</span>
                          <span className="text-[10px] text-muted-foreground/50">Máximo 20MB</span>
                          <input
                            type="file"
                            accept=".pdf"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f && f.size > 20 * 1024 * 1024) { toast.error("Arquivo excede 20MB."); return; }
                              if (f) setPdfFile(f);
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </PropertyRow>
                  <PropertyRow icon={DollarSign} label="Valor total" required hint="Valor de venda do orçamento">
                    <NotionInput value={manualTotalRaw} onChange={setManualTotalRaw} placeholder="150.000,00" maxLength={20} required suffix="R$" />
                  </PropertyRow>
                  <PropertyRow icon={StickyNote} label="Observações" hint="Ex: Orçamento feito no Obra Prima">
                    <Textarea
                      value={importNotes}
                      onChange={(e) => setImportNotes(e.target.value)}
                      placeholder="Notas sobre este orçamento importado..."
                      rows={2}
                      maxLength={2000}
                      className="border-transparent hover:border-border focus:border-primary/40 bg-transparent text-sm font-body placeholder:text-muted-foreground/40 focus:ring-1 focus:ring-primary/20 resize-none"
                    />
                  </PropertyRow>
                </div>
              </>
            )}

            {/* ── Template ── */}
            {mode !== "import" && templates.length > 0 && (
              <>
                <SectionTitle icon={LayoutTemplate} title="Template" />
                <PropertyRow icon={LayoutTemplate} label="Modelo base">
                  <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                    <SelectTrigger className={selectTriggerClass}>
                      <SelectValue placeholder="Selecione um template (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem template (seções padrão)</SelectItem>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </PropertyRow>
                {selectedTemplateId && selectedTemplateId !== "none" && (
                  <p className="text-[11px] text-muted-foreground font-body ml-[164px] -mt-1 mb-1">
                    {templates.find((t) => t.id === selectedTemplateId)?.description}
                  </p>
                )}
              </>
            )}

            {/* ── Cliente ── */}
            <SectionTitle icon={User} title="Cliente" />
            <div className="border-b border-border/30 pb-1 mb-1">
              <PropertyRow icon={User} label="Nome" required>
                <NotionInput value={clientName} onChange={setClientName} placeholder="João Silva" maxLength={255} required />
              </PropertyRow>
              <PropertyRow icon={Mail} label="E-mail">
                <NotionInput value={clientEmail} onChange={setClientEmail} placeholder="cliente@email.com" type="email" maxLength={255} />
              </PropertyRow>
              <PropertyRow icon={Phone} label="Telefone">
                <NotionInput value={clientPhone} onChange={setClientPhone} placeholder="(11) 99999-9999" maxLength={20} />
              </PropertyRow>
            </div>

            {/* ── Imóvel ── */}
            <SectionTitle icon={Building2} title="Imóvel" />
            <div className="border-b border-border/30 pb-1 mb-1">
              <PropertyRow icon={Building2} label="Condomínio">
                <NotionInput value={condominio} onChange={setCondominio} placeholder="Ed. Aurora" maxLength={255} />
              </PropertyRow>
              <PropertyRow icon={MapPin} label="Bairro">
                <NotionInput value={bairro} onChange={setBairro} placeholder="Brooklin" maxLength={100} />
              </PropertyRow>
              <PropertyRow icon={Ruler} label="Metragem">
                <NotionInput value={metargemRaw} onChange={handleMetragemChange} placeholder="82" maxLength={10} suffix="m²" />
              </PropertyRow>
              <PropertyRow icon={Home} label="Tipo de locação">
                <Select value={locationType} onValueChange={setLocationType}>
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCATION_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </PropertyRow>
            </div>

            {/* ── Briefing ── */}
            <SectionTitle icon={FileText} title="Briefing e Contexto" />
            <div className="border-b border-border/30 pb-1 mb-1">
              <PropertyRow icon={FileText} label="Contexto" hint="Como o cliente chegou, urgência...">
                <Textarea
                  value={demandContext}
                  onChange={(e) => setDemandContext(e.target.value)}
                  placeholder="Ex: Cliente indicado pelo corretor X..."
                  rows={2}
                  maxLength={2000}
                  className="border-transparent hover:border-border focus:border-primary/40 bg-transparent text-sm font-body placeholder:text-muted-foreground/40 focus:ring-1 focus:ring-primary/20 resize-none"
                />
              </PropertyRow>
              <PropertyRow icon={FileText} label="Briefing" hint="Escopo, preferências, restrições...">
                <Textarea
                  value={briefing}
                  onChange={(e) => setBriefing(e.target.value)}
                  placeholder="Descreva o escopo desejado..."
                  rows={3}
                  maxLength={5000}
                  className="border-transparent hover:border-border focus:border-primary/40 bg-transparent text-sm font-body placeholder:text-muted-foreground/40 focus:ring-1 focus:ring-primary/20 resize-none"
                />
              </PropertyRow>
            </div>

            {/* ── Responsáveis ── */}
            <SectionTitle icon={UserCheck} title="Responsáveis" />
            <div className="border-b border-border/30 pb-1 mb-1">
              <PropertyRow icon={UserCheck} label="Comercial">
                <Select value={commercialOwnerId} onValueChange={setCommercialOwnerId}>
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue placeholder="Selecione o comercial" />
                  </SelectTrigger>
                  <SelectContent>
                    {comerciais.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </PropertyRow>
              {mode !== "import" && (
                <PropertyRow icon={UserCheck} label="Orçamentista">
                  <div>
                    <Select value={estimatorOwnerId} onValueChange={setEstimatorOwnerId}>
                      <SelectTrigger className={selectTriggerClass}>
                        <SelectValue placeholder="Selecione o orçamentista" />
                      </SelectTrigger>
                      <SelectContent>
                        {orcamentistas.map((m) => (
                          <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {nextEstimatorId && estimatorOwnerId === nextEstimatorId && (
                      <p className="text-[11px] text-muted-foreground font-body flex items-center gap-1 mt-1 ml-2.5">
                        <UserCheck className="h-3 w-3 text-success" />
                        Rodízio automático: <span className="font-medium">{orcamentistas.find((m) => m.id === nextEstimatorId)?.full_name}</span>
                      </p>
                    )}
                    {nextEstimatorId && estimatorOwnerId && estimatorOwnerId !== nextEstimatorId && (
                      <p className="text-[11px] text-muted-foreground font-body flex items-center gap-1 mt-1 ml-2.5">
                        <UserCheck className="h-3 w-3 text-primary" />
                        Manual (rodízio: {orcamentistas.find((m) => m.id === nextEstimatorId)?.full_name})
                      </p>
                    )}
                  </div>
                </PropertyRow>
              )}
            </div>

            {/* ── Prazo e Prioridade ── */}
            {mode !== "import" && (
              <>
                <SectionTitle icon={Calendar} title="Prazo e Prioridade" />
                <div className="border-b border-border/30 pb-1 mb-1">
                  <PropertyRow icon={Calendar} label="Prazo desejado">
                    <input
                      type="date"
                      value={dueAt}
                      onChange={(e) => setDueAt(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      className="px-2.5 py-2 rounded-lg border border-transparent hover:border-border focus:border-primary/40 bg-transparent text-sm font-body text-foreground focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all"
                    />
                  </PropertyRow>
                  <PropertyRow icon={AlertTriangle} label="Prioridade">
                    <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                      <SelectTrigger className={selectTriggerClass}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(PRIORITIES).map(([key, { label }]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </PropertyRow>
                </div>
              </>
            )}

            {/* ── Links ── */}
            <SectionTitle icon={LinkIcon} title="Links e Referências" />
            <div className="border-b border-border/30 pb-1 mb-1">
              <PropertyRow icon={ExternalLink} label="Hubspot" hint="URL do negócio no Hubspot">
                <NotionInput value={hubspotDealUrl} onChange={setHubspotDealUrl} placeholder="https://app.hubspot.com/..." type="url" />
              </PropertyRow>
              <PropertyRow icon={LinkIcon} label="Referências">
                <div className="space-y-2">
                  {referenceLinks.map((link, i) => (
                    <div key={i} className="flex gap-1.5">
                      <input
                        value={link}
                        onChange={(e) => updateLink(i, e.target.value)}
                        placeholder="https://..."
                        type="url"
                        className="flex-1 px-2.5 py-2 rounded-lg border border-transparent hover:border-border focus:border-primary/40 bg-transparent text-sm font-body text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all"
                      />
                      {referenceLinks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLink(i)}
                          className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addLink}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary font-body py-1 px-2 rounded-md hover:bg-primary/5 transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                    Adicionar link
                  </button>
                </div>
              </PropertyRow>
            </div>

            {/* ── Notas internas ── */}
            <SectionTitle icon={StickyNote} title="Observações Internas" />
            <div className="pb-2">
              <PropertyRow icon={StickyNote} label="Notas" hint="Visíveis apenas internamente">
                <Textarea
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  placeholder="Notas visíveis apenas internamente..."
                  rows={2}
                  maxLength={2000}
                  className="border-transparent hover:border-border focus:border-primary/40 bg-transparent text-sm font-body placeholder:text-muted-foreground/40 focus:ring-1 focus:ring-primary/20 resize-none"
                />
              </PropertyRow>
            </div>

            {/* ── Completion checklist ── */}
            <div className="rounded-xl border border-border/40 bg-card p-4 mb-2">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-display font-bold text-muted-foreground uppercase tracking-[0.08em]">
                  Checklist
                </p>
                <span className={cn(
                  "text-[11px] font-mono tabular-nums px-2 py-0.5 rounded-full",
                  progressPercent === 100
                    ? "bg-success/10 text-success"
                    : "bg-muted text-muted-foreground"
                )}>
                  {completionItems.filter(i => i.done).length}/{completionItems.length}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {completionItems.map((item) => (
                  <div
                    key={item.label}
                    className={cn(
                      "flex items-center gap-1.5 text-[11px] font-body px-2.5 py-1.5 rounded-lg border transition-all duration-300",
                      item.done
                        ? "text-success bg-success/5 border-success/15"
                        : "text-muted-foreground/60 bg-muted/20 border-border/30"
                    )}
                  >
                    <CheckCircle2 className={cn(
                      "h-3 w-3 shrink-0 transition-colors",
                      item.done ? "text-success" : "text-muted-foreground/20"
                    )} />
                    <span className={item.done ? "font-medium" : ""}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </form>
        </ScrollArea>

        <DialogFooter className="px-6 py-3 border-t border-border/40 bg-card/50">
          <div className="flex items-center justify-between w-full gap-3">
            <span className="text-[11px] text-muted-foreground/60 font-mono tabular-nums hidden sm:inline">
              {progressPercent}%
            </span>
            <div className="flex items-center gap-2 ml-auto">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleOpenChange(false)}
                disabled={loading}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                form="new-budget-form"
                disabled={loading || !clientName.trim() || (mode === "import" && (!pdfFile || !manualTotalRaw.trim()))}
                size="sm"
                className="gap-1.5 text-xs h-8"
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : mode === "import" ? (
                  <PackageCheck className="h-3.5 w-3.5" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                {loading ? "Criando…" : mode === "import" ? "Importar Orçamento" : "Criar Solicitação"}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
