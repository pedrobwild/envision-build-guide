import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BudgetHubCounts {
  activitiesCount: number;
  pendingActivitiesCount: number;
  nextActivityDate: string | null;
  meetingsCount: number;
  conversationsCount: number;
  lastConversationAt: string | null;
  lostReason: {
    reason_category: string;
    reason_detail: string | null;
    competitor_name: string | null;
    competitor_value: number | null;
    lost_at: string;
  } | null;
}

async function fetchBudgetHub(budgetId: string): Promise<BudgetHubCounts> {
  const [activitiesRes, meetingsRes, conversationsRes, lostRes] = await Promise.all([
    supabase
      .from("budget_activities")
      .select("id, scheduled_for, completed_at", { count: "exact" })
      .eq("budget_id", budgetId)
      .order("scheduled_for", { ascending: true, nullsFirst: false }),
    supabase
      .from("budget_meetings")
      .select("id", { count: "exact", head: true })
      .eq("budget_id", budgetId),
    supabase
      .from("budget_conversations")
      .select("id, last_message_at", { count: "exact" })
      .eq("budget_id", budgetId)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(1),
    supabase
      .from("budget_lost_reasons")
      .select("reason_category, reason_detail, competitor_name, competitor_value, lost_at")
      .eq("budget_id", budgetId)
      .maybeSingle(),
  ]);

  const activities = activitiesRes.data ?? [];
  // Pendentes = não-completadas COM scheduled_for (inclui atrasadas — críticas para o usuário ver).
  // "Próxima atividade" usa a primeira FUTURA; se nenhuma, cai para a mais antiga atrasada.
  const now = Date.now();
  const pending = activities.filter((a) => !a.completed_at && a.scheduled_for);
  const future = pending.filter((a) => new Date(a.scheduled_for!).getTime() >= now);
  const next = future[0]?.scheduled_for ?? pending[0]?.scheduled_for ?? null;

  return {
    activitiesCount: activitiesRes.count ?? activities.length,
    pendingActivitiesCount: pending.length,
    nextActivityDate: next,
    meetingsCount: meetingsRes.count ?? 0,
    conversationsCount: conversationsRes.count ?? 0,
    lastConversationAt: conversationsRes.data?.[0]?.last_message_at ?? null,
    lostReason: lostRes.data ?? null,
  };
}

export function useBudgetHub(budgetId: string | undefined) {
  return useQuery({
    queryKey: ["budget-hub", budgetId],
    queryFn: () => fetchBudgetHub(budgetId!),
    enabled: !!budgetId,
    staleTime: 30 * 1000,
  });
}
