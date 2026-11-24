package com.porto.ciops.coa.pop.price.system.service.pricing.calculation;

import com.porto.ciops.coa.pop.price.system.service.catalog.domain.CatalogRate;
import com.porto.ciops.coa.pop.price.system.service.pricing.domain.*;
import com.porto.ciops.coa.pop.price.system.service.pricing.domain.PricingInput.*;

import java.math.*;
import java.time.Instant;
import java.util.*;

/** Pure financial calculation. Provider I/O and persistence belong to application services. */
public final class PricingEngine {
    private static final MathContext MC = MathContext.DECIMAL128;
    private static final BigDecimal TWELVE = new BigDecimal("12");
    private final UnitConverter units = new UnitConverter();
    private final ProgressivePricing progressive = new ProgressivePricing();
    private final NetworkPricingPolicy network = new NetworkPricingPolicy();

    public PricingResult calculate(
            UUID estimateId,
            long revision,
            String name,
            BigDecimal hours,
            List<Item> items,
            Map<Long, List<CatalogRate>> prices) {
        if (hours.signum() <= 0 || hours.compareTo(new BigDecimal("744")) > 0)
            throw new IllegalArgumentException("Invalid monthly hours");
        Map<UUID, String> errors = new HashMap<>();
        Map<String, List<Candidate>> groups = new LinkedHashMap<>();
        Set<String> trafficKeys = new HashSet<>();
        for (var item : items) {
            try {
                if (item.quantity().signum() <= 0 || item.consumption().signum() < 0)
                    throw new IllegalArgumentException("Invalid consumption");
                List<Candidate> candidates = new ArrayList<>();
                if (item.flow() != null) {
                    units.convert(item.consumption(), item.consumptionUnit(), "GB", hours);
                    if (item.rateId() != null || item.retentionDays() != null)
                        throw new IllegalArgumentException(
                                "A flow cannot also use a resource tariff or retention");
                    if (!trafficKeys.add(item.flow().trafficKey()))
                        throw new IllegalArgumentException("Traffic already accounted for");
                    network.required(item.flow());
                    for (var charge : item.flow().charges()) {
                        var tiers = lookup(prices, charge.rateId());
                        network.validateTariff(item.flow(), charge.key(), tiers.getFirst());
                        candidates.add(candidate(item, charge.key().name(), tiers, hours));
                    }
                } else {
                    if (item.rateId() == null)
                        throw new IllegalArgumentException("No catalog price selected");
                    candidates.add(
                            candidate(item, "RESOURCE", lookup(prices, item.rateId()), hours));
                }
                for (var candidate : candidates)
                    groups.computeIfAbsent(candidate.group(), ignored -> new ArrayList<>())
                            .add(candidate);
            } catch (IllegalArgumentException ex) {
                errors.put(item.id(), ex.getMessage());
            }
        }
        // Validate each aggregated bucket before allocation, so an unsupported range cannot yield a
        // partial item total.
        for (var group : groups.values()) {
            try {
                progressive.calculate(sumUsage(group), group.getFirst().tiers());
            } catch (IllegalArgumentException ex) {
                group.forEach(c -> errors.put(c.item().id(), ex.getMessage()));
            }
        }
        Map<UUID, List<PricingResult.Charge>> charges = new HashMap<>();
        Map<String, BigDecimal> byService = new TreeMap<>(),
                byRegion = new TreeMap<>(),
                byAccount = new TreeMap<>(),
                byCategory = new TreeMap<>();
        for (var original : groups.values()) {
            var group = original.stream().filter(c -> !errors.containsKey(c.item().id())).toList();
            if (group.isEmpty()) continue;
            BigDecimal usage = sumUsage(group);
            var quote = progressive.calculate(usage, group.getFirst().tiers());
            BigDecimal remaining = quote.cost();
            for (int i = 0; i < group.size(); i++) {
                var candidate = group.get(i);
                BigDecimal allocated =
                        i == group.size() - 1
                                ? remaining
                                : usage.signum() == 0
                                        ? BigDecimal.ZERO
                                        : quote.cost()
                                                .multiply(candidate.usage(), MC)
                                                .divide(usage, MC);
                remaining = remaining.subtract(allocated);
                charges.computeIfAbsent(candidate.item().id(), ignored -> new ArrayList<>())
                        .add(
                                new PricingResult.Charge(
                                        candidate.key(),
                                        candidate.usage(),
                                        candidate.tiers().getFirst().unit(),
                                        allocated,
                                        usage,
                                        quote.tiers()));
                var rate = candidate.tiers().getFirst();
                byService.merge(rate.serviceCode(), allocated, BigDecimal::add);
                byRegion.merge(rate.regionCode(), allocated, BigDecimal::add);
                byAccount.merge(candidate.billingAccount(), allocated, BigDecimal::add);
                byCategory.merge(candidate.item().category(), allocated, BigDecimal::add);
            }
        }
        List<PricingResult.Line> lines = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        BigDecimal subtotal = BigDecimal.ZERO, networkTotal = BigDecimal.ZERO;
        for (var item : items) {
            if (errors.containsKey(item.id())) {
                String warning = item.name() + ": " + errors.get(item.id());
                warnings.add(warning);
                lines.add(
                        new PricingResult.Line(
                                item, "UNPRICEABLE", null, null, List.of(), warning));
            } else {
                var allocated = charges.getOrDefault(item.id(), List.of());
                BigDecimal cost =
                        allocated.stream()
                                .map(PricingResult.Charge::allocatedMonthlyCost)
                                .reduce(BigDecimal.ZERO, BigDecimal::add);
                subtotal = subtotal.add(cost);
                if (item.flow() != null) networkTotal = networkTotal.add(cost);
                lines.add(
                        new PricingResult.Line(
                                item,
                                "PRICED",
                                money(cost),
                                money(cost.multiply(TWELVE)),
                                List.copyOf(allocated),
                                null));
            }
        }
        if (items.isEmpty()) warnings.add("No components selected");
        boolean complete = warnings.isEmpty();
        return new PricingResult(
                UUID.randomUUID(),
                estimateId,
                revision,
                name,
                Instant.now(),
                "USD",
                hours,
                "SI: GB=10^9 bytes; IEC: GiB=2^30 bytes; annual=12 modeled months; retention=steady"
                        + " state",
                complete,
                complete ? money(subtotal.divide(hours, MC)) : null,
                complete ? money(subtotal) : null,
                complete ? money(subtotal.multiply(TWELVE)) : null,
                money(subtotal),
                money(networkTotal),
                List.copyOf(lines),
                rounded(byService),
                rounded(byRegion),
                rounded(byAccount),
                rounded(byCategory),
                List.copyOf(warnings));
    }

    private Candidate candidate(Item item, String key, List<CatalogRate> tiers, BigDecimal hours) {
        BigDecimal monthly;
        String target = tiers.getFirst().unit();
        if (item.retentionDays() != null) {
            if (item.retentionDays() < 1 || item.period() != Period.DAY || !units.storage(target))
                throw new IllegalArgumentException(
                        "Retention requires daily ingest and a storage tariff");
            monthly =
                    units.convert(
                                    item.consumption(),
                                    item.consumptionUnit(),
                                    units.storageVolume(target),
                                    hours)
                            .multiply(BigDecimal.valueOf(item.retentionDays()));
            if (units.hourlyStorage(target)) monthly = monthly.multiply(hours);
        } else {
            BigDecimal factor =
                    switch (item.period()) {
                        case HOUR -> hours;
                        case DAY -> hours.divide(new BigDecimal("24"), MC);
                        case MONTH -> BigDecimal.ONE;
                        case YEAR -> BigDecimal.ONE.divide(TWELVE, MC);
                    };
            monthly =
                    units.convert(item.consumption(), item.consumptionUnit(), target, hours)
                            .multiply(factor, MC);
        }
        monthly = monthly.multiply(item.quantity(), MC);
        // Sharing a bucket prevents duplicated first-tier allowances across components in the same
        // account.
        long firstId = tiers.stream().mapToLong(CatalogRate::id).min().orElseThrow();
        String billingAccount = item.accountCode();
        if (item.flow() != null
                && (key.equals("DATA_IN")
                        || key.equals("INTER_REGION_IN")
                        || key.equals("INTER_AZ_IN")))
            billingAccount = item.flow().destinationAccount();
        return new Candidate(
                item, key, monthly, tiers, billingAccount + "/" + firstId, billingAccount);
    }

    private List<CatalogRate> lookup(Map<Long, List<CatalogRate>> prices, long id) {
        var result = prices.getOrDefault(id, List.of());
        if (result.isEmpty() || result.stream().noneMatch(r -> r.id() == id))
            throw new IllegalArgumentException("Selected price is unavailable");
        return result;
    }

    private BigDecimal sumUsage(List<Candidate> group) {
        return group.stream().map(Candidate::usage).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static BigDecimal money(BigDecimal amount) {
        return amount.setScale(2, RoundingMode.HALF_EVEN);
    }

    private Map<String, BigDecimal> rounded(Map<String, BigDecimal> source) {
        Map<String, BigDecimal> result = new TreeMap<>();
        source.forEach((k, v) -> result.put(k, money(v)));
        return Collections.unmodifiableMap(result);
    }

    private record Candidate(
            Item item,
            String key,
            BigDecimal usage,
            List<CatalogRate> tiers,
            String group,
            String billingAccount) {}
}
