/**
 * Painel "Inteligência IA" da página de Análises.
 *
 * - Recebe os mesmos dados que o resto da AnalisesPage já carregou
 *   (sem fetch redundante).
 * - Permite pergunta em linguagem natural com sugestões.
 * - Mostra resumo executivo, KPIs principais e cards de insights ranqueados.
 * - Cada insight traz evidências, ação recomendada e visualização opcional.
 *
 * Estado vazio, loading, erro e limitações são tratados explicitamente.
 */

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Brain,
  Copy,
  Download,
  Filter,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { BudgetWithSections } from "@/types/budget-common";
import { useAiDataAnalysis } from "@/hooks/ai-data/useAiDataAnalysis";
import { suggestQuestions, type InsightType } from "@/lib/ai-data";
import { InsightCard } from "./InsightCard";

interface Props {
  budgets: BudgetWithSections[];
  profiles?: Record<string, string>;
  range: { from: Date; to: Date };
  loading?: boolean;
  role?: string;
  screen?: string;
}

const TYPE_FILTERS: Array<{ value: "all" | InsightType; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "operational", label: "Operacional" },
  { value: "financial", label: "Financeiro" },
  { value: "comparative", label: "Comparativo" },
  { value: "diagnostic", label: "Diagnóstico" },
  { value: "predictive", label: "Preditivo" },
  { value: "prescriptive", label: "Recomendações" },
  { value: "funnel", label: "Funil" },
  { value: "data_quality", label: "Qualidade dos dados" },
  { value: "geographic", label: "Geográfico" },
];

export function AiAnalysisPanel({ budgets, profiles, range, loading: externalLoading = false, role, screen }: Props) {
  const [question, setQuestion] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [filterType, setFilterType] = useState<"all" | InsightType>("all");
  const { toast } = useToast();

  const { result, insights, loading, refresh, plannedTypes, rationale } = useAiDataAnalysis({
    budgets,
    profiles,
    range,
    question: submitted,
    context: { role, screen, range },
  });

  const visible = useMemo(
    () => (filterType === "all" ? insights : insights.filter((i) => i.type === filterType)),
    [insights, filterType],
  );

  const suggestions = useMemo(() => suggestQuestions({ role, screen, range }), [role, screen, range]);

  const totalLoading = externalLoading || loading;

  const handleAsk = () => {
    setSubmitted(question.trim());
  };

  const handleCopy = async () => {
    const lines: string[] = [];
    lines.push(`# Resumo executivo — ${new Date().toLocaleString("pt-BR")}`);
    lines.push("");
    lines.push(result.answer);
    lines.push("");
    lines.push(`Confiança média: ${(result.confidence * 100).toFixed(0)}%`);
    if (result.limitations.length > 0) {
      lines.push("");
      lines.push("## Limitações");
      result.limitations.forEach((l) => lines.push(`- ${l}`));
    }
    lines.push("");
    lines.push("## Insights");
    visible.forEach((i) => {
      lines.push(`### [${i.type}] ${i.title}`);
      lines.push(i.summary);
      if (i.recommendedAction) lines.push(`> Ação: ${i.recommendedAction}`);
      lines.push("");
    });
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast({ title: "Resumo copiado", description: "Cole no email ou no chat." });
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  };

  const handleExport = () => {
    const payload = {
      generatedAt: result.generatedAt,
      question: submitted,
      filtersApplied: result.filtersApplied,
      confidence: result.confidence,
      limitations: result.limitations,
      metricsUsed: result.metricsUsed,
      nextSteps: result.nextSteps,
      insights: visible,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analise-ia-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border bg-gradient-to-br from-primary/[0.04] to-transparent">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="rounded-lg bg-primary/10 p-2 shrink-0">
              <Brain className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold font-display text-foreground tracking-tight">
                Inteligência IA — Análise dos Dados
              </h3>
              <p className="text-[11px] font-body text-muted-foreground mt-0.5">
                {totalLoading ? "Calculando insights…" : result.answer}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={refresh} disabled={totalLoading} title="Atualizar análise">
              <RefreshCw className={`h-3.5 w-3.5 ${totalLoading ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy} title="Copiar resumo executivo">
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleExport} title="Exportar análise (JSON)">
              <Download className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* NL Question */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="mt-3 flex flex-col sm:flex-row gap-2">
          <div className="flex-1 flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleAsk();
                }
              }}
              placeholder='Pergunte em linguagem natural — ex.: "Por que a margem caiu?"'
              className="border-0 shadow-none focus-visible:ring-0 px-0 h-7 text-sm font-body"
            />
            <Button onClick={handleAsk} size="sm" className="h-7 px-3 shrink-0" disabled={totalLoading}>
              {totalLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </Button>
          </div>
          <Select value={filterType} onValueChange={(v) => setFilterType(v as typeof filterType)}>
            <SelectTrigger className="h-9 w-full sm:w-44 text-xs">
              <Filter className="h-3 w-3 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPE_FILTERS.map((t) => <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </motion.div>

        {/* Plan / suggestions */}
        {submitted && rationale && (
          <p className="mt-2 text-[10px] font-body text-muted-foreground">
            <span className="font-semibold">Plano: </span>{rationale}
            {plannedTypes.length > 0 && (
              <span className="ml-1">— foco: {plannedTypes.join(", ")}.</span>
            )}
          </p>
        )}

        {!submitted && suggestions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {suggestions.slice(0, 6).map((s) => (
              <button
                key={s}
                onClick={() => { setQuestion(s); setSubmitted(s); }}
                className="text-[11px] px-2 py-1 rounded-md bg-muted/60 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      <ScrollArea className="max-h-[70vh]">
        <div className="p-4 space-y-3">
          {totalLoading && (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
            </div>
          )}

          {!totalLoading && visible.length === 0 && (
            <div className="rounded-lg border border-border bg-muted/20 p-6 text-center">
              <Sparkles className="h-5 w-5 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-body text-foreground">Nenhum insight relevante neste filtro.</p>
              <p className="text-xs font-body text-muted-foreground mt-1">
                Tente trocar o tipo, ampliar o período ou perguntar algo diferente.
              </p>
            </div>
          )}

          {!totalLoading && visible.length > 0 && (
            <>
              <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground/80">
                <span>
                  {visible.length} insight{visible.length === 1 ? "" : "s"} · confiança média {(result.confidence * 100).toFixed(0)}%
                </span>
                {result.metricsUsed.length > 0 && (
                  <span className="flex flex-wrap gap-1 justify-end">
                    {result.metricsUsed.slice(0, 4).map((m) => (
                      <Badge key={m} variant="outline" className="h-4 px-1 text-[9px]">{m}</Badge>
                    ))}
                  </span>
                )}
              </div>

              {visible.map((insight) => (
                <InsightCard key={insight.id} insight={insight} />
              ))}

              {result.nextSteps.length > 0 && (
                <div className="mt-4 rounded-xl border border-primary/20 bg-primary/[0.04] p-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">Próximos passos sugeridos</h4>
                  <ul className="space-y-1">
                    {result.nextSteps.map((s, i) => (
                      <li key={i} className="text-[12px] font-body text-foreground leading-relaxed">→ {s}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.limitations.length > 0 && (
                <div className="mt-2 rounded-xl border border-border bg-muted/20 p-3">
                  <h4 className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Limitações dos dados</h4>
                  <ul className="space-y-0.5">
                    {result.limitations.map((l, i) => (
                      <li key={i} className="text-[11px] font-body text-muted-foreground">• {l}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
