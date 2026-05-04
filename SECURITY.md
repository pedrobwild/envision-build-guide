# Segurança — módulo de análise de dados

Este documento cobre o módulo `ai-analysis` / `data-analysis` /
`data-quality` introduzido em maio 2026. Para o resto da plataforma,
consulte `docs/AI_ASSISTANT.md` e o board geral de RLS no Supabase.

## Princípios

1. **Cálculos no front, IA só interpreta.** A IA nunca recebe linhas
   brutas e nunca produz números — recebe `AnalysisResult` (já agregado)
   e devolve narrativa em pt-BR no schema estrito `AiInterpretation`
   (`src/components/ai-analysis/schemas.ts`). Isso elimina a classe de
   bugs "LLM inventou métrica".
2. **Saída auditável.** Cada `AdvancedInsight` carrega `provenance`
   (`source`, `datasetId`, `columns`, `params`). Quem revisar uma
   análise consegue traçar de volta à função pura que gerou cada
   número.
3. **Defesa em profundidade.** Validação Zod nas fronteiras, limites
   de payload, mascaramento opcional de PII, CORS controlado, RLS no
   banco.

## Checklist obrigatória — qualquer feature nova de análise

### Validação de entrada
- [ ] Schema Zod no edge function (`AnalysisRequestSchema` ou específico).
- [ ] `assertPayloadSize(rawBody)` antes do `JSON.parse`.
- [ ] `checkDatasetSize(dataset)` com `maxRows`/`maxCols` documentados.
- [ ] `truncateLongStrings(dataset)` se aceita texto livre.

### Privacidade / PII
- [ ] `containsPii(dataset)` antes de enviar ao gateway de IA.
- [ ] Se `containsPii.found === true`: confirmação explícita do usuário
      (componente `PiiConfirmDialog`) **OU** `redactDataset(dataset)`
      antes do envio.
- [ ] **Default-on** para mascarar quando o caminho for "user → LLM
      externo" (Lovable AI Gateway, Perplexity).
- [ ] Logs (`console.log`/`console.error`) **não** contêm PII nem dataset
      cru. Use `redactPii` no texto antes de logar, ou logue só metadados
      (count, columns affected, error code).

### Autenticação / autorização
- [ ] Edge function valida JWT do header `Authorization: Bearer ...`.
- [ ] `user_roles` checado server-side (não confiar no claim do JWT).
- [ ] Tools que tocam tabelas sensíveis exigem `isAdmin`.
- [ ] RLS continua sendo a defesa primária — service role é usado só
      após o gate de role.

### Rate limiting / custos
- [ ] Rate limiter por usuário no edge function de IA
      (10 req/min default, ajustar conforme uso).
- [ ] Cap de tokens / max_tokens explícito no payload do gateway.
- [ ] Cache LRU de respostas idempotentes (TTL ≤ 60s) quando aplicável.

### Tratamento de erros
- [ ] `try/catch` em volta do parse, validação, fetch ao gateway.
- [ ] Resposta ao cliente com `{ error: "mensagem segura" }` —
      **não** vazar stack trace, query SQL, schema interno.
- [ ] Status HTTP correto: 400 (validação), 401 (auth), 403 (role),
      413 (payload), 429 (rate limit), 502 (LLM falhou), 500 (resto).
- [ ] Falha ao persistir histórico **não** falha a request principal
      (best-effort, log estruturado).

### Saída do LLM
- [ ] Schema Zod (`AiInterpretationSchema`) valida cada resposta.
- [ ] Em caso de violação, **não** propagar texto cru para a UI —
      retornar erro estruturado e logar o offender no servidor.
- [ ] `nature: fact|inference|hypothesis` é exigido em cada
      `keyFinding`. Componente `AnalysisConfidenceBadge` renderiza
      visualmente para o usuário.
- [ ] `confidence` exibido na UI; quando `low`, recomendar mais dados.

## Política de dados sensíveis

Dataset enviados ao módulo podem conter:

| Tipo | Permitido cru? | Política default |
|---|---|---|
| Nome de cliente | sim | (visível para admin) |
| Email / telefone | **não** | mascaramento default-on |
| CPF / CNPJ | **não** | mascaramento sempre |
| Cartão de crédito | **nunca** | bloquear envio |
| Endereço completo | **não** sem confirmação | mascaramento default-on |
| Custo interno / margem | sim, só admin | RLS gate + role check |
| Texto livre (notas) | truncado em 10k chars | truncar + redact |

## Reporte de incidentes

Vulnerabilidade descoberta? Abra um bug report **privado** com
severidade=critical e área=security via `/admin/bugs`. Não publique em
issues públicas até patch disponível.

## Auditoria

Todas as chamadas a `ai-data-analyst` registram:
- `user_id`, `role`, `datasetId`, `rows`, `cols`, `pii_redacted_count`,
  `confidence`, `latency_ms`, `gateway_model`, `tokens_used`.

A retenção dos logs é de 90 dias. Logs **não** contêm linhas do dataset.
