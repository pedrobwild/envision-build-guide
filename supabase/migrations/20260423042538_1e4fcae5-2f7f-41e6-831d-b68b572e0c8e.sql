-- 1. Baseline de mídia: snapshot do media_config "esperado" para orçamentos com upload manual
CREATE TABLE public.media_integrity_baseline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL UNIQUE,
  media_config jsonb NOT NULL,
  config_hash text NOT NULL,
  video3d_count integer NOT NULL DEFAULT 0,
  projeto3d_count integer NOT NULL DEFAULT 0,
  projeto_executivo_count integer NOT NULL DEFAULT 0,
  fotos_count integer NOT NULL DEFAULT 0,
  reason text,
  captured_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_media_baseline_budget ON public.media_integrity_baseline(budget_id);

ALTER TABLE public.media_integrity_baseline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage media baseline"
  ON public.media_integrity_baseline FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages media baseline"
  ON public.media_integrity_baseline FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2. Alertas de divergência detectados pela verificação periódica
CREATE TABLE public.media_integrity_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL,
  budget_label text,
  alert_type text NOT NULL, -- 'config_changed' | 'hash_mismatch' | 'count_mismatch' | 'url_broken' | 'missing_baseline'
  severity text NOT NULL DEFAULT 'warning', -- 'info' | 'warning' | 'critical'
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  baseline_snapshot jsonb,
  current_snapshot jsonb,
  status text NOT NULL DEFAULT 'open', -- 'open' | 'acknowledged' | 'resolved'
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_media_alerts_budget ON public.media_integrity_alerts(budget_id);
CREATE INDEX idx_media_alerts_status ON public.media_integrity_alerts(status);
CREATE INDEX idx_media_alerts_created ON public.media_integrity_alerts(created_at DESC);

ALTER TABLE public.media_integrity_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage media alerts"
  ON public.media_integrity_alerts FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages media alerts"
  ON public.media_integrity_alerts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. Trigger para updated_at
CREATE TRIGGER trg_media_baseline_updated_at
  BEFORE UPDATE ON public.media_integrity_baseline
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Helper: capturar baseline atual de um orçamento marcado como manual
CREATE OR REPLACE FUNCTION public.mark_budget_as_manual_baseline(
  p_budget_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_media jsonb;
  v_hash text;
  v_baseline_id uuid;
BEGIN
  SELECT media_config INTO v_media
    FROM public.budgets
   WHERE id = p_budget_id;

  IF v_media IS NULL THEN
    v_media := '{}'::jsonb;
  END IF;

  v_hash := encode(digest(v_media::text, 'sha256'), 'hex');

  INSERT INTO public.media_integrity_baseline (
    budget_id, media_config, config_hash,
    video3d_count, projeto3d_count, projeto_executivo_count, fotos_count,
    reason, captured_by
  )
  VALUES (
    p_budget_id,
    v_media,
    v_hash,
    CASE WHEN v_media ? 'video3d' AND length(coalesce(v_media->>'video3d','')) > 0 THEN 1 ELSE 0 END,
    coalesce(jsonb_array_length(v_media->'projeto3d'), 0),
    coalesce(jsonb_array_length(v_media->'projetoExecutivo'), 0),
    coalesce(jsonb_array_length(v_media->'fotos'), 0),
    p_reason,
    auth.uid()
  )
  ON CONFLICT (budget_id) DO UPDATE
    SET media_config = EXCLUDED.media_config,
        config_hash = EXCLUDED.config_hash,
        video3d_count = EXCLUDED.video3d_count,
        projeto3d_count = EXCLUDED.projeto3d_count,
        projeto_executivo_count = EXCLUDED.projeto_executivo_count,
        fotos_count = EXCLUDED.fotos_count,
        reason = COALESCE(EXCLUDED.reason, media_integrity_baseline.reason),
        captured_by = EXCLUDED.captured_by,
        updated_at = now()
  RETURNING id INTO v_baseline_id;

  RETURN v_baseline_id;
END;
$$;