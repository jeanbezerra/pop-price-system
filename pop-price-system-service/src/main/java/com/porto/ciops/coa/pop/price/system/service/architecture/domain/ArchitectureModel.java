package com.porto.ciops.coa.pop.price.system.service.architecture.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record ArchitectureModel(UUID id,String name,BigDecimal hoursPerMonth,ArchitectureGraph graph,
        String status,long revision,Instant createdAt,Instant updatedAt,Instant publishedAt) {
    public record Summary(UUID id,String name,BigDecimal hoursPerMonth,String status,long revision,Instant updatedAt,Instant publishedAt) {}
}
