
-- RPC: lista orçamentos com version_group_id = id que poderiam ser absorvidos por outro grupo do mesmo cliente+property
CREATE OR REPLACE FUNCTION public.list_orphan_version_groups()
RETURNS TABLE(
  budget_id uuid,
  budget_code text,
  project_name text,
  client_id uuid,
  client_name text,
  property_id uuid,
  property_label text,
  current_version_group_id uuid,
  target_version_group_id uuid,
  target_group_size integer,
  internal_status text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  RETURN QUERY
  WITH self_grouped AS (
    SELECT b.id, b.client_id, b.property_id, b.version_group_id,
           b.sequential_code, b.project_name, b.internal_status, b.created_at
    FROM budgets b
    WHERE b.version_group_id = b.id
      AND b.deleted_at IS NULL
      AND b.client_id IS NOT NULL
  ),
  candidates AS (
    SELECT
      s.id AS budget_id,
      s.sequential_code,
      s.project_name,
      s.client_id,
      s.property_id,
      s.version_group_id AS current_vg,
      s.internal_status,
      s.created_at,
      (
        -- Maior grupo (em volume) coexistindo no mesmo cliente+imóvel, excluindo o próprio
        SELECT b2.version_group_id
        FROM budgets b2
        WHERE b2.client_id = s.client_id
          AND coalesce(b2.property_id::text,'∅') = coalesce(s.property_id::text,'∅')
          AND b2.id <> s.id
          AND b2.version_group_id IS NOT NULL
          AND b2.version_group_id <> s.id
          AND b2.deleted_at IS NULL
        GROUP BY b2.version_group_id
        ORDER BY count(*) DESC, min(b2.created_at) ASC
        LIMIT 1
      ) AS target_vg
    FROM self_grouped s
  )
  SELECT
    c.budget_id,
    c.sequential_code,
    c.project_name,
    c.client_id,
    cl.name,
    c.property_id,
    coalesce(cp.label, cp.empreendimento, cp.address, '—'),
    c.current_vg,
    c.target_vg,
    (SELECT count(*)::int FROM budgets b3 WHERE b3.version_group_id = c.target_vg AND b3.deleted_at IS NULL),
    c.internal_status,
    c.created_at
  FROM candidates c
  LEFT JOIN clients cl ON cl.id = c.client_id
  LEFT JOIN client_properties cp ON cp.id = c.property_id
  WHERE c.target_vg IS NOT NULL
  ORDER BY cl.name ASC, c.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_orphan_version_groups() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_orphan_version_groups() TO authenticated;

-- RPC: consolida um orçamento órfão para o version_group_id alvo, renumerando a versão
CREATE OR REPLACE FUNCTION public.consolidate_orphan_version_group(
  _budget_id uuid,
  _target_version_group_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_budget budgets%ROWTYPE;
  v_target_exists boolean;
  v_next_version int;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT * INTO v_budget FROM budgets WHERE id = _budget_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'budget not found';
  END IF;

  IF v_budget.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'budget is deleted';
  END IF;

  -- Sanidade: budget precisa estar realmente auto-referenciado
  IF v_budget.version_group_id IS DISTINCT FROM v_budget.id THEN
    RAISE EXCEPTION 'budget is not orphan (version_group_id <> id)';
  END IF;

  -- Sanidade: target_version_group_id deve existir e pertencer ao mesmo client_id (e mesmo property_id quando ambos preenchidos)
  SELECT EXISTS (
    SELECT 1 FROM budgets b
    WHERE b.version_group_id = _target_version_group_id
      AND b.deleted_at IS NULL
      AND b.client_id = v_budget.client_id
      AND coalesce(b.property_id::text,'∅') = coalesce(v_budget.property_id::text,'∅')
  ) INTO v_target_exists;

  IF NOT v_target_exists THEN
    RAISE EXCEPTION 'target version group does not match client/property';
  END IF;

  -- Próxima versão disponível dentro do grupo alvo
  SELECT coalesce(max(version_number), 0) + 1
    INTO v_next_version
  FROM budgets
  WHERE version_group_id = _target_version_group_id;

  UPDATE budgets
  SET
    version_group_id = _target_version_group_id,
    version_number = v_next_version,
    is_current_version = false,
    updated_at = now()
  WHERE id = _budget_id;

  -- Auditoria
  INSERT INTO budget_events (budget_id, event_type, note, metadata, user_id)
  VALUES (
    _budget_id,
    'version_group_consolidation',
    format('Consolidado no grupo %s como V%s', _target_version_group_id, v_next_version),
    jsonb_build_object(
      'previous_version_group_id', v_budget.version_group_id,
      'new_version_group_id', _target_version_group_id,
      'new_version_number', v_next_version
    ),
    auth.uid()
  );

  RETURN jsonb_build_object(
    'budget_id', _budget_id,
    'new_version_group_id', _target_version_group_id,
    'new_version_number', v_next_version
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consolidate_orphan_version_group(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consolidate_orphan_version_group(uuid, uuid) TO authenticated;
