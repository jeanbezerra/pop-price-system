package com.porto.ciops.coa.pop.price.system.service.estimation.domain;

import com.porto.ciops.coa.pop.price.system.service.pricing.domain.PricingInput.Item;
import com.porto.ciops.coa.pop.price.system.service.pricing.domain.PricingResult;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Architecture composition plus its last immutable calculation, which may refer to an older
 * revision.
 */
public record Estimate(
        UUID id,
        String name,
        BigDecimal hoursPerMonth,
        String currency,
        long revision,
        Instant createdAt,
        Instant updatedAt,
        List<Item> items,
        PricingResult lastCalculation) {}
