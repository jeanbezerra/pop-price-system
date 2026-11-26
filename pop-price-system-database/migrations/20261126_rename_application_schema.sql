-- Stop application instances before applying; restart with the updated application afterwards.
-- Renaming preserves object identity, data, foreign keys, sequences, owners and privileges.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SELECT pg_advisory_xact_lock(hashtext('pop_price_system_service.schema_rename'));
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='ratecard') THEN
        IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='pop_price_system_service') THEN
            RAISE EXCEPTION 'Both ratecard and pop_price_system_service exist. Resolve the conflict before renaming.';
        END IF;
        ALTER SCHEMA ratecard RENAME TO pop_price_system_service;
    ELSIF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='pop_price_system_service') THEN
        RAISE EXCEPTION 'Application schema not found. Use deploy.sql only for an empty database.';
    END IF;
    EXECUTE format('ALTER DATABASE %I SET search_path TO pop_price_system_service, public', current_database());
END $$;
COMMIT;
