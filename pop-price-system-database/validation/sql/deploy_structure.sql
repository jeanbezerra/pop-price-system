-- TEST ONLY. Applied by verify-deploy exclusively to a newly created isolated database.
BEGIN;
\ir portal_catalog.sql

SELECT id AS rate_id FROM pop_price_system_service.price_dimension WHERE rate_code='test-rate' \gset

INSERT INTO pop_price_system_service.cloud_provider(code,name) VALUES ('AZURE','Microsoft Azure'),('GCP','Google Cloud');
INSERT INTO pop_price_system_service.cloud_service(provider,code,name) VALUES
    ('AZURE','test-compute','Synthetic Azure service'),('GCP','test-compute','Synthetic GCP service');
INSERT INTO pop_price_system_service.cloud_region(provider,code,name) VALUES
    ('AZURE','test-region','Synthetic Azure region'),('GCP','test-region','Synthetic GCP region');

INSERT INTO pop_price_system_service.catalog_synchronization(id,provider,service_code,region_code,status,finished_at,source_version,idempotency_key) VALUES
    ('10000000-0000-4000-8000-000000000001','AWS','AmazonEC2','us-east-1','COMPLETED',now(),'test-v1','deploy-test-completed'),
    ('10000000-0000-4000-8000-000000000002','AWS','AmazonEC2','us-east-1','RUNNING',NULL,NULL,'deploy-test-running');
INSERT INTO pop_price_system_service.catalog_sync_checkpoint(provider,service_code,region_code,source_version,source_url,synchronized_at,synchronization_id)
VALUES ('AWS','AmazonEC2','us-east-1','test-v1','https://example.invalid/test-only',now(),'10000000-0000-4000-8000-000000000001');
INSERT INTO pop_price_system_service.catalog_change_history(synchronization_id,dimension_id,change_type)
VALUES ('10000000-0000-4000-8000-000000000001',:rate_id,'INSERTED');
INSERT INTO pop_price_system_service.catalog_stage_product(synchronization_id,sku,family,attributes,usage_type,operation,content_hash)
VALUES ('10000000-0000-4000-8000-000000000002','STAGE-TEST-SKU','Compute','{}','BoxUsage','RunInstances','test-only');
INSERT INTO pop_price_system_service.catalog_stage_rate(synchronization_id,sku,term_code,modality,term_attributes,rate_code,currency,unit,description,range_begin,range_end,unit_price,effective_at,applies_to,content_hash)
VALUES ('10000000-0000-4000-8000-000000000002','STAGE-TEST-SKU','stage-term','OnDemand','{}','stage-rate','USD','Hrs','Synthetic test fixture',0,NULL,0.1,now(),'[]','test-only');

INSERT INTO pop_price_system_service.architecture_estimate(id,name,hours_per_month)
VALUES ('20000000-0000-4000-8000-000000000001','Synthetic deployment estimate',720);
INSERT INTO pop_price_system_service.architecture_estimate_item(id,estimate_id,name,category,account_code,traffic_key,rate_id,quantity,consumption,consumption_unit,consumption_period,retention_days)
VALUES ('20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','Synthetic transfer','network','test-account','test-traffic',:rate_id,2,10,'GB','MONTH',30);
INSERT INTO pop_price_system_service.architecture_data_flow(item_id,source_service,destination_service,source_account,destination_account,source_region,destination_region,direction,connectivity)
VALUES ('20000000-0000-4000-8000-000000000002','AmazonEC2','AmazonEC2','test-account','test-destination','us-east-1','us-east-1','INTERNAL','DIRECT');
INSERT INTO pop_price_system_service.architecture_flow_charge(item_id,charge_key,rate_id)
VALUES ('20000000-0000-4000-8000-000000000002','test-charge',:rate_id);
INSERT INTO pop_price_system_service.architecture_flow_hop(item_id,position,service_code,account_code,region_code)
VALUES ('20000000-0000-4000-8000-000000000002',0,'AmazonEC2','test-account','us-east-1');
INSERT INTO pop_price_system_service.architecture_estimate_calculation(id,estimate_id,revision,snapshot)
VALUES ('20000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001',0,'{"testOnly":true,"totalUsd":144}');

INSERT INTO pop_price_system_service.exchange_quote(id,quotation_at,quotation_date,buy_rate,sell_rate,source,bulletin,source_url,payload)
VALUES ('30000000-0000-4000-8000-000000000001','2026-01-02T16:00:00Z','2026-01-02',5.10,5.11,'BCB_PTAX','Fechamento','https://example.invalid/test-only','{"testOnly":true}');
INSERT INTO pop_price_system_service.architecture_model(id,name,hours_per_month,graph,status,published_at)
VALUES ('30000000-0000-4000-8000-000000000002','Synthetic deployment model',720,'{"nodes":[],"edges":[]}', 'PUBLISHED',now());
INSERT INTO pop_price_system_service.estimate_valuation(id,estimate_id,calculation_id,model_id,quote_id,snapshot)
VALUES ('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001','{"testOnly":true,"totalBrl":735.84}');
INSERT INTO pop_price_system_service.customer_contract(id,reference,name,customer_name,valuation_id,starts_on,months,snapshot)
VALUES ('30000000-0000-4000-8000-000000000004','DEPLOY-TEST-CONTRACT','Synthetic contract','Test customer','30000000-0000-4000-8000-000000000003','2026-01-02',12,'{"testOnly":true}');

INSERT INTO pop_price_system_service.architecture_icon(provider,icon_key,release,name,kind,category,asset_path,source_path,sha256,source_url,package_sha256) VALUES
    ('AZURE','test.azure','test-v1','Synthetic Azure icon','SERVICE','compute','/architecture-icons/test/azure.svg','test/azure.svg',repeat('a',64),'https://example.invalid/test-only',repeat('b',64)),
    ('GCP','test.gcp','test-v1','Synthetic GCP icon','SERVICE','compute','/architecture-icons/test/gcp.svg','test/gcp.svg',repeat('c',64),'https://example.invalid/test-only',repeat('d',64));
INSERT INTO pop_price_system_service.architecture_component(id,provider,service_code,name,category,status,icon_key,icon_release,characteristics) VALUES
    ('40000000-0000-4000-8000-000000000001','GENERIC',NULL,'Synthetic generic component','application','ACTIVE',NULL,NULL,'[{"name":"Purpose","value":"Test only"}]'),
    ('40000000-0000-4000-8000-000000000002','AWS','AmazonEC2','Synthetic AWS component','Compute','ACTIVE','aws.ec2','2026-07-31','[]'),
    ('40000000-0000-4000-8000-000000000003','AZURE','test-compute','Synthetic Azure component','compute','ACTIVE','test.azure','test-v1','[]'),
    ('40000000-0000-4000-8000-000000000004','GCP','test-compute','Synthetic GCP component','compute','ACTIVE','test.gcp','test-v1','[]'),
    ('40000000-0000-4000-8000-000000000005','AWS',NULL,'Synthetic pending component','Compute','PENDING',NULL,NULL,'[]');
COMMIT;
