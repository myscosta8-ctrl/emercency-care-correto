# Overview

This project is an Emergency UPA (Unidade de Pronto Atendimento) patient management system. Its primary purpose is to streamline the administration and care processes within an emergency medical unit.

**Key Capabilities:**

*   **Patient Management:** Comprehensive patient registration, tracking, and status management, including a detailed care status workflow and critical alert system.
*   **Administrative Tools:** Features for managing staff, permissions, and feature flags, alongside an extensive audit logging system.
*   **Bed Management:** System for allocating and monitoring beds, including isolation protocols.
*   **Medical Documentation:** Tools for recording patient evolutions (SOAP notes), vital signs, prescriptions, and mandatory notifications (e.g., for infectious diseases).
*   **Access Control:** Robust server-side authentication and role-based access control to ensure data security and appropriate user permissions.
*   **User Experience:** A dark, modern UI with a focus on usability, incorporating Manchester triage colors and supporting Brazilian Portuguese (pt-BR).

The system aims to improve patient flow, enhance data accuracy, and provide critical information rapidly to medical staff, ultimately leading to better patient outcomes and more efficient emergency department operations.

# User Preferences

*   After every `orval` codegen run, reset `lib/api-zod/src/index.ts` to only: `export * from "./generated/api";`
*   After codegen, run `pnpm run typecheck:libs` to rebuild composite lib `.d.ts` files
*   All deep imports from `@workspace/api-client-react/src/generated/api.schemas` must use `@workspace/api-client-react` (package root) for TypeScript to resolve correctly

# System Architecture

The project is structured as a pnpm workspace monorepo using TypeScript, with each package managing its own dependencies.

**Core Technologies:**

*   **Node.js:** Version 24
*   **Package Manager:** pnpm
*   **TypeScript:** Version 5.9
*   **API Framework:** Express 5
*   **Database:** PostgreSQL with Drizzle ORM
*   **Validation:** Zod (`zod/v4`) and `drizzle-zod`
*   **API Codegen:** Orval (from OpenAPI spec)
*   **Build Tool:** esbuild (CJS bundle)
*   **Frontend:** React with Vite

**Architectural Decisions & Design Patterns:**

*   **Monorepo Structure:** Facilitates code sharing and consistent development across frontend and backend applications.
*   **Clean Architecture (implied):** Separation of concerns between API server, UI, and shared libraries.
*   **API-First Approach:** OpenAPI specification drives API client generation for robust frontend-backend communication.
*   **Server-Side Access Control:** Critical `requireAuth`, `requirePermissao`, and `auditWrite` middlewares enforce security, permissions, and logging at the API level.
*   **Role-Based UI:** Frontend elements are dynamically rendered or disabled based on user roles and permissions, ensuring a tailored experience.
*   **Feature Flag System:** Allows dynamic control over application features, integrated with user permissions.
*   **Password Management:** Secure password handling with bcrypt hashing, first-access forced password change, and a robust password reset mechanism.
*   **Critical Alert System:** Real-time patient critical status monitoring with visual and auditory alerts for relevant roles.
*   **Data Model:** Comprehensive patient demographics, clinical data, and administrative metadata, designed for a UPA environment.

**UI/UX Decisions:**

*   **Dark Modern UI:** Provides a sleek and professional aesthetic.
*   **Manchester Triage Colors:** Integrated into the UI for intuitive visual identification of patient urgency.
*   **Localization:** Full support for Brazilian Portuguese (pt-BR).
*   **Responsive Design:** Implied by the use of React and modern frontend practices, ensuring usability across devices.
*   **Print-Friendly Outputs:** Specific CSS for printing reports (e.g., evolution notes, shift handovers).
*   **Intuitive Workflow:** Patient status workflow, bed management, and alert systems are designed to mirror real-world UPA operations.

**Key Features & Implementations:**

*   **Admin Section:** Dashboard with stats, full CRUD for staff, permission matrix (read-only), feature flags with audit logging, and a dedicated audit log viewer.
*   **Patient Data Enrichment:** Addition of `address` to `patients` for external system compatibility (e.g., SINAN).
*   **Mandatory Notifications:** Dedicated `patient_notifications` table and API for managing notifications, including auto-population of patient data.
*   **CPF Validation:** Server-side validation (Módulo 11) for Brazilian CPF numbers.
*   **Care Status Workflow:** `care_status` and `care_status_changed_at` fields in `patients` table, with defined states and rules for transitions, including time-based alerts on the frontend.
*   **Bed Management:** `beds` table with detailed attributes, automatic seeding of standard beds, and API endpoints for management. Frontend displays a grid view with color-coded status and isolation indicators.
*   **Password Reset Flow:** Dedicated `password_resets` table, API endpoints for requesting and performing resets, and public-facing UI pages.
*   **First-Access Password Change:** Ensures new users set a strong password immediately after their first login.
*   **Critical Alert System:** Backend API (`/api/alerts/critical`) to identify critical patients based on triage level or vital signs. Frontend displays alerts, highlights patients, and provides an dismissible popup.
*   **Role-based UI Elements:** Dynamic visibility of navigation links, buttons, and sections based on user permissions (e.g., "Funcionários" link, "Admin" link, "Nova Admissão" button).
*   **Audit Fields:** `createdBy` and `updatedBy` fields for tracking changes on `patients` and `evolutions` tables.
*   **Patient Detail Screen:** Comprehensive view with SOAP evolution history, vital signs, prescriptions, tasks, and compulsory notifications. Includes a print function for patient evolution.
*   **Shift Handover:** Dedicated interface for managing and printing shift summaries.
*   **Staff Management:** CRUD operations for staff, including login, password hash, digital signature, and stamp generation.
*   **Patient Form Sections:** Standardized admission and edit forms structured into logical sections (Patient Data, Documents, Contact, Address, Clinical Data, Initial Vital Signs).
*   **Sector Order:** Predefined order for displaying patient sectors.

# External Dependencies

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

### Prontuário e Atendimento
- **`prontuario_number`**: `PRN-AAAA-NNNNN` — gerado automaticamente após INSERT com o `id` do paciente. Permanente.
- **`atendimento_number`**: `ATD-AAAA-NNNNN` — gerado por visita/admissão, também automático.
- Ambos gerados no `POST /api/patients` logo após o insert, com `UPDATE` subsequente. Exibidos na ficha do paciente e no setor de Laboratório.

### Workflow de Status de Cuidado (`careStatus`)
- **Campo DB**: `care_status` (text, enum) + `care_status_changed_at` (timestamp) na tabela `patients`.
- **Valores completos**: `"Em Triagem"` → `"Aguardando Atendimento"` → `"Em Atendimento (Cons. 1)"` | `"Em Atendimento (Cons. 2)"` → `"Em Observação"` | `"Internado"` | `"Em Transferência"` | `"Alta"`.
- **Padrão**: todo paciente criado começa com `"Em Triagem"`.
- **Endpoint**: `PUT /api/patients/:id/status` (requer `mudar_setor`) aceita `{ triage_level?, care_status?, user_id }`.
- **Regra de leito**: Pacientes em `"Em Triagem"` ou `"Aguardando Atendimento"` são bloqueados de ser alocados a leitos (422 backend).
- **Frontend — badge**: Cada card exibe o status com cor:
  - Azul = Em Triagem, Amarelo = Aguardando, Céu/Violeta = Cons.1/Cons.2, Laranja = Em Observação, Vermelho = Internado, Roxo = Em Transferência, Verde = Alta.

### Fila Médica (`/fila-medico`)
- Página dedicada ao fluxo médico. Acessada via header do dashboard e como home do perfil `medico`.
- **Consultório 1** (Adulto/Clínica Geral) e **Consultório 2** (Pediatria/Pré-Adulto) exibidos como cards.
- Lista de pacientes `"Aguardando Atendimento"` ordenados por gravidade de triagem.
- Botões "Cons. 1" / "Cons. 2" chamam o paciente → status muda para `"Em Atendimento (Cons. X)"`.
- Botão "Desfecho" nos pacientes em atendimento → modal com opções: Alta, Em Observação, Internação, Transferência.
- Rota protegida por `registrar_prescricao` (médico/enfermeiro têm acesso).

### Laboratório (`/laboratorio`)
- Página dedicada ao setor de laboratório. Home do perfil `farmaceutico` (laboratorista).
- Lista todos os pacientes ativos (não em Alta) com accordion expansível por paciente.
- Exibe PRN e ATD de cada paciente.
- Por paciente: lista de exames com status pendente/liberado, prioridade, tipo (laboratorial/imagem).
- Botão "+ Solicitar exame" → formulário inline para registrar nova solicitação.
- Botão "Inserir resultado" → formulário com texto + upload de arquivo (PDF/imagem, Base64 em `file_data`).
- Ao liberar resultado: status muda para `"liberado"`, `liberado_at` gravado, evolução automática registrada.
- Notificações em tempo real (polling 30s): banner verde no topo lista novos resultados liberados.
- Rota protegida por `registrar_exames`.

### Tabela `exam_results`
- Colunas: `id`, `patient_id`, `uploaded_by`, `exam_name`, `exam_type` (laboratorial/imagem), `prioridade` (urgente/rotina/eletivo), `result_text`, `file_data` (Base64), `file_name`, `file_mime`, `status` (pendente/liberado), `liberado_at`, `notified`, `created_at`, `updated_at`.
- Rotas: `GET /api/patients/:id/exam-results`, `POST /api/patients/:id/exam-results`, `PUT /api/patients/:id/exam-results/:examId/liberar`, `PUT /api/patients/:id/exam-results/:examId/notified`.

### Nova Ação de Permissão: `registrar_exames`
- Atribuída a: `farmaceutico`, `medico` (`*`), `administrador` (`*`).
- Controla acesso à página `/laboratorio`.

### Controle de Acesso por Setor e Turno

#### Novos campos na tabela `staff`
- `setores_atuacao` (text) — setores que o funcionário visualiza no dashboard, separados por vírgula. Valor especial `"todos"` = sem restrição. Exemplos: `"sala_vermelha,observacao_adulto"`, `"observacao_pediatrica,observacao_pre_adulto"`.
- `turno` (text) — turno do plantão. Valores: `dia_07_19`, `tarde_19_23`, `noite_23_07`, `plantao_24h`, `noite_19_07`.
- `consultorio` (text) — apenas para médicos. Valores: `""`, `"1"`, `"2"`, `"ambos"`.

#### Estrutura de plantões configurada pelo admin
| Perfil | Turno | Setores de atuação | Consultório |
|--------|-------|-------------------|-------------|
| Médico Cons. 1 | dia_07_19 | `todos` | `1` |
| Médico Cons. 2 | dia_07_19 | `observacao_pediatrica,observacao_pre_adulto` | `2` |
| Médico Cons. 1 noturno | tarde_19_23 | `todos` | `1` |
| Plantonista 24h | plantao_24h | `sala_vermelha,observacao_adulto` | `ambos` |
| Enfermeiro triagem | dia_07_19 | `todos` | — |
| Enfermeiro obs. pediátrica | dia_07_19 | `observacao_pediatrica,observacao_pre_adulto` | — |
| Enfermeiro sala vermelha | dia_07_19 | `sala_vermelha,observacao_adulto` | — |
| Enfermeiro noturno | noite_19_07 | `todos` | — |

#### Efeito no Dashboard
- `setoresAtuacao = "todos"` → todos os setores visíveis (sem restrição).
- `setoresAtuacao = "sala_vermelha,observacao_adulto"` → apenas esses dois setores aparecem no dashboard (tanto "Por Setor" quanto "Por Status").
- Filtro de setor manual também é restrito aos setores permitidos.

#### Efeito na Fila Médica
- `consultorio = "1"` → apenas card do Consultório 1; botão "Cons. 2" oculto na fila.
- `consultorio = "2"` → apenas card do Consultório 2; botão "Cons. 1" oculto na fila.
- `consultorio = "ambos"` ou `""` → ambos visíveis.

#### Cadastro de funcionários (`/funcionarios`)
- Formulário includes: **Turno do plantão** (select), **Consultório** (select, só para médicos), **Setores de atuação** (checkboxes multi-select).
- Card de funcionário exibe turno, consultório e setores de atuação configurados.

#### Feature flag `setor_pre_adulto`
- Padrão: **ativada** (`true`).
- Quando desativada em Admin → Funcionalidades:
  - Setor Observação Pré-Adulto é removido do dashboard (todos os usuários).
  - Removido dos setores disponíveis no desfecho da fila médica.
  - Removido dos checkboxes de setores de atuação no cadastro de funcionários.
- Descrição no painel: "Desative para remover completamente este setor do sistema — dashboard, fila médica, formulários e cadastro de funcionários."

### Tabela `patient_exam_requests`
- Colunas: `id`, `patient_id` (FK patients), `prescription_id` (FK patient_prescriptions, nullable), `laboratoriais` (jsonb), `imagem` (jsonb), `prioridade` (urgente/rotina/eletivo), `justificativa`, `status` (solicitado/coletado/laudado), `created_at`.
- Rotas: `GET /api/patients/:id/exam-requests`, `POST /api/patients/:id/exam-requests`, `PATCH /api/patients/:id/exam-requests/:examRequestId/status`.
- Preenchida automaticamente ao salvar prescrição médica com exames (prescription-form.tsx).

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
