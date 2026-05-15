# Relatório Técnico — Sistema UPA Breves (Emergência 3.0)
**Data:** Maio de 2026  
**Preparado para:** Arquiteto de Software / Novo Colaborador Técnico  
**Ambiente de desenvolvimento:** Replit (editor principal) + Google IDX / Firebase Studio (testes com banco de produção)  
**Repositório GitHub:** https://github.com/myscosta8-ctrl/EMERCENCY-CARE-CORRETO

---

## 1. Visão Geral do Projeto

Sistema de gestão de pacientes para a UPA 24h do município de Breves/PA (Prefeitura Municipal de Breves). O sistema opera em ambiente de emergência hospitalar, com suporte a triagem Manchester, controle de fluxo de pacientes, prescrições médicas, evoluções multiprofissionais, gestão de leitos, notificações compulsórias (SINAN), geração de PDFs e módulo de laboratório.

**Linguagem padrão da interface:** Português Brasileiro (pt-BR)  
**Tema visual:** Dark, moderno, com cores da Triagem de Manchester  
**Usuários:** Recepcionistas, enfermeiros, técnicos de enfermagem, médicos, assistentes sociais, nutricionistas, farmacêuticos, administradores

---

## 2. Estrutura do Projeto (Monorepo pnpm)

O projeto é um **monorepo pnpm workspace** organizado em três camadas: artefatos deployáveis, bibliotecas compartilhadas e scripts utilitários.

```
/                                   ← raiz do workspace
├── artifacts/                      ← aplicações deployáveis
│   ├── api-server/                 ← backend Express (Node.js 24)
│   │   ├── src/
│   │   │   ├── assets/             ← logos em JPEG para PDFs (prefeitura-breves, upa24h)
│   │   │   ├── lib/                ← db-init.ts, server-permissions.ts, supabase-storage.ts, pdf-lib helpers
│   │   │   ├── middleware/         ← requireAuth, requirePermissao, auditWrite
│   │   │   ├── middlewares/        ← (duplicata histórica, não usar)
│   │   │   ├── routes/             ← um arquivo .ts por recurso (ver seção 7)
│   │   │   └── templates/          ← PDFs oficiais: apac-laudo.pdf, ficha-referencia.pdf
│   │   ├── build.mjs               ← script esbuild (CJS → ESM, copia assets e templates)
│   │   └── dist/                   ← build compilado (index.mjs)
│   │
│   ├── upa-system/                 ← frontend React + Vite
│   │   ├── public/
│   │   │   ├── logos/              ← logos institucionais para PWA e telas
│   │   │   └── pdf-templates/      ← templates locais de impressão HTML
│   │   ├── src/
│   │   │   ├── components/         ← componentes reutilizáveis (ver seção 8)
│   │   │   ├── hooks/              ← hooks customizados (ver seção 9)
│   │   │   ├── lib/                ← utils, sinan-agravos.ts, permissions.ts
│   │   │   └── pages/              ← páginas da aplicação (ver seção 10)
│   │   └── vite.config.ts          ← configuração do Vite (CRÍTICA — ver seção 15)
│   │
│   └── mockup-sandbox/             ← servidor Vite separado para prototipagem de UI no canvas
│       └── src/components/mockups/ ← mockups: prontuario-tabs, upa-dashboard
│
├── lib/                            ← bibliotecas compartilhadas (TypeScript composite)
│   ├── api-spec/                   ← especificação OpenAPI (fonte para codegen)
│   ├── api-client-react/           ← hooks React Query gerados por Orval
│   ├── api-zod/                    ← schemas Zod gerados por Orval
│   └── db/                         ← schema Drizzle ORM + conexão PostgreSQL
│       └── src/
│           ├── index.ts            ← lógica de conexão (SSL automático para Supabase)
│           └── schema/             ← definições das tabelas Drizzle
│
├── scripts/                        ← utilitários de workspace (@workspace/scripts)
├── pnpm-workspace.yaml             ← catalog de versões fixas e packages discovery
├── tsconfig.json                   ← solution file TypeScript (apenas libs)
├── tsconfig.base.json              ← configurações TypeScript compartilhadas
├── .idx/dev.nix                    ← configuração do ambiente Google IDX (CRÍTICA)
├── setup-idx.sh                    ← script de setup automático do .env no IDX
├── .env.example                    ← modelo do .env com estrutura das variáveis
├── IDX-MIGRATION.md                ← guia de uso do IDX
└── RELATORIO-TECNICO.md            ← este documento
```

---

## 3. Tecnologias Utilizadas

### Backend
| Tecnologia | Versão | Uso |
|---|---|---|
| Node.js | 24.x | Runtime do servidor |
| Express | 5.x | Framework HTTP |
| TypeScript | ~5.9.2 | Linguagem principal |
| Drizzle ORM | ^0.45.2 | ORM para PostgreSQL |
| Zod | catalog | Validação de schemas |
| bcryptjs | ^3.0.3 | Hash de senhas |
| pdf-lib | ^1.17.1 | Geração de PDFs no servidor |
| pino + pino-http | ^9 / ^10 | Logging estruturado (NUNCA use console.log no servidor) |
| esbuild | ^0.27.3 | Build do backend (CJS bundle → ESM) |
| @supabase/supabase-js | ^2.105.3 | Cliente Supabase (Storage de arquivos) |

### Frontend
| Tecnologia | Versão | Uso |
|---|---|---|
| React | 19.1.0 | UI framework (versão FIXADA — não alterar) |
| Vite | catalog (^7.x) | Build tool e dev server |
| TailwindCSS | catalog (^4.x) | Estilização utility-first |
| @tanstack/react-query | ^5.90.21 | Gerenciamento de estado servidor/cache |
| wouter | ^3.3.5 | Roteamento client-side (não React Router) |
| Radix UI | várias | Componentes acessíveis headless |
| lucide-react | ^0.545.0 | Ícones |
| framer-motion | ^12.x | Animações |
| react-hook-form | ^7.55.0 | Formulários |
| date-fns | ^3.6.0 | Manipulação de datas |
| recharts | ^2.15.2 | Gráficos |
| vite-plugin-pwa | ^1.3.0 | PWA / Service Worker |
| sonner | ^2.0.7 | Notificações toast |
| pdf-lib | ^1.17.1 | Geração de PDFs no cliente |
| html5-qrcode | ^2.3.8 | Leitura de QR Code |

### Banco de Dados e Infraestrutura
| Item | Detalhe |
|---|---|
| PostgreSQL | Banco principal |
| Supabase | Banco de produção (Transaction Pooler, porta 6543) |
| Replit PostgreSQL | Banco de desenvolvimento local |
| Supabase Storage | Upload de arquivos de exames (bucket `exam-files`) |

### Ambiente de Desenvolvimento
| Item | Detalhe |
|---|---|
| Replit | Editor principal, workflows, banco local |
| Google IDX / Firebase Studio | Ambiente de teste com Supabase produção |
| pnpm | Gerenciador de pacotes (workspace) |
| Orval | Codegen de cliente a partir do OpenAPI spec |

---

## 4. Scripts Importantes

### Raiz do projeto (`package.json`)
```bash
pnpm run typecheck:libs    # Compila apenas as libs composite (tsc --build)
pnpm run typecheck         # Typecheck completo: libs + todos os artefatos
pnpm run build             # typecheck + build de todos os pacotes
```

### Backend (`artifacts/api-server/package.json`)
```bash
pnpm --filter @workspace/api-server run dev        # build + start (desenvolvimento)
pnpm --filter @workspace/api-server run build      # esbuild → dist/index.mjs
pnpm --filter @workspace/api-server run start      # node dist/index.mjs
pnpm --filter @workspace/api-server run typecheck  # tsc --noEmit
```

### Frontend (`artifacts/upa-system/package.json`)
```bash
pnpm --filter @workspace/upa-system run dev        # vite dev server
pnpm --filter @workspace/upa-system run build      # vite build → dist/public/
pnpm --filter @workspace/upa-system run serve      # vite preview
pnpm --filter @workspace/upa-system run typecheck  # tsc --noEmit
```

### Codegen OpenAPI → cliente
```bash
pnpm --filter @workspace/api-spec run codegen
# Após codegen, redefinir lib/api-zod/src/index.ts para apenas:
# export * from "./generated/api";
# Depois executar:
pnpm run typecheck:libs
```

---

## 5. Como Iniciar o Sistema

### No Replit
Os workflows são gerenciados automaticamente pelo Replit:
- **API Server** → executa `pnpm --filter @workspace/api-server run dev` na porta definida pelo workflow
- **web (upa-system)** → executa `pnpm --filter @workspace/upa-system run dev`
- **mockup-sandbox** → executa `pnpm --filter @workspace/mockup-sandbox run dev`

### No Google IDX
**Passo 1 — Criar o .env (apenas uma vez ou quando recriar o workspace):**
```bash
bash setup-idx.sh
# Informa a senha do Supabase quando solicitado
```

**Passo 2 — Iniciar a API manualmente (se não iniciar automaticamente via onStart):**
```bash
pkill -f "node.*dist/index.mjs" 2>/dev/null; sleep 1
set -a; source .env; set +a
PORT=8080 NODE_ENV=development pnpm --filter @workspace/api-server run dev &
```

**Passo 3 — Aguardar e abrir preview:**
- Aguardar `Server listening port: 8080` e `Database initialization complete`
- Clicar no botão **web** no painel de preview do IDX
- Login padrão: `admin` / `admin123`

**Para sincronizar código do Replit para IDX:**
```bash
git pull
# O IDX relê o dev.nix com "Rebuild Environment" ou reinicia automaticamente
```

---

## 6. Variáveis de Ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | Sim | URL PostgreSQL (Replit local ou Supabase Transaction Pooler) |
| `SUPABASE_DATABASE_URL` | Opcional | URL Supabase (usada em `NODE_ENV=production`) |
| `SUPABASE_SERVICE_KEY` | Opcional | Service Role Key — ativa upload de arquivos no Supabase Storage |
| `SESSION_SECRET` | Sim | Segredo da sessão (definido via Replit Secrets) |

**Formato da URL Supabase Transaction Pooler:**
```
postgresql://postgres.whcvaopgbhkkkpqpnxfs:SENHA@aws-1-us-east-1.pooler.supabase.com:6543/postgres
```

**Lógica de conexão (`lib/db/src/index.ts`):**
- `NODE_ENV=production` → usa `SUPABASE_DATABASE_URL`
- `NODE_ENV=development` → usa `DATABASE_URL`
- SSL habilitado automaticamente quando a URL contém `supabase.com` ou `supabase.co`

---

## 7. Rotas da API (Backend)

Todas as rotas passam pelos middlewares `requireAuth` (valida header `x-staff-id`) e `auditWrite` (loga operações de escrita).

**Rotas públicas (sem autenticação):**
```
GET  /api/healthz                    → health check
POST /api/auth/login                 → login (retorna staff completo)
POST /api/auth/forgot-password       → solicitar reset de senha
POST /api/auth/reset-password        → aplicar nova senha via token
POST /api/auth/change-password       → trocar senha (primeiro acesso)
GET  /api/calls/recent               → chamadas recentes (painel TV)
```

**Rotas autenticadas:**
```
/api/patients                        → CRUD completo de pacientes
/api/patients/:id/notifications      → notificações SINAN por paciente
/api/patients/:id/social-notes       → evoluções do serviço social
/api/patients/:id/nutritional-assessments → avaliações nutricionais
/api/patients/:id/pharmacy-entries   → entradas farmácia
/api/patients/:id/transfers          → registros de transferência
/api/patients/:id/devices            → dispositivos clínicos
/api/patients/:id/alerts             → alertas por paciente
/api/patients/:id/allergies          → alergias
/api/patients/:id/consents           → consentimentos (TCLE)
/api/patients/:id/deaths             → registros de óbito
/api/patients/:id/procedures         → procedimentos
/api/patients/:id/interconsults      → interconsultas
/api/patients/:id/care-plans         → planos de cuidado
/api/patients/:id/controlled-substances → medicamentos controlados
/api/patients/:id/dispensations      → dispensações farmacêuticas
/api/patients/:id/nursing-forms      → formulários de enfermagem
/api/exam-requests                   → solicitações de exames (globais)
/api/staff                           → CRUD de colaboradores
/api/audit                           → log de auditoria
/api/alerts                          → sistema de alertas críticos
/api/beds                            → gestão de leitos
/api/notifications                   → notificações SINAN (standalone)
/api/internal-notifications          → notificações internas do sistema
/api/reports                         → relatórios e PDFs
/api/tempos-metas                    → monitoramento de tempos-meta
/api/inventory                       → estoque de medicamentos
/api/backup/export                   → exportação completa de dados (JSON)
```

**Rotas de PDF geradas pelo servidor:**
```
GET /api/patients/:id/pdf/apac             → APAC Laudo (overlay em PDF oficial)
GET /api/patients/:id/pdf/ficha-referencia → Ficha de Referência (overlay em PDF oficial)
GET /api/patients/:id/prescriptions/:rxId/pdf → Prescrição Médica (landscape A4)
```

---

## 8. Banco de Dados — Tabelas

O banco é PostgreSQL gerenciado pelo Supabase em produção. A inicialização é **idempotente** — `db-init.ts` executa `CREATE TABLE IF NOT EXISTS` e `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` a cada startup, sem migrations manuais.

### Tabelas Principais (criadas na inicialização base)
| Tabela | Descrição |
|---|---|
| `staff` | Colaboradores — login, senha (bcrypt), cargo, setor, turno, consultório, permissões customizadas |
| `patients` | Pacientes — dados demográficos, triagem, care_status, prontuário, atendimento number |
| `patient_calls` | Chamadas de pacientes (painel TV) |
| `patient_alerts` | Alertas por paciente (crítico, queda, etc.) |
| `audit_log` | Log de todas as operações de escrita |
| `beds` | Leitos — número, setor, status, ocupante, isolamento |
| `password_resets` | Tokens de reset de senha |
| `patient_evolutions` | Evoluções multiprofissionais (SOAP, SAE, técnico, etc.) com `structured_data` JSONB |
| `patient_exam_requests` | Solicitações de exames laboratoriais e imagem |
| `exam_results` | Resultados de exames com upload de arquivo (base64 ou Supabase Storage) |
| `nutritional_assessments` | Avaliações nutricionais com `structured_data` JSONB |
| `patient_notifications` | Notificações SINAN por paciente |
| `patient_prescriptions` | Prescrições médicas e de enfermagem |
| `patient_tasks` | Tarefas clínicas |
| `patient_devices` | Dispositivos clínicos (sonda, cateter, etc.) |
| `pharmacy_entries` | Entradas do módulo farmácia |
| `social_notes` | Notas do serviço social com `structured_data` JSONB |
| `transfers` | Transferências de pacientes |
| `vitals` | Sinais vitais por paciente |

### Tabelas Adicionais (criadas via ALTER incremental)
| Tabela | Descrição |
|---|---|
| `patient_nir_entries` | Entradas de regulação/NIR por paciente |
| `patient_allergies` | Alergias registradas |
| `patient_consents` | Consentimentos (TCLE) |
| `patient_deaths` | Registros de óbito |
| `patient_procedures` | Procedimentos clínicos |
| `interconsults` | Interconsultas multiprofissionais |
| `care_plans` | Planos de cuidado |
| `controlled_substances` | Medicamentos controlados |
| `pharmacy_dispensations` | Dispensações farmacêuticas |
| `internal_notifications` | Notificações internas do sistema (sino) |
| `inventory_items` | Itens de estoque |
| `inventory_stock` | Estoque por item |
| `inventory_batches` | Lotes de inventário |
| `inventory_transactions` | Movimentações de estoque |
| `patient_nursing_forms` | Formulários estruturados de enfermagem |

### Campos-chave da tabela `patients`
```
id, full_name, age, birth_date, sex, mother_name
cpf, rg, cns, phone, email, address
care_status (11 estados — ver seção 12)
sector, internment_status
prontuario_number, atendimento_number (formato: 000001)
triage_level (Manchester: vermelho/laranja/amarelo/verde/azul)
diagnosis, treatment, bed
created_by, updated_by (audit fields)
archived_at, archive_reason (alta = arquivamento, não exclusão)
```

### Campos-chave da tabela `staff`
```
id, name, login, password_hash (bcrypt)
role (cargo — ver seção 13)
sector, setores_atuacao, turno, consultorio
custom_permissions (JSON array — sobrepõe permissões do cargo)
must_change_password (obriga troca no primeiro login)
active (soft delete)
coren_crm, digital_signature, stamp
```

---

## 9. Sistema de Autenticação

### Fluxo de Login
1. Frontend envia `POST /api/auth/login` com `{ login, password }`
2. Backend executa `pool.query()` direto (não Drizzle) para compatibilidade com o Transaction Pooler do Supabase
3. Verifica hash bcrypt; se for hash legado (SHA-256), valida e **faz upgrade automático** para bcrypt
4. Retorna objeto `staff` completo com `role`, `setores_atuacao`, `turno`, `consultorio`, `custom_permissions`
5. Frontend armazena em `AuthContext` e `localStorage`

### Middleware de Autenticação
- `requireAuth` — valida header `x-staff-id` em todas as rotas protegidas
- Não usa JWT/cookies — autenticação stateless por header

### Sistema de Permissões
Definido em dois lugares (devem ser mantidos em sincronia):
- **Backend:** `artifacts/api-server/src/lib/server-permissions.ts`
- **Frontend:** `artifacts/upa-system/src/lib/permissions.ts`

**Cargos e permissões base:**
```
recepcionista       → criar_paciente, editar_paciente, visualizar_setores
enfermeiro          → editar_paciente, classificacao_risco, gerar_pdf, registrar_sinais_vitais,
                       registrar_evolucao, registrar_prescricao, registrar_alergia,
                       registrar_consentimento, registrar_procedimento, registrar_interconsulta,
                       registrar_plano_cuidados, mudar_setor, excluir_paciente
tecnico_enfermagem  → registrar_sinais_vitais, registrar_evolucao
medico              → * (acesso total)
assistente_social   → visualizar_setores, visualizar_relatorios, editar_paciente, registrar_nota_social
nutricionista       → visualizar_setores, visualizar_relatorios, registrar_avaliacao_nutricional
farmaceutico        → visualizar_setores, registrar_prescricao, registrar_farmacia,
                       registrar_exames, registrar_medicamento_controlado, registrar_dispensacao
laboratorio         → visualizar_setores, registrar_exames
auxiliar_administrativo → editar_paciente, visualizar_setores, visualizar_relatorios
administrador       → * (acesso total)
diretoria_geral     → * (acesso total)
```

**Permissões customizadas (`custom_permissions`):**
- Coluna JSON na tabela `staff`
- Quando preenchida, **sobrepõe completamente** as permissões do cargo
- Administrável via Admin → Equipe → Matriz de Permissões

### Hooks de Permissão (Frontend)
```typescript
usePode(acao, feature?)  // Verifica permissão + feature flag
useFeatures()            // Feature flags do sistema
```

---

## 10. Fluxo de Cuidado do Paciente (Care Status)

O paciente percorre 11 estados possíveis:

```
Em Triagem
    ↓
Aguardando Atendimento
    ↓
Em Atendimento (Cons. 1)  ←→  Em Atendimento (Cons. 2)
    ↓
Em Medicação  |  Aguardando Exames  |  Aguardando Reavaliação
    ↓
Em Observação  |  Internado  |  Em Transferência  |  Sala Vermelha
    ↓
Alta (→ arquivado, não deletado)
```

**Regras importantes:**
- Pacientes com status `Alta` são **arquivados** (não deletados) — histórico preservado
- A API filtra pacientes com `Alta` de todos os endpoints de listagem ativa
- Ao dar `Alta`, o servidor gera automaticamente uma evolução `SUMÁRIO DE ALTA` com dados do internamento

---

## 11. Páginas do Frontend

### Páginas Principais
| Arquivo | Rota | Descrição |
|---|---|---|
| `login.tsx` | `/login` | Tela de login |
| `change-password.tsx` | `/change-password` | Troca de senha obrigatória (primeiro acesso) |
| `forgot-password.tsx` | `/forgot-password` | Solicitar reset |
| `reset-password.tsx` | `/reset-password` | Aplicar nova senha |
| `dashboard.tsx` | `/` | Dashboard principal com fluxo de pacientes |
| `patient-detail.tsx` | `/patient/:id` | Prontuário completo (19 abas) |
| `leitos.tsx` | `/leitos` | Grade visual de leitos |
| `observacao-leitos.tsx` | `/observacao-leitos` | Leitos em observação |
| `fila-medico.tsx` | `/fila-medico` | Fila médica (Cons. 1 e 2) |
| `recepcao.tsx` | `/recepcao` | Fila de recepção |
| `farmacia.tsx` | `/farmacia` | Módulo farmácia |
| `farmacia-estoque.tsx` | `/farmacia-estoque` | Estoque de medicamentos |
| `laboratorio.tsx` | `/laboratorio` | Módulo laboratório |
| `exames.tsx` | `/exames` | Solicitações de exames |
| `vitais.tsx` | `/vitais` | Registro de sinais vitais |
| `historico.tsx` | `/historico` | Arquivo de altas |
| `relatorios.tsx` | `/relatorios` | Relatórios gerenciais |
| `social.tsx` | `/social` | Módulo serviço social |
| `nutricao.tsx` | `/nutricao` | Módulo nutrição |
| `shift-handover.tsx` | `/passagem-plantao` | Passagem de plantão |
| `tempos-metas.tsx` | `/tempos-metas` | Monitoramento de tempos-meta |
| `painel-tv.tsx` | `/painel-tv` | Painel para TV da recepção |
| `notification-print.tsx` | `/notification-print/:id` | Impressão SINAN |
| `patient-nursing-form.tsx` | `/patient/:id/nursing-form` | Formulário de enfermagem |
| `not-found.tsx` | `*` | 404 |

### Páginas Admin (`/pages/admin/`)
| Arquivo | Descrição |
|---|---|
| `staff.tsx` | CRUD de colaboradores + matriz de permissões |
| (outros) | Feature flags, auditoria, configurações |

---

## 12. Prontuário Multiprofissional (patient-detail.tsx)

Arquivo com **3.176 linhas** — componente central e mais complexo do sistema.

**19 abas organizadas por categoria profissional:**
```
1.  resumo          → Resumo Clínico (dados de admissão, últimos vitais, prescrições ativas)
2.  atendimento     → Dados do atendimento atual
3.  sinais-vitais   → Sinais vitais com gráficos
4.  timeline        → Linha do Tempo cronológica (todos os eventos)
5.  evolucao-medica → Evoluções médicas (HDA, exame físico, CID-10, conduta)
6.  prescricao      → Prescrição médica com PDF
7.  sol-exames      → Solicitação de exames (lab + imagem)
8.  enfermagem      → SAE (Sistematização da Assistência de Enfermagem)
9.  sae             → SAE estruturado
10. tecnico-enf     → Evoluções do técnico de enfermagem
11. social          → Serviço social estruturado
12. nutricao        → Avaliação nutricional (IMC auto-calculado)
13. farmacia        → Entradas farmácia
14. exames          → Resultados de exames (com upload)
15. laboratorio     → Módulo laboratório
16. nir             → Regulação/NIR
17. transferencia   → Transferências
18. sinan           → Notificações SINAN (ver seção 14)
19. dispositivos    → Dispositivos clínicos
    alergias        → (condicional: apenas internados com permissão)
```

**ATENÇÃO:** Os valores das abas (`"sol-exames"`, `"alergias"`, etc.) são identificadores **internos do React** e NÃO têm relação com as rotas da API. As chamadas à API usam os caminhos corretos em inglês (`/exam-requests`, `/allergies`).

---

## 13. Componentes Principais

```
patient-form.tsx              → Formulário de admissão/edição de paciente
patient-row.tsx               → Linha do dashboard com status e ações
patient-resumo-tab.tsx        → Resumo Clínico (tab 1 do prontuário)
patient-timeline-tab.tsx      → Linha do Tempo agregada
patient-nir-tab.tsx           → Regulação/NIR
patient-lab-tab.tsx           → Laboratório com auto-refresh (30s)
patient-allergies-tab.tsx     → Alergias
patient-care-plan-tab.tsx     → Plano de cuidados
patient-controlled-meds-tab.tsx → Medicamentos controlados
patient-dispensations-tab.tsx → Dispensações
patient-interconsults-tab.tsx → Interconsultas
patient-procedures-tab.tsx    → Procedimentos
patient-alerts-panel.tsx      → Painel de alertas críticos
patient-obito-tab.tsx         → Registro de óbito
patient-tcle-tab.tsx          → Consentimentos (TCLE)
evolution-medico.tsx          → Evolução médica estruturada
evolution-enfermeiro.tsx      → Evolução enfermeiro (SAE)
evolution-tecnico.tsx         → Evolução técnico de enfermagem
evolution-social.tsx          → Evolução serviço social
evolution-nutricionista.tsx   → Avaliação nutricional (IMC auto)
evolution-enfermagem-diaria.tsx → Evolução diária de enfermagem
medical-prescription-form.tsx → Formulário prescrição médica
prescription-form.tsx         → Formulário prescrição enfermagem
vitals-record-form.tsx        → Registro de sinais vitais
vitals-update-form.tsx        → Atualização de sinais vitais
notification-form.tsx         → Formulário SINAN
transfer-form.tsx             → Formulário de transferência
tasks-form.tsx                → Formulário de tarefas
bed-picker-inline.tsx         → Seletor de leito inline
dashboard-sidebar.tsx         → Sidebar do dashboard
internal-notifications-bell.tsx → Sino de notificações internas
role-header.tsx               → Cabeçalho com role do usuário
print-header.tsx              → Cabeçalho padrão UPA para impressão
error-boundary.tsx            → Boundary de erros React
patient-lookup.tsx            → Busca de paciente
```

---

## 14. Hooks Customizados

```
use-audit.ts           → Registra ações no audit_log
use-critical-alerts.ts → Polling de alertas críticos (pacientes em estado crítico)
use-debounce.ts        → Debounce para buscas
use-mobile.tsx         → Detecção de mobile
use-nurse.ts           → Dados da enfermeira responsável
use-offline.ts         → Detecção de modo offline (PWA)
use-pode.ts            → Verificação de permissão (usePode)
use-toast.ts           → Sistema de toasts (Sonner)
```

---

## 15. Módulo SINAN (Notificações Compulsórias)

### O que existe atualmente
**Backend:**
- Tabela `patient_notifications` — armazena notificações por paciente
- Rota `POST /api/notifications` — cria notificação, auto-preenchendo dados do paciente
- Rota `GET /api/notifications/:id` — busca notificação com dados do paciente
- Rota standalone `router.use("/notifications", sinanNotificationsRouter)` em `routes/index.ts`
- Geração de PDF SINAN via `GET /api/patients/:id/prescriptions/:rxId/pdf` (landscape, com dados do paciente)

**Frontend:**
- `artifacts/upa-system/src/lib/sinan-agravos.ts` — lista completa de 60+ agravos do SINAN com código, CID-10, template e flag `urgente`
- Aba `sinan` no prontuário (tab 18) — listagem e geração de notificações
- `notification-form.tsx` — formulário de notificação (todos os campos preenchíveis digitalmente)
- `notification-print.tsx` — página de impressão SINAN formatada
- Permissão `sinan_pdf` (feature flag) controla visibilidade da aba

### Agravos cadastrados no sistema
O arquivo `sinan-agravos.ts` contém:
- Notificações imediatas (≤24h): Antraz, Botulismo, Cólera, COVID-19, Dengue Grave, Difteria, Febre Amarela, SRAG, Meningite, Mpox, Raiva, Sarampo, Tétano, Varíola e outros
- Notificações semanais: AIDS adulto/criança, Chikungunya, Dengue, Esquistossomose, Leishmaniose, Malária, Sífilis, Tuberculose e outros
- Templates disponíveis: `dengue`, `srag`, `meningite`, `febre_amarela`, `exantematica`, `aids_adulto`, `covid19`, `outros`

### O que NÃO foi integrado / ainda falta
- Preenchimento automático de campos específicos do formulário SINAN por agravo (cada agravo tem campos distintos)
- Integração com o sistema nacional de notificação (e-SUS/SINAN online) — notificação digital
- Relatórios agregados de notificações por período/agravo para vigilância epidemiológica
- Workflow de acompanhamento do caso após notificação (investigação, encerramento)
- Assinatura digital do responsável pela notificação

---

## 16. Problemas Encontrados e Resolvidos

### Problema 1 — Login com Loading Infinito (Supabase Transaction Pooler)
**Causa:** Drizzle ORM fazia queries que exigiam sessão de conexão persistente (incompatível com Transaction Pooler do Supabase, porta 6543).  
**Solução:** Rota `/api/auth/login` foi reescrita para usar `pool.query()` direto (node-postgres), sem Drizzle, que é compatível com pooler.  
**Arquivo afetado:** `artifacts/api-server/src/routes/auth.ts`

### Problema 2 — SSL na Conexão com Supabase
**Causa:** Em `NODE_ENV=development`, SSL não era ativado, causando falhas de conexão com o Supabase.  
**Solução:** Detecção automática por URL — se contém `supabase.com` ou `supabase.co`, SSL é ativado independentemente do `NODE_ENV`.  
**Arquivo afetado:** `lib/db/src/index.ts`

### Problema 3 — `Invalid PORT value: ""` no IDX
**Causa:** O IDX passava `PORT` como string vazia `""` para o processo Vite. O operador `??` em JavaScript NÃO trata string vazia como "ausente" — apenas `null` e `undefined` ativam o fallback.  
**Solução:** Substituído `??` por `||` na leitura da variável PORT:
```typescript
// ANTES (bugado com IDX):
const rawPort = process.env.PORT ?? "5173";
// DEPOIS (correto):
const rawPort = process.env.PORT || "5173";
```
**Arquivo afetado:** `artifacts/upa-system/vite.config.ts` (linha 11)

### Problema 4 — Preview do IDX travando em loop
**Causa:** O IDX usava `lsof` no comando do preview para matar processos, mas `lsof` não estava disponível no ambiente Nix. Além disso, o formato heredoc `''...''` do Nix causava problemas de parsing com `||`.  
**Solução:** Simplificação do comando do preview no `dev.nix`:
```nix
# ANTES (problemático):
command = ["sh" "-c" ''lsof -ti:"$PORT" | xargs kill -9 2>/dev/null || true; sleep 1; PORT=$PORT ...'']
# DEPOIS (funcional):
command = ["sh" "-c" "export PORT=\${PORT:-5173}; BASE_PATH=/ API_PORT=8080 NODE_ENV=development pnpm --filter @workspace/upa-system run dev"]
```
**Arquivo afetado:** `.idx/dev.nix`

### Problema 5 — Dois processos Node esgotando o connection pool do Supabase
**Causa:** O IDX iniciava a API via `onStart` E o usuário iniciava manualmente, criando dois processos que esgotavam as conexões do Supabase Transaction Pooler.  
**Solução:** Adição de `pkill -f "node.*dist/index.mjs" 2>/dev/null || true` antes do start da API no `onStart`.  
**Arquivo afetado:** `.idx/dev.nix`

### Problema 6 — `monospace.showWebPreview` not found
**Causa:** O workspace do IDX ficou em estado degradado (interface do Firebase Studio corrompida).  
**Solução:** Fechar e reabrir o workspace no IDX (Rebuild Environment).  
**Natureza:** Bug do próprio IDX, não do código.

### Problema 7 — Remote GitHub incorreto
**Causa:** O remote `github` apontava para repositório inexistente (`emergencycare1.0`); o remote `origin` apontava para `emergency-care-hub`.  
**Solução:** Push via URL direta com token: `https://ghp_TOKEN@github.com/myscosta8-ctrl/EMERCENCY-CARE-CORRETO.git`  
**Repositório correto:** `EMERCENCY-CARE-CORRETO`

---

## 17. Estado Atual do Projeto

### Funcionando e Estável
- Login e autenticação com bcrypt + upgrade automático de hashes legados
- CRUD completo de pacientes
- Dashboard com fluxo por status e setor
- Triagem Manchester com cores corretas
- Prontuário multiprofissional (19 abas)
- Sinais vitais com histórico
- Prescrições médicas com geração de PDF
- Evoluções multiprofissionais (médico, enfermeiro, técnico, social, nutricionista)
- Solicitações de exames
- Gestão de leitos com isolamento
- Sistema de alertas críticos
- Notificações internas (sino)
- Passagem de plantão
- Auditoria de todas as operações
- Sistema de permissões por cargo + customização individual
- SINAN — formulário digital e geração de PDF
- Histórico de altas (arquivo)
- Backup de dados (exportação JSON)
- PWA com service worker e cache offline
- Geração de PDFs: APAC, Ficha de Referência, Prescrição Médica, SINAN
- Upload de arquivos de exames (base64 local ou Supabase Storage)
- Ambiente IDX funcionando com Supabase produção

### Experimental / Em Desenvolvimento
- Módulo de Inventário de Medicamentos (tabelas criadas, frontend parcial)
- Módulo de Tempos-Meta (tabela e frontend básico)
- Módulo farmácia-estoque (parcialmente implementado)
- Painel TV (funcional mas sem integração completa de chamadas)

### O Que Ainda Não Existe
- Deploy de produção configurado (não há Firebase Hosting, Cloud Run ou Replit Deployment ativo)
- Integração com e-SUS/SINAN online (notificação eletrônica)
- Módulo de agendamento/ambulatório
- Integração com sistemas externos de laboratório (HIS/LIS)
- Módulo financeiro / faturamento SUS
- Relatórios avançados por período/agravo para vigilância epidemiológica

---

## 18. Arquitetura Técnica do Backend

### Build System
O backend usa `esbuild` (via `build.mjs`) para compilar TypeScript ESM → `dist/index.mjs`:
- Bundla todo o código em um único arquivo
- Plugin `esbuild-plugin-pino` para compatibilidade do Pino logger
- Copia assets (`src/assets/`) para `dist/assets/`
- Copia templates PDF (`src/templates/`) para `dist/templates/`

### Logging
**Obrigatório:** Use `req.log` em route handlers e `logger` (singleton) fora de requests.  
**Proibido:** `console.log` em qualquer arquivo do servidor.

### Proxy e Roteamento
No Replit: proxy automático configurado em `.replit-artifact/artifact.toml`  
No IDX: proxy Vite em `vite.config.ts` (ativado quando `REPL_ID` é undefined):
```typescript
proxy: {
  "/api": {
    target: `http://localhost:${process.env.API_PORT ?? "8080"}`,
    changeOrigin: true,
    secure: false,
  },
}
```

### Estratégia de Migração de Banco
Sem migrations manuais. `db-init.ts` executa na startup:
```
1. CREATE TABLE IF NOT EXISTS (idempotente)
2. ALTER TABLE ... ADD COLUMN IF NOT EXISTS (idempotente)
3. CREATE INDEX IF NOT EXISTS (idempotente)
```
Isso permite que o Supabase de produção seja atualizado automaticamente a cada deploy, sem passos extras.

---

## 19. Pontos Críticos — NÃO Alterar Sem Cautela

1. **`lib/db/src/index.ts`** — Lógica de conexão SSL/banco. Mudança aqui quebra produção.

2. **`artifacts/api-server/src/routes/auth.ts`** — Login usa `pool.query()` direto (não Drizzle) por compatibilidade com Transaction Pooler. Reverter para Drizzle **quebrará o login no Supabase**.

3. **`artifacts/upa-system/vite.config.ts`** — Configuração do Vite. O `||` na linha do PORT é crítico para IDX. O proxy `/api` deve ser mantido exatamente como está.

4. **`.idx/dev.nix`** — Qualquer alteração neste arquivo só tem efeito após "Rebuild Environment" no IDX. O Gemini do IDX não deve editar este arquivo.

5. **`pnpm-workspace.yaml`** — Versão do React fixada em `19.1.0`. Não alterar sem verificar compatibilidade com toda a cadeia de dependências (incluindo Expo se houver no futuro).

6. **`artifacts/api-server/src/lib/server-permissions.ts`** — Deve estar em sincronia com `artifacts/upa-system/src/lib/permissions.ts`. Alteração de um sem o outro cria inconsistência entre autorização frontend e backend.

7. **`artifacts/api-server/src/lib/db-init.ts`** — Arquivo de 850+ linhas. Cada `ALTER TABLE` é cumulativo e aplicado em produção. Nunca remover um `ADD COLUMN IF NOT EXISTS` existente.

8. **`artifacts/upa-system/src/pages/patient-detail.tsx`** — 3.176 linhas. Componente mais complexo. Qualquer refatoração deve ser incremental e testada cuidadosamente. Os valores das abas (ex: `"sol-exames"`) são internos ao React e NÃO se conectam à API.

---

## 20. Padrão Arquitetural Desejado

O projeto segue filosofia de **desenvolvimento incremental com rollback fácil**:

- **Microetapas:** Cada nova funcionalidade é implementada em passos pequenos e verificáveis
- **Sem refatorações globais:** Renomear, reorganizar ou padronizar em escala ampla é evitado — o risco supera o benefício
- **Sem integração automática:** Ferramentas de IA (Gemini no IDX) não devem fazer edições autônomas em arquivos de configuração, componentes complexos ou schema de banco
- **Evitar alterações destrutivas:** Banco de dados usa apenas `IF NOT EXISTS` — nunca `DROP`, `TRUNCATE` ou `ALTER TABLE ... DROP COLUMN`
- **GitHub como central:** Toda alteração sai do Replit, vai para o GitHub, e é puxada pelo IDX — nunca o inverso
- **Supabase é produção:** O banco Supabase contém dados reais. Qualquer mudança de schema deve ser testada em desenvolvimento antes

---

## 21. Conta Padrão do Sistema

| Campo | Valor |
|---|---|
| Login | `admin` |
| Senha | `admin123` |
| Cargo | `administrador` |
| Observação | Deve trocar a senha no primeiro acesso |

**No banco Replit local:** conta `staffgeral` / `admin1234` (legado, pode não existir no Supabase)  
**No Supabase (produção):** conta `admin` / `admin123` (seeded pelo `db-init.ts`)

---

## 22. Fluxo de Desenvolvimento Recomendado

```
1. Editar código no Replit (ambiente estável, sem IDX)
2. Testar no Replit (workflows automáticos)
3. Replit faz checkpoint automático (commit local)
4. Fazer push para GitHub (via token ou Version Control)
5. No IDX: git pull
6. Testar no IDX contra o Supabase de produção
7. Se necessário: clicar "Try Again" ou "Rebuild Environment" no IDX
```

**Para sincronizar do IDX para GitHub (se alteração emergencial no IDX):**
```bash
git add -A && git commit -m "fix: descrição" && git push origin main
```
Depois, no Replit: puxar as mudanças via Version Control.

---

*Fim do Relatório Técnico — Sistema UPA Breves (Emergência 3.0)*  
*Gerado em: Maio de 2026*  
*Versão do documento: 1.0*
