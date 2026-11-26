package com.porto.ciops.coa.pop.price.system.service.architecture.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import java.util.List;

public record ArchitectureModel(UUID id,String name,BigDecimal hoursPerMonth,ArchitectureGraph graph,
        String status,long revision,Instant createdAt,Instant updatedAt,Instant publishedAt,Instant archivedAt,StructureSpecification specification) {
    public record Summary(UUID id,String name,BigDecimal hoursPerMonth,String status,long revision,Instant updatedAt,Instant publishedAt,
            Instant createdAt,Instant archivedAt,List<String> clouds,int componentCount,BigDecimal predictedMonthlyCost,Long costRevision,StructureSpecification specification) {}
}
