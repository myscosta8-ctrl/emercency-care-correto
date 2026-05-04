# Overview

This project is an Emergency UPA (Unidade de Pronto Atendimento) patient management system designed to optimize administrative and care processes within an emergency medical unit. It provides comprehensive tools for patient registration, tracking, bed management, and medical documentation. Key features include a robust access control system, a critical alert mechanism, and a user-friendly dark UI optimized for emergency settings with Manchester triage colors and Brazilian Portuguese localization. The system aims to improve patient flow, data accuracy, and rapid information access for medical staff, ultimately enhancing patient outcomes and operational efficiency.

# User Preferences

*   After every `orval` codegen run, reset `lib/api-zod/src/index.ts` to only: `export * from "./generated/api";`
*   After codegen, run `pnpm run typecheck:libs` to rebuild composite lib `.d.ts` files
*   All deep imports from `@workspace/api-client-react/src/generated/api.schemas` must use `@workspace/api-client-react` (package root) for TypeScript to resolve correctly

# System Architecture

The project is built as a pnpm workspace monorepo using TypeScript, facilitating code sharing between frontend and backend.

**Core Technologies:**
*   **Backend:** Node.js (v24), Express 5, PostgreSQL with Drizzle ORM, Zod for validation, Orval for API codegen.
*   **Frontend:** React with Vite.
*   **Build Tool:** esbuild.

**Architectural Decisions & Design Patterns:**
*   **Monorepo:** Centralized codebase for consistent development.
*   **API-First:** OpenAPI specification drives client generation.
*   **Server-Side Security:** `requireAuth`, `requirePermissao`, and `auditWrite` middlewares enforce authentication, role-based access control, and comprehensive audit logging at the API level.
*   **Role-Based UI:** Dynamically renders UI elements based on user permissions.
*   **Feature Flag System:** Allows dynamic control over application features.
*   **Secure Authentication:** bcrypt hashing for passwords, forced first-access password changes, and a robust password reset flow.
*   **Critical Alert System:** Real-time monitoring of patient critical statuses with visual and auditory alerts for relevant roles.
*   **Comprehensive Data Model:** Designed specifically for UPA environments, including patient demographics, clinical data, and administrative metadata.

**UI/UX Decisions:**
*   **Dark Modern UI:** Professional and sleek aesthetic.
*   **Manchester Triage Colors:** Integrated for intuitive visual urgency identification.
*   **Localization:** Full support for Brazilian Portuguese (pt-BR).
*   **Print-Friendly Outputs:** Specific CSS for reports (e.g., evolution notes, shift handovers).
*   **Intuitive Workflow:** Designed to mirror real-world UPA operations for patient status, bed management, and alerts.

**Key Features & Implementations:**
*   **Admin Section:** Full CRUD for staff, permission management, feature flags, and audit log viewer.
*   **Patient Management:** Unique `prontuario_number` and `atendimento_number` for each patient and visit, respectively.
*   **Care Status Workflow:** Defined states for patient care progression (`Em Triagem` to `Alta`) with time-based alerts.
*   **Bed Management:** Detailed `beds` table with automatic seeding, isolation protocols, and a visual grid interface.
*   **Mandatory Notifications:** Dedicated system for managing and tracking compulsory notifications (e.g., infectious diseases).
*   **Laboratório Module:** Management of exam requests and results, including file uploads and real-time notifications.
*   **Access Control by Sector and Shift:** Staff profiles define `setores_atuacao`, `turno`, and `consultorio` to dynamically filter dashboard views and access in the medical queue.
*   **Patient Detail Screen:** Comprehensive view with SOAP evolution history, vital signs, prescriptions, and mandatory notifications.
*   **Shift Handover:** Dedicated interface for managing and printing shift summaries.
*   **Staff Management:** CRUD operations for staff, including login, password hash, digital signature, and stamp generation.
*   **Patient Form Sections:** Standardized admission and edit forms structured into logical sections (Patient Data, Documents, Contact, Address, Clinical Data, Initial Vital Signs).

# External Dependencies

*   **Database:** PostgreSQL
*   **ORM:** Drizzle ORM
*   **API Codegen:** Orval (from OpenAPI spec)
*   **Password Hashing:** bcrypt
*   **Validation:** Zod (`zod/v4`) and `drizzle-zod`
*   **Authentication:** Custom server-side middlewares (`requireAuth`, `requirePermissao`)
*   **Audit Logging:** Custom `auditWrite` middleware for all successful API writes
*   **Frontend State Management:** React Context API (e.g., `AuthContext`)