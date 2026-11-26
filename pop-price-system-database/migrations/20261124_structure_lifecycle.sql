-- Additive migration for existing installations. No graph or historical valuation is removed.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
ALTER TABLE pop_price_system_service.architecture_model
    ADD COLUMN IF NOT EXISTS archived_at timestamptz,
    ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
COMMIT;
