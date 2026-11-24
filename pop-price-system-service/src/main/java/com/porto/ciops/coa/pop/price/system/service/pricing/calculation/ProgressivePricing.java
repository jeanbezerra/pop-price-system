package com.porto.ciops.coa.pop.price.system.service.pricing.calculation;

import com.porto.ciops.coa.pop.price.system.service.catalog.domain.CatalogRate;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/** Progressive brackets use [begin,end), and unbounded upper limits are represented by null. */
public final class ProgressivePricing {
    public Quote calculate(BigDecimal consumption, List<CatalogRate> source) {
        if (consumption.signum() < 0 || source.isEmpty())
            throw new IllegalArgumentException("Price or consumption unavailable");
        var tiers = source.stream().sorted(Comparator.comparing(CatalogRate::rangeBegin)).toList();
        BigDecimal expected = BigDecimal.ZERO;
        BigDecimal total = BigDecimal.ZERO;
        List<TierCost> breakdown = new ArrayList<>();
        String unit = tiers.getFirst().unit();
        for (var rate : tiers) {
            if (!rate.active()
                    || !"USD".equals(rate.currency())
                    || !"OnDemand".equals(rate.modality())
                    || !rate.appliesTo().isEmpty()
                    || !unit.equals(rate.unit())
                    || rate.unitPrice().signum() < 0
                    || expected == null
                    || expected.compareTo(rate.rangeBegin()) != 0
                    || rate.rangeEnd() != null && rate.rangeEnd().compareTo(rate.rangeBegin()) <= 0)
                throw new IllegalArgumentException(
                        "Inactive, conditional, overlapping or incomplete price tiers");
            BigDecimal upper =
                    rate.rangeEnd() == null ? consumption : consumption.min(rate.rangeEnd());
            BigDecimal used = upper.subtract(rate.rangeBegin()).max(BigDecimal.ZERO);
            BigDecimal cost = used.multiply(rate.unitPrice());
            breakdown.add(new TierCost(rate, used, cost));
            total = total.add(cost);
            expected = rate.rangeEnd();
        }
        if (expected != null && consumption.compareTo(expected) > 0)
            throw new IllegalArgumentException("Consumption exceeds known price ranges");
        return new Quote(total, List.copyOf(breakdown));
    }

    public record Quote(BigDecimal cost, List<TierCost> tiers) {}

    public record TierCost(CatalogRate price, BigDecimal billedConsumption, BigDecimal cost) {}
}
