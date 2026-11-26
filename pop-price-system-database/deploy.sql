-- Initial deployment only: psql -X -v ON_ERROR_STOP=1 -f deploy.sql on an empty database.
\set ON_ERROR_STOP on
-- No triggers, stored functions, scheduler, queue or database jobs are created.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
CREATE SCHEMA pop_price_system_service;
CREATE TABLE pop_price_system_service.cloud_provider (code text PRIMARY KEY, name text NOT NULL);
INSERT INTO pop_price_system_service.cloud_provider(code, name) VALUES ('AWS', 'Amazon Web Services');
CREATE TABLE pop_price_system_service.cloud_region (
    provider text NOT NULL REFERENCES pop_price_system_service.cloud_provider(code), code text NOT NULL, name text NOT NULL,
    PRIMARY KEY(provider, code)
);
CREATE TABLE pop_price_system_service.cloud_service (
    provider text NOT NULL REFERENCES pop_price_system_service.cloud_provider(code), code text NOT NULL, name text NOT NULL,
    attributes jsonb NOT NULL DEFAULT '[]', PRIMARY KEY(provider, code)
);
-- Audit of synchronous requests. This table is not a work queue.
CREATE TABLE pop_price_system_service.catalog_synchronization (
    id uuid PRIMARY KEY, provider text NOT NULL REFERENCES pop_price_system_service.cloud_provider(code), service_code text NOT NULL,
    region_code text NOT NULL, status text NOT NULL, attempt integer NOT NULL DEFAULT 1,
    heartbeat_at timestamptz NOT NULL DEFAULT now(), started_at timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz, error_code text, source_version text,
    processed bigint NOT NULL DEFAULT 0, inserted bigint NOT NULL DEFAULT 0, updated bigint NOT NULL DEFAULT 0,
    unchanged bigint NOT NULL DEFAULT 0, deactivated bigint NOT NULL DEFAULT 0, idempotency_key text UNIQUE,
    CONSTRAINT synchronization_status CHECK (status IN ('RUNNING','COMPLETED','FAILED')),
    CONSTRAINT synchronization_attempt CHECK (attempt > 0)
);
CREATE UNIQUE INDEX synchronization_active_scope ON pop_price_system_service.catalog_synchronization(provider, service_code, region_code)
    WHERE status = 'RUNNING';
CREATE INDEX synchronization_history ON pop_price_system_service.catalog_synchronization(started_at DESC, id);
CREATE TABLE pop_price_system_service.catalog_sync_checkpoint (
    provider text NOT NULL, service_code text NOT NULL, region_code text NOT NULL,
    source_version text NOT NULL, source_url text NOT NULL, synchronized_at timestamptz NOT NULL,
    synchronization_id uuid NOT NULL REFERENCES pop_price_system_service.catalog_synchronization(id),
    PRIMARY KEY(provider, service_code, region_code),
    FOREIGN KEY(provider, service_code) REFERENCES pop_price_system_service.cloud_service(provider, code),
    FOREIGN KEY(provider, region_code) REFERENCES pop_price_system_service.cloud_region(provider, code)
);
CREATE TABLE pop_price_system_service.cloud_product (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, provider text NOT NULL, service_code text NOT NULL,
    region_code text NOT NULL, sku text NOT NULL, family text NOT NULL, attributes jsonb NOT NULL,
    usage_type text NOT NULL, operation text NOT NULL, content_hash text NOT NULL, active boolean NOT NULL DEFAULT true,
    UNIQUE(provider, service_code, region_code, sku),
    FOREIGN KEY(provider, service_code) REFERENCES pop_price_system_service.cloud_service(provider, code),
    FOREIGN KEY(provider, region_code) REFERENCES pop_price_system_service.cloud_region(provider, code)
);
CREATE INDEX product_search ON pop_price_system_service.cloud_product(provider, service_code, region_code, id);
CREATE INDEX product_family ON pop_price_system_service.cloud_product(family, id) WHERE active;
CREATE INDEX product_attributes ON pop_price_system_service.cloud_product USING gin(attributes jsonb_path_ops);
CREATE TABLE pop_price_system_service.price_term (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, product_id bigint NOT NULL REFERENCES pop_price_system_service.cloud_product(id),
    term_code text NOT NULL, modality text NOT NULL, attributes jsonb NOT NULL,
    UNIQUE(product_id, term_code, modality)
);
CREATE TABLE pop_price_system_service.price_dimension (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, term_id bigint NOT NULL REFERENCES pop_price_system_service.price_term(id),
    rate_code text NOT NULL, currency text NOT NULL, unit text NOT NULL, description text NOT NULL,
    range_begin numeric NOT NULL CHECK (range_begin >= 0), range_end numeric,
    unit_price numeric NOT NULL CHECK (unit_price >= 0), effective_at timestamptz NOT NULL,
    applies_to jsonb NOT NULL DEFAULT '[]', content_hash text NOT NULL, active boolean NOT NULL DEFAULT true,
    UNIQUE(term_id, rate_code, currency), CHECK (range_end IS NULL OR range_end > range_begin)
);
CREATE INDEX dimension_term ON pop_price_system_service.price_dimension(term_id, id) WHERE active;
CREATE TABLE pop_price_system_service.price_version (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, dimension_id bigint NOT NULL REFERENCES pop_price_system_service.price_dimension(id),
    source_version text NOT NULL, source_url text NOT NULL, content_hash text NOT NULL, snapshot jsonb NOT NULL,
    valid_from timestamptz NOT NULL, valid_to timestamptz, CHECK (valid_to IS NULL OR valid_to >= valid_from)
);
CREATE UNIQUE INDEX version_current ON pop_price_system_service.price_version(dimension_id) WHERE valid_to IS NULL;
CREATE INDEX version_history ON pop_price_system_service.price_version(dimension_id, id DESC);
CREATE TABLE pop_price_system_service.catalog_change_history (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    synchronization_id uuid NOT NULL REFERENCES pop_price_system_service.catalog_synchronization(id),
    dimension_id bigint NOT NULL REFERENCES pop_price_system_service.price_dimension(id), change_type text NOT NULL,
    changed_at timestamptz NOT NULL DEFAULT now(), CHECK (change_type IN ('INSERTED','UPDATED','DEACTIVATED')),
    UNIQUE(synchronization_id, dimension_id)
);
CREATE INDEX change_history_dimension ON pop_price_system_service.catalog_change_history(dimension_id, id DESC);
CREATE INDEX change_history_sync ON pop_price_system_service.catalog_change_history(synchronization_id, change_type);
-- Isolated staging: a failed or interrupted HTTP request never publishes a partial catalog.
CREATE TABLE pop_price_system_service.catalog_stage_product (
    synchronization_id uuid NOT NULL REFERENCES pop_price_system_service.catalog_synchronization(id), sku text NOT NULL,
    family text NOT NULL, attributes jsonb NOT NULL, usage_type text NOT NULL, operation text NOT NULL,
    content_hash text NOT NULL, PRIMARY KEY(synchronization_id, sku)
);
CREATE TABLE pop_price_system_service.catalog_stage_rate (
    synchronization_id uuid NOT NULL REFERENCES pop_price_system_service.catalog_synchronization(id), sku text NOT NULL,
    term_code text NOT NULL, modality text NOT NULL, term_attributes jsonb NOT NULL, rate_code text NOT NULL,
    currency text NOT NULL, unit text NOT NULL, description text NOT NULL, range_begin numeric NOT NULL,
    range_end numeric, unit_price numeric NOT NULL, effective_at timestamptz NOT NULL,
    applies_to jsonb NOT NULL, content_hash text NOT NULL,
    PRIMARY KEY(synchronization_id, sku, term_code, modality, rate_code, currency)
);
CREATE TABLE pop_price_system_service.architecture_estimate (
    id uuid PRIMARY KEY, name text NOT NULL, hours_per_month numeric NOT NULL,
    currency text NOT NULL DEFAULT 'USD', revision bigint NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (hours_per_month > 0 AND hours_per_month <= 744), CHECK (currency = 'USD')
);
CREATE INDEX estimate_created ON pop_price_system_service.architecture_estimate(created_at DESC, id);
CREATE TABLE pop_price_system_service.architecture_estimate_item (
    id uuid PRIMARY KEY, estimate_id uuid NOT NULL REFERENCES pop_price_system_service.architecture_estimate(id) ON DELETE CASCADE,
    name text NOT NULL, category text NOT NULL, account_code text NOT NULL, traffic_key text,
    rate_id bigint REFERENCES pop_price_system_service.price_dimension(id), quantity numeric NOT NULL CHECK (quantity > 0),
    consumption numeric NOT NULL CHECK (consumption >= 0), consumption_unit text NOT NULL,
    consumption_period text NOT NULL CHECK (consumption_period IN ('HOUR','DAY','MONTH','YEAR')),
    retention_days integer CHECK (retention_days > 0), created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(estimate_id, traffic_key)
);
CREATE INDEX estimate_items ON pop_price_system_service.architecture_estimate_item(estimate_id, created_at, id);
CREATE TABLE pop_price_system_service.architecture_data_flow (
    item_id uuid PRIMARY KEY REFERENCES pop_price_system_service.architecture_estimate_item(id) ON DELETE CASCADE,
    source_service text NOT NULL, destination_service text NOT NULL,
    source_account text NOT NULL, destination_account text NOT NULL,
    source_region text NOT NULL, destination_region text NOT NULL, source_az text, destination_az text,
    direction text NOT NULL CHECK (direction IN ('INTERNET_IN','INTERNET_OUT','INTERNAL')),
    connectivity text NOT NULL CHECK (connectivity IN ('DIRECT','NAT_GATEWAY','TRANSIT_GATEWAY','VPC_ENDPOINT','PRIVATELINK','DIRECT_CONNECT'))
);
CREATE TABLE pop_price_system_service.architecture_flow_charge (
    item_id uuid NOT NULL REFERENCES pop_price_system_service.architecture_data_flow(item_id) ON DELETE CASCADE,
    charge_key text NOT NULL, rate_id bigint NOT NULL REFERENCES pop_price_system_service.price_dimension(id),
    PRIMARY KEY(item_id, charge_key)
);
CREATE TABLE pop_price_system_service.architecture_flow_hop (
    item_id uuid NOT NULL REFERENCES pop_price_system_service.architecture_data_flow(item_id) ON DELETE CASCADE,
    position integer NOT NULL CHECK (position >= 0), service_code text NOT NULL,
    account_code text NOT NULL, region_code text NOT NULL, PRIMARY KEY(item_id, position)
);
-- Every calculation is immutable; changing items or catalog prices never overwrites earlier snapshots.
CREATE TABLE pop_price_system_service.architecture_estimate_calculation (
    id uuid PRIMARY KEY, estimate_id uuid NOT NULL REFERENCES pop_price_system_service.architecture_estimate(id),
    revision bigint NOT NULL, snapshot jsonb NOT NULL, calculated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX estimate_calculations ON pop_price_system_service.architecture_estimate_calculation(estimate_id, calculated_at DESC, id);
COMMENT ON TABLE pop_price_system_service.price_version IS 'valid_from/to: observation instants; snapshot.effectiveAt: provider effective time';

-- Portal, exchange quotes, architecture models and commercial valuations.
CREATE TABLE pop_price_system_service.exchange_quote (
    id uuid PRIMARY KEY,
    quotation_at timestamptz NOT NULL,
    quotation_date date NOT NULL,
    buy_rate numeric(20,10) NOT NULL CHECK (buy_rate > 0),
    sell_rate numeric(20,10) NOT NULL CHECK (sell_rate > 0),
    source text NOT NULL CHECK (source = 'BCB_PTAX'),
    bulletin text NOT NULL CHECK (bulletin = 'Fechamento'),
    source_url text NOT NULL,
    payload jsonb NOT NULL,
    synchronized_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(quotation_at, buy_rate, sell_rate)
);
CREATE INDEX exchange_quote_date ON pop_price_system_service.exchange_quote(quotation_date DESC, quotation_at DESC, id);
CREATE TABLE pop_price_system_service.portal_parameters (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    hours_per_month numeric(9,6) NOT NULL CHECK (hours_per_month > 0 AND hours_per_month <= 744),
    revision bigint NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO pop_price_system_service.portal_parameters(singleton, hours_per_month) VALUES(true,720) ON CONFLICT DO NOTHING;
CREATE TABLE pop_price_system_service.architecture_model (
    id uuid PRIMARY KEY,
    name text NOT NULL,
    hours_per_month numeric(9,6) NOT NULL CHECK (hours_per_month > 0 AND hours_per_month <= 744),
    graph jsonb NOT NULL CHECK (jsonb_typeof(graph) = 'object'),
    specification jsonb CONSTRAINT architecture_model_specification_object CHECK (specification IS NULL OR jsonb_typeof(specification) = 'object'),
    status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PUBLISHED')),
    revision bigint NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    published_at timestamptz,
    archived_at timestamptz,
    deleted_at timestamptz,
    CHECK ((status = 'PUBLISHED') = (published_at IS NOT NULL))
);
CREATE INDEX architecture_model_list ON pop_price_system_service.architecture_model(status, updated_at DESC, id);
CREATE TABLE pop_price_system_service.estimate_valuation (
    id uuid PRIMARY KEY,
    estimate_id uuid NOT NULL REFERENCES pop_price_system_service.architecture_estimate(id),
    calculation_id uuid NOT NULL REFERENCES pop_price_system_service.architecture_estimate_calculation(id),
    model_id uuid REFERENCES pop_price_system_service.architecture_model(id),
    quote_id uuid NOT NULL REFERENCES pop_price_system_service.exchange_quote(id),
    snapshot jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(calculation_id, quote_id)
);
CREATE INDEX valuation_estimate ON pop_price_system_service.estimate_valuation(estimate_id, created_at DESC, id);
CREATE INDEX valuation_model ON pop_price_system_service.estimate_valuation(model_id);
CREATE INDEX valuation_quote ON pop_price_system_service.estimate_valuation(quote_id);
CREATE TABLE pop_price_system_service.customer_contract (
    id uuid PRIMARY KEY,
    reference text NOT NULL UNIQUE,
    name text NOT NULL,
    customer_name text NOT NULL,
    valuation_id uuid NOT NULL REFERENCES pop_price_system_service.estimate_valuation(id),
    starts_on date NOT NULL,
    months integer NOT NULL CHECK (months BETWEEN 1 AND 120),
    snapshot jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customer_contract_valuation ON pop_price_system_service.customer_contract(valuation_id);
CREATE INDEX customer_contract_created ON pop_price_system_service.customer_contract(created_at DESC, id);

-- Component authoring is independent of installed cloud pricing integrations.
CREATE TABLE pop_price_system_service.architecture_component_provider (
    code text PRIMARY KEY,
    name text NOT NULL,
    position integer NOT NULL
);
INSERT INTO pop_price_system_service.architecture_component_provider(code,name,position) VALUES
    ('GENERIC','Genérico',0),('AWS','Amazon Web Services',1),
    ('AZURE','Microsoft Azure',2),('GCP','Google Cloud',3)
ON CONFLICT (code) DO NOTHING;

-- Official icon metadata and editable component definitions.

CREATE TABLE pop_price_system_service.architecture_icon (
    provider text NOT NULL REFERENCES pop_price_system_service.cloud_provider(code),
    icon_key text NOT NULL,
    release text NOT NULL,
    name text NOT NULL,
    kind text NOT NULL CHECK (kind IN ('SERVICE','RESOURCE','CATEGORY','GROUP')),
    category text NOT NULL,
    tags text NOT NULL DEFAULT '',
    asset_path text NOT NULL CHECK (asset_path LIKE '/architecture-icons/%'),
    source_path text NOT NULL,
    sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
    source_url text NOT NULL,
    package_sha256 text NOT NULL CHECK (package_sha256 ~ '^[a-f0-9]{64}$'),
    PRIMARY KEY (provider,icon_key,release)
);

CREATE TABLE pop_price_system_service.architecture_component (
    id uuid PRIMARY KEY,
    provider text NOT NULL,
    service_code text,
    name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
    category text NOT NULL CHECK (length(btrim(category)) BETWEEN 1 AND 100),
    description text NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
    status text NOT NULL CHECK (status IN ('PENDING','ACTIVE','INACTIVE')),
    icon_key text,
    icon_release text,
    revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    characteristics jsonb NOT NULL DEFAULT '[]',
    deleted_at timestamptz,
    CONSTRAINT architecture_component_provider_fk FOREIGN KEY (provider)
        REFERENCES pop_price_system_service.architecture_component_provider(code) ON DELETE RESTRICT,
    CONSTRAINT architecture_component_service_fk FOREIGN KEY (provider,service_code)
        REFERENCES pop_price_system_service.cloud_service(provider,code) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT architecture_component_icon_fk FOREIGN KEY (provider,icon_key,icon_release)
        REFERENCES pop_price_system_service.architecture_icon(provider,icon_key,release) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT architecture_component_icon_pair CHECK ((icon_key IS NULL) = (icon_release IS NULL)),
    CONSTRAINT architecture_component_generic
        CHECK (provider <> 'GENERIC' OR (service_code IS NULL AND icon_key IS NULL)),
    CONSTRAINT architecture_component_active_cloud
        CHECK (status <> 'ACTIVE' OR provider = 'GENERIC' OR (service_code IS NOT NULL AND icon_key IS NOT NULL)),
    CONSTRAINT architecture_component_characteristics
        CHECK (jsonb_typeof(characteristics) = 'array' AND jsonb_array_length(characteristics) <= 30)
);
CREATE INDEX architecture_component_service ON pop_price_system_service.architecture_component(provider,service_code,id);
CREATE INDEX architecture_component_icon ON pop_price_system_service.architecture_component(provider,icon_key,icon_release);

-- Categories belong to the authoring provider, independently of pricing integrations.
CREATE TABLE pop_price_system_service.architecture_component_category (
    provider text NOT NULL REFERENCES pop_price_system_service.architecture_component_provider(code) ON DELETE RESTRICT,
    code text NOT NULL,
    name text NOT NULL,
    original_name text NOT NULL,
    source_url text,
    release text NOT NULL,
    origin text NOT NULL CHECK (origin IN ('PROVIDER','PORTAL')),
    PRIMARY KEY (provider,code)
);
INSERT INTO pop_price_system_service.architecture_component_category(provider,code,name,original_name,release,origin) VALUES
    ('GENERIC','application','Aplicações','Aplicações','portal-v1','PORTAL'),
    ('GENERIC','compute','Computação','Computação','portal-v1','PORTAL'),
    ('GENERIC','storage','Armazenamento','Armazenamento','portal-v1','PORTAL'),
    ('GENERIC','database','Banco de dados','Banco de dados','portal-v1','PORTAL'),
    ('GENERIC','network','Rede','Rede','portal-v1','PORTAL'),
    ('GENERIC','integration','Integração','Integração','portal-v1','PORTAL'),
    ('GENERIC','observability','Observabilidade','Observabilidade','portal-v1','PORTAL'),
    ('GENERIC','security','Segurança','Segurança','portal-v1','PORTAL')
ON CONFLICT (provider,code) DO NOTHING;

COMMENT ON COLUMN pop_price_system_service.architecture_component.deleted_at IS 'Logical deletion; hidden from authoring queries, retained for historical references.';

-- Pinned provider libraries; categories precede icons and components inside the AWS seed.
\ir seeds/azure.sql
\ir seeds/gcp.sql
\ir seeds/aws.sql
DO $$
BEGIN
    EXECUTE format('ALTER DATABASE %I SET search_path TO pop_price_system_service, public', current_database());
END $$;
COMMIT;
