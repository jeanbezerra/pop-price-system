package com.porto.ciops.coa.pop.price.system.service.architecture.domain;

import java.util.Set;

/** Filters and stable ordering applied before pagination. */
public record StructureSearch(String status, String lifecycle, String q, String provider, String category,
                              String environment, String sort, String direction, int size, int offset) {
    public static final Set<String> SORTS = Set.of("provider","name","category","environment","status","region","componentCount","predictedMonthlyCost","createdAt","updatedAt");
    public StructureSearch {
        status = status == null ? "" : status;
        q = q == null ? "" : q.trim();
        provider = provider == null ? "" : provider;
        category = category == null ? "" : category;
        environment = environment == null ? "" : environment;
    }
    public void validate() {
        if (!Set.of("","DRAFT","PUBLISHED").contains(status) || !Set.of("ACTIVE","ARCHIVED","ALL").contains(lifecycle)
                || !Set.of("","AWS","AZURE","GCP","GENERIC").contains(provider)
                || !Set.of("","APPLICATION","PLATFORM","DATA","NETWORK","SECURITY","OTHER").contains(category)
                || !Set.of("","DEVELOPMENT","TEST","HOMOLOGATION","PRODUCTION").contains(environment)
                || q.length() > 200 || !SORTS.contains(sort) || !Set.of("ASC","DESC").contains(direction)
                || size < 1 || size > 100 || offset < 0)
            throw new IllegalArgumentException("Filtros, ordenação ou paginação inválidos.");
    }
}
