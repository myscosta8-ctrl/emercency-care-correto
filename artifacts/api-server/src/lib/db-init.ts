import { pool } from "@workspace/db";
import { logger } from "./logger";
import bcrypt from "bcryptjs";

const INIT_SQL = `
-- Tabelas
CREATE TABLE IF NOT EXISTS public.staff (
  id serial PRIMARY KEY,
  name text NOT NULL,
  role text NOT NULL,
  coren_crm text NOT NULL DEFAULT '',
  sector text NOT NULL DEFAULT '',
  login text NOT NULL UNIQUE,
  password_hash text NOT NULL DEFAULT '',
  access_levels text NOT NULL DEFAULT '',
  signature text NOT NULL DEFAULT '',
  stamp text NOT NULL DEFAULT '',
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  email text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  must_change_password boolean NOT NULL DEFAULT false,
  setores_atuacao text NOT NULL DEFAULT 'todos',
  turno text NOT NULL DEFAULT '',
  consultorio text NOT NULL DEFAULT '',
  custom_permissions text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.patients (
  id serial PRIMARY KEY,
  full_name text NOT NULL,
  age integer NOT NULL DEFAULT 0,
  bed text NOT NULL DEFAULT '',
  diagnosis text NOT NULL DEFAULT '',
  triage_level text NOT NULL,
  sector text NOT NULL,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  nurse text NOT NULL DEFAULT '',
  internment_status text NOT NULL DEFAULT 'nao_internado',
  created_by text NOT NULL DEFAULT '',
  updated_by text NOT NULL DEFAULT '',
  birth_date text NOT NULL DEFAULT '',
  sex text NOT NULL DEFAULT 'O',
  mother_name text NOT NULL DEFAULT '',
  cns text NOT NULL DEFAULT '',
  cpf text NOT NULL DEFAULT '',
  rg text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  symptoms text NOT NULL DEFAULT '',
  symptom_onset_date text NOT NULL DEFAULT '',
  attendance_date text NOT NULL DEFAULT '',
  attendance_time text NOT NULL DEFAULT '',
  health_unit text NOT NULL DEFAULT 'UPA Breves - Breves/PA',
  responsible_professional text NOT NULL DEFAULT '',
  agravo text NOT NULL DEFAULT '',
  data_notificacao text NOT NULL DEFAULT '',
  municipio_notificacao text NOT NULL DEFAULT '',
  codigo_ibge text NOT NULL DEFAULT '',
  evolucao_caso text NOT NULL DEFAULT '',
  classificacao_final text NOT NULL DEFAULT '',
  criterio_confirmacao text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  care_status text NOT NULL DEFAULT 'Em Triagem',
  care_status_changed_at timestamp without time zone NOT NULL DEFAULT now(),
  prontuario_number text NOT NULL DEFAULT '',
  atendimento_number text NOT NULL DEFAULT '',
  archived_at timestamp without time zone,
  archive_reason text NOT NULL DEFAULT '',
  address_street text NOT NULL DEFAULT '',
  address_number text NOT NULL DEFAULT '',
  address_neighborhood text NOT NULL DEFAULT '',
  address_city text NOT NULL DEFAULT '',
  address_cep text NOT NULL DEFAULT '',
  hora_recepcao timestamp without time zone,
  hora_triagem timestamp without time zone,
  hora_atendimento_medico timestamp without time zone,
  hora_medicacao timestamp without time zone,
  hora_alta timestamp without time zone,
  hora_internacao timestamp without time zone,
  hora_transferencia timestamp without time zone
);

CREATE TABLE IF NOT EXISTS public.patient_alerts (
  id serial PRIMARY KEY,
  patient_id integer NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  type text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  created_by_name text NOT NULL DEFAULT '',
  deactivated_at timestamp without time zone,
  deactivated_by_name text NOT NULL DEFAULT '',
  motivo_desativacao text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.audit_log (
  id serial PRIMARY KEY,
  usuario text NOT NULL,
  acao text NOT NULL,
  detalhes text,
  ip text,
  criado_em timestamp without time zone NOT NULL DEFAULT now(),
  staff_id integer
);

CREATE TABLE IF NOT EXISTS public.beds (
  id serial PRIMARY KEY,
  bed_id text NOT NULL UNIQUE,
  sector text NOT NULL,
  bed_number integer NOT NULL,
  is_isolation boolean NOT NULL DEFAULT false,
  is_occupied boolean NOT NULL DEFAULT false,
  patient_id integer REFERENCES public.patients(id) ON DELETE SET NULL,
  isolation_active boolean NOT NULL DEFAULT false,
  isolation_type text,
  isolation_reason text,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  is_extra boolean NOT NULL DEFAULT false,
  extra_reason text,
  admission_time timestamp without time zone
);

CREATE TABLE IF NOT EXISTS public.password_resets (
  id text PRIMARY KEY,
  user_id integer NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamp without time zone NOT NULL,
  used_at timestamp without time zone,
  created_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.patient_evolutions (
  id serial PRIMARY KEY,
  patient_id integer NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  user_id integer NOT NULL DEFAULT 0,
  soap_text text NOT NULL DEFAULT '',
  professional_category text NOT NULL DEFAULT 'geral',
  structured_data jsonb
);

CREATE TABLE IF NOT EXISTS public.patient_exam_requests (
  id serial PRIMARY KEY,
  patient_id integer NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  prescription_id integer,
  laboratoriais jsonb NOT NULL DEFAULT '[]',
  imagem jsonb NOT NULL DEFAULT '[]',
  prioridade text NOT NULL DEFAULT 'rotina',
  justificativa text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'solicitado',
  created_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.exam_results (
  id serial PRIMARY KEY,
  patient_id integer NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  uploaded_by integer NOT NULL DEFAULT 0,
  exam_name text NOT NULL,
  exam_type text NOT NULL DEFAULT 'laboratorial',
  prioridade text NOT NULL DEFAULT 'rotina',
  result_text text NOT NULL DEFAULT '',
  file_data text NOT NULL DEFAULT '',
  file_name text NOT NULL DEFAULT '',
  file_mime text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pendente',
  liberado_at timestamp without time zone,
  notified boolean NOT NULL DEFAULT false,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nutritional_assessments (
  id serial PRIMARY KEY,
  patient_id integer NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  user_id integer NOT NULL DEFAULT 0,
  content text NOT NULL DEFAULT '',
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  structured_data jsonb
);

CREATE TABLE IF NOT EXISTS public.patient_notifications (
  id serial PRIMARY KEY,
  patient_id integer NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  disease text NOT NULL DEFAULT '',
  classification text NOT NULL DEFAULT '',
  pdf_url text NOT NULL DEFAULT '',
  agravo_code text NOT NULL DEFAULT '',
  cid10 text NOT NULL DEFAULT '',
  data_notificacao text NOT NULL DEFAULT '',
  data_inicio_sintomas text NOT NULL DEFAULT '',
  logradouro text NOT NULL DEFAULT '',
  numero_endereco text NOT NULL DEFAULT '',
  complemento text NOT NULL DEFAULT '',
  bairro text NOT NULL DEFAULT '',
  municipio_residencia text NOT NULL DEFAULT '',
  uf_residencia text NOT NULL DEFAULT '',
  cep text NOT NULL DEFAULT '',
  form_data text NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS public.patient_prescriptions (
  id serial PRIMARY KEY,
  patient_id integer NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pendente',
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  user_id integer NOT NULL DEFAULT 0,
  type text NOT NULL DEFAULT 'nursing',
  content text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.patient_tasks (
  id serial PRIMARY KEY,
  patient_id integer NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  items text NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'pendente',
  responsible text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.patient_devices (
  id serial PRIMARY KEY,
  patient_id integer NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  device_type text NOT NULL,
  insertion_date text NOT NULL,
  insertion_site text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  removed_at timestamp without time zone,
  created_by integer NOT NULL DEFAULT 0,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pharmacy_entries (
  id serial PRIMARY KEY,
  patient_id integer NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  user_id integer NOT NULL DEFAULT 0,
  medication text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pendente',
  notes text NOT NULL DEFAULT '',
  created_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.social_notes (
  id serial PRIMARY KEY,
  patient_id integer NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  user_id integer NOT NULL DEFAULT 0,
  content text NOT NULL DEFAULT '',
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  structured_data jsonb
);

CREATE TABLE IF NOT EXISTS public.transfers (
  id serial PRIMARY KEY,
  patient_id integer NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  user_id integer NOT NULL DEFAULT 0,
  destination_hospital text NOT NULL,
  specialty text NOT NULL DEFAULT '',
  reason_for_transfer text NOT NULL DEFAULT '',
  transfer_status text NOT NULL DEFAULT 'Solicitado',
  transport_type text NOT NULL DEFAULT '',
  regulation_contact text NOT NULL DEFAULT '',
  departure_datetime timestamp without time zone,
  arrival_confirmation boolean NOT NULL DEFAULT false,
  arrival_datetime timestamp without time zone,
  created_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vitals (
  id serial PRIMARY KEY,
  patient_id integer NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  user_id integer NOT NULL DEFAULT 0,
  bp text NOT NULL DEFAULT '',
  hr integer NOT NULL DEFAULT 0,
  rr integer NOT NULL DEFAULT 0,
  spo2 integer NOT NULL DEFAULT 0,
  temp real NOT NULL DEFAULT 0,
  glucose real NOT NULL DEFAULT 0,
  note text NOT NULL DEFAULT '',
  created_at timestamp without time zone NOT NULL DEFAULT now()
);

-- FK pendente de patient_exam_requests → patient_prescriptions
ALTER TABLE public.patient_exam_requests
  ADD COLUMN IF NOT EXISTS prescription_id integer;

-- Colunas de resultado adicionadas depois da criação inicial
ALTER TABLE public.patient_exam_requests ADD COLUMN IF NOT EXISTS result_text text NOT NULL DEFAULT '';
ALTER TABLE public.patient_exam_requests ADD COLUMN IF NOT EXISTS result_file_name text NOT NULL DEFAULT '';
ALTER TABLE public.patient_exam_requests ADD COLUMN IF NOT EXISTS result_file_data text NOT NULL DEFAULT '';
ALTER TABLE public.patient_exam_requests ADD COLUMN IF NOT EXISTS result_file_mime text NOT NULL DEFAULT '';
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'patient_exam_requests_prescription_id_fk'
  ) THEN
    ALTER TABLE public.patient_exam_requests
      ADD CONSTRAINT patient_exam_requests_prescription_id_fk
      FOREIGN KEY (prescription_id) REFERENCES public.patient_prescriptions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Garantir constraints UNIQUE necessárias para ON CONFLICT
DO $$ BEGIN
  BEGIN ALTER TABLE public.staff ADD UNIQUE (login); EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
DO $$ BEGIN
  BEGIN ALTER TABLE public.beds ADD UNIQUE (bed_id); EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- Usuários padrão do sistema
-- admin / admin123  e  myscosta8@gmail.com / Enfermagem@2025 (bcrypt)
INSERT INTO public.staff (id, name, role, coren_crm, sector, login, password_hash, access_levels, signature, stamp, email, active, must_change_password, setores_atuacao)
VALUES
  (1, 'Marcus Yan dos Santos Costa', 'enfermeiro', '577662', 'todos_os_setores',
   'myscosta8@gmail.com',
   '$2b$12$qbInr5XhJqetV.WpivyAxuROpjleauQmH51bX1s6c8BLyigaOPqCi',
   'assistencial,admin,coordenacao_enfermagem', '', '',
   'myscosta8@gmail.com', true, false, 'todos'),
  (2, 'Administrador', 'administrador', 'ADM-001', 'Administração',
   'admin',
   '$2b$12$bf0Rq6eq4kup9tX4sBI2S.0ml/325WD1rO7.a73V66W9APMcXXkkq',
   '', '', '', '', true, false, 'todos')
ON CONFLICT (login) DO NOTHING;

SELECT setval('public.staff_id_seq', GREATEST((SELECT MAX(id) FROM public.staff), 1));

-- Leitos padrão
INSERT INTO public.beds (bed_id, sector, bed_number, is_isolation) VALUES
  ('VS-01','sala_vermelha',1,false), ('VS-02','sala_vermelha',2,false),
  ('VS-03','sala_vermelha',3,false), ('VS-04','sala_vermelha',4,false),
  ('OA-01','observacao_adulto',1,false), ('OA-02','observacao_adulto',2,false),
  ('OA-03','observacao_adulto',3,false), ('OA-04','observacao_adulto',4,false),
  ('OA-05','observacao_adulto',5,false), ('OA-06','observacao_adulto',6,false),
  ('OA-07','observacao_adulto',7,false), ('OA-08','observacao_adulto',8,false),
  ('OA-09','observacao_adulto',9,false), ('OA-10','observacao_adulto',10,false),
  ('OA-11','observacao_adulto',11,false), ('OA-12','observacao_adulto',12,false),
  ('OA-13','observacao_adulto',13,false), ('OA-14','observacao_adulto',14,false),
  ('OA-15','observacao_adulto',15,false), ('OA-16','observacao_adulto',16,false),
  ('OA-ISO','observacao_adulto',17,true),
  ('OP-01','observacao_pediatrica',1,false), ('OP-02','observacao_pediatrica',2,false),
  ('OP-03','observacao_pediatrica',3,false), ('OP-04','observacao_pediatrica',4,false),
  ('OP-05','observacao_pediatrica',5,false), ('OP-ISO','observacao_pediatrica',6,true),
  ('PA-01','observacao_pre_adulto',1,false), ('PA-02','observacao_pre_adulto',2,false),
  ('PA-03','observacao_pre_adulto',3,false), ('PA-04','observacao_pre_adulto',4,false),
  ('PA-05','observacao_pre_adulto',5,false), ('PA-06','observacao_pre_adulto',6,false),
  ('PA-07','observacao_pre_adulto',7,false), ('PA-ISO','observacao_pre_adulto',8,true)
ON CONFLICT (bed_id) DO NOTHING;
`;

async function migratePasswords(): Promise<void> {
  try {
    const { rows } = await pool.query<{ login: string; password_hash: string }>(
      `SELECT login, password_hash FROM public.staff
       WHERE login IN ('admin', 'myscosta8@gmail.com')`
    );

    const defaultPasswords: Record<string, string> = {
      admin: "admin123",
      "myscosta8@gmail.com": "Enfermagem@2025",
    };

    for (const row of rows) {
      const isBcrypt =
        row.password_hash.startsWith("$2b$") ||
        row.password_hash.startsWith("$2a$");

      if (!isBcrypt) {
        const plain = defaultPasswords[row.login];
        if (plain) {
          const hash = await bcrypt.hash(plain, 12);
          await pool.query(
            `UPDATE public.staff SET password_hash = $1 WHERE login = $2`,
            [hash, row.login]
          );
          logger.info({ login: row.login }, "Migrated legacy hash to bcrypt");
        }
      }
    }
  } catch {
    // Table may not exist yet — will be created in INIT_SQL below
  }
}

export async function initializeDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    const result = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'staff'
      ) AS exists`
    );

    const alreadyInitialized = result.rows[0]?.exists === true;

    if (alreadyInitialized) {
      logger.info("Database already initialized — running incremental migrations");
      await migratePasswords();
      // ── incremental migrations (all idempotent) ────────────────────────────
      await client.query(`
        -- staff: permission system
        ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS custom_permissions text NOT NULL DEFAULT '';

        -- patients: columns added after initial schema (fixes Supabase 500 errors)
        ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS birth_date text NOT NULL DEFAULT '';
        ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS sex text NOT NULL DEFAULT 'O';
        ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS mother_name text NOT NULL DEFAULT '';
        ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS cns text NOT NULL DEFAULT '';
        ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS cpf text NOT NULL DEFAULT '';
        ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS rg text NOT NULL DEFAULT '';
        ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT '';
        ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '';
        ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS symptoms text NOT NULL DEFAULT '';
        ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS symptom_onset_date text NOT NULL DEFAULT '';
        ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS attendance_date text NOT NULL DEFAULT '';
        ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS attendance_time text NOT NULL DEFAULT '';
        ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS health_unit text NOT NULL DEFAULT 'UPA Breves - Breves/PA';
        ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS responsible_professional text NOT NULL DEFAULT '';
        ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS agravo text NOT NULL DEFAULT '';
        ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS data_notificacao text NOT NULL DEFAULT '';
        ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS municipio_notificacao text NOT NULL DEFAULT '';
        ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS codigo_ibge text NOT NULL DEFAULT '';
        ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS evolucao_caso text NOT NULL DEFAULT '';
        ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS classificacao_final text NOT NULL DEFAULT '';
        ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS criterio_confirmacao text NOT NULL DEFAULT '';
        ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS address text NOT NULL DEFAULT '';
        ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS care_status text NOT NULL DEFAULT 'Em Triagem';
        ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS care_status_changed_at timestamp without time zone NOT NULL DEFAULT now();
        ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS prontuario_number text NOT NULL DEFAULT '';
        ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS atendimento_number text NOT NULL DEFAULT '';
        ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS created_by text NOT NULL DEFAULT '';
        ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS updated_by text NOT NULL DEFAULT '';
        ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS internment_status text NOT NULL DEFAULT 'nao_internado';
        ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS nurse text NOT NULL DEFAULT '';
        ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS archived_at timestamp without time zone;
        ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS archive_reason text NOT NULL DEFAULT '';

        -- staff: extra columns
        ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS setores_atuacao text NOT NULL DEFAULT 'todos';
        ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS turno text NOT NULL DEFAULT '';
        ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS consultorio text NOT NULL DEFAULT '';
        ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
        ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
        ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '';

        -- exam_results: extra columns
        ALTER TABLE public.exam_results ADD COLUMN IF NOT EXISTS notified boolean NOT NULL DEFAULT false;
        ALTER TABLE public.exam_results ADD COLUMN IF NOT EXISTS liberado_at timestamp without time zone;

        -- patient_exam_requests: extra columns
        ALTER TABLE public.patient_exam_requests ADD COLUMN IF NOT EXISTS result_text text NOT NULL DEFAULT '';
        ALTER TABLE public.patient_exam_requests ADD COLUMN IF NOT EXISTS result_file_name text NOT NULL DEFAULT '';
        ALTER TABLE public.patient_exam_requests ADD COLUMN IF NOT EXISTS result_file_data text NOT NULL DEFAULT '';
        ALTER TABLE public.patient_exam_requests ADD COLUMN IF NOT EXISTS result_file_mime text NOT NULL DEFAULT '';

        -- audit_log: extra column
        ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS staff_id integer;

        -- patient_prescriptions: columns added after initial schema
        ALTER TABLE public.patient_prescriptions ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'nursing';
        ALTER TABLE public.patient_prescriptions ADD COLUMN IF NOT EXISTS user_id integer NOT NULL DEFAULT 0;
        ALTER TABLE public.patient_prescriptions ADD COLUMN IF NOT EXISTS content text NOT NULL DEFAULT '';
        ALTER TABLE public.patient_prescriptions ADD COLUMN IF NOT EXISTS invalidado boolean NOT NULL DEFAULT false;
        ALTER TABLE public.patient_prescriptions ADD COLUMN IF NOT EXISTS motivo_invalidacao text NOT NULL DEFAULT '';

        -- patient_evolutions: invalidação
        ALTER TABLE public.patient_evolutions ADD COLUMN IF NOT EXISTS invalidado boolean NOT NULL DEFAULT false;
        ALTER TABLE public.patient_evolutions ADD COLUMN IF NOT EXISTS motivo_invalidacao text NOT NULL DEFAULT '';

        -- patient_exam_requests: invalidação
        ALTER TABLE public.patient_exam_requests ADD COLUMN IF NOT EXISTS invalidado boolean NOT NULL DEFAULT false;
        ALTER TABLE public.patient_exam_requests ADD COLUMN IF NOT EXISTS motivo_invalidacao text NOT NULL DEFAULT '';

        -- patients: endereço separado em campos individuais
        ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS address_street text NOT NULL DEFAULT '';
        ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS address_number text NOT NULL DEFAULT '';
        ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS address_neighborhood text NOT NULL DEFAULT '';
        ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS address_city text NOT NULL DEFAULT '';
        ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS address_cep text NOT NULL DEFAULT '';

        -- patients: rastreamento de tempo por etapa do fluxo
        ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS hora_recepcao timestamp without time zone;
        ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS hora_triagem timestamp without time zone;
        ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS hora_atendimento_medico timestamp without time zone;
        ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS hora_medicacao timestamp without time zone;
        ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS hora_alta timestamp without time zone;
        ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS hora_internacao timestamp without time zone;
        ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS hora_transferencia timestamp without time zone;

        -- tabela de alertas clínicos por paciente
        CREATE TABLE IF NOT EXISTS public.patient_alerts (
          id serial PRIMARY KEY,
          patient_id integer NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
          type text NOT NULL,
          descricao text NOT NULL DEFAULT '',
          ativo boolean NOT NULL DEFAULT true,
          created_at timestamp without time zone NOT NULL DEFAULT now(),
          created_by_name text NOT NULL DEFAULT '',
          deactivated_at timestamp without time zone,
          deactivated_by_name text NOT NULL DEFAULT '',
          motivo_desativacao text NOT NULL DEFAULT ''
        );
      `);

      // ── restore admin account (idempotent) ──────────────────────────────────
      // Garante que o login 'admin' existe, está ativo e com senha conhecida.
      // Hash bcrypt(cost=12) de "admin123" — altere via painel após recuperar acesso.
      await client.query(`
        INSERT INTO public.staff (id, name, role, coren_crm, sector, login, password_hash,
          access_levels, signature, stamp, email, active, must_change_password, setores_atuacao)
        VALUES (2, 'Administrador', 'administrador', 'ADM-001', 'Administração',
          'admin',
          '$2b$12$bf0Rq6eq4kup9tX4sBI2S.0ml/325WD1rO7.a73V66W9APMcXXkkq',
          '', '', '', '', true, false, 'todos')
        ON CONFLICT (login) DO UPDATE SET
          password_hash     = '$2b$12$bf0Rq6eq4kup9tX4sBI2S.0ml/325WD1rO7.a73V66W9APMcXXkkq',
          active            = true,
          must_change_password = false,
          role              = 'administrador';
      `);
      logger.info("Database initialization complete");
      return;
    }

    logger.info("Database not initialized — running setup...");
    await client.query(INIT_SQL);
    logger.info("Database initialized successfully");
  } catch (err) {
    logger.error({ err }, "Failed to initialize database");
    throw err;
  } finally {
    client.release();
  }
}
