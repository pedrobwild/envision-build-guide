import { useNavigate } from "react-router-dom";
import { AlertTriangle, Clock, Eye, ShieldAlert } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { TeamMember } from "@/hooks/useDashboardMetrics";

interface Props {
  data: TeamMember[];
  loading?: boolean;
}

const HEALTH_DOT = {
  healthy: "bg-emerald-500",
  warning: "bg-amber-500",
  critical: "bg-destructive",
};

const TH = "text-[10px] font-medium uppercase tracking-[0.05em] text-muted-foreground font-body pb-2.5 whitespace-nowrap";

export function TeamPerformanceBlock({ data, loading }: Props) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <Skeleton className="h-4 w-40 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground font-body mb-4">
          Performance da equipe
        </h3>
        <p className="text-xs text-muted-foreground font-body py-6 text-center">
          Sem dados de equipe no período
        </p>
      </div>
    );
  }

  const maxActive = Math.max(...data.map((d) => d.activeBudgets), 1);

  // Balance indicator
  const avgLoad = data.length > 0 ? data.reduce((s, m) => s + m.activeBudgets, 0) / data.length : 0;
  const maxLoad = Math.max(...data.map((m) => m.activeBudgets));
  const isBalanced = maxLoad <= avgLoad * 1.5 || maxLoad <= 2;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground font-body">
          Performance da equipe
        </h3>
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-body font-medium ${
                isBalanced
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
              }`}>
                <ShieldAlert className="h-2.5 w-2.5" />
                {isBalanced ? "Carga balanceada" : "Desbalanceada"}
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs font-body max-w-[200px]">
              {isBalanced
                ? "A carga está bem distribuída entre os membros da equipe."
                : `Maior carga: ${maxLoad} itens vs média de ${avgLoad.toFixed(1)}. Considere redistribuir.`}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <p className="text-xs text-muted-foreground/70 font-body mb-4">
        Carga, risco e produtividade por orçamentista
      </p>

      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b border-border">
              <th className={`text-left ${TH} pr-4`}>Orçamentista</th>
              <th className={`text-center ${TH} px-2`}>Ativa</th>
              <th className={`text-center ${TH} px-2`}>Entregues</th>
              <th className={`text-center ${TH} px-2`}>Lead time</th>
              <th className={`text-center ${TH} px-2`}>Atrasados</th>
              <th className={`text-center ${TH} px-2`}>Aguardando</th>
              <th className={`text-center ${TH} px-2`}>Revisão</th>
              <th className={`text-center ${TH} px-2`}>SLA</th>
              <th className={`text-right ${TH} pl-2`}>Ocupação</th>
            </tr>
          </thead>
          <tbody>
            {data.map((member) => (
              <tr
                key={member.id}
                className="border-b border-border/50 last:border-0 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => navigate(`/admin/operacoes?estimator=${member.id}`)}
              >
                {/* Name */}
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${HEALTH_DOT[member.health]}`} />
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-semibold font-display ${
                      member.health === "critical"
                        ? "bg-destructive/10 text-destructive"
                        : member.health === "warning"
                        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-body text-foreground font-medium truncate max-w-[120px]">
                        {member.name}
                      </span>
                      {member.overloaded && (
                        <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />
                      )}
                    </div>
                  </div>
                </td>

                {/* Active */}
                <td className="py-3 px-2 text-center">
                  <span className={`text-sm font-mono tabular-nums font-semibold ${
                    member.overloaded ? "text-destructive" : "text-foreground"
                  }`}>
                    {member.activeBudgets}
                  </span>
                </td>

                {/* Completed */}
                <td className="py-3 px-2 text-center">
                  <span className="text-sm font-mono tabular-nums text-foreground">
                    {member.completedInPeriod}
                  </span>
                </td>

                {/* Lead time */}
                <td className="py-3 px-2 text-center">
                  <span className={`text-sm font-mono tabular-nums ${
                    member.avgLeadTimeDays !== null && member.avgLeadTimeDays > 10
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-muted-foreground"
                  }`}>
                    {member.avgLeadTimeDays !== null ? `${member.avgLeadTimeDays}d` : "—"}
                  </span>
                </td>

                {/* Overdue */}
                <td className="py-3 px-2 text-center">
                  <span className={`text-sm font-mono tabular-nums font-semibold ${
                    member.overdueCount > 0 ? "text-destructive" : "text-muted-foreground/40"
                  }`}>
                    {member.overdueCount}
                  </span>
                </td>

                {/* Waiting info */}
                <td className="py-3 px-2 text-center">
                  <span className={`text-sm font-mono tabular-nums ${
                    member.waitingInfoCount >= 2 ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-muted-foreground/40"
                  }`}>
                    {member.waitingInfoCount}
                  </span>
                </td>

                {/* Review */}
                <td className="py-3 px-2 text-center">
                  <span className={`text-sm font-mono tabular-nums ${
                    member.inReviewCount > 0 ? "text-foreground" : "text-muted-foreground/40"
                  }`}>
                    {member.inReviewCount}
                  </span>
                </td>

                {/* SLA */}
                <td className="py-3 px-2 text-center">
                  <span className={`text-[11px] font-mono tabular-nums font-semibold ${
                    member.slaRate < 60 ? "text-destructive"
                    : member.slaRate < 80 ? "text-amber-600 dark:text-amber-400"
                    : "text-emerald-600 dark:text-emerald-400"
                  }`}>
                    {member.slaRate}%
                  </span>
                </td>

                {/* Occupation bar */}
                <td className="py-3 pl-2">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-14 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${(member.activeBudgets / maxActive) * 100}%`,
                          backgroundColor: member.health === "critical"
                            ? "hsl(var(--destructive))"
                            : member.health === "warning"
                            ? "hsl(38 92% 50%)"
                            : "#0070F3",
                        }}
                      />
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
