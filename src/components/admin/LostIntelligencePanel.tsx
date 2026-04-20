import { useMemo, useState } from "react";
import { useLostReasons, type LostReasonRow } from "@/hooks/useLostReasons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatBRL } from "@/lib/formatBRL";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingDown, AlertTriangle, Trophy, Users, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  /** Mapa userId → nome para exibir no ranking. */
  getProfileName?: (id: string | null) => string;
}

const WINDOW_OPTIONS = [
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
  { value: "180", label: "180 dias" },
  { value: "365", label: "365 dias" },
];

/**
 * Painel de Inteligência de Perda — agrega motivos, valor perdido,
 * concorrentes e ranking por consultora a partir de `budget_lost_reasons`.
 */
export function LostIntelligencePanel({ getProfileName }: Props) {
  const [days, setDays] = useState("90");
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading } = useLostReasons({ days: Number(days) });

  const maxCategoryCount = useMemo(() => {
    if (!data?.byCategory.length) return 1;
    return Math.max(...data.byCategory.map((c) => c.count));
  }, [data]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-destructive" />
            Inteligência de Perda
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.total === 0) {
    return (
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-destructive" />
            Inteligência de Perda
          </CardTitle>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="h-7 w-[110px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WINDOW_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground font-body text-center py-6">
            Nenhuma perda registrada nos últimos {days} dias.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm font-display flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-destructive" />
          Inteligência de Perda
          <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0 h-4 ml-1">
            {data.total}
          </Badge>
        </CardTitle>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="h-7 w-[110px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WINDOW_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>

      <CardContent className="space-y-5 pt-0">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <KpiBlock
            label="Negócios perdidos"
            value={data.total.toString()}
            icon={<TrendingDown className="h-3.5 w-3.5 text-destructive" />}
          />
          <KpiBlock
            label="Valor perdido"
            value={formatBRL(data.totalValueLost)}
            icon={<AlertTriangle className="h-3.5 w-3.5 text-warning" />}
          />
          <KpiBlock
            label="Concorrentes"
            value={data.byCompetitor.length.toString()}
            icon={<Trophy className="h-3.5 w-3.5 text-primary" />}
          />
        </div>

        {/* Ranking de motivos */}
        <section>
          <h4 className="text-[11px] font-body font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Motivos
          </h4>
          <div className="space-y-1.5">
            {data.byCategory.map((c) => {
              const widthPct = (c.count / maxCategoryCount) * 100;
              return (
                <div key={c.category} className="space-y-0.5">
                  <div className="flex items-center justify-between text-xs font-body">
                    <span className="text-foreground truncate">{c.label}</span>
                    <span className="font-mono tabular-nums text-muted-foreground shrink-0 ml-2">
                      {c.count} · {formatBRL(c.valueLost)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-destructive/70 rounded-full transition-all"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Concorrentes */}
        {data.byCompetitor.length > 0 && (
          <section>
            <h4 className="text-[11px] font-body font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
              <Trophy className="h-3 w-3" /> Top concorrentes
            </h4>
            <div className="space-y-1">
              {data.byCompetitor.slice(0, 5).map((c) => (
                <div
                  key={c.name}
                  className="flex items-center justify-between text-xs font-body py-1 border-b border-border/40 last:border-0"
                >
                  <span className="text-foreground truncate">{c.name}</span>
                  <div className="flex items-center gap-2 shrink-0 ml-2 font-mono tabular-nums text-muted-foreground">
                    <span>{c.count}×</span>
                    {c.avgValue !== null && (
                      <span className="text-[10px] text-muted-foreground/70">
                        média {formatBRL(c.avgValue)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Ranking por consultora */}
        {data.byOwner.length > 0 && getProfileName && (
          <section>
            <h4 className="text-[11px] font-body font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
              <Users className="h-3 w-3" /> Por consultora
            </h4>
            <div className="space-y-1">
              {data.byOwner.slice(0, 6).map((o) => (
                <div
                  key={o.ownerId}
                  className="flex items-center justify-between text-xs font-body py-1 border-b border-border/40 last:border-0"
                >
                  <span className="text-foreground truncate">{getProfileName(o.ownerId)}</span>
                  <div className="flex items-center gap-2 shrink-0 ml-2 font-mono tabular-nums text-muted-foreground">
                    <span>{o.count} perdas</span>
                    <span className="text-[10px] text-muted-foreground/70">
                      {formatBRL(o.valueLost)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Drill-down */}
        <div className="pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? "Ocultar" : "Ver"} negócios perdidos ({data.total})
          </Button>
          {expanded && (
            <div className="mt-2 max-h-72 overflow-y-auto space-y-1.5 pr-1">
              {data.rows.map((r) => (
                <LostRow key={r.id} row={r} />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function KpiBlock({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 px-2.5 py-2">
      <div className="flex items-center gap-1.5 text-[10px] font-body uppercase tracking-wider text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 text-sm font-display font-semibold text-foreground tabular-nums">
        {value}
      </div>
    </div>
  );
}

function LostRow({ row }: { row: LostReasonRow }) {
  return (
    <div className="rounded-md border border-border/50 px-2.5 py-1.5 bg-card">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-body font-medium text-foreground truncate">
            {row.budget_sequential_code && (
              <span className="text-[10px] font-mono text-muted-foreground mr-1">
                {row.budget_sequential_code}
              </span>
            )}
            {row.budget_client_name || "—"}
          </p>
          <p className="text-[10px] font-body text-muted-foreground truncate">
            {row.budget_project_name}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] font-mono text-muted-foreground">
            {format(new Date(row.lost_at), "dd/MM/yy", { locale: ptBR })}
          </p>
          <p className="text-[11px] font-mono tabular-nums text-destructive font-semibold">
            {formatBRL(row.budget_manual_total ?? 0)}
          </p>
        </div>
      </div>
      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
        <Badge variant="outline" className="text-[9px] py-0 px-1.5 h-4 font-body">
          {row.reason_category}
        </Badge>
        {row.competitor_name && (
          <span className="text-[10px] font-body text-muted-foreground italic">
            vs {row.competitor_name}
            {row.competitor_value ? ` (${formatBRL(row.competitor_value)})` : ""}
          </span>
        )}
      </div>
      {row.reason_detail && (
        <p className="mt-1 text-[10px] font-body text-muted-foreground italic line-clamp-2">
          "{row.reason_detail}"
        </p>
      )}
    </div>
  );
}
