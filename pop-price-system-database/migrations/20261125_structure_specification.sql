-- Nullable metadata preserves existing structures until their specification is defined.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
ALTER TABLE pop_price_system_service.architecture_model ADD COLUMN IF NOT EXISTS specification jsonb;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='pop_price_system_service.architecture_model'::regclass AND conname='architecture_model_specification_object') THEN
        ALTER TABLE pop_price_system_service.architecture_model ADD CONSTRAINT architecture_model_specification_object
            CHECK (specification IS NULL OR jsonb_typeof(specification) = 'object') NOT VALID;
    END IF;
END $$;
ALTER TABLE pop_price_system_service.architecture_model VALIDATE CONSTRAINT architecture_model_specification_object;
COMMIT;
