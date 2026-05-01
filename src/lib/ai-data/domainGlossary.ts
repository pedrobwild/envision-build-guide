/**
 * Glossário de domínio do BWild — usado pelo NL planner para reconhecer
 * sinônimos, abreviações e jargões em perguntas dos usuários.
 *
 * Mantenha as listas em PT-BR e em snake_case (para combinar com IDs de métricas).
 */

import type { EntityKey } from "./types";

export interface GlossaryEntry {
  /** lemma canônico (singular, lowercase). */
  term: string;
  /** sinônimos e variações comuns. */
  synonyms: string[];
  /** entidade/métrica que o termo representa. */
  refersTo:
    | { kind: "entity"; entity: EntityKey }
    | { kind: "metric"; metric: string }
    | { kind: "concept"; description: string };
}

export const DOMAIN_GLOSSARY: GlossaryEntry[] = [
  {
    term: "orçamento",
    synonyms: ["orcamento", "proposta", "obra", "projeto", "deal", "deals", "negocio", "negócio"],
    refersTo: { kind: "entity", entity: "budgets" },
  },
  {
    term: "cliente",
    synonyms: ["clientes", "lead", "leads", "contato", "contatos", "comprador"],
    refersTo: { kind: "entity", entity: "clients" },
  },
  {
    term: "lead source",
    synonyms: ["origem", "fonte", "canal", "campanha", "marketing"],
    refersTo: { kind: "entity", entity: "lead_sources" },
  },
  {
    term: "pipeline",
    synonyms: ["funil", "esteira"],
    refersTo: { kind: "entity", entity: "deal_pipelines" },
  },
  {
    term: "atividade",
    synonyms: ["atividades", "tarefa", "tarefas", "follow up", "follow-up", "ligacao", "ligação"],
    refersTo: { kind: "entity", entity: "budget_activities" },
  },
  {
    term: "motivo de perda",
    synonyms: ["perda", "perdido", "lost", "razao", "razão"],
    refersTo: { kind: "entity", entity: "budget_lost_reasons" },
  },
  {
    term: "alerta",
    synonyms: ["alertas", "anomalia", "anomalias", "alarme"],
    refersTo: { kind: "entity", entity: "operations_alerts" },
  },

  // Métricas
  { term: "conversao", synonyms: ["conversão", "win rate", "taxa de fechamento", "fechamento"], refersTo: { kind: "metric", metric: "conversion_rate" } },
  { term: "receita", synonyms: ["faturamento", "vendas", "revenue", "ganhos"], refersTo: { kind: "metric", metric: "revenue_brl" } },
  { term: "margem", synonyms: ["lucro", "margem bruta", "rentabilidade"], refersTo: { kind: "metric", metric: "gross_margin_pct" } },
  { term: "custo", synonyms: ["custos", "gastos"], refersTo: { kind: "metric", metric: "cost_brl" } },
  { term: "ticket", synonyms: ["ticket medio", "ticket médio", "valor medio", "valor médio"], refersTo: { kind: "metric", metric: "avg_ticket_brl" } },
  { term: "lead time", synonyms: ["tempo de entrega", "tempo de produção", "tempo medio"], refersTo: { kind: "metric", metric: "avg_lead_time_days" } },
  { term: "backlog", synonyms: ["fila", "carteira ativa"], refersTo: { kind: "metric", metric: "backlog_count" } },
  { term: "atrasados", synonyms: ["atraso", "vencidos", "vencido", "overdue"], refersTo: { kind: "metric", metric: "overdue_count" } },
  { term: "sla", synonyms: ["dentro do prazo", "no prazo", "service level"], refersTo: { kind: "metric", metric: "sla_on_time_pct" } },
  { term: "throughput", synonyms: ["produtividade", "ritmo", "velocidade"], refersTo: { kind: "metric", metric: "throughput_per_week" } },
  { term: "health", synonyms: ["saude", "saúde", "score", "indice", "índice"], refersTo: { kind: "metric", metric: "health_score" } },
  { term: "pipeline value", synonyms: ["pipeline em real", "carteira", "valor em carteira", "valor em pipeline"], refersTo: { kind: "metric", metric: "portfolio_value_brl" } },
  { term: "forecast", synonyms: ["previsao", "previsão", "projecao", "projeção"], refersTo: { kind: "metric", metric: "forecast_revenue_next_30d" } },

  // Conceitos
  { term: "gargalo", synonyms: ["bottleneck", "travado", "trava"], refersTo: { kind: "concept", description: "Estágio onde itens passam tempo demais ou onde o passe entre etapas perde mais volume." } },
  { term: "outlier", synonyms: ["anomalia", "fora da curva", "discrepante"], refersTo: { kind: "concept", description: "Valor muito acima/abaixo do desvio típico (>2σ) — costuma ser um caso especial." } },
  { term: "pareto", synonyms: ["80/20", "concentracao", "concentração"], refersTo: { kind: "concept", description: "Concentração: poucos itens explicam a maior parte do total." } },
  { term: "saúde", synonyms: ["health", "saude", "estado"], refersTo: { kind: "concept", description: "Composto de SLA, lead time, conversão, margem e backlog." } },
];

/** Tenta resolver um termo de pergunta a uma entrada de glossário. */
export function lookupTerm(raw: string): GlossaryEntry | undefined {
  const norm = normalize(raw);
  for (const entry of DOMAIN_GLOSSARY) {
    if (normalize(entry.term) === norm) return entry;
    if (entry.synonyms.some((s) => normalize(s) === norm)) return entry;
  }
  return undefined;
}

/** Lowercase + remove acentos para matching tolerante. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}
