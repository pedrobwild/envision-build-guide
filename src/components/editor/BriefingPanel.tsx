import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useIsMobile } from "@/hooks/use-mobile";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  PanelRightClose,
  PanelRightOpen,
  Clock,
  ArrowRight,
  MessageSquare,
  GitBranch,
  Send,
  Handshake,
  User,
  MapPin,
  Ruler,
  Home,
  CalendarClock,
  Flag,
  FileText,
  StickyNote,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { CommentQuickTemplates } from "@/components/editor/CommentQuickTemplates";

interface BriefingPanelProps {
  budgetId: string;
  budget: Record<string, unknown>;
  onBudgetFieldChange: (field: string, value: string | number | boolean | null) => void;
}

const EVENT_ICONS: Record<string, React.ElementType> = {
  status_change: ArrowRight,
  comment: MessageSquare,
  version: GitBranch,
  published: Send,
  contract: Handshake,
};

const PRIORITY_COLORS: Record<string, string> = {
  alta: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",
  media: "bg-warning/10 text-warning border-warning/20",
  normal: "bg-muted text-muted-foreground border-border",
  baixa: "bg-muted text-muted-foreground border-border",
};

export function BriefingPanel({ budgetId, budget, onBudgetFieldChange }: BriefingPanelProps) {
  const { isAdmin, isComercial, isOrcamentista } = useUserProfile();
  const isMobile = useIsMobile();

  const [expanded, setExpanded] = useState(() => window.innerWidth >= 1280);
  const [events, setEvents] = useState<Record<string, unknown>[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const autoSaveTimers = useRef<Record<string, NodeJS.Timeout>>({});
  const briefingTextareaRef = useRef<HTMLTextAreaElement>(null);
  const estimatorTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-collapse on narrow screens
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1280px)");
    const handler = (e: MediaQueryListEvent) => {
      if (!e.matches) setExpanded(false);
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // Fetch events
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingEvents(true);
      const { data } = await supabase
        .from("budget_events")
        .select("*")
        .eq("budget_id", budgetId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (!cancelled) {
        setEvents(data ?? []);
        setLoadingEvents(false);
      }
    }
    load();

    // Realtime subscription
    const channel = supabase
      .channel(`budget-events-${budgetId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "budget_events",
          filter: `budget_id=eq.${budgetId}`,
        },
        (payload) => {
          setEvents((prev) => [payload.new as Record<string, unknown>, ...prev].slice(0, 50));
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [budgetId]);

  const debouncedSave = useCallback((field: string, value: string | number | boolean | null) => {
    if (autoSaveTimers.current[field]) clearTimeout(autoSaveTimers.current[field]);
    autoSaveTimers.current[field] = setTimeout(async () => {
      await supabase.from("budgets").update({ [field]: value } as Record<string, unknown>).eq("id", budgetId);
    }, 800);
  }, [budgetId]);

  const handleFieldChange = useCallback((field: string, value: any) => {
    onBudgetFieldChange(field, value);
    debouncedSave(field, value);
  }, [onBudgetFieldChange, debouncedSave]);

  const canEditBriefing = isAdmin || isComercial;
  const canEditEstimatorNotes = isAdmin || isOrcamentista;

  // Determine if there are recent events (simple: any event in last 24h)
  const hasRecentEvents = events.length > 0 &&
    new Date(events[0].created_at).getTime() > Date.now() - 86400000;

  if (!expanded) {
    return (
      <div className="flex-shrink-0 w-10 border-l border-border bg-card flex flex-col items-center pt-3 gap-3">
        <button
          onClick={() => setExpanded(true)}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors relative"
          title="Abrir painel de briefing"
        >
          <PanelRightOpen className="h-4 w-4" />
          {hasRecentEvents && (
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="flex-shrink-0 w-80 border-l border-border bg-card flex flex-col transition-all duration-200 overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
        <span className="font-display font-semibold text-sm text-foreground">Briefing</span>
        <button
          onClick={() => setExpanded(false)}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="Fechar painel"
        >
          <PanelRightClose className="h-4 w-4" />
        </button>
      </div>

      <Tabs defaultValue="briefing" className="flex flex-col flex-1 min-h-0">
        <TabsList className="mx-3 mt-2 grid grid-cols-2">
          <TabsTrigger value="briefing">Briefing</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        {/* ─── Tab: Briefing ─── */}
        <TabsContent value="briefing" className="flex-1 overflow-y-auto px-3 pb-4 space-y-4 mt-3">
          {/* Client name — always read-only */}
          <FieldRow icon={User} label="Cliente">
            <span className="text-sm text-foreground font-body">{budget.client_name || "—"}</span>
          </FieldRow>

          {/* Address (condominio + bairro) */}
          <FieldRow icon={MapPin} label="Endereço">
            {canEditBriefing ? (
              <div className="space-y-1.5">
                <Input
                  placeholder="Condomínio"
                  value={budget.condominio ?? ""}
                  onChange={(e) => handleFieldChange("condominio", e.target.value)}
                  className="h-8 text-sm"
                />
                <Input
                  placeholder="Bairro"
                  value={budget.bairro ?? ""}
                  onChange={(e) => handleFieldChange("bairro", e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            ) : (
              <span className="text-sm text-foreground font-body">
                {[budget.condominio, budget.bairro].filter(Boolean).join(", ") || "—"}
              </span>
            )}
          </FieldRow>

          {/* Area m² */}
          <FieldRow icon={Ruler} label="Área (m²)">
            {canEditBriefing ? (
              <Input
                placeholder="Ex: 120m²"
                value={budget.metragem ?? ""}
                onChange={(e) => handleFieldChange("metragem", e.target.value)}
                className="h-8 text-sm"
              />
            ) : (
              <span className="text-sm text-foreground font-body">{budget.metragem || "—"}</span>
            )}
          </FieldRow>

          {/* Project type */}
          <FieldRow icon={Home} label="Tipo de imóvel">
            {canEditBriefing ? (
              <Input
                placeholder="Ex: Apartamento"
                value={budget.property_type ?? ""}
                onChange={(e) => handleFieldChange("property_type", e.target.value)}
                className="h-8 text-sm"
              />
            ) : (
              <span className="text-sm text-foreground font-body">{budget.property_type || "—"}</span>
            )}
          </FieldRow>

          {/* Deadline */}
          <FieldRow icon={CalendarClock} label="Prazo">
            {canEditBriefing ? (
              <Input
                type="date"
                value={budget.due_at ? new Date(budget.due_at).toISOString().slice(0, 10) : ""}
                onChange={(e) => handleFieldChange("due_at", e.target.value || null)}
                className="h-8 text-sm"
              />
            ) : (
              <span className="text-sm text-foreground font-body">
                {budget.due_at
                  ? new Date(budget.due_at).toLocaleDateString("pt-BR")
                  : "—"}
              </span>
            )}
          </FieldRow>

          {/* Priority */}
          <FieldRow icon={Flag} label="Prioridade">
            {canEditBriefing ? (
              <select
                value={budget.priority ?? "normal"}
                onChange={(e) => handleFieldChange("priority", e.target.value)}
                className="h-8 text-sm rounded-md border border-input bg-background px-2 font-body focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="alta">Alta</option>
                <option value="media">Média</option>
                <option value="normal">Normal</option>
                <option value="baixa">Baixa</option>
              </select>
            ) : (
              <Badge
                variant="outline"
                className={cn("text-[10px] font-body", PRIORITY_COLORS[budget.priority ?? "normal"])}
              >
                {(budget.priority ?? "normal").charAt(0).toUpperCase() + (budget.priority ?? "normal").slice(1)}
              </Badge>
            )}
          </FieldRow>

          {/* Commercial instructions (briefing field) */}
          <FieldRow icon={FileText} label="Instruções comerciais">
            {canEditBriefing ? (
              <div>
                <CommentQuickTemplates
                  value={budget.briefing ?? ""}
                  onChange={(v) => handleFieldChange("briefing", v)}
                  textareaRef={briefingTextareaRef}
                />
                <Textarea
                  ref={briefingTextareaRef}
                  placeholder="Instruções do comercial para o orçamentista... (digite / para templates)"
                  value={budget.briefing ?? ""}
                  onChange={(e) => handleFieldChange("briefing", e.target.value)}
                  className="text-sm min-h-[80px] resize-y"
                />
              </div>
            ) : (
              <ReadOnlyBox text={budget.briefing} />
            )}
          </FieldRow>

          {/* Estimator notes (internal_notes field) */}
          <FieldRow icon={StickyNote} label="Notas do orçamentista">
            {canEditEstimatorNotes ? (
              <div>
                <CommentQuickTemplates
                  value={budget.internal_notes ?? ""}
                  onChange={(v) => handleFieldChange("internal_notes", v)}
                  textareaRef={estimatorTextareaRef}
                />
                <Textarea
                  ref={estimatorTextareaRef}
                  placeholder="Anotações do orçamentista... (digite / para templates)"
                  value={budget.internal_notes ?? ""}
                  onChange={(e) => handleFieldChange("internal_notes", e.target.value)}
                  className="text-sm min-h-[80px] resize-y"
                />
              </div>
            ) : (
              <ReadOnlyBox text={budget.internal_notes} />
            )}
          </FieldRow>
        </TabsContent>

        {/* ─── Tab: Histórico ─── */}
        <TabsContent value="historico" className="flex-1 overflow-y-auto px-3 pb-4 mt-3">
          {loadingEvents ? (
            <p className="text-xs text-muted-foreground font-body animate-pulse">Carregando...</p>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <Clock className="h-8 w-8" />
              <p className="text-sm font-body">Nenhum evento registrado ainda.</p>
            </div>
          ) : (
            <div className="relative space-y-0">
              {/* timeline line */}
              <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />

              {events.map((ev) => {
                const Icon = EVENT_ICONS[ev.event_type] ?? Clock;
                return (
                  <div key={ev.id} className="relative flex gap-3 py-2.5">
                    <div className="relative z-10 flex-shrink-0 h-6 w-6 rounded-full bg-muted border border-border flex items-center justify-center">
                      <Icon className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <p className="text-xs font-medium text-foreground font-body leading-tight">
                        {formatEventType(ev.event_type)}
                      </p>
                      {ev.from_status && ev.to_status && (
                        <div className="flex items-center gap-1 flex-wrap">
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-body">
                            {ev.from_status}
                          </Badge>
                          <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-body">
                            {ev.to_status}
                          </Badge>
                        </div>
                      )}
                      {ev.note && (
                        <p className="text-sm text-muted-foreground font-body leading-snug">
                          {ev.note}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground/60 font-body">
                        {formatDistanceToNow(new Date(ev.created_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ─── Helpers ─── */

function FieldRow({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-body">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      {children}
    </div>
  );
}

function ReadOnlyBox({ text }: { text?: string | null }) {
  return (
    <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground font-body min-h-[40px]">
      {text || <span className="text-muted-foreground">—</span>}
    </div>
  );
}

function formatEventType(type: string): string {
  const map: Record<string, string> = {
    status_change: "Mudança de status",
    comment: "Comentário",
    version: "Nova versão",
    published: "Publicado",
    contract: "Contrato",
  };
  return map[type] ?? type;
}
