
-- RPC: lista grupos de imóveis duplicados (mesmo cliente, normalização case/trim)
CREATE OR REPLACE FUNCTION public.list_duplicate_properties()
RETURNS TABLE(
  client_id uuid,
  client_name text,
  empreendimento_norm text,
  bairro_norm text,
  metragem_norm text,
  property_count integer,
  property_ids uuid[],
  property_labels text[],
  budget_counts integer[],
  primary_property_id uuid
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
  WITH norm AS (
    SELECT
      cp.id,
      cp.client_id,
      cp.is_primary,
      cp.created_at,
      lower(btrim(coalesce(cp.empreendimento, ''))) AS e,
      lower(btrim(coalesce(cp.bairro, ''))) AS b,
      lower(btrim(coalesce(cp.metragem, ''))) AS m,
      coalesce(cp.label, cp.empreendimento, cp.address, 'Sem nome') AS lbl
    FROM client_properties cp
    WHERE cp.empreendimento IS NOT NULL
      AND btrim(cp.empreendimento) <> ''
  ),
  grp AS (
    SELECT
      n.client_id,
      n.e, n.b, n.m,
      array_agg(n.id ORDER BY n.is_primary DESC, n.created_at ASC) AS ids,
      array_agg(n.lbl ORDER BY n.is_primary DESC, n.created_at ASC) AS lbls,
      count(*) AS c,
      (array_agg(n.id ORDER BY n.is_primary DESC, n.created_at ASC))[1] AS primary_id
    FROM norm n
    GROUP BY n.client_id, n.e, n.b, n.m
    HAVING count(*) > 1
  )
  SELECT
    g.client_id,
    c.name AS client_name,
    g.e, g.b, g.m,
    g.c::int,
    g.ids,
    g.lbls,
    (
      SELECT array_agg(
        (SELECT count(*)::int FROM budgets b WHERE b.property_id = pid AND b.deleted_at IS NULL)
        ORDER BY ord
      )
      FROM unnest(g.ids) WITH ORDINALITY AS u(pid, ord)
    ) AS budget_counts,
    g.primary_id
  FROM grp g
  LEFT JOIN clients c ON c.id = g.client_id
  ORDER BY g.c DESC, c.name ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_duplicate_properties() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_duplicate_properties() TO authenticated;

-- RPC: mescla um conjunto de imóveis em um primário (re-aponta budgets, deleta orfãos)
CREATE OR REPLACE FUNCTION public.merge_duplicate_properties(
  _primary_id uuid,
  _duplicate_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_primary client_properties%ROWTYPE;
  v_client_id uuid;
  v_relinked int := 0;
  v_deleted int := 0;
  v_dup_id uuid;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT * INTO v_primary FROM client_properties WHERE id = _primary_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'primary property not found';
  END IF;
  v_client_id := v_primary.client_id;

  -- Re-aponta budgets de cada duplicata para o primário (apenas mesmo cliente)
  FOREACH v_dup_id IN ARRAY _duplicate_ids LOOP
    IF v_dup_id = _primary_id THEN CONTINUE; END IF;

    -- Garante que a duplicata pertence ao mesmo cliente (segurança)
    IF NOT EXISTS (
      SELECT 1 FROM client_properties WHERE id = v_dup_id AND client_id = v_client_id
    ) THEN
      CONTINUE;
    END IF;

    UPDATE budgets SET property_id = _primary_id
    WHERE property_id = v_dup_id;
    GET DIAGNOSTICS v_relinked = ROW_COUNT;

    DELETE FROM client_properties WHERE id = v_dup_id;
    v_deleted := v_deleted + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'primary_id', _primary_id,
    'deleted_count', v_deleted,
    'relinked_budgets', v_relinked
  );
END;
$$;

REVOKE ALL ON FUNCTION public.merge_duplicate_properties(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_duplicate_properties(uuid, uuid[]) TO authenticated;
