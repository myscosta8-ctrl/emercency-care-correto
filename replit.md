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
