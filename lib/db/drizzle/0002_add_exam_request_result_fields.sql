ALTER TABLE "patient_exam_requests" ADD COLUMN "result_text" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "patient_exam_requests" ADD COLUMN "result_file_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "patient_exam_requests" ADD COLUMN "result_file_data" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "patient_exam_requests" ADD COLUMN "result_file_mime" text DEFAULT '' NOT NULL;
