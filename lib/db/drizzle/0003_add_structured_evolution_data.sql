-- Add professional_category and structured_data to patient_evolutions
ALTER TABLE "patient_evolutions"
  ADD COLUMN IF NOT EXISTS "professional_category" text NOT NULL DEFAULT 'geral',
  ADD COLUMN IF NOT EXISTS "structured_data" jsonb;

-- Add structured_data to social_notes
ALTER TABLE "social_notes"
  ADD COLUMN IF NOT EXISTS "structured_data" jsonb;

-- Add structured_data to nutritional_assessments
ALTER TABLE "nutritional_assessments"
  ADD COLUMN IF NOT EXISTS "structured_data" jsonb;
