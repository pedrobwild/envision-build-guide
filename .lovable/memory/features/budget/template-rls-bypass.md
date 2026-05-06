---
name: Template RLS bypass
description: RPC seed_budget_from_template (SECURITY DEFINER) aplica template em qualquer orçamento que o usuário enxerga via can_access_budget, evitando que orçamentistas fiquem bloqueados quando estimator_owner_id é outra pessoa
type: feature
---
- `seedFromTemplate` em `src/lib/seed-from-template.ts` chama a RPC `public.seed_budget_from_template(p_budget_id, p_template_id)`.
- A RPC roda como SECURITY DEFINER com `search_path=public`, valida `can_access_budget(auth.uid(), p_budget_id)` e então faz DELETE+INSERT em `sections`/`items`.
- Quando `p_template_id` é NULL, a RPC só limpa as seções e o cliente segue chamando `seedDefaultSections` para popular os defaults TS.
- Aplica também o desconto promocional (`budget_templates.default_discount_amount`) criando seção "Descontos" + item de custo negativo.
- Resolveu o caso "Marina não consegue aplicar template": como orçamentista, ela acessa o budget mas as policies de `sections`/`items` exigiam ser `estimator_owner_id`, então DELETE/INSERT direto era bloqueado por RLS.
