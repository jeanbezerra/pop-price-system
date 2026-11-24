package com.porto.ciops.coa.pop.price.system.service.catalog.domain;

import tools.jackson.databind.JsonNode;

import java.time.Instant;

/** Read contracts independent of JDBC row representations. */
public final class CatalogViews {
    private CatalogViews() {}

    public record Provider(String code, String name) {}

    public record Region(String provider, String code, String name) {}

    public record Service(String provider, String code, String name, JsonNode attributes, Instant lastSynchronizedAt) {}

    public record Product(
            long id,
            String provider,
            String serviceCode,
            String regionCode,
            String sku,
            String family,
            JsonNode attributes,
            String usageType,
            String operation,
            boolean active) {}

    public record Version(
            long id,
            String sourceVersion,
            String sourceUrl,
            JsonNode snapshot,
            Instant validFrom,
            Instant validTo) {}

    public record Change(
            long id, String synchronizationId, long rateId, String type, Instant changedAt) {}
}
