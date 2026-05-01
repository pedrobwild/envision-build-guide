# AI Data Analysis Assistant

Camada de análise inteligente que transforma dados brutos do BWild em insights
ranqueados (descritivos, diagnósticos, preditivos, prescritivos, comparativos,
de funil, financeiros, operacionais, de qualidade de dados e geográficos) e
responde perguntas em linguagem natural.

Tudo é puro frontend (TypeScript) — sem dependência de LLM externo. Pode ser
estendido com chamadas a Edge Functions se algum dia precisar de raciocínio
mais avançado.

## Estrutura

```
src/lib/ai-data/
  types.ts                     contratos compartilhados (Insight, AnalysisResult, etc.)
  dataCatalog.ts               entidades, campos, relações e limitações conhecidas
  metricDefinitions.ts         métricas (id, unidade, direção, healthBands)
  domainGlossary.ts            termos PT-BR + sinônimos para o NL planner
  statistics.ts                estatística pura (mean/median/IQR/outliers/Pareto/regressão)
  insightScoring.ts            ranking de insights (severity * magnitude * confidence)
  visualizationRecommender.ts  escolha de tipo de gráfico ideal por insight
  insightEngine.ts             geradores por categoria + orquestrador `runInsightEngine`
  analysisPlanner.ts           NL → plano (intenção, entidade, métrica, filtros)
  __tests__/                   vitest

src/hooks/ai-data/useAiDataAnalysis.ts   hook que combina engine + snapshots
src/components/ai-analysis/               UI (painel + insight cards + viz)
```

A página `src/pages/AnalisesPage.tsx` ganhou uma nova aba “Inteligência IA”.

## Como adicionar uma nova métrica

1. Crie a entrada em `metricDefinitions.ts`:

   ```ts
   no_show_rate: {
     id: "no_show_rate",
     label: "Taxa de no-show",
     description: "% de visitas agendadas em que o cliente não compareceu.",
     unit: "percent",
     domain: "comercial",
     entity: "budget_activities",
     direction: "down_is_good",
     healthBands: { excellent: 5, healthy: 10, warning: 20, critical: 100 },
   },
   ```

2. Implemente o cálculo em algum gerador de `insightEngine.ts` (ou crie um
   novo gerador). Lembre-se de retornar `[]` quando os dados forem
   insuficientes e adicionar uma `limitation` explícita.

3. Se houver sinônimos PT-BR comuns para o conceito, adicione no
   `domainGlossary.ts` apontando `kind: "metric"`.

## Como adicionar um novo tipo de insight

1. Acrescente a string ao tipo `InsightType` em `types.ts`.
2. Implemente uma função `generateXxxInsights(input, numbers): Insight[]`
   em `insightEngine.ts`.
3. Some-a ao array `GENERATORS` no fim do arquivo.
4. Atualize o `TYPE_LABEL` em `components/ai-analysis/InsightCard.tsx` e a
   lista `TYPE_FILTERS` em `components/ai-analysis/AiAnalysisPanel.tsx`.
5. Se quiser priorização diferente, ajuste pesos em `insightScoring.ts`.

## Princípios

- **Não inventar números**: cada insight cita evidências numéricas reais
  vindas dos dados carregados. Quando não há base, a função retorna `[]`
  ou um insight com `confidence` baixa + `limitation` explícita.
- **Funções puras**: o engine é determinístico, sem fetch interno —
  facilita teste e composição. A camada de fetch (snapshots, motivos
  de perda) vive no hook `useAiDataAnalysis`.
- **Confiança visível**: cada insight expõe `confidence` e a UI mostra.
- **Segurança**: tudo lê via Supabase client respeitando RLS. Não há
  chave secreta no frontend, queries são read-only e a paginação está
  em `limit(60)` (snapshots) e `limit(500)` (motivos de perda).

## Limitações atuais

- O motor preditivo usa regressão linear simples — bom para tendências
  monotônicas. Para sazonalidade, evoluir para média móvel exponencial
  ou Holt-Winters.
- O parser NL é heurístico (regex + glossário). Para perguntas longas
  e abertas, encaminhar ao chat (`AiAssistant`) que usa LLM.
- Probabilidades de fechamento por etapa em `insightEngine.ts` são
  globais — podem ser tornadas configuráveis por pipeline.
