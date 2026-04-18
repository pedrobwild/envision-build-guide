import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Video,
  RefreshCw,
  Loader2,
  Users,
  Clock,
  Calendar,
  CheckCircle2,
  HelpCircle,
  ShieldAlert,
  ListChecks,
  ChevronDown,
  FileText,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Participant {
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
}

interface Meeting {
  id: string;
  title: string | null;
  started_at: string | null;
  duration_seconds: number | null;
  participants: Participant[];
  transcript: string | null;
  summary: string | null;
  video_url: string | null;
  audio_url: string | null;
  action_items: unknown[];
  questions: unknown[];
  objections: unknown[];
  next_steps: unknown[];
  full_report: Record<string, unknown> | null;
  external_id: string | null;
  provider: string;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return s === 0 ? `${m} min` : `${m}m ${s}s`;
}

function toStringList(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((v) => {
        if (typeof v === "string") return v;
        if (v && typeof v === "object") {
          const obj = v as Record<string, unknown>;
          return (
            (obj.text as string) ??
            (obj.title as string) ??
            (obj.description as string) ??
            (obj.content as string) ??
            JSON.stringify(v)
          );
        }
        return String(v);
      })
      .filter(Boolean);
  }
  return [String(value)];
}

interface MeetingsPanelProps {
  budgetId: string;
}

export function MeetingsPanel({ budgetId }: MeetingsPanelProps) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ["budget-meetings", budgetId],
    queryFn: async (): Promise<Meeting[]> => {
      const { data, error } = await supabase
        .from("budget_meetings")
        .select(
          "id, title, started_at, duration_seconds, participants, transcript, summary, video_url, audio_url, action_items, questions, objections, next_steps, full_report, external_id, provider"
        )
        .eq("budget_id", budgetId)
        .order("started_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as Meeting[];
    },
  });

  useEffect(() => {
    if (!selectedId && meetings.length > 0) {
      setSelectedId(meetings[0].id);
    }
  }, [meetings, selectedId]);

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("elephan-sync", {
        body: { budget_id: budgetId },
      });
      if (error) throw error;
      return data as { pulled: number; matched: number; unmatched: number; errors?: string[] };
    },
    onSuccess: (data) => {
      if (data?.matched > 0) {
        toast.success(`${data.matched} reunião(ões) sincronizadas`);
      } else if (data?.pulled === 0) {
        toast.info("Nenhuma reunião nova no Elephan.ia");
      } else {
        toast.info(`${data?.pulled ?? 0} reuniões puxadas, nenhuma vinculada a este orçamento`);
      }
      queryClient.invalidateQueries({ queryKey: ["budget-meetings", budgetId] });
      queryClient.invalidateQueries({ queryKey: ["budget-hub", budgetId] });
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "Falha ao sincronizar";
      toast.error(msg);
    },
  });

  const selected = meetings.find((m) => m.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-display font-semibold">Reuniões gravadas</h3>
          <p className="text-xs text-muted-foreground font-body">
            Vídeos e análise IA do Elephan.ia
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="gap-2"
        >
          {syncMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Sincronizar agora
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : meetings.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-8 text-center">
          <Video className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-display font-medium mb-1">Nenhuma reunião encontrada</p>
          <p className="text-xs text-muted-foreground font-body mb-4">
            Reuniões do Elephan.ia são vinculadas a este orçamento pelo telefone ou email do cliente.
          </p>
          <Button
            size="sm"
            variant="default"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="gap-2"
          >
            {syncMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Buscar no Elephan.ia
          </Button>
        </div>
      ) : (
        <>
          {/* Meetings list — compact */}
          <div className="grid gap-2">
            {meetings.map((m) => {
              const active = m.id === selectedId;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedId(m.id)}
                  className={cn(
                    "w-full text-left rounded-lg border p-3 transition-all",
                    "hover:border-foreground/20",
                    active ? "border-primary/40 bg-primary/5" : "border-border bg-card"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-display font-medium truncate">
                        {m.title || "Reunião sem título"}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground font-body">
                        {m.started_at && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(m.started_at), "dd/MM HH:mm", { locale: ptBR })}
                          </span>
                        )}
                        {m.duration_seconds != null && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDuration(m.duration_seconds)}
                          </span>
                        )}
                        {m.participants?.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {m.participants.length}
                          </span>
                        )}
                      </div>
                    </div>
                    {m.video_url && (
                      <Badge variant="outline" className="text-[10px] gap-1 shrink-0">
                        <Video className="h-3 w-3" />
                        Vídeo
                      </Badge>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <Separator />

          {selected && <MeetingDetail meeting={selected} />}
        </>
      )}
    </div>
  );
}

function MeetingDetail({ meeting }: { meeting: Meeting }) {
  const questions = toStringList(meeting.questions);
  const objections = toStringList(meeting.objections);
  const nextSteps = toStringList(meeting.next_steps);
  const actionItems = toStringList(meeting.action_items);

  return (
    <div className="space-y-4">
      {/* Video player */}
      {meeting.video_url && (
        <div className="rounded-xl overflow-hidden border border-border bg-black aspect-video">
          <video src={meeting.video_url} controls className="w-full h-full" preload="metadata" />
        </div>
      )}

      {!meeting.video_url && meeting.audio_url && (
        <div className="rounded-xl border border-border p-4 bg-muted/30">
          <audio src={meeting.audio_url} controls className="w-full" />
        </div>
      )}

      {/* Header info */}
      <div className="space-y-1">
        <h4 className="text-base font-display font-semibold leading-tight">
          {meeting.title || "Reunião"}
        </h4>
        <div className="flex items-center gap-3 text-xs text-muted-foreground font-body flex-wrap">
          {meeting.started_at && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(new Date(meeting.started_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
            </span>
          )}
          {meeting.duration_seconds != null && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(meeting.duration_seconds)}
            </span>
          )}
        </div>
      </div>

      {/* Participants */}
      {meeting.participants?.length > 0 && (
        <div className="rounded-lg border border-border p-3 bg-card">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Participantes
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {meeting.participants.map((p, i) => (
              <Badge key={i} variant="secondary" className="text-xs font-body">
                {p.name || p.email || p.phone || `Participante ${i + 1}`}
                {p.role && <span className="ml-1 opacity-60">· {p.role}</span>}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      {meeting.summary && (
        <AnalysisCard
          icon={FileText}
          title="Resumo executivo"
          tone="primary"
          content={<p className="text-sm font-body leading-relaxed whitespace-pre-wrap">{meeting.summary}</p>}
        />
      )}

      {/* Next steps */}
      {nextSteps.length > 0 && (
        <AnalysisCard
          icon={CheckCircle2}
          title="Próximos passos"
          tone="success"
          content={
            <ul className="space-y-1.5">
              {nextSteps.map((s, i) => (
                <li key={i} className="text-sm font-body flex gap-2 leading-relaxed">
                  <span className="text-emerald-600 dark:text-emerald-400 shrink-0">→</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          }
        />
      )}

      {/* Action items */}
      {actionItems.length > 0 && (
        <AnalysisCard
          icon={ListChecks}
          title="Action items"
          tone="info"
          content={
            <ul className="space-y-1.5">
              {actionItems.map((s, i) => (
                <li key={i} className="text-sm font-body flex gap-2 leading-relaxed">
                  <span className="text-primary shrink-0">□</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          }
        />
      )}

      {/* Questions */}
      {questions.length > 0 && (
        <AnalysisCard
          icon={HelpCircle}
          title="Dúvidas levantadas"
          tone="info"
          content={
            <ul className="space-y-1.5">
              {questions.map((q, i) => (
                <li key={i} className="text-sm font-body leading-relaxed">
                  <span className="text-muted-foreground mr-1.5">{i + 1}.</span>
                  {q}
                </li>
              ))}
            </ul>
          }
        />
      )}

      {/* Objections */}
      {objections.length > 0 && (
        <AnalysisCard
          icon={ShieldAlert}
          title="Objeções identificadas"
          tone="warning"
          content={
            <ul className="space-y-1.5">
              {objections.map((o, i) => (
                <li key={i} className="text-sm font-body leading-relaxed flex gap-2">
                  <span className="text-amber-600 dark:text-amber-400 shrink-0">⚠</span>
                  <span>{o}</span>
                </li>
              ))}
            </ul>
          }
        />
      )}

      {/* Full report */}
      {meeting.full_report && Object.keys(meeting.full_report).length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors group">
            <span className="text-sm font-display font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Relatório completo da IA
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground group-data-[state=open]:rotate-180 transition-transform" />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 p-3 rounded-lg border border-border bg-muted/20">
            <pre className="text-[11px] font-mono whitespace-pre-wrap break-words leading-relaxed text-foreground/80">
              {JSON.stringify(meeting.full_report, null, 2)}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Transcript */}
      {meeting.transcript && (
        <Collapsible>
          <CollapsibleTrigger className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors group">
            <span className="text-sm font-display font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Transcrição completa
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground group-data-[state=open]:rotate-180 transition-transform" />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 p-3 rounded-lg border border-border bg-muted/20 max-h-96 overflow-y-auto">
            <p className="text-xs font-body whitespace-pre-wrap leading-relaxed text-foreground/80">
              {meeting.transcript}
            </p>
          </CollapsibleContent>
        </Collapsible>
      )}

      {meeting.external_id && (
        <p className="text-[10px] text-muted-foreground/60 font-mono">
          ID Elephan: {meeting.external_id}
        </p>
      )}
    </div>
  );
}

function AnalysisCard({
  icon: Icon,
  title,
  tone,
  content,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  tone: "primary" | "success" | "warning" | "info";
  content: React.ReactNode;
}) {
  const toneClasses = {
    primary: "border-primary/20 bg-primary/5",
    success: "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20",
    warning: "border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20",
    info: "border-border bg-card",
  };
  const iconToneClasses = {
    primary: "text-primary",
    success: "text-emerald-600 dark:text-emerald-400",
    warning: "text-amber-600 dark:text-amber-400",
    info: "text-muted-foreground",
  };
  return (
    <div className={cn("rounded-lg border p-4", toneClasses[tone])}>
      <div className="flex items-center gap-2 mb-2.5">
        <Icon className={cn("h-3.5 w-3.5", iconToneClasses[tone])} />
        <span className="text-xs font-medium uppercase tracking-wide text-foreground/80">{title}</span>
      </div>
      {content}
    </div>
  );
}
