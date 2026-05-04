/**
 * Renderiza um DataQualityReport para o usuário não-técnico.
 *
 * Princípios:
 *  - lógica estatística vive em src/lib/data-quality, NÃO aqui.
 *  - aqui só formatamos e ordenamos.
 *  - estados loading/empty/error explícitos.
 */

import { AlertTriangle, AlertCircle, Info, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type {
  DataQualityIssue,
  DataQualityReport,
  DataQualitySeverity,
} from "./types";

interface Props {
  report: DataQualityReport | null;
  loading?: boolean;
  error?: string | null;
}

const SEVERITY_STYLE: Record<DataQualitySeverity, string> = {
  critical: "border-destructive/30 bg-destructive/[0.05]",
  warning: "border-amber-500/30 bg-amber-500/[0.05]",
  info: "border-border bg-muted/20",
};

const SEVERITY_ICON: Record<DataQualitySeverity, typeof Info> = {
  critical: AlertTriangle,
  warning: AlertCircle,
  info: Info,
};

const SEVERITY_LABEL: Record<DataQualitySeverity, string> = {
  critical: "Crítico",
  warning: "Atenção",
  info: "Observação",
};

export function DataQualityPanel({ report, loading, error }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-primary" />
            Qualidade dos dados
          </CardTitle>
          {report && !loading && (
            <div className="flex items-center gap-1.5">
              <HealthDot score={report.healthScore} />
              <span className="text-[11px] text-muted-foreground tabular-nums">
                Saúde {(report.healthScore * 100).toFixed(0)}%
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {loading && (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-md" />
            ))}
          </div>
        )}
        {!loading && error && (
          <div
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
          >
            Não foi possível analisar a qualidade dos dados: {error}
          </div>
        )}
        {!loading && !error && report && report.issues.length === 0 && (
          <EmptyState />
        )}
        {!loading && !error && report && report.issues.length > 0 && (
          <>
            <div className="flex flex-wrap gap-2 pb-1">
              {(["critical", "warning", "info"] as const).map((sev) => (
                <Badge
                  key={sev}
                  variant="outline"
                  className={cn("text-[11px]", SEVERITY_STYLE[sev])}
                >
                  {SEVERITY_LABEL[sev]}: {report.counts[sev]}
                </Badge>
              ))}
            </div>
            <ul className="space-y-2">
              {report.issues.map((i) => (
                <IssueRow key={i.id} issue={i} />
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function IssueRow({ issue }: { issue: DataQualityIssue }) {
  const Icon = SEVERITY_ICON[issue.severity];
  return (
    <li
      className={cn(
        "rounded-md border p-3 text-sm",
        SEVERITY_STYLE[issue.severity],
      )}
    >
      <div className="flex items-start gap-2">
        <Icon
          className={cn(
            "h-4 w-4 mt-0.5 shrink-0",
            issue.severity === "critical" && "text-destructive",
            issue.severity === "warning" && "text-amber-600 dark:text-amber-400",
            issue.severity === "info" && "text-muted-foreground",
          )}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="leading-snug">{issue.message}</p>
          {issue.suggestion && (
            <p className="mt-1 text-[12px] text-muted-foreground leading-snug">
              <span className="font-medium text-foreground">Sugestão:</span> {issue.suggestion}
            </p>
          )}
          {issue.columns.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {issue.columns.slice(0, 4).map((c) => (
                <Badge key={c} variant="outline" className="text-[10px] font-mono">
                  {c}
                </Badge>
              ))}
              {issue.columns.length > 4 && (
                <span className="text-[10px] text-muted-foreground">
                  +{issue.columns.length - 4}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function HealthDot({ score }: { score: number }) {
  const color =
    score >= 0.8 ? "bg-emerald-500" : score >= 0.5 ? "bg-amber-500" : "bg-destructive";
  return <span className={cn("inline-block h-2 w-2 rounded-full", color)} aria-hidden />;
}

function EmptyState() {
  return (
    <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
      <Sparkles className="h-4 w-4 mx-auto mb-1.5 text-emerald-500" />
      Nenhum problema de qualidade detectado.
    </div>
  );
}
