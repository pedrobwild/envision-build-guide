/**
 * Painel de resumo estatístico — uma linha por coluna do dataset.
 *
 * Não monta gráficos pesados (deixa pra ChartRecommendationPanel).
 * Aqui mostramos números crus + barrinha de cardinality.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListChecks } from "lucide-react";
import type { StatisticalSummary } from "./types";

interface Props {
  summaries: StatisticalSummary[] | null;
  loading?: boolean;
  error?: string | null;
}

function fmt(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1000) return n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2);
}

export function StatisticalSummaryPanel({ summaries, loading, error }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <ListChecks className="h-4 w-4 text-primary" />
          Resumo estatístico por coluna
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {loading && (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        )}
        {!loading && error && (
          <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        {!loading && !error && (!summaries || summaries.length === 0) && (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Sem colunas para resumir.
          </div>
        )}
        {!loading && !error && summaries && summaries.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Coluna</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Faltando</TableHead>
                  <TableHead className="text-right">Únicos</TableHead>
                  <TableHead className="text-right">Métrica</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaries.map((s) => (
                  <SummaryRow key={s.column} summary={s} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryRow({ summary }: { summary: StatisticalSummary }) {
  let tagText: string;
  let metric: string;
  switch (summary.kind) {
    case "numeric":
      tagText = "numérica";
      metric = `μ=${fmt(summary.mean)}  med=${fmt(summary.median)}`;
      break;
    case "categorical":
      tagText = "categórica";
      metric = summary.top[0]
        ? `top: ${summary.top[0].value} (${(summary.top[0].share * 100).toFixed(0)}%)`
        : "—";
      break;
    case "temporal":
      tagText = "temporal";
      metric = summary.spanDays !== null ? `${summary.spanDays.toFixed(0)} dias` : "—";
      break;
    case "boolean":
      tagText = "boolean";
      metric = `${(summary.trueShare * 100).toFixed(0)}% true`;
      break;
  }
  return (
    <TableRow>
      <TableCell className="font-medium">{summary.column}</TableCell>
      <TableCell>
        <Badge variant="outline" className="text-[10px]">
          {tagText}
        </Badge>
      </TableCell>
      <TableCell className="text-right tabular-nums">{summary.count}</TableCell>
      <TableCell className="text-right tabular-nums">{summary.missing}</TableCell>
      <TableCell className="text-right tabular-nums">
        {"uniqueCount" in summary ? summary.uniqueCount : "—"}
      </TableCell>
      <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
        {metric}
      </TableCell>
    </TableRow>
  );
}
