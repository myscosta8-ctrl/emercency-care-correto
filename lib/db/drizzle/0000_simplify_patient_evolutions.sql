CREATE TABLE "patients" (
	"id" serial PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"birth_date" text DEFAULT '' NOT NULL,
	"age" integer DEFAULT 0 NOT NULL,
	"sex" text DEFAULT 'O' NOT NULL,
	"mother_name" text DEFAULT '' NOT NULL,
	"cns" text DEFAULT '' NOT NULL,
	"cpf" text DEFAULT '' NOT NULL,
	"rg" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"sector" text NOT NULL,
	"bed" text DEFAULT '' NOT NULL,
	"triage_level" text NOT NULL,
	"internment_status" text DEFAULT 'nao_internado' NOT NULL,
	"diagnosis" text DEFAULT '' NOT NULL,
	"symptoms" text DEFAULT '' NOT NULL,
	"symptom_onset_date" text DEFAULT '' NOT NULL,
	"attendance_date" text DEFAULT '' NOT NULL,
	"attendance_time" text DEFAULT '' NOT NULL,
	"health_unit" text DEFAULT 'UPA Breves - Breves/PA' NOT NULL,
	"responsible_professional" text DEFAULT '' NOT NULL,
	"nurse" text DEFAULT '' NOT NULL,
	"agravo" text DEFAULT '' NOT NULL,
	"data_notificacao" text DEFAULT '' NOT NULL,
	"municipio_notificacao" text DEFAULT '' NOT NULL,
	"codigo_ibge" text DEFAULT '' NOT NULL,
	"evolucao_caso" text DEFAULT '' NOT NULL,
	"classificacao_final" text DEFAULT '' NOT NULL,
	"criterio_confirmacao" text DEFAULT '' NOT NULL,
	"created_by" text DEFAULT '' NOT NULL,
	"updated_by" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patient_evolutions" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_id" integer NOT NULL,
	"user_id" integer DEFAULT 0 NOT NULL,
	"soap_text" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patient_prescriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_id" integer NOT NULL,
	"items" text DEFAULT '[]' NOT NULL,
	"status" text DEFAULT 'pendente' NOT NULL,
	"responsible" text DEFAULT '' NOT NULL,
	"scheduled_time" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patient_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_id" integer NOT NULL,
	"items" text DEFAULT '[]' NOT NULL,
	"status" text DEFAULT 'pendente' NOT NULL,
	"responsible" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"coren_crm" text DEFAULT '' NOT NULL,
	"sector" text DEFAULT '' NOT NULL,
	"login" text NOT NULL,
	"password_hash" text DEFAULT '' NOT NULL,
	"access_levels" text DEFAULT '' NOT NULL,
	"signature" text DEFAULT '' NOT NULL,
	"stamp" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "staff_login_unique" UNIQUE("login")
);
--> statement-breakpoint
CREATE TABLE "vitals" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_id" integer NOT NULL,
	"user_id" integer DEFAULT 0 NOT NULL,
	"bp" text DEFAULT '' NOT NULL,
	"hr" integer DEFAULT 0 NOT NULL,
	"rr" integer DEFAULT 0 NOT NULL,
	"spo2" integer DEFAULT 0 NOT NULL,
	"temp" real DEFAULT 0 NOT NULL,
	"glucose" real DEFAULT 0 NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patient_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_id" integer NOT NULL,
	"types" text DEFAULT '[]' NOT NULL,
	"other_type" text DEFAULT '' NOT NULL,
	"diagnosis" text DEFAULT '' NOT NULL,
	"symptom_onset_date" text DEFAULT '' NOT NULL,
	"situation" text DEFAULT 'pendente' NOT NULL,
	"disease" text DEFAULT '' NOT NULL,
	"classification" text DEFAULT '' NOT NULL,
	"health_unit" text DEFAULT 'UPA Breves' NOT NULL,
	"pdf_url" text DEFAULT '' NOT NULL,
	"responsible" text DEFAULT '' NOT NULL,
	"notified_at" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"usuario" text NOT NULL,
	"acao" text NOT NULL,
	"detalhes" text,
	"ip" text,
	"criado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "patient_evolutions" ADD CONSTRAINT "patient_evolutions_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_prescriptions" ADD CONSTRAINT "patient_prescriptions_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_tasks" ADD CONSTRAINT "patient_tasks_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_notifications" ADD CONSTRAINT "patient_notifications_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;