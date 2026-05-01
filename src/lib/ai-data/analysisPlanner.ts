/**
 * Analysis Planner — converte uma pergunta em linguagem natural em um
 * plano executável: entidade alvo, métrica relevante, filtros e tipos
 * de insight a priorizar.
 *
 * Esta camada é HEURÍSTICA (matching de palavras-chave + glossário).
 * Não chama LLM. Para queries complexas, devolva uma intenção parcial
 * e deixe o motor decidir; o consumidor pode encaminhar a pergunta
 * para o assistente de chat se quiser interpretação semântica completa.
 *
 * Vantagens:
 *  - Funciona offline e sem custo de API.
 *  - Transparente: o usuário vê quais filtros/métricas foram inferidos.
 *  - Determinístico: facilita teste e regressão.
 */

import type { AnalysisContext, EntityKey, InsightType } from "./types";
import { lookupTerm, normalize } from "./domainGlossary";

export interface AnalysisPlan {
  /** intenção identificada (categorias de insight a priorizar). */
  insightTypes: InsightType[];
  /** entidade foco da pergunta. */
  entity: EntityKey;
  /** métrica principal alvo, se identificada. */
  metric?: string;
  /** filtros sugeridos extraídos da pergunta. */
  filters: Record<string, unknown>;
  /** explicação curta do plano em PT-BR. */
  rationale: string;
  /** confidence em [0,1]. */
  confidence: number;
  /** tokens reconhecidos no glossário (para UX). */
  recognizedTerms: string[];
}

const INTENT_PATTERNS: Array<{ regex: RegExp; types: InsightType[]; rationale: string }> = [
  { regex: /\b(por que|porq|por qu[eê])\b/i, types: ["diagnostic", "comparative"], rationale: "Pergunta diagnóstica — buscando causas." },
  { regex: /\b(prev[ií]?s[ãa]o|forecast|proje[cç][ãa]o|tend[eê]ncia|pr[óo]ximos? meses?|pr[óo]ximas? semanas?)\b/i, types: ["predictive", "comparative"], rationale: "Pergunta sobre futuro/projeção." },
  { regex: /\b(o que devo|priorizar|recomend|deveria|melhor a[cç][ãa]o|ag[ií]r|destravar)\b/i, types: ["prescriptive", "operational"], rationale: "Pergunta acionável — priorizando recomendações." },
  { regex: /\b(risco|atras|vencid|gargalo|trava|parad)\b/i, types: ["operational", "diagnostic", "prescriptive"], rationale: "Foco em risco/operação." },
  { regex: /\b(margem|lucro|receita|custo|ticket|financeir|rentab)\b/i, types: ["financial", "comparative"], rationale: "Foco financeiro." },
  { regex: /\b(funil|convers[ãa]o|etapa|estagio|est[aá]gio)\b/i, types: ["funnel", "comparative"], rationale: "Análise de funil." },
  { regex: /\b(inconsist[eê]nc|qualidade dos dados|faltand|duplicad|incompleto)\b/i, types: ["data_quality"], rationale: "Auditoria de qualidade de dados." },
  { regex: /\b(regi[ãa]o|cidade|bairro|mapa|geogr[aá]f)\b/i, types: ["geographic"], rationale: "Análise geográfica." },
  { regex: /\b(top|melhores?|piores?|ranking|maiores?|menores?)\b/i, types: ["descriptive", "financial"], rationale: "Ranking/Top N." },
  { regex: /\b(compara|m[eê]s passado|semana passada|ano passado|vs|versus|antes)\b/i, types: ["comparative"], rationale: "Comparação entre períodos." },
];

export function planAnalysis(question: string, context: AnalysisContext = {}): AnalysisPlan {
  const q = normalize(question);
  if (!q) {
    return defaultPlan(context, "Sem pergunta — análise completa por padrão.");
  }

  // 1) Detecta tipos de insight via padrões.
  const types = new Set<InsightType>();
  let rationale = "";
  for (const { regex, types: ts, rationale: r } of INTENT_PATTERNS) {
    if (regex.test(q)) {
      ts.forEach((t) => types.add(t));
      rationale = rationale ? `${rationale} ${r}` : r;
    }
  }
  if (types.size === 0) {
    types.add("descriptive");
    types.add("comparative");
    rationale = "Sem padrão claro — gerando visão descritiva e comparativa.";
  }

  // 2) Detecta entidade e métrica via glossário.
  let entity: EntityKey = context.entity ?? "budgets";
  let metric: string | undefined;
  const recognized: string[] = [];
  const tokens = q.split(/[^a-z0-9_]+/).filter(Boolean);
  for (const tok of tokens) {
    const hit = lookupTerm(tok);
    if (!hit) continue;
    recognized.push(hit.term);
    if (hit.refersTo.kind === "entity") entity = hit.refersTo.entity;
    if (hit.refersTo.kind === "metric" && !metric) metric = hit.refersTo.metric;
  }

  // 3) Filtros simples a partir da pergunta.
  const filters: Record<string, unknown> = {};
  const periodMatch = q.match(/(ultim|últ).{0,5}(\d+)\s*(dia|semana|mes|m[eê]s|ano)s?/);
  if (periodMatch) {
    filters.period = `${periodMatch[2]}_${periodMatch[3]}s`;
  }
  if (/atras|vencid/.test(q)) filters.status = "overdue";
  if (/perdid|lost/.test(q)) filters.status = "lost";
  if (/fechad|ganho|won/.test(q)) filters.status = "contrato_fechado";

  return {
    insightTypes: [...types],
    entity,
    metric,
    filters,
    rationale,
    confidence: recognized.length > 0 ? 0.8 : 0.55,
    recognizedTerms: recognized,
  };
}

function defaultPlan(context: AnalysisContext, why: string): AnalysisPlan {
  return {
    insightTypes: ["descriptive", "comparative", "operational", "financial"],
    entity: context.entity ?? "budgets",
    filters: context.filters ?? {},
    rationale: why,
    confidence: 0.6,
    recognizedTerms: [],
  };
}

/** Sugere perguntas de exemplo dado um contexto (tela atual, papel do usuário). */
export function suggestQuestions(context: AnalysisContext = {}): string[] {
  const role = context.role ?? "admin";
  const screen = context.screen ?? "";

  const base = [
    "O que mudou em relação ao mês passado?",
    "Quais ações devo priorizar hoje?",
    "Quais são os maiores gargalos da operação?",
    "Quais clientes geram mais receita?",
    "Por que a margem caiu?",
    "Qual origem de lead converte melhor?",
  ];
  const adminOnly = [
    "Qual previsão de receita para os próximos meses?",
    "Quais obras estão em risco de atraso?",
    "Quais dados parecem inconsistentes?",
    "Qual nossa taxa de conversão esta semana?",
  ];
  const screenSpecific: Record<string, string[]> = {
    "/admin/operacoes": [
      "Quais 5 itens devo destravar primeiro?",
      "Por que o SLA caiu?",
      "Onde estão concentrados os atrasos?",
    ],
    "/admin/comercial": [
      "Quais leads estão parados?",
      "Qual etapa do funil está perdendo mais?",
      "Quais oportunidades têm maior valor?",
    ],
  };

  return [
    ...base,
    ...(role === "admin" ? adminOnly : []),
    ...(screenSpecific[screen] ?? []),
  ].slice(0, 12);
}
