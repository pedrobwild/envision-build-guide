import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ClientTimelineEvent = {
  id: string;
  at: string; // ISO
  budget_id: string;
  budget_code: string | null;
  budget_project: string | null;
  source: "status_change" | "activity" | "comment" | "budget_created" | "lost_reason" | "pipeline_event";
  title: string;
  description?: string | null;
  // status_change
  from_status?: string | null;
  to_status?: string | null;
  // activity
  activity_type?: string | null;
  outcome?: string | null;
  // comment
  body?: string | null;
  // pipeline event metadata (consolidation, auto-assign, etc.)
  event_type?: string | null;
};

type BudgetLite = { id: string; sequential_code: string | null; project_name: string | null; created_at: string | null };

export function useClientTimeline(clientId: string | undefined) {
  return useQuery({
    queryKey: ["client-timeline", clientId],
    enabled: !!clientId,
    queryFn: async (): Promise<ClientTimelineEvent[]> => {
      if (!clientId) return [];

      // 1. budgets do cliente
      const { data: budgets, error: bErr } = await supabase
        .from("budgets")
        .select("id, sequential_code, project_name, created_at")
        .eq("client_id", clientId);
      if (bErr) throw bErr;
      const budgetList = (budgets ?? []) as BudgetLite[];
      if (budgetList.length === 0) return [];

      const ids = budgetList.map((b) => b.id);
      const meta = new Map<string, BudgetLite>();
      for (const b of budgetList) meta.set(b.id, b);

      // 2. paralelo: events + activities + comments + lost_reasons
      const [evRes, actRes, comRes, lostRes] = await Promise.all([
        supabase
          .from("budget_events")
          .select("id, budget_id, event_type, from_status, to_status, note, metadata, created_at")
          .in("budget_id", ids)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("budget_activities")
          .select("id, budget_id, type, title, description, outcome, scheduled_for, completed_at, created_at")
          .in("budget_id", ids)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("budget_comments")
          .select("id, budget_id, body, created_at")
          .in("budget_id", ids)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("budget_lost_reasons")
          .select("id, budget_id, reason_category, reason_detail, lost_at")
          .in("budget_id", ids)
          .order("lost_at", { ascending: false })
          .limit(100),
      ]);

      if (evRes.error) throw evRes.error;
      if (actRes.error) throw actRes.error;
      if (comRes.error) throw comRes.error;
      if (lostRes.error) throw lostRes.error;

      const out: ClientTimelineEvent[] = [];

      // criação de cada orçamento (marco inicial)
      for (const b of budgetList) {
        if (!b.created_at) continue;
        out.push({
          id: `created-${b.id}`,
          at: b.created_at,
          budget_id: b.id,
          budget_code: b.sequential_code,
          budget_project: b.project_name,
          source: "budget_created",
          title: "Orçamento criado",
        });
      }

      for (const ev of evRes.data ?? []) {
        const b = meta.get(ev.budget_id);
        const isStatus = ev.event_type === "status_change";
        out.push({
          id: ev.id,
          at: ev.created_at,
          budget_id: ev.budget_id,
          budget_code: b?.sequential_code ?? null,
          budget_project: b?.project_name ?? null,
          source: isStatus ? "status_change" : "pipeline_event",
          event_type: ev.event_type,
          title: isStatus
            ? "Mudança de etapa"
            : ev.event_type === "pipeline_consolidation"
              ? "Consolidação automática"
              : ev.event_type === "estimator_auto_assigned"
                ? "Orçamentista atribuído"
                : ev.event_type === "pipeline_moved"
                  ? "Pipeline alterado"
                  : ev.event_type ?? "Evento",
          description: ev.note ?? null,
          from_status: ev.from_status ?? null,
          to_status: ev.to_status ?? null,
        });
      }

      for (const a of actRes.data ?? []) {
        const b = meta.get(a.budget_id);
        const at = a.completed_at ?? a.scheduled_for ?? a.created_at;
        out.push({
          id: a.id,
          at,
          budget_id: a.budget_id,
          budget_code: b?.sequential_code ?? null,
          budget_project: b?.project_name ?? null,
          source: "activity",
          activity_type: a.type,
          outcome: a.outcome ?? null,
          title: a.title,
          description: a.description,
        });
      }

      for (const c of comRes.data ?? []) {
        const b = meta.get(c.budget_id);
        out.push({
          id: c.id,
          at: c.created_at,
          budget_id: c.budget_id,
          budget_code: b?.sequential_code ?? null,
          budget_project: b?.project_name ?? null,
          source: "comment",
          title: "Comentário interno",
          body: c.body,
        });
      }

      for (const l of lostRes.data ?? []) {
        const b = meta.get(l.budget_id);
        out.push({
          id: `lost-${l.id}`,
          at: l.lost_at,
          budget_id: l.budget_id,
          budget_code: b?.sequential_code ?? null,
          budget_project: b?.project_name ?? null,
          source: "lost_reason",
          title: "Motivo de perda registrado",
          description: [l.reason_category, l.reason_detail].filter(Boolean).join(" — "),
        });
      }

      out.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      return out;
    },
    staleTime: 30_000,
  });
}
