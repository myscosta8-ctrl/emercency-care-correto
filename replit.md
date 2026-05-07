# Overview

This project is an Emergency UPA (Unidade de Pronto Atendimento) patient management system designed to optimize administrative and care processes within an emergency medical unit. It provides comprehensive tools for patient registration, tracking, bed management, and medical documentation. Key features include a robust access control system, a critical alert mechanism, and a user-friendly dark UI optimized for emergency settings with Manchester triage colors and Brazilian Portuguese localization. The system aims to improve patient flow, data accuracy, and rapid information access for medical staff, ultimately enhancing patient outcomes and operational efficiency.

**Key Capabilities:**

*   **Patient Management:** Registration, tracking, care status workflow, and critical alerts.
*   **Administrative Tools:** Staff, permissions, feature flags, and audit logging.
*   **Bed Management:** Allocation, monitoring, and isolation protocols.
*   **Medical Documentation:** SOAP notes, vital signs, prescriptions, and mandatory notifications.
*   **Access Control:** Server-side authentication, role-based permissions, and per-collaborator custom permission overrides.
*   **User Experience:** Dark, modern UI with Manchester triage colors and Brazilian Portuguese (pt-BR) localization.

# User Preferences

*   After every `orval` codegen run, reset `lib/api-zod/src/index.ts` to only: `export * from "./generated/api";`
*   After codegen, run `pnpm run typecheck:libs` to rebuild composite lib `.d.ts` files
*   All deep imports from `@workspace/api-client-react/src/generated/api.schemas` must use `@workspace/api-client-react` (package root) for TypeScript to resolve correctly

# System Architecture

The project is built as a pnpm workspace monorepo using TypeScript, facilitating code sharing between frontend and backend. It is structured with distinct packages for frontend, backend, and shared libraries.

**Core Technologies:**
*   **Backend:** Node.js (v24), Express 5, PostgreSQL with Drizzle ORM, Zod for validation, Orval for API codegen.
*   **Frontend:** React with Vite.
*   **Build Tool:** esbuild (CJS bundle).
*   **TypeScript:** Version 5.9.

**Architectural Decisions & Design Patterns:**
*   **Monorepo:** Centralized codebase for consistent development.
*   **API-First:** OpenAPI specification drives client generation.
*   **Server-Side Security:** `requireAuth`, `requirePermissao`, and `auditWrite` middlewares enforce authentication, role-based access control, and comprehensive audit logging at the API level.
*   **Per-Collaborator Permissions:** `custom_permissions` column on `staff` table stores a JSON array of allowed actions. When set, it overrides the role default in both `temPermissaoServer` (backend) and `temPermissao` (frontend). Admin UI in `staff.tsx` exposes a full permission matrix with toggle per action.
*   **Admission Restriction:** Only `recepcionista`, `administrador`, and `diretoria_geral` (via `*`) can create new admissions (`criar_paciente`). Enfermeiro, técnico de enfermagem, and auxiliar administrativo no longer have this permission.
*   **Invalidation Ownership:** Prescriptions, evolutions, and exam-requests can only be invalidated by the record's author (`userId`) or an admin (`administrador`/`diretoria_geral`). Backend returns HTTP 403 otherwise.
*   **Role-Based UI:** Dynamically renders or disables UI elements based on user roles and permissions.
*   **Feature Flag System:** Allows dynamic control over application features.
*   **Secure Authentication:** bcrypt hashing for passwords, forced first-access password changes, and a robust password reset flow.
*   **Critical Alert System:** Real-time monitoring of patient critical statuses with visual and auditory alerts for relevant roles.
*   **Comprehensive Data Model:** Designed specifically for UPA environments, including patient demographics, clinical data, and administrative metadata.
*   **Auto-Migration on Startup:** `db-init.ts` runs idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements on every start, so new columns added in development are automatically applied to Supabase production without a manual migration step.

**UI/UX Decisions:**
*   **Dark Modern UI:** Professional and sleek aesthetic.
*   **Manchester Triage Colors:** Integrated for intuitive visual urgency identification.
*   **Localization:** Full support for Brazilian Portuguese (pt-BR).
*   **Print-Friendly Outputs:** Specific CSS and server-side generation for reports (e.g., evolution notes, shift handovers, medical prescriptions).
*   **Intuitive Workflow:** Designed to mirror real-world UPA operations for patient status, bed management, and alerts.

**Key Features & Implementations:**
*   **Admin Section:** Full CRUD for staff, permission matrix, feature flags, and audit log viewer.
*   **Patient Management:** Unique `prontuario_number` and `atendimento_number` for each patient and visit; includes `address` for external system compatibility.
*   **Care Status Workflow:** Full flow with 11 states: `Em Triagem` → `Aguardando Atendimento` → `Em Atendimento (Cons. 1/2)` → `Em Medicação` / `Aguardando Exames` / `Aguardando Reavaliação` → `Em Observação` / `Internado` / `Em Transferência` → `Alta`.
*   **Prontuário/Atendimento numbering:** Sequential from 1 — `generateProntuarioNumber(id)` and `generateAtendimentoNumber(id)` both return `String(id).padStart(6, "0")` (e.g. `000001`).
*   **PDF Logo Assets:** `artifacts/api-server/src/assets/prefeitura-breves.jpeg` and `upa24h.jpg` are embedded in all generated PDFs via `pdf-lib embedJpg()`. `assetPath()` helper mirrors `templatePath()` pattern. `build.mjs` copies assets to `dist/assets/` via `copyAssets()`.
*   **Standard UPA Header:** `buildUpaHeaderPortraitDoc()` function generates a portrait A4 page with logos + 8-row patient info block. APAC and Ficha PDFs prepend this page before the official template pages. Prescription PDF embeds logos directly in the landscape header.
*   **Patient History Archive (`/historico`):** Dedicated page listing all discharged patients (careStatus="Alta") with search by name/CPF/diagnosis, date filters, CSV export, and link to full prontuário.
*   **Exam Results (Lab) Tab in Prontuário:** `patient-lab-tab.tsx` component embedded in patient-detail.tsx as a "Laboratório" tab. Supports soliciting new exams, inserting text results + file uploads, and auto-refreshes every 30s for real-time visibility.
*   **Sol. Exames Tab:** Separate "Sol. Exames" tab in patient-detail for requesting lab/imaging exams (add by typing + Enter, prioridade selector, justificativa field). Visible only to users with `registrar_prescricao` permission.
*   **Invalidação de Registros:** Prescriptions, evolutions, and exam-requests can be invalidated with an optional motivo. Schema has `invalidado boolean` + `motivo_invalidacao text`; API routes `PATCH /:id/{prescriptions|evolutions|exam-requests}/:targetId/invalidar`; UI shows red "Invalidado" badge + faded content + Ban icon button.
*   **Prescrição Médica PDF:** `GET /api/patients/:id/prescriptions/:rxId/pdf` — landscape A4, official Prefeitura de Breves layout with DK_GREEN/BLUE institutional header, 8-row patient info block, 3-column medication table (10 rows), signature footer.
*   **APAC Laudo PDF:** `GET /api/patients/:id/pdf/apac` — loads `src/templates/apac-laudo.pdf` (official SUS form) and overlays patient data at field coordinates; built via `build.mjs` copy to `dist/templates/`.
*   **Ficha de Referência PDF:** `GET /api/patients/:id/pdf/ficha-referencia` — loads `src/templates/ficha-referencia.pdf` (official Prefeitura de Breves form) and overlays patient data at field coordinates.
*   **Sumário de Alta Automático:** When a patient receives "Alta" status, the server automatically creates a structured "SUMÁRIO DE ALTA" evolution entry with admission date, time of stay, diagnosis, triage level, and active prescriptions.
*   **Dashboard Flow Tabs:** Six-tab flow selector: 🏥 Todos / 🩺 Triagem (Em Triagem only) / 📋 Recepção (Aguardando Atendimento) / 🩺 Consultórios / 💊 Medicação / 🛏 Leitos (Em Observação + Internado + Transferência + Sala Vermelha sectors). Individual sector pills shown only in "Todos" mode. Alta patients are excluded from all dashboard counts and lists (API-level filter).
*   **PWA/Offline Support:** `vite-plugin-pwa` installed in `upa-system`. NetworkFirst caching for `/api/` routes (8s timeout, 5min max-age, 200 entries). App shell (JS/CSS/HTML) pre-cached. Manifest includes UPA name, dark theme, standalone display. Service worker auto-updates.
*   **Default Admin Account:** Login `staffgeral` / Senha `admin1234` (must change on first login). All other accounts deleted. Role: `administrador`.
*   **Consultório Availability Indicator:** In the medical queue (fila-medico.tsx), Cons.1 and Cons.2 buttons show green + "livre" when the room has no active patients, making triage routing immediately visible.
*   **Triage Sector:** Full "Triagem" sector support across all menus, forms, and filters.
*   **SINAN Notification Form:** Fully fillable digital form (all fields editable, PDF generated with filled data, only signatures blank).
*   **Alta = Archive:** Giving a patient "Alta" archives them (sets careStatus="Alta") instead of deleting — full history preserved.
*   **Bed Management:** Detailed `beds` table with automatic seeding, isolation protocols, and a visual grid interface.
*   **Mandatory Notifications:** Dedicated system for managing and tracking compulsory notifications (e.g., infectious diseases).
*   **Laboratório Module:** Management of exam requests and results, including file uploads and real-time notifications.
*   **Access Control by Sector and Shift:** Staff profiles define `setores_atuacao`, `turno`, and `consultorio` to dynamically filter dashboard views and access in the medical queue.
*   **Patient Detail Screen:** Comprehensive view with profession-specific evolution tabs, vital signs, prescriptions, tasks, and mandatory notifications.
*   **Profession-Specific Evolution Tabs:** Each clinical category has a dedicated structured form in the patient detail screen:
    *   **Médico** (`evolution-medico.tsx`): HDA, exame físico, hipótese diagnóstica, CID-10, conduta, CRM — stores `professional_category="medico"` + `structured_data` JSONB in `patient_evolutions`.
    *   **Enfermeiro** (`evolution-enfermeiro.tsx`): SAE fields (avaliação por sistemas, NANDA, prescrição de enfermagem, resultado, COREN).
    *   **Técnico de Enfermagem** (`evolution-tecnico.tsx`): Turno selector, procedure checkboxes, intercorrências, observações gerais.
    *   **Assistente Social** (`evolution-social.tsx`): Moradia, renda familiar, composição familiar, demandas, intervenções, encaminhamentos, CRESS — stored in `social_notes.structured_data`.
    *   **Nutricionista** (`evolution-nutricionista.tsx`): Peso, altura, IMC (auto-calculated), via de alimentação, diagnóstico nutricional, plano alimentar, CRN — stored in `nutritional_assessments.structured_data`.
    *   All tabs include expandable history cards and print-to-new-window capability (A4 formatted HTML).
*   **Shift Handover:** Dedicated interface for managing and printing shift summaries.
*   **Staff Management:** CRUD operations for staff, including login, password hash, digital signature, and stamp generation.
*   **Patient Form Sections:** Standardized admission and edit forms structured into logical sections.
*   **Audit Fields:** `createdBy` and `updatedBy` for tracking changes on critical tables.

# Banco de Dados & Persistência

*   **Banco primário (desenvolvimento):** PostgreSQL do Replit — acessado via `DATABASE_URL`.
*   **Banco externo (Supabase):** Configurado via `SUPABASE_DATABASE_URL`. Quando essa variável estiver definida, o sistema se conecta ao Supabase em vez do banco local. Isso é configurado automaticamente no deploy.
*   **Prioridade de conexão:** `SUPABASE_DATABASE_URL` > `DATABASE_URL` (em `lib/db/src/index.ts`).
*   **Backup de dados:** `GET /api/backup/export` (requer permissão `admin`) — retorna JSON com todos os dados do sistema para download.

# External Dependencies

*   **Access Control:**
    *   `requireAuth` middleware: Validates `x-staff-id` for API requests.
    *   `requirePermissao(acao)` middleware: Checks user roles against a server-side `PERMISSOES` map.
    *   `auditWrite` middleware: Logs successful write operations to `audit_log`.
*   **Audit Log:**
    *   `audit_log` table: Stores `id`, `usuario`, `acao`, `detalhes`, `ip`, `criado_em`, `staff_id`.
    *   `GET /api/audit`: Lists entries.
    *   `POST /api/audit`: Records entries (legacy, used by admin panel).
    *   `useAudit()` hook: Registers actions with the logged-in user.
*   **Exam Management:**
    *   `exam_results` table: Stores `id`, `patient_id`, `uploaded_by`, `exam_name`, `exam_type`, `prioridade`, `result_text`, `file_data`, `file_name`, `file_mime`, `status`, `liberado_at`, `notified`, `created_at`, `updated_at`.
    *   `patient_exam_requests` table: Stores `id`, `patient_id`, `prescription_id`, `laboratoriais`, `imagem`, `prioridade`, `justificativa`, `status`, `created_at`.
    *   API endpoints for managing exam requests and results.
*   **Password Reset:**
    *   `password_resets` table: Stores `id`, `user_id`, `token`, `expires_at`, `used_at`, `created_at`.
    *   `POST /api/auth/forgot-password` and `POST /api/auth/reset-password` API endpoints.
*   **Critical Alert System:**
    *   `GET /api/alerts/critical` API: Identifies critical patients.
    *   `POST /api/alerts/log` API: Logs critical patient detections to `audit_log`.
    *   `useCriticalAlerts` hook: Polls critical alert API.
*   **Feature Flags & Permissions:**
    *   `useFeatures()` and `usePode(acao, feature?)` hooks: Combine profile permissions and feature flags.
    *   `localStorage` for flag persistence.
    *   `lib/permissions.ts`: Defines `PERMISSOES`, `PERFIL_LABELS`, `ACAO_LABELS`, `ACOES`, `PERFIS`.
    *   `artifacts/api-server/src/lib/server-permissions.ts`: Server-side mirroring of permissions.
*   **Frontend State Management:** React Context API (e.g., `AuthContext`)
