package com.porto.ciops.coa.pop.price.system.service.catalog.domain;

/** Optional exact-match filters; attributes are a JSON object matched by JSONB containment. */
public record CatalogFilter(
        String provider,
        String service,
        String region,
        String category,
        String sku,
        String modality,
        String attributes,
        boolean active) {}
