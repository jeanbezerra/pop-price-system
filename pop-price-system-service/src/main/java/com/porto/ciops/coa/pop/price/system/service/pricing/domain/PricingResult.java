package com.porto.ciops.coa.pop.price.system.service.pricing.domain;

import com.porto.ciops.coa.pop.price.system.service.pricing.calculation.ProgressivePricing.TierCost;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Immutable calculation snapshot. Consolidated totals are null when any component is unpriceable.
 */
public record PricingResult(
        UUID calculationId,
        UUID estimateId,
        long revision,
        String name,
        Instant calculatedAt,
        String currency,
        BigDecimal hoursPerMonth,
        String unitConvention,
        boolean complete,
        BigDecimal hourlyCost,
        BigDecimal monthlyCost,
        BigDecimal annualCost,
        BigDecimal knownMonthlySubtotal,
        BigDecimal networkMonthlySubtotal,
        List<Line> items,
        Map<String, BigDecimal> byService,
        Map<String, BigDecimal> byRegion,
        Map<String, BigDecimal> byAccount,
        Map<String, BigDecimal> byCategory,
        List<String> warnings) {
    public record Line(
            PricingInput.Item component,
            String status,
            BigDecimal monthlyCost,
            BigDecimal annualCost,
            List<Charge> charges,
            String warning) {}

    public record Charge(
            String key,
            BigDecimal monthlyBilledConsumption,
            String unit,
            BigDecimal allocatedMonthlyCost,
            BigDecimal aggregationGroupConsumption,
            List<TierCost> prices) {}
}
