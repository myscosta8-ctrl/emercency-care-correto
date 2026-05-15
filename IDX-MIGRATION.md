# Guia de Setup — UPA Breves no Google IDX

> **IMPORTANTE:** O Gemini integrado ao IDX pode dar instruções erradas para este projeto.
> Siga apenas este guia. O `.env` fica na **raiz do projeto**, nunca em `artifacts/api-server/`.

---

## Primeira vez no IDX (workspace novo)

### Passo 1 — Abrir o terminal no IDX

No IDX, clique em **Terminal → New Terminal** (ou `Ctrl+Shift+``).

---

### Passo 2 — Criar o arquivo .env (único comando)

No terminal, rode:

```bash
bash setup-idx.sh
```

O script vai pedir a **senha do banco Supabase** e criará o `.env` automaticamente.

> Senha do Supabase: veja em **app.supabase.com → Settings → Database → Database password**
> Se não lembrar, clique em "Reset database password" para criar uma nova.

---

### Passo 3 — Iniciar a API

Após o script terminar, rode no mesmo terminal:

```bash
set -a; source .env; set +a; PORT=8080 NODE_ENV=development pnpm --filter @workspace/api-server run dev &
```

Aguarde aparecer:
```
Server listening port: 8080
Database initialization complete
```

---

### Passo 4 — Abrir o sistema

Clique no botão **web** no painel de preview do IDX.

Login: **`admin`** / Senha: **`admin123`**

---

## Se o sistema travar ou o login ficar em loading infinito

Rode estes comandos em sequência no terminal:

```bash
# 1. Matar todos os processos Node em execução
pkill -f "node.*dist/index.mjs" 2>/dev/null; sleep 2

# 2. Recriar o .env (se necessário)
bash setup-idx.sh

# 3. Reiniciar a API
set -a; source .env; set +a; PORT=8080 NODE_ENV=development pnpm --filter @workspace/api-server run dev &
```

---

## Se o workspace foi recriado do zero

O IDX roda `pnpm install` automaticamente ao criar um workspace novo (hook `onCreate`).
Se as dependências não foram instaladas, rode:

```bash
pnpm install
bash setup-idx.sh
set -a; source .env; set +a; PORT=8080 NODE_ENV=development pnpm --filter @workspace/api-server run dev &
```

---

## Estrutura dos arquivos de configuração

```
/                        ← raiz do projeto
├── .env                 ← criado pelo setup-idx.sh (NÃO vai para o GitHub)
├── .env.example         ← modelo do .env (vai para o GitHub)
├── setup-idx.sh         ← script de setup automático (vai para o GitHub)
└── .idx/
    └── dev.nix          ← configuração do ambiente IDX (Node 24, pnpm, portas)
```

---

## Como continuar desenvolvendo

**Regra principal:** Edite o código aqui no **Replit** (ambiente estável) e sincronize com o GitHub. No IDX, use apenas para testar com o banco de produção Supabase.

### Fluxo recomendado:

1. **Editar** → Replit (auto-reload, estável)
2. **Commitar** → GitHub via Replit Version Control
3. **Puxar no IDX** → `git pull` no terminal do IDX
4. **Reiniciar API no IDX** → `pkill -f "node.*dist/index.mjs"; set -a; source .env; set +a; PORT=8080 NODE_ENV=development pnpm --filter @workspace/api-server run dev &`

---

## Variáveis de ambiente necessárias

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | URL completa do Supabase Transaction Pooler (porta 6543) |
| `SUPABASE_DATABASE_URL` | Mesma URL acima |
| `SESSION_SECRET` | String secreta da sessão (já configurada no script) |

Formato da URL:
```
postgresql://postgres.whcvaopgbhkkkpqpnxfs:SENHA@aws-1-us-east-1.pooler.supabase.com:6543/postgres
```

---

## Dicas para não quebrar o sistema no IDX

- **Não deixe o Gemini editar arquivos de configuração** (dev.nix, vite.config.ts, package.json)
- **Não mova o .env** de lugar — ele deve ficar sempre na raiz do projeto
- **Não rode `pnpm dev` na raiz** — use sempre `pnpm --filter @workspace/nome run dev`
- **Sempre reinicie a API** após qualquer mudança no backend
- Se o preview ficar em branco, aguarde a API iniciar completamente antes de abrir
