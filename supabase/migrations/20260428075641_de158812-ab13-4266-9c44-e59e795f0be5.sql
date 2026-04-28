ALTER TABLE public.budget_templates
ADD COLUMN IF NOT EXISTS default_discount_amount NUMERIC NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.budget_templates.default_discount_amount IS
'Valor positivo em BRL. Quando > 0, ao seedar um orçamento a partir deste template, cria automaticamente seção "Descontos" com item "Desconto promocional" de custo negativo desse valor.';