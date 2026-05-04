# Overview

This project is an Emergency UPA (Unidade de Pronto Atendimento) patient management system designed to optimize administrative and care processes within an emergency medical unit. It provides comprehensive tools for patient registration, tracking, bed management, and medical documentation. Key features include a robust access control system, a critical alert mechanism, and a user-friendly dark UI optimized for emergency settings with Manchester triage colors and Brazilian Portuguese localization. The system aims to improve patient flow, data accuracy, and rapid information access for medical staff, ultimately enhancing patient outcomes and operational efficiency.

**Key Capabilities:**

*   **Patient Management:** Registration, tracking, care status workflow, and critical alerts.
*   **Administrative Tools:** Staff, permissions, feature flags, and audit logging.
*   **Bed Management:** Allocation, monitoring, and isolation protocols.
*   **Medical Documentation:** SOAP notes, vital signs, prescriptions, and mandatory notifications.
*   **Access Control:** Server-side authentication and role-based permissions.
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
*   **Role-Based UI:** Dynamically renders or disables UI elements based on user roles and permissions.
*   **Feature Flag System:** Allows dynamic control over application features.
*   **Secure Authentication:** bcrypt hashing for passwords, forced first-access password changes, and a robust password reset flow.
*   **Critical Alert System:** Real-time monitoring of patient critical statuses with visual and auditory alerts for relevant roles.
*   **Comprehensive Data Model:** Designed specifically for UPA environments, including patient demographics, clinical data, and administrative metadata.

**UI/UX Decisions:**
*   **Dark Modern UI:** Professional and sleek aesthetic.
*   **Manchester Triage Colors:** Integrated for intuitive visual urgency identification.
*   **Localization:** Full support for Brazilian Portuguese (pt-BR).
*   **Print-Friendly Outputs:** Specific CSS and server-side generation for reports (e.g., evolution notes, shift handovers, medical prescriptions).
*   **Intuitive Workflow:** Designed to mirror real-world UPA operations for patient status, bed management, and alerts.

**Key Features & Implementations:**
*   **Admin Section:** Full CRUD for staff, permission matrix, feature flags, and audit log viewer.
*   **Patient Management:** Unique `prontuario_number` and `atendimento_number` for each patient and visit; includes `address` for external system compatibility.
*   **Care Status Workflow:** Defined states for patient care progression (`Em Triagem` to `Alta`) with rules for transitions and time-based alerts.
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
*   **Arquivo de migração:** `scripts/supabase_migration.sql` — execute esse arquivo no SQL Editor do Supabase para criar o schema e importar os dados.
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
