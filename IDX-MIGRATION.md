# Migração para Google IDX

## Pré-requisitos
- Conta Google em https://idx.google.com
- Repositório Git do projeto (GitHub, GitLab ou similar)
- Conta no Supabase com o banco de produção já configurado

---

## Passo 1 — Exportar o código para um repositório Git

No Replit, clique em **Version Control** (ícone de ramificação na barra lateral)
e conecte a um repositório GitHub. Ou baixe o ZIP pelo menu do projeto e faça
`git push` manualmente para um repositório novo.

---

## Passo 2 — Criar o workspace no IDX

1. Acesse https://idx.google.com e clique em **New workspace**.
2. Escolha **Import a repo** e cole a URL do repositório Git.
3. O IDX detectará o arquivo `.idx/dev.nix` e configurará o ambiente
   automaticamente (Node.js 24, pnpm, extensões).

---

## Passo 3 — Configurar os Secrets (variáveis de ambiente)

No IDX, abra **Settings → Secrets** e adicione:

| Variável                  | Valor                                      |
|---------------------------|--------------------------------------------|
| `DATABASE_URL`            | URL de conexão do Supabase (mesma do prod) |
| `SUPABASE_DATABASE_URL`   | Mesma URL acima (ou URL direta Supabase)   |
| `SUPABASE_SERVICE_KEY`    | Service Role Key do Supabase               |
| `SESSION_SECRET`          | Qualquer string longa e aleatória          |

> **Banco de dados:** O Replit oferecia um PostgreSQL local automático.
> No IDX, use o Supabase diretamente como banco de desenvolvimento também —
> basta apontar `DATABASE_URL` para o Supabase. O projeto já está preparado
> para isso.

---

## Passo 4 — Primeira execução

Ao abrir o workspace:
1. O IDX rodará `pnpm install` automaticamente (hook `onCreate`).
2. Em seguida, iniciará a API (porta 8080) e o frontend (porta 23662).
3. O painel **Previews** mostrará o botão **web** — clique para abrir o sistema.

> O frontend usa um proxy interno do Vite para redirecionar `/api → localhost:8080`,
> então tudo funciona por uma única URL no IDX.

---

## Diferenças em relação ao Replit

| Aspecto                 | Replit                        | IDX                                     |
|-------------------------|-------------------------------|-----------------------------------------|
| Proxy de rotas          | Automático (`/api → 8080`)    | Proxy Vite em dev (já configurado)      |
| Banco local             | PostgreSQL automático          | Use Supabase em dev também              |
| Workflows               | `.replit-artifact/artifact.toml` | `.idx/dev.nix` (onStart + previews)  |
| Secrets                 | Painel Replit Secrets          | Painel IDX Secrets                      |
| Deploy/publicação       | Replit Deployments            | Firebase Hosting ou Cloud Run           |

---

## Deploy em produção via IDX

O IDX integra nativamente com **Firebase Hosting** e **Cloud Run**.
Para usar o backend Express com Cloud Run:

```bash
# Build da API
pnpm --filter @workspace/api-server run build

# Build do frontend
pnpm --filter @workspace/upa-system run build
```

Depois configure o `firebase.json` ou o `Dockerfile` conforme a documentação
do Firebase/Cloud Run em https://firebase.google.com/docs.

---

## Solução de problemas comuns

**"PORT not provided"**
→ Certifique-se de que as variáveis `PORT` e `BASE_PATH` estão definidas
no bloco `env` do `dev.nix` ou nos Secrets do workspace.

**API não responde**
→ Verifique se o processo `api-server` iniciou sem erro no terminal
**Output** do IDX. Confirme que `DATABASE_URL` está configurada nos Secrets.

**Tela em branco no frontend**
→ Confirme que `BASE_PATH=/` está definido. O Vite proxy precisa que a API
esteja rodando na porta 8080 antes do frontend ser aberto.
