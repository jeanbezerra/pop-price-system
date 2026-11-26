-- TEST ONLY. portal_local.py applies this exclusively to a newly created isolated database.
INSERT INTO pop_price_system_service.cloud_service(provider,code,name,attributes) VALUES('AWS','AmazonEC2','Amazon Elastic Compute Cloud','[]');
INSERT INTO pop_price_system_service.cloud_region(provider,code,name) VALUES('AWS','us-east-1','US East (N. Virginia)');
WITH product AS (
    INSERT INTO pop_price_system_service.cloud_product(provider,service_code,region_code,sku,family,attributes,usage_type,operation,content_hash)
    VALUES('AWS','AmazonEC2','us-east-1','PORTAL-TEST-SKU','Compute Instance','{}','BoxUsage','RunInstances','portal-test') RETURNING id
), term AS (
    INSERT INTO pop_price_system_service.price_term(product_id,term_code,modality,attributes) SELECT id,'test-term','OnDemand','{}' FROM product RETURNING id
), dimension AS (
    INSERT INTO pop_price_system_service.price_dimension(term_id,rate_code,currency,unit,description,range_begin,range_end,unit_price,effective_at,content_hash)
    SELECT id,'test-rate','USD','Hrs','Synthetic test fixture; never a production price',0,NULL,0.1,'2025-01-01T00:00:00Z','portal-test' FROM term RETURNING id
)
INSERT INTO pop_price_system_service.price_version(dimension_id,source_version,source_url,content_hash,snapshot,valid_from)
SELECT id,'portal-test','https://example.invalid/test-only','portal-test','{}',now() FROM dimension;
