-- Resolve public_id antigo (orcamento despublicado) para o public_id da versão
-- atualmente publicada do mesmo version_group_id. Retorna NULL se não houver
-- versão publicada acessível.
CREATE OR REPLACE FUNCTION public.resolve_published_public_id(p_public_id text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH src AS (
    SELECT id, version_group_id, status, public_id
    FROM public.budgets
    WHERE public_id = p_public_id
    LIMIT 1
  ),
  -- Se o próprio já está publicado/minuta, retorna ele mesmo (caso edge)
  self_ok AS (
    SELECT public_id
    FROM src
    WHERE status IN ('published','minuta_solicitada')
      AND public_id IS NOT NULL
  ),
  -- Caso contrário, procura no mesmo grupo a versão publicada mais recente
  group_pub AS (
    SELECT b.public_id
    FROM public.budgets b, src
    WHERE b.public_id IS NOT NULL
      AND b.status IN ('published','minuta_solicitada')
      AND (
        b.version_group_id = src.version_group_id
        OR b.id = src.version_group_id
        OR b.version_group_id = src.id
      )
    ORDER BY b.is_published_version DESC NULLS LAST,
             b.created_at DESC
    LIMIT 1
  )
  SELECT public_id FROM self_ok
  UNION ALL
  SELECT public_id FROM group_pub
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_published_public_id(text) TO anon, authenticated;