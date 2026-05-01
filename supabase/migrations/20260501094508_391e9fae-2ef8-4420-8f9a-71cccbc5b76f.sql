CREATE UNIQUE INDEX IF NOT EXISTS uniq_client_property_identity
  ON public.client_properties (
    client_id,
    lower(btrim(empreendimento)),
    lower(btrim(bairro)),
    lower(btrim(metragem))
  )
  WHERE empreendimento IS NOT NULL
    AND btrim(empreendimento) <> ''
    AND bairro IS NOT NULL
    AND btrim(bairro) <> ''
    AND metragem IS NOT NULL
    AND btrim(metragem) <> '';