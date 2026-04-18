-- ============================================================================
-- CRM: tabela `clients` + integração com `budgets`
-- ============================================================================

-- 1) Tabela principal --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  document TEXT,
  document_type TEXT CHECK (document_type IN ('cpf','cnpj') OR document_type IS NULL),
  city TEXT,
  bairro TEXT,
  condominio_default TEXT,
  property_type_default TEXT,
  location_type_default TEXT,
  status TEXT NOT NULL DEFAULT 'lead'
    CHECK (status IN ('lead','active','inactive','lost','won')),
  source TEXT,
  referrer_name TEXT,
  commercial_owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  hubspot_contact_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.clients IS
  'CRM: clientes (pessoas ou empresas) que solicitam orcamentos. Um cliente pode ter multiplos budgets.';

-- 2) Índices -----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_clients_name          ON public.clients (lower(name));
CREATE INDEX IF NOT EXISTS idx_clients_email         ON public.clients (lower(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_phone         ON public.clients (phone)        WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_status        ON public.clients (status);
CREATE INDEX IF NOT EXISTS idx_clients_owner         ON public.clients (commercial_owner_id);
CREATE INDEX IF NOT EXISTS idx_clients_created_at    ON public.clients (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clients_tags          ON public.clients USING GIN (tags);

CREATE UNIQUE INDEX IF NOT EXISTS uq_clients_email_active
  ON public.clients (lower(email))
  WHERE email IS NOT NULL AND is_active = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_clients_phone_active
  ON public.clients (phone)
  WHERE phone IS NOT NULL AND is_active = TRUE;

-- 3) Trigger updated_at ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_clients_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clients_set_updated_at ON public.clients;
CREATE TRIGGER trg_clients_set_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_clients_set_updated_at();

-- 4) RLS ---------------------------------------------------------------------
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read clients" ON public.clients;
CREATE POLICY "Authenticated users can read clients"
  ON public.clients FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert clients" ON public.clients;
CREATE POLICY "Authenticated users can insert clients"
  ON public.clients FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid() OR created_by IS NULL);

DROP POLICY IF EXISTS "Admin and commercial can update clients" ON public.clients;
CREATE POLICY "Admin and commercial can update clients"
  ON public.clients FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'comercial')
    OR created_by = auth.uid()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'comercial')
    OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Only admin can delete clients" ON public.clients;
CREATE POLICY "Only admin can delete clients"
  ON public.clients FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 5) FK em budgets -----------------------------------------------------------
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_budgets_client_id ON public.budgets (client_id);

-- 6) Backfill ----------------------------------------------------------------
DO $migration$
DECLARE
  v_inserted_count INT;
  v_linked_count   INT;
BEGIN
  WITH ranked AS (
    SELECT
      b.id AS budget_id,
      COALESCE(NULLIF(TRIM(b.client_name), ''), 'Cliente sem nome') AS client_name,
      NULLIF(LOWER(TRIM(b.lead_email)), '') AS email_norm,
      NULLIF(TRIM(b.client_phone), '')      AS phone_norm,
      NULLIF(TRIM(b.city), '')              AS city_norm,
      NULLIF(TRIM(b.bairro), '')            AS bairro_norm,
      NULLIF(TRIM(b.condominio), '')        AS condominio_norm,
      b.property_type,
      b.location_type,
      b.commercial_owner_id,
      b.created_by,
      b.created_at,
      COALESCE(
        NULLIF(LOWER(TRIM(b.lead_email)), ''),
        'phone:' || NULLIF(TRIM(b.client_phone), ''),
        'name:'  || LOWER(COALESCE(NULLIF(TRIM(b.client_name), ''), '')) || '|' ||
                    LOWER(COALESCE(NULLIF(TRIM(b.bairro),      ''), '')) || '|' ||
                    LOWER(COALESCE(NULLIF(TRIM(b.city),        ''), ''))
      ) AS dedup_key
    FROM public.budgets b
    WHERE b.client_id IS NULL
  ),
  first_per_key AS (
    SELECT DISTINCT ON (dedup_key)
      dedup_key, client_name, email_norm, phone_norm, city_norm,
      bairro_norm, condominio_norm, property_type, location_type,
      commercial_owner_id, created_by, created_at
    FROM ranked
    WHERE dedup_key IS NOT NULL
    ORDER BY dedup_key, created_at ASC
  )
  INSERT INTO public.clients (
    name, email, phone, city, bairro, condominio_default,
    property_type_default, location_type_default,
    status, commercial_owner_id, created_by, created_at, updated_at
  )
  SELECT
    client_name, email_norm, phone_norm, city_norm, bairro_norm,
    condominio_norm, property_type, location_type,
    'active', commercial_owner_id, created_by,
    COALESCE(created_at, now()), COALESCE(created_at, now())
  FROM first_per_key
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  RAISE NOTICE 'CRM backfill: % clientes inseridos a partir do historico de budgets.', v_inserted_count;

  WITH budgets_keys AS (
    SELECT
      b.id AS budget_id,
      COALESCE(
        NULLIF(LOWER(TRIM(b.lead_email)), ''),
        'phone:' || NULLIF(TRIM(b.client_phone), ''),
        'name:'  || LOWER(COALESCE(NULLIF(TRIM(b.client_name), ''), '')) || '|' ||
                    LOWER(COALESCE(NULLIF(TRIM(b.bairro),      ''), '')) || '|' ||
                    LOWER(COALESCE(NULLIF(TRIM(b.city),        ''), ''))
      ) AS dedup_key
    FROM public.budgets b
    WHERE b.client_id IS NULL
  ),
  client_keys AS (
    SELECT
      c.id AS client_id,
      COALESCE(
        NULLIF(LOWER(TRIM(c.email)), ''),
        'phone:' || NULLIF(TRIM(c.phone), ''),
        'name:'  || LOWER(COALESCE(NULLIF(TRIM(c.name),   ''), '')) || '|' ||
                    LOWER(COALESCE(NULLIF(TRIM(c.bairro), ''), '')) || '|' ||
                    LOWER(COALESCE(NULLIF(TRIM(c.city),   ''), ''))
      ) AS dedup_key
    FROM public.clients c
  )
  UPDATE public.budgets b
     SET client_id = ck.client_id
    FROM budgets_keys bk
    JOIN client_keys  ck ON ck.dedup_key = bk.dedup_key
   WHERE b.id = bk.budget_id
     AND b.client_id IS NULL
     AND bk.dedup_key IS NOT NULL;

  GET DIAGNOSTICS v_linked_count = ROW_COUNT;
  RAISE NOTICE 'CRM backfill: % budgets linkados a clientes.', v_linked_count;
END;
$migration$;

-- 7) View agregada -----------------------------------------------------------
CREATE OR REPLACE VIEW public.client_stats
WITH (security_invoker = on) AS
SELECT
  c.id                                        AS client_id,
  COUNT(b.id)                                 AS total_budgets,
  COUNT(b.id) FILTER (
    WHERE b.internal_status = 'contrato_fechado'
  )                                           AS won_budgets,
  COUNT(b.id) FILTER (
    WHERE b.internal_status NOT IN ('contrato_fechado','perdido','arquivado')
  )                                           AS active_budgets,
  COALESCE(SUM(
    CASE WHEN b.internal_status = 'contrato_fechado'
         THEN COALESCE(b.manual_total, 0)
         ELSE 0
    END
  ), 0)                                       AS total_won_value,
  COALESCE(SUM(
    CASE WHEN b.internal_status NOT IN ('contrato_fechado','perdido','arquivado')
         THEN COALESCE(b.manual_total, 0)
         ELSE 0
    END
  ), 0)                                       AS pipeline_value,
  COALESCE(AVG(
    NULLIF(b.manual_total, 0)
  ) FILTER (
    WHERE b.internal_status = 'contrato_fechado'
  ), 0)                                       AS avg_ticket,
  MAX(b.created_at)                           AS last_budget_at
FROM public.clients c
LEFT JOIN public.budgets b ON b.client_id = c.id
GROUP BY c.id;

COMMENT ON VIEW public.client_stats IS
  'Metricas agregadas por cliente usadas no dashboard do CRM.';