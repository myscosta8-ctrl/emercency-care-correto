-- ============================================================
--  UPA Breves — PARTE 1 de 4: Criação das Tabelas
--  Execute primeiro este arquivo no SQL Editor do Supabase
-- ============================================================

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;
SET default_tablespace = '';
SET default_table_access_method = heap;

CREATE TABLE public.audit_log (
    id integer NOT NULL,
    usuario text NOT NULL,
    acao text NOT NULL,
    detalhes text,
    ip text,
    criado_em timestamp without time zone DEFAULT now() NOT NULL,
    staff_id integer
);
CREATE SEQUENCE public.audit_log_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.audit_log_id_seq OWNED BY public.audit_log.id;

CREATE TABLE public.beds (
    id integer NOT NULL,
    bed_id text NOT NULL,
    sector text NOT NULL,
    bed_number integer NOT NULL,
    is_isolation boolean DEFAULT false NOT NULL,
    is_occupied boolean DEFAULT false NOT NULL,
    patient_id integer,
    isolation_active boolean DEFAULT false NOT NULL,
    isolation_type text,
    isolation_reason text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    is_extra boolean DEFAULT false NOT NULL,
    extra_reason text,
    admission_time timestamp without time zone
);
CREATE SEQUENCE public.beds_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.beds_id_seq OWNED BY public.beds.id;

CREATE TABLE public.exam_results (
    id integer NOT NULL,
    patient_id integer NOT NULL,
    uploaded_by integer DEFAULT 0 NOT NULL,
    exam_name text NOT NULL,
    exam_type text DEFAULT 'laboratorial'::text NOT NULL,
    prioridade text DEFAULT 'rotina'::text NOT NULL,
    result_text text DEFAULT ''::text NOT NULL,
    file_data text DEFAULT ''::text NOT NULL,
    file_name text DEFAULT ''::text NOT NULL,
    file_mime text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'pendente'::text NOT NULL,
    liberado_at timestamp without time zone,
    notified boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE public.exam_results_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.exam_results_id_seq OWNED BY public.exam_results.id;

CREATE TABLE public.nutritional_assessments (
    id integer NOT NULL,
    patient_id integer NOT NULL,
    user_id integer DEFAULT 0 NOT NULL,
    content text DEFAULT ''::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    structured_data jsonb
);
CREATE SEQUENCE public.nutritional_assessments_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.nutritional_assessments_id_seq OWNED BY public.nutritional_assessments.id;

CREATE TABLE public.password_resets (
    id text NOT NULL,
    user_id integer NOT NULL,
    token text NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    used_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.patient_devices (
    id integer NOT NULL,
    patient_id integer NOT NULL,
    device_type text NOT NULL,
    insertion_date text NOT NULL,
    insertion_site text DEFAULT ''::text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    removed_at timestamp without time zone,
    created_by integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE public.patient_devices_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.patient_devices_id_seq OWNED BY public.patient_devices.id;

CREATE TABLE public.patient_evolutions (
    id integer NOT NULL,
    patient_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    user_id integer DEFAULT 0 NOT NULL,
    soap_text text DEFAULT ''::text NOT NULL,
    professional_category text DEFAULT 'geral'::text NOT NULL,
    structured_data jsonb
);
CREATE SEQUENCE public.patient_evolutions_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.patient_evolutions_id_seq OWNED BY public.patient_evolutions.id;

CREATE TABLE public.patient_exam_requests (
    id integer NOT NULL,
    patient_id integer NOT NULL,
    prescription_id integer,
    laboratoriais jsonb DEFAULT '[]'::jsonb NOT NULL,
    imagem jsonb DEFAULT '[]'::jsonb NOT NULL,
    prioridade text DEFAULT 'rotina'::text NOT NULL,
    justificativa text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'solicitado'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE public.patient_exam_requests_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.patient_exam_requests_id_seq OWNED BY public.patient_exam_requests.id;

CREATE TABLE public.patient_notifications (
    id integer NOT NULL,
    patient_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    disease text DEFAULT ''::text NOT NULL,
    classification text DEFAULT ''::text NOT NULL,
    pdf_url text DEFAULT ''::text NOT NULL,
    agravo_code text DEFAULT ''::text NOT NULL,
    cid10 text DEFAULT ''::text NOT NULL,
    data_notificacao text DEFAULT ''::text NOT NULL,
    data_inicio_sintomas text DEFAULT ''::text NOT NULL,
    logradouro text DEFAULT ''::text NOT NULL,
    numero_endereco text DEFAULT ''::text NOT NULL,
    complemento text DEFAULT ''::text NOT NULL,
    bairro text DEFAULT ''::text NOT NULL,
    municipio_residencia text DEFAULT ''::text NOT NULL,
    uf_residencia text DEFAULT ''::text NOT NULL,
    cep text DEFAULT ''::text NOT NULL,
    form_data text DEFAULT '{}'::text NOT NULL
);
CREATE SEQUENCE public.patient_notifications_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.patient_notifications_id_seq OWNED BY public.patient_notifications.id;

CREATE TABLE public.patient_prescriptions (
    id integer NOT NULL,
    patient_id integer NOT NULL,
    status text DEFAULT 'pendente'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    user_id integer DEFAULT 0 NOT NULL,
    type text DEFAULT 'nursing'::text NOT NULL,
    content text DEFAULT ''::text NOT NULL
);
CREATE SEQUENCE public.patient_prescriptions_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.patient_prescriptions_id_seq OWNED BY public.patient_prescriptions.id;

CREATE TABLE public.patient_tasks (
    id integer NOT NULL,
    patient_id integer NOT NULL,
    items text DEFAULT '[]'::text NOT NULL,
    status text DEFAULT 'pendente'::text NOT NULL,
    responsible text DEFAULT ''::text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE public.patient_tasks_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.patient_tasks_id_seq OWNED BY public.patient_tasks.id;

CREATE TABLE public.patients (
    id integer NOT NULL,
    full_name text NOT NULL,
    age integer DEFAULT 0 NOT NULL,
    bed text DEFAULT ''::text NOT NULL,
    diagnosis text DEFAULT ''::text NOT NULL,
    triage_level text NOT NULL,
    sector text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    nurse text DEFAULT ''::text NOT NULL,
    internment_status text DEFAULT 'nao_internado'::text NOT NULL,
    created_by text DEFAULT ''::text NOT NULL,
    updated_by text DEFAULT ''::text NOT NULL,
    birth_date text DEFAULT ''::text NOT NULL,
    sex text DEFAULT 'O'::text NOT NULL,
    mother_name text DEFAULT ''::text NOT NULL,
    cns text DEFAULT ''::text NOT NULL,
    cpf text DEFAULT ''::text NOT NULL,
    rg text DEFAULT ''::text NOT NULL,
    phone text DEFAULT ''::text NOT NULL,
    email text DEFAULT ''::text NOT NULL,
    symptoms text DEFAULT ''::text NOT NULL,
    symptom_onset_date text DEFAULT ''::text NOT NULL,
    attendance_date text DEFAULT ''::text NOT NULL,
    attendance_time text DEFAULT ''::text NOT NULL,
    health_unit text DEFAULT 'UPA Breves - Breves/PA'::text NOT NULL,
    responsible_professional text DEFAULT ''::text NOT NULL,
    agravo text DEFAULT ''::text NOT NULL,
    data_notificacao text DEFAULT ''::text NOT NULL,
    municipio_notificacao text DEFAULT ''::text NOT NULL,
    codigo_ibge text DEFAULT ''::text NOT NULL,
    evolucao_caso text DEFAULT ''::text NOT NULL,
    classificacao_final text DEFAULT ''::text NOT NULL,
    criterio_confirmacao text DEFAULT ''::text NOT NULL,
    address text DEFAULT ''::text NOT NULL,
    care_status text DEFAULT 'Em Triagem'::text NOT NULL,
    care_status_changed_at timestamp without time zone DEFAULT now() NOT NULL,
    prontuario_number text DEFAULT ''::text NOT NULL,
    atendimento_number text DEFAULT ''::text NOT NULL
);
CREATE SEQUENCE public.patients_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.patients_id_seq OWNED BY public.patients.id;

CREATE TABLE public.pharmacy_entries (
    id integer NOT NULL,
    patient_id integer NOT NULL,
    user_id integer DEFAULT 0 NOT NULL,
    medication text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'pendente'::text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE public.pharmacy_entries_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.pharmacy_entries_id_seq OWNED BY public.pharmacy_entries.id;

CREATE TABLE public.social_notes (
    id integer NOT NULL,
    patient_id integer NOT NULL,
    user_id integer DEFAULT 0 NOT NULL,
    content text DEFAULT ''::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    structured_data jsonb
);
CREATE SEQUENCE public.social_notes_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.social_notes_id_seq OWNED BY public.social_notes.id;

CREATE TABLE public.staff (
    id integer NOT NULL,
    name text NOT NULL,
    role text NOT NULL,
    coren_crm text DEFAULT ''::text NOT NULL,
    sector text DEFAULT ''::text NOT NULL,
    login text NOT NULL,
    password_hash text DEFAULT ''::text NOT NULL,
    access_levels text DEFAULT ''::text NOT NULL,
    signature text DEFAULT ''::text NOT NULL,
    stamp text DEFAULT ''::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    email text DEFAULT ''::text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    must_change_password boolean DEFAULT false NOT NULL,
    setores_atuacao text DEFAULT 'todos'::text NOT NULL,
    turno text DEFAULT ''::text NOT NULL,
    consultorio text DEFAULT ''::text NOT NULL
);
CREATE SEQUENCE public.staff_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.staff_id_seq OWNED BY public.staff.id;

CREATE TABLE public.transfers (
    id integer NOT NULL,
    patient_id integer NOT NULL,
    user_id integer DEFAULT 0 NOT NULL,
    destination_hospital text NOT NULL,
    specialty text DEFAULT ''::text NOT NULL,
    reason_for_transfer text DEFAULT ''::text NOT NULL,
    transfer_status text DEFAULT 'Solicitado'::text NOT NULL,
    transport_type text DEFAULT ''::text NOT NULL,
    regulation_contact text DEFAULT ''::text NOT NULL,
    departure_datetime timestamp without time zone,
    arrival_confirmation boolean DEFAULT false NOT NULL,
    arrival_datetime timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE public.transfers_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.transfers_id_seq OWNED BY public.transfers.id;

CREATE TABLE public.vitals (
    id integer NOT NULL,
    patient_id integer NOT NULL,
    user_id integer DEFAULT 0 NOT NULL,
    bp text DEFAULT ''::text NOT NULL,
    hr integer DEFAULT 0 NOT NULL,
    rr integer DEFAULT 0 NOT NULL,
    spo2 integer DEFAULT 0 NOT NULL,
    temp real DEFAULT 0 NOT NULL,
    glucose real DEFAULT 0 NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE public.vitals_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.vitals_id_seq OWNED BY public.vitals.id;
