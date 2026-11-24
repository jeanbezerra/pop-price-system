package com.porto.ciops.coa.pop.price.system.service.catalog.domain;

import tools.jackson.databind.JsonNode;

import java.math.BigDecimal;
import java.time.Instant;

/** Immutable catalog quotation, including the exact observed price version. */
public record CatalogRate(
        long id,
        long versionId,
        String provider,
        String serviceCode,
        String regionCode,
        String sku,
        String family,
        JsonNode attributes,
        String usageType,
        String operation,
        String modality,
        String termCode,
        String rateCode,
        String unit,
        String currency,
        BigDecimal unitPrice,
        BigDecimal rangeBegin,
        BigDecimal rangeEnd,
        Instant effectiveAt,
        String sourceVersion,
        String sourceUrl,
        boolean active,
        JsonNode appliesTo) {}
