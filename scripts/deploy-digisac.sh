#!/usr/bin/env bash
# Deploy da integração Digisac (migração + 3 edge functions + secrets).
#
# Uso:
#   export SUPABASE_ACCESS_TOKEN="sbp_..."         # https://supabase.com/dashboard/account/tokens
#   export DIGISAC_API_TOKEN="<Bearer token>"      # Configurações → API no painel do Digisac
#   export DIGISAC_API_BASE_URL="https://bwild.digisac.chat/api/v1"
#   # opcional:
#   # export DIGISAC_WEBHOOK_SECRET="algum-segredo-que-voce-cria"
#   bash scripts/deploy-digisac.sh
#
# Requer o Supabase CLI. Se não tiver instalado, o script usa `bunx supabase`.

set -euo pipefail

PROJECT_REF="pieenhgjulsrjlioozsy"

echo "==> Verificando variáveis de ambiente..."
: "${SUPABASE_ACCESS_TOKEN:?defina SUPABASE_ACCESS_TOKEN}"
: "${DIGISAC_API_TOKEN:?defina DIGISAC_API_TOKEN (Bearer token da API Digisac)}"
: "${DIGISAC_API_BASE_URL:=https://bwild.digisac.chat/api/v1}"

if command -v supabase >/dev/null 2>&1; then
  SUPA="supabase"
else
  echo "==> Supabase CLI não encontrado; usando bunx supabase"
  SUPA="bunx supabase"
fi

export SUPABASE_ACCESS_TOKEN

echo "==> Linkando projeto ($PROJECT_REF)..."
$SUPA link --project-ref "$PROJECT_REF" || true

echo "==> Aplicando migrações (supabase db push)..."
$SUPA db push --include-all

echo "==> Deploy das edge functions..."
$SUPA functions deploy digisac-webhook --no-verify-jwt --project-ref "$PROJECT_REF"
$SUPA functions deploy digisac-send    --project-ref "$PROJECT_REF"
$SUPA functions deploy digisac-sync    --project-ref "$PROJECT_REF"

echo "==> Configurando secrets das edge functions..."
SECRETS_ARGS=(
  "DIGISAC_API_TOKEN=$DIGISAC_API_TOKEN"
  "DIGISAC_API_BASE_URL=$DIGISAC_API_BASE_URL"
)
if [[ -n "${DIGISAC_WEBHOOK_SECRET:-}" ]]; then
  SECRETS_ARGS+=("DIGISAC_WEBHOOK_SECRET=$DIGISAC_WEBHOOK_SECRET")
fi
$SUPA secrets set --project-ref "$PROJECT_REF" "${SECRETS_ARGS[@]}"

WEBHOOK_URL="https://${PROJECT_REF}.functions.supabase.co/digisac-webhook"

cat <<EOF

============================================================
 Deploy concluído 🎉
============================================================

Próximos passos (no navegador):

 1. No Digisac (https://bwild.digisac.chat):
    Configurações → Webhooks → Adicionar
      URL:     ${WEBHOOK_URL}
      Eventos: message.created, ticket.opened, ticket.closed, contact.updated
EOF

if [[ -n "${DIGISAC_WEBHOOK_SECRET:-}" ]]; then
  cat <<EOF
      Header:  x-webhook-secret = ${DIGISAC_WEBHOOK_SECRET}
EOF
fi

cat <<EOF

 2. No sistema, abra /admin/conversas → "Configurar Digisac"
    (ou rode o SQL abaixo diretamente no SQL editor do Supabase):

    UPDATE public.digisac_config
       SET api_token     = '<o mesmo DIGISAC_API_TOKEN>',
           api_base_url  = '${DIGISAC_API_BASE_URL}',
           webhook_secret= '${DIGISAC_WEBHOOK_SECRET:-}' ,
           enabled       = true;

 3. Depois clique em "Sincronizar agora" para importar tickets.

EOF
