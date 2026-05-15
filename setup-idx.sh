#!/usr/bin/env bash
# ============================================================
#  Setup do ambiente UPA Breves no Google IDX
#  Execute: bash setup-idx.sh
# ============================================================

set -e

echo ""
echo "=== Setup UPA Breves — Google IDX ==="
echo ""

# ── Verificar se .env já existe ─────────────────────────────
if [ -f ".env" ]; then
  echo "⚠️  Arquivo .env já existe."
  read -r -p "   Deseja sobrescrever? (s/N): " CONFIRM
  if [[ ! "$CONFIRM" =~ ^[Ss]$ ]]; then
    echo "   Cancelado. Nenhuma alteração feita."
    exit 0
  fi
fi

# ── Solicitar senha do Supabase ──────────────────────────────
echo ""
echo "Informe a senha do banco Supabase."
echo "(É a senha configurada em app.supabase.com → Settings → Database)"
echo ""
read -r -s -p "Senha do Supabase: " SUPABASE_PASSWORD
echo ""

if [ -z "$SUPABASE_PASSWORD" ]; then
  echo "❌ Senha não pode ser vazia."
  exit 1
fi

# ── Montar URL de conexão ────────────────────────────────────
DB_URL="postgresql://postgres.whcvaopgbhkkkpqpnxfs:${SUPABASE_PASSWORD}@aws-1-us-east-1.pooler.supabase.com:6543/postgres"

# ── Criar arquivo .env ───────────────────────────────────────
cat > .env << EOF
DATABASE_URL=${DB_URL}
SUPABASE_DATABASE_URL=${DB_URL}
SESSION_SECRET=upa-breves-session-secret-2026
EOF

echo ""
echo "✅ Arquivo .env criado com sucesso!"
echo ""
echo "=== Próximos passos ==="
echo ""
echo "1. Inicie a API no terminal:"
echo "   set -a; source .env; set +a; PORT=8080 NODE_ENV=development pnpm --filter @workspace/api-server run dev &"
echo ""
echo "2. Aguarde aparecer: 'Server listening port: 8080'"
echo ""
echo "3. Abra o preview (botão 'web' no painel direito do IDX)"
echo ""
echo "4. Login: admin / admin123"
echo ""
