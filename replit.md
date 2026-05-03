# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `cd lib/api-spec && npx orval --config ./orval.config.ts` — regenerate API hooks and Zod schemas
- `pnpm --filter @workspace/db run push-force` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Critical Notes

- After every `orval` codegen run, reset `lib/api-zod/src/index.ts` to only: `export * from "./generated/api";`
- After codegen, run `pnpm run typecheck:libs` to rebuild composite lib `.d.ts` files
- All deep imports from `@workspace/api-client-react/src/generated/api.schemas` must use `@workspace/api-client-react` (package root) for TypeScript to resolve correctly

## Project: UPA Breves — Gestão de Pacientes

Emergency UPA patient management system. Dark modern UI with Manchester triage colors, pt-BR.

### Artifacts
- `artifacts/upa-system` — React+Vite frontend, preview path `/`
- `artifacts/api-server` — Express API server, paths `/api`

### Admin Section (`/admin`) — Direção only
- **Dashboard**: stats cards (pacientes, triagem por cor, funcionários por perfil, feature flags)
- **Usuários**: CRUD completo de funcionários (criar/editar/excluir/ativar/desativar)
- **Permissões**: matriz ações × perfis (somente leitura)
- **Funcionalidades**: feature flags com Switch — cada toggle grava entrada no audit log
- **Auditoria** (`/admin/auditoria`): log persistido em PostgreSQL, busca por usuário/ação/detalhes, badges coloridos por tipo de ação, botão atualizar

### Backend DB Structure — novos campos e tabelas

#### `patients` — campos adicionados
- `address TEXT` — endereço consolidado em texto único (para compatibilidade com sistemas externos como SINAN)

#### `patient_notifications` — campos adicionados
- `disease TEXT` — doença notificada (ex: "Dengue Clássico")
- `classification TEXT` — classificação do caso (ex: "Confirmado Laboratorial")
- `health_unit TEXT DEFAULT 'UPA Breves'` — unidade de saúde notificadora
- `pdf_url TEXT` — URL do PDF SINAN gerado

#### Novas rotas standalone de notificação
- `POST /api/notifications` — cria notificação; busca paciente por `patient_id` e auto-preenche `disease`, `classification`, `health_unit`, `professional` a partir dos dados do paciente
- `GET /api/notifications/:id` — retorna notificação com dados do paciente mesclados (`patient.full_name`, `patient.cpf`, `patient.address`, etc.)

#### Validação de CPF
- Algoritmo completo de validação (módulo 11) em `patients.ts` e `sinan-notifications.ts`
- `POST /api/patients` e `PUT /api/patients/:id` retornam `422` com mensagem clara se o CPF for inválido
- CPF em branco / não preenchido é aceito normalmente

### Access Control (Server-side)

- **`requireAuth`** middleware (`artifacts/api-server/src/middleware/require-auth.ts`): reads `x-staff-id` header, looks up staff in DB, attaches `req.staff`. Blocks all writes (POST/PUT/PATCH/DELETE) that lack a valid header → HTTP 401.
- **`requirePermissao(acao)`**: per-route middleware that checks `req.staff.role` against the server-side `PERMISSOES` map → HTTP 403 if insufficient.
- **`auditWrite`** middleware (`artifacts/api-server/src/middleware/audit-write.ts`): hooks into `res.on("finish")` to auto-log every successful write to `audit_log` with `staff_id`, `usuario`, `acao`, `ip`.
- All routes (except `/api/healthz` and `/api/auth/*`) require auth.
- Frontend: `setExtraHeaders({ "x-staff-id": String(user.id) })` called on login/logout/mount in `auth-context.tsx`.
- **Auth context split**: `auth-context.tsx` exports only `AuthContext` + `AuthProvider` (component file); `use-auth.ts` exports `useAuth` hook (separate file for Vite HMR compatibility).

### Audit Log
- Tabela `audit_log`: `id`, `usuario`, `acao`, `detalhes`, `ip`, `criado_em`, `staff_id` (integer FK to staff)
- `GET  /api/audit?limit=N` — lista entradas (padrão 200, máx 500)
- `POST /api/audit` — grava entrada `{ usuario, acao, detalhes? }` (legado — usado pelo admin panel)
- `auditWrite` middleware grava automaticamente toda escrita bem-sucedida via API com `staff_id`
- Hook `useAudit()` (`src/hooks/use-audit.ts`) — chama `registrar(acao, detalhes?)` com o usuário logado
- Integrado em: toggles de feature flags, "Restaurar padrões"

### Role-based UI
- **"Funcionários"** link hidden unless `pode("gerenciar_usuarios")` → only `administrador`
- **"Admin"** link hidden unless `activeUser?.role === "administrador"`
- **"Nova Admissão"** button disabled unless `pode("criar_paciente")`
- Logout button (Power icon, `aria-label="Sair"`) in dashboard header → clears session + navigates to `/login`

### Workflow de Status de Cuidado (`careStatus`)
- **Campo DB**: `care_status` (text, enum) + `care_status_changed_at` (timestamp) na tabela `patients`.
- **Valores**: `"Em Triagem"` → `"Aguardando Atendimento"` → `"Em Observação"` → `"Internado"` → `"Em Transferência"` → `"Alta"`.
- **Padrão**: todo paciente criado começa com `"Em Triagem"`.
- **Endpoint**: `PUT /api/patients/:id/status` (requer `mudar_setor`) aceita `{ triage_level?, care_status?, user_id }`.
  - Atualiza `careStatus` + `careStatusChangedAt` + `triageLevel` conforme enviado.
  - Registra evolução automática: `[Reclassificação] Triagem: X → Y | Status: A → B`.
  - Loga no servidor: `action=patient_reclassified` com `changes[]`.
- **Regra de leito**: Pacientes em `"Em Triagem"` ou `"Aguardando Atendimento"` são bloqueados de ser alocados a leitos (422 backend).
- **Frontend — badge**: Cada card de paciente exibe o status com cor:
  - Azul = Em Triagem, Amarelo = Aguardando, Laranja = Em Observação, Vermelho = Internado, Roxo = Em Transferência, Verde = Alta.
- **Frontend — alertas de tempo**:
  - `"Em Triagem"` há >30min → badge laranja com `Clock` e tempo decorrido.
  - `"Em Observação"` há >6h → badge roxo com `Clock` e tempo decorrido.
- **Frontend — "Reclassificar"**: Botão `RefreshCw` em cada linha (visível para quem tem `mudar_setor`) abre modal com selects de triagem + status.
- **Frontend — visualização "Por Status"**: Toggle "Por Setor" / "Por Status" no dashboard. "Por Status" agrupa em seções: Triagem, Aguardando, Observação, Internado, Transferência (alta excluída da lista ativa).
  - Cabeçalho de cada seção exibe contagem de alertas de tempo (>30min triagem / >6h observação).

### Gestão de Leitos (`/leitos`)
- **Tabela**: `beds` — `id`, `bed_id` (único), `sector`, `bed_number`, `is_isolation` (fixo), `is_extra` (boolean), `extra_reason`, `is_occupied`, `patient_id` (FK → patients), `admission_time` (timestamp), `isolation_active`, `isolation_type` (contact/droplet/airborne), `isolation_reason`, `created_at`, `updated_at`.
- **Seed automático**: 35 leitos criados na primeira chamada GET se a tabela estiver vazia.
  - Sala Vermelha: VS-01 a VS-04 (4 leitos, sem isolamento)
  - Observação Adulto: OA-01 a OA-16 + OA-ISO (17 leitos, 1 isolamento)
  - Observação Pediátrica: OP-01 a OP-05 + OP-ISO (6 leitos, 1 isolamento)
  - Pré-Observação: PA-01 a PA-07 + PA-ISO (8 leitos, 1 isolamento)
- **API**: `GET /api/beds` (lista com dados do paciente), `GET /api/beds/:id`, `PUT /api/beds/:id` (requer `registrar_sinais_vitais`).
- **Bloqueio servidor**: `PUT` retorna 400 se `isolationActive=true` em leito sem `is_isolation`. `PUT` retorna 422 se o paciente não estiver em `"Em Observação"` ou `"Internado"` ao tentar alocar a um leito.
- **Frontend**: Página `/leitos` acessível a todos os autenticados; botão "Leitos" na barra de navegação do dashboard.
  - Grade por setor com cards coloridos: verde (livre), amarelo (ocupado), vermelho (crítico/triagem red), roxo (isolamento ativo).
  - Ícone de biohazard nos leitos com capacidade de isolamento.
  - Modal ao clicar: exibe paciente, toggle de precaução, tipo (Contato/Gotículas/Aerossóis) e motivo.
  - Edição restrita a quem tem permissão `registrar_sinais_vitais` (enfermeiro, médico, admin).
  - Leitos não-isolamento bloqueados no frontend + backend.

### Password Reset (Esqueci minha senha)
- **Tabela**: `password_resets` — `id` (UUID), `user_id` (FK staff), `token` (text único), `expires_at` (1h), `used_at` (nullable), `created_at`.
- **`POST /api/auth/forgot-password`**: body `{ login }` → busca usuário ativo, gera token 32 bytes hex, salva no DB, loga link no console (`[RESET] nome (login) → /reset-password?token=XYZ`). Retorna `{ ok: true }` sempre (evita enumeração de usuários).
- **`POST /api/auth/reset-password`**: body `{ token, password }` → valida token (existe, não expirado, não utilizado), atualiza hash bcrypt, marca `used_at`, zera `must_change_password`. Retorna `{ ok: true }`.
- **Páginas públicas** (sem autenticação): `/forgot-password` e `/reset-password?token=XYZ`.
- **Login**: botão "Esqueci minha senha" ao lado do label "Senha" → navega para `/forgot-password`.
- **Segurança**: token de uso único, expiração 1h, bcrypt cost 12, senha nunca exposta.

### Password & First-Access Flow
- **Hashing**: Senhas novas armazenadas como `bcrypt(sha256(plain + "upa_salt_2026"), cost=12)`. Usuários legados (SHA-256 puro) continuam funcionando; login detecta pelo prefixo `$2b$`.
- **Novo usuário**: Senha padrão `1234` aplicada automaticamente pelo servidor; campo senha removido do formulário de criação. `must_change_password = true` para todos os novos usuários.
- **Fluxo de primeiro acesso**: Login retorna `mustChangePassword: true` → `AuthGuard` intercepta e redireciona para `/change-password` → bloqueia todas as outras rotas até troca concluída.
- **Tela `/change-password`**: Nova senha + confirmação (mínimo 6 chars). Envia `sha256(nova + salt)` ao `POST /api/auth/change-password`. Servidor guarda `bcrypt(hash)` e zera `must_change_password`. Redireciona para `/`.
- **UI aviso**: Mensagem âmbar "A senha inicial será 1234. O usuário será solicitado a alterá-la no primeiro acesso." no formulário de criação.
- **Mensagem na tela**: "Por segurança, você deve alterar sua senha no primeiro acesso."
- **Todos os perfis**: admin, enfermeiro, técnico, médico, recepcionista — mesma regra.

### Critical Alert System (Alerta de Paciente Crítico)
- **Roles**: only `enfermeiro` and `tecnico_enfermagem` see any alert UI — controlled by `ALERT_ROLES = new Set(["enfermeiro","tecnico_enfermagem"])` and `isNurseOrTech` in dashboard.
- **Alert panel**: `⚠ ATENÇÃO — N PACIENTES CRÍTICOS` shown above patient list when `isNurseOrTech && criticals.length > 0`.
- **Header badge**: animated red Siren + count badge in header, same condition.
- **Row highlighting**: critical patients shown in red highlight with pulsing dot, sorted to top of sector.
- **Automatic popup**: `div[role="alertdialog"]` fixed overlay renders directly in DOM (no portal) when `criticalPopupOpen = isNurseOrTech && criticals.length > 0 && !popupDismissed`. Re-opens on new critical patients via `prevCriticalIds` ref.
- **Dismiss button**: "Entendido — Vou Avaliar" sets `popupDismissed=true`. Panel and badge remain visible.
- **Hook**: `useCriticalAlerts` in `artifacts/upa-system/src/hooks/use-critical-alerts.ts` — polls `GET /api/alerts/critical` every 30s, sound suppressed for non-alert roles.
- **API**: `GET /api/alerts/critical` — patients with `triage_level='red'` OR vitals (SpO₂<90, HR>130, systolicBP<90). Router at `artifacts/api-server/src/routes/alerts.ts`.
- **Audit**: `POST /api/alerts/log` — fires whenever new critical patients detected; writes to `audit_log` table.
- **Test account**: login=`enfteste`, password=`enf123`, role=`enfermeiro` (staff id=5).

### Feature Flags & Permissions
- `useFeatures()` + `usePode(acao, feature?)` — combinam permissão de perfil + feature flag em uma só chamada
- Flags persistidas em `localStorage` (`upa_features`)
- Permissões definidas em `lib/permissions.ts` (exporta `PERMISSOES`, `PERFIL_LABELS`, `ACAO_LABELS`, `ACOES`, `PERFIS`)
- Server-side mirror: `artifacts/api-server/src/lib/server-permissions.ts`

### Features Implemented
- **Dashboard**: Patient list by sector (Sala Vermelha / Obs. Adulto / Obs. Pediátrica / Obs. Pré-Adulto), triage summary, search/filter
- **Patient Detail**: Full SOAP evolution history, vital signs, prescriptions, pending tasks, reclassification
  - Print button (Imprimir Evolução) generates clean A4 report with patient info, vitals, all SOAP entries, signature line
  - Right column shows demographics card (documentos, contato, endereço) when data is present
- **Shift Handover** (`/passagem-plantao`): Compact table format per sector, meta fields (date/shift/responsible), Resumo Geral; improved print CSS (A4 landscape, 8.5pt, tight padding)
- **Staff Management** (`/funcionarios`): Full CRUD with login/password hash, digital signature canvas, stamp generator
  - Roles: **Admin** / **Coordenação de Enfermagem** / **Profissional Assistencial**
  - Role gating: only Admin or Coordenação can add/edit/delete staff (via "Acessando como:" selector in header)
- **Audit fields**: `createdBy`/`updatedBy` on `patients` table; `createdBy` on `evolutions` table — populated from responsible nurse on every create/update
- **Notificações Compulsórias**: full CRUD per patient — types (dengue/covid19/tuberculose/violencia/outros), diagnosis, symptom onset date, situation (pendente/notificado), responsible, date/time. Shown as a section in patient detail below Pendências. Pending count badge shown. Amber color theme. Also accessible from mobile action bar.

### DB Schema — patients table
Full demographics model:
- **Identificação**: id, name, birthDate, age (auto-computed from birthDate), sex (M/F/O), motherName
- **Documentos**: cns (Cartão SUS), cpf, rg
- **Contato**: phone, guardianName (nome do responsável)
- **Endereço**: street, addressNumber, neighborhood, city, addressState, zipCode
- **Clínico**: bed, diagnosis, heartRate, respiratoryRate, glucose, spO2, temperature, systolicBp, diastolicBp, status (triage), sector, internmentStatus, nurse
- **Auditoria**: createdBy, updatedBy, createdAt, updatedAt

### Other tables
- `evolutions`: vitals snapshot, SOAP fields, responsible, note, createdBy, createdAt
- `prescriptions`: items (JSON), status, responsible, scheduledTime, notes
- `tasks`: description, status, responsible, dueDate
- `patient_notifications`: patientId, types (JSON array), otherType, diagnosis, symptomOnsetDate, situation (notificado|pendente), responsible, notifiedAt, createdAt, updatedAt
- `staff`: fullName, category, corenCrm, sector, login, passwordHash, accessLevels (comma-sep), signature (dataURL), stamp (text)

### API routes for notifications
- `GET  /api/patients/:id/notifications` — list notifications for patient
- `POST /api/patients/:id/notifications` — create notification
- `PATCH /api/patients/:id/notifications/:notificationId` — update notification
- `DELETE /api/patients/:id/notifications/:notificationId` — delete notification

### Patient Form Sections (admission + edit)
1. **Dados do Paciente** — nome, data de nascimento, idade (auto), sexo, nome da mãe
2. **Documentos** — CNS, CPF, RG
3. **Contato** — telefone, nome do responsável
4. **Endereço** — rua, número, bairro, cidade, estado (UF dropdown), CEP
5. **Dados Clínicos** — triagem, setor, leito, diagnóstico, internação, responsável
6. **Sinais Vitais Iniciais** — PA, FC, FR, SpO₂, temperatura, HGT

### Sector Order
1. Sala Vermelha (🔴)
2. Observação Adulto (🟡)
3. Observação Pediátrica (🟢)
4. Observação Pré-Adulto (🔵)

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
