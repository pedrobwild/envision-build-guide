-- ============================================================
-- Seed dev: leads de teste para validar Meta + Digisac
-- ============================================================
-- USO MANUAL APENAS. Não roda automaticamente em produção.
-- Para executar:
--   psql "$DATABASE_URL" -f supabase/seeds/dev_test_leads.sql
--
-- Os 3 leads abaixo são isolados pelo domínio @test.bwild.com.br para
-- facilitar limpeza:
--   DELETE FROM clients WHERE email LIKE '%@test.bwild.com.br';
--   (cascade dispara nos budgets via trigger AFTER INSERT — mas como são
--    soft-delete, prefira marcar is_active=false e deleted_at em budgets.)
-- ============================================================

INSERT INTO public.clients (
  name, email, phone, status, source, external_source, external_lead_id,
  campaign_id, campaign_name, adset_id, adset_name, ad_id, ad_name, form_id, form_name,
  utm_source, utm_medium, utm_campaign, is_active
) VALUES
  -- Lead 1: Meta Lead Ads completo
  ('Teste Meta Form 1', 'meta1@test.bwild.com.br', '11987654321', 'mql', 'meta_ads',
   'meta_ads', 'test-leadgen-001',
   '120208000000001', 'TST - Reformas SP', '120208000000002', 'TST - Adset Bairros Nobres',
   '120208000000003', 'TST - Anúncio Carousel', 'test-form-001', 'Formulário Teste Reforma',
   'meta', 'paid_social', 'TST - Reformas SP', true),

  -- Lead 2: Click-to-WhatsApp (vem com marcador BW na primeira mensagem)
  ('Teste C2W Marker', 'c2w@test.bwild.com.br', '11987654322', 'mql', 'meta_ads',
   'meta_ads', 'digisac:test-msg-001',
   '120208000000003', NULL, '120208000000002', NULL,
   '120208000000001', NULL, NULL, NULL,
   'meta', 'click_to_whatsapp', '120208000000003', true),

  -- Lead 3: Indicação manual (sem tracking Meta)
  ('Teste Indicação Manual', 'indica@test.bwild.com.br', '1132511000', 'lead', 'indicacao',
   NULL, NULL,
   NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
   NULL, NULL, NULL, true)
ON CONFLICT DO NOTHING;
