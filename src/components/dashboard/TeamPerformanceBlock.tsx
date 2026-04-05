import { useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { TeamMember } from "@/hooks/useDashboardMetrics";

interface Props {
  data: TeamMember[];
  loading?: boolean;
}

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

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground font-body mb-1">
        Performance da equipe
      </h3>
      <p className="text-xs text-muted-foreground/70 font-body mb-4">
        Produtividade e carga por orçamentista
      </p>

      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full min-w-[480px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-[10px] font-medium uppercase tracking-[0.05em] text-muted-foreground font-body pb-2.5 pr-4">
                Orçamentista
              </th>
              <th className="text-center text-[10px] font-medium uppercase tracking-[0.05em] text-muted-foreground font-body pb-2.5 px-2 whitespace-nowrap">
                Carga ativa
              </th>
              <th className="text-center text-[10px] font-medium uppercase tracking-[0.05em] text-muted-foreground font-body pb-2.5 px-2 whitespace-nowrap">
                Entregues
              </th>
              <th className="text-center text-[10px] font-medium uppercase tracking-[0.05em] text-muted-foreground font-body pb-2.5 px-2 whitespace-nowrap">
                Lead time médio
              </th>
              <th className="text-right text-[10px] font-medium uppercase tracking-[0.05em] text-muted-foreground font-body pb-2.5 pl-4 whitespace-nowrap">
                Ocupação
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((member) => (
              <tr
                key={member.id}
                className="border-b border-border/50 last:border-0 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => navigate(`/admin/operacoes?estimator=${member.id}`)}
              >
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2.5">
                    <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold font-display ${
                      member.overloaded
                        ? "bg-destructive/10 text-destructive"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-body text-foreground font-medium truncate max-w-[140px]">
                        {member.name}
                      </span>
                      {member.overloaded && (
                        <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />
                      )}
                    </div>
                  </div>
                </td>
                <td className="py-3 px-2 text-center">
                  <span className={`text-sm font-mono tabular-nums font-semibold ${
                    member.overloaded ? "text-destructive" : "text-foreground"
                  }`}>
                    {member.activeBudgets}
                  </span>
                </td>
                <td className="py-3 px-2 text-center">
                  <span className="text-sm font-mono tabular-nums text-foreground">
                    {member.completedInPeriod}
                  </span>
                </td>
                <td className="py-3 px-2 text-center">
                  <span className={`text-sm font-mono tabular-nums ${
                    member.avgLeadTimeDays !== null && member.avgLeadTimeDays > 10
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-muted-foreground"
                  }`}>
                    {member.avgLeadTimeDays !== null ? `${member.avgLeadTimeDays}d` : "—"}
                  </span>
                </td>
                <td className="py-3 pl-4">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${(member.activeBudgets / maxActive) * 100}%`,
                          backgroundColor: member.overloaded ? "hsl(var(--destructive))" : "#0070F3",
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
