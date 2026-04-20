-- Tabela de metas comerciais (mensal por usuário ou global)
CREATE TABLE public.commercial_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NULL, -- NULL = meta global da equipe
  target_month DATE NOT NULL, -- primeiro dia do mês
  revenue_target_brl NUMERIC NOT NULL DEFAULT 0,
  deals_target INTEGER NOT NULL DEFAULT 0,
  notes TEXT NULL,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, target_month)
);

ALTER TABLE public.commercial_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read commercial targets"
  ON public.commercial_targets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage commercial targets"
  ON public.commercial_targets FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_commercial_targets_updated_at
  BEFORE UPDATE ON public.commercial_targets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_commercial_targets_month ON public.commercial_targets(target_month);
CREATE INDEX idx_commercial_targets_owner ON public.commercial_targets(owner_id);