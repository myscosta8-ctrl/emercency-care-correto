CREATE TABLE "patient_exam_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_id" integer NOT NULL,
	"prescription_id" integer,
	"laboratoriais" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"imagem" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"prioridade" text DEFAULT 'rotina' NOT NULL,
	"justificativa" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'solicitado' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "patient_exam_requests" ADD CONSTRAINT "patient_exam_requests_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_exam_requests" ADD CONSTRAINT "patient_exam_requests_prescription_id_patient_prescriptions_id_fk" FOREIGN KEY ("prescription_id") REFERENCES "public"."patient_prescriptions"("id") ON DELETE set null ON UPDATE no action;
