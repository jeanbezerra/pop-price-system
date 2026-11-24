package com.porto.ciops.coa.pop.price.system.service.commercial.domain;

import java.math.BigDecimal;
import java.time.*;
import java.util.UUID;

/** Commercial registration pinned to a valuation; new quotes cannot reprice it. */
public record CustomerContract(UUID id, String reference, String name, String customerName,
        UUID valuationId, UUID estimateId, LocalDate startsOn, int months,
        BigDecimal monthlyUsd, BigDecimal monthlyBrl, BigDecimal totalBrl,
        Valuation valuation, Instant createdAt) {}
