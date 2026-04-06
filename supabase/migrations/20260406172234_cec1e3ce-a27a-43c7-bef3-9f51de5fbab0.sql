
CREATE POLICY "Orcamentistas can manage templates"
ON public.budget_templates FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'orcamentista'::app_role))
WITH CHECK (has_role(auth.uid(), 'orcamentista'::app_role));

CREATE POLICY "Orcamentistas can manage template sections"
ON public.budget_template_sections FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'orcamentista'::app_role))
WITH CHECK (has_role(auth.uid(), 'orcamentista'::app_role));

CREATE POLICY "Orcamentistas can manage template items"
ON public.budget_template_items FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'orcamentista'::app_role))
WITH CHECK (has_role(auth.uid(), 'orcamentista'::app_role));
