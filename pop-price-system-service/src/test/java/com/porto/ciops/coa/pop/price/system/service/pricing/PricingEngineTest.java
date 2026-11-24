package com.porto.ciops.coa.pop.price.system.service.pricing;

import static org.assertj.core.api.Assertions.*;

import com.porto.ciops.coa.pop.price.system.service.catalog.domain.CatalogRate;
import com.porto.ciops.coa.pop.price.system.service.pricing.calculation.*;
import com.porto.ciops.coa.pop.price.system.service.pricing.domain.*;
import com.porto.ciops.coa.pop.price.system.service.pricing.domain.PricingInput.*;
import com.porto.ciops.coa.pop.price.system.service.shared.Json;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

class PricingEngineTest {
    private final PricingEngine engine = new PricingEngine();
    private final BigDecimal hours = new BigDecimal("720");

    private CatalogRate rate(long id, String begin, String end, String price, String unit) {
        return rate(id, begin, end, price, unit, "us-east-1", "BoxUsage", "Compute");
    }

    private CatalogRate rate(
            long id,
            String begin,
            String end,
            String price,
            String unit,
            String region,
            String usage,
            String family) {
        var json = new Json();
        return new CatalogRate(
                id,
                id,
                "AWS",
                "AmazonEC2",
                region,
                "fixture-sku",
                family,
                json.tree("{}"),
                usage,
                "",
                "OnDemand",
                "fixture-term",
                "fixture-rate-" + id,
                unit,
                "USD",
                new BigDecimal(price),
                new BigDecimal(begin),
                end == null ? null : new BigDecimal(end),
                Instant.parse("2026-01-01T00:00:00Z"),
                "fixture-version",
                "https://example.test",
                true,
                json.tree("[]"));
    }

    private Item item(Long rate, String amount, String unit, Period period) {
        return new Item(
                UUID.randomUUID(),
                "Component",
                "compute",
                "account-a",
                rate,
                BigDecimal.ONE,
                new BigDecimal(amount),
                unit,
                period,
                null,
                null);
    }

    private PricingResult calculate(List<Item> items, Map<Long, List<CatalogRate>> rates) {
        return engine.calculate(UUID.randomUUID(), 1, "Architecture", hours, items, rates);
    }

    @Test
    void calculatesHourlyMonthlyAndAnnualWithExplicitAssumptions() {
        var original = item(1L, "1", "Hrs", Period.HOUR);
        var doubled =
                new Item(
                        original.id(),
                        original.name(),
                        original.category(),
                        original.accountCode(),
                        1L,
                        new BigDecimal("2"),
                        original.consumption(),
                        original.consumptionUnit(),
                        original.period(),
                        null,
                        null);
        var result =
                calculate(
                        List.of(doubled),
                        Map.of(1L, List.of(rate(1, "0", null, "0.123456789", "Hrs"))));
        assertThat(result.complete()).isTrue();
        assertThat(result.monthlyCost()).isEqualByComparingTo("177.78");
        assertThat(result.annualCost()).isEqualByComparingTo("2133.33");
        assertThat(
                        result.items()
                                .getFirst()
                                .charges()
                                .getFirst()
                                .prices()
                                .getFirst()
                                .price()
                                .versionId())
                .isEqualTo(1);
    }

    @Test
    void aggregatesProgressiveTiersAcrossItemsInTheSameAccount() {
        var tiers = List.of(rate(1, "0", "100", "1", "GB"), rate(2, "100", null, "0.5", "GB"));
        var result =
                calculate(
                        List.of(
                                item(1L, "100", "GB", Period.MONTH),
                                item(2L, "100", "GB", Period.MONTH)),
                        Map.of(1L, tiers, 2L, tiers));
        assertThat(result.monthlyCost()).isEqualByComparingTo("150.00");
        assertThat(result.items())
                .allSatisfy(i -> assertThat(i.monthlyCost()).isEqualByComparingTo("75.00"));
    }

    @Test
    void doesNotRoundUnitPricesBeforeMultiplication() {
        var result =
                calculate(
                        List.of(item(1L, "1000000", "Requests", Period.MONTH)),
                        Map.of(1L, List.of(rate(1, "0", null, "0.000000123456", "Requests"))));
        assertThat(result.monthlyCost()).isEqualByComparingTo("0.12");
        assertThat(result.annualCost()).isEqualByComparingTo("1.48");
    }

    @Test
    void usesHalfEvenOnlyForDisplayedMoney() {
        var result =
                calculate(
                        List.of(item(1L, "1", "Requests", Period.MONTH)),
                        Map.of(1L, List.of(rate(1, "0", null, "0.005", "Requests"))));
        assertThat(result.monthlyCost()).isEqualByComparingTo("0.00");
        assertThat(result.annualCost()).isEqualByComparingTo("0.06");
    }

    @Test
    void calculatesSteadyStateRetentionFromDailyIngest() {
        var base = item(1L, "10", "GB", Period.DAY);
        var retained =
                new Item(
                        base.id(),
                        base.name(),
                        "storage",
                        base.accountCode(),
                        base.rateId(),
                        base.quantity(),
                        base.consumption(),
                        base.consumptionUnit(),
                        base.period(),
                        30,
                        null);
        var result =
                calculate(
                        List.of(retained),
                        Map.of(1L, List.of(rate(1, "0", null, "0.023", "GB-Mo"))));
        assertThat(result.monthlyCost()).isEqualByComparingTo("6.90");
    }

    @Test
    void convertsKnownUnitsAndRejectsUnknownUnits() {
        var converter = new UnitConverter();
        assertThat(converter.convert(BigDecimal.ONE, "TiB", "GiB", hours))
                .isEqualByComparingTo("1024");
        assertThat(converter.convert(BigDecimal.ONE, "TB", "GB", hours))
                .isEqualByComparingTo("1000");
        assertThat(converter.convert(BigDecimal.ONE, "GB-Mo", "GB-Hrs", hours))
                .isEqualByComparingTo(hours);
        assertThat(converter.convert(new BigDecimal("1000000"), "Requests", "1M Requests", hours))
                .isEqualByComparingTo("1");
        assertThatThrownBy(() -> converter.convert(BigDecimal.ONE, "GB", "Hrs", hours))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void refusesMissingPriceAndDoesNotPresentPartialSubtotalAsTotal() {
        var result =
                calculate(
                        List.of(
                                item(null, "1", "GB", Period.MONTH),
                                item(1L, "10", "GB", Period.MONTH)),
                        Map.of(1L, List.of(rate(1, "0", null, "0.1", "GB"))));
        assertThat(result.complete()).isFalse();
        assertThat(result.monthlyCost()).isNull();
        assertThat(result.knownMonthlySubtotal()).isEqualByComparingTo("1.00");
        assertThat(result.warnings()).hasSize(1);
    }

    @Test
    void rejectsGapsOverlapsAndUncoveredConsumption() {
        var pricing = new ProgressivePricing();
        assertThatThrownBy(
                        () ->
                                pricing.calculate(
                                        new BigDecimal("20"),
                                        List.of(rate(1, "0", "10", "1", "GB"))))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(
                        () ->
                                pricing.calculate(
                                        new BigDecimal("20"),
                                        List.of(
                                                rate(1, "0", "10", "1", "GB"),
                                                rate(2, "11", null, "1", "GB"))))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(
                        () ->
                                pricing.calculate(
                                        new BigDecimal("20"),
                                        List.of(
                                                rate(1, "0", "10", "1", "GB"),
                                                rate(2, "9", null, "1", "GB"))))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void bracketBoundaryIsNotBilledTwice() {
        var quote =
                new ProgressivePricing()
                        .calculate(
                                new BigDecimal("100"),
                                List.of(
                                        rate(1, "0", "100", "1", "GB"),
                                        rate(2, "100", null, "10", "GB")));
        assertThat(quote.cost()).isEqualByComparingTo("100");
        assertThat(quote.tiers().get(1).billedConsumption()).isZero();
    }

    private Flow flow(String destinationRegion, List<Charge> charges) {
        return new Flow(
                "traffic-1",
                "AmazonEC2",
                "AmazonEC2",
                "account-a",
                "account-b",
                "us-east-1",
                destinationRegion,
                "use1-az1",
                "use1-az1",
                Direction.INTERNAL,
                Connectivity.DIRECT,
                charges,
                List.of());
    }

    private Item transfer(Flow flow) {
        return new Item(
                UUID.randomUUID(),
                "Traffic",
                "network",
                "account-a",
                null,
                BigDecimal.ONE,
                new BigDecimal("10"),
                "GB",
                Period.MONTH,
                null,
                flow);
    }

    @Test
    void doesNotAddASurchargeForDifferentAccountsInTheSameAz() {
        var result = calculate(List.of(transfer(flow("us-east-1", List.of()))), Map.of());
        assertThat(result.complete()).isTrue();
        assertThat(result.monthlyCost()).isZero();
    }

    @Test
    void missingInterRegionTariffIsUnpriceable() {
        var result = calculate(List.of(transfer(flow("us-west-2", List.of()))), Map.of());
        assertThat(result.complete()).isFalse();
        assertThat(result.monthlyCost()).isNull();
        assertThat(result.warnings().getFirst()).contains("INTER_REGION_OUT");
    }

    @Test
    void billsExplicitInterRegionTariffsOncePerDirection() {
        var f =
                flow(
                        "us-west-2",
                        List.of(
                                new Charge(ChargeKey.INTER_REGION_OUT, 1),
                                new Charge(ChargeKey.INTER_REGION_IN, 2)));
        var result =
                calculate(
                        List.of(transfer(f)),
                        Map.of(
                                1L,
                                        List.of(
                                                rate(
                                                        1,
                                                        "0",
                                                        null,
                                                        "0.02",
                                                        "GB",
                                                        "us-east-1",
                                                        "DataTransfer-Out-Bytes",
                                                        "Data Transfer")),
                                2L,
                                        List.of(
                                                rate(
                                                        2,
                                                        "0",
                                                        null,
                                                        "0.01",
                                                        "GB",
                                                        "us-west-2",
                                                        "DataTransfer-In-Bytes",
                                                        "Data Transfer"))));
        assertThat(result.complete()).isTrue();
        assertThat(result.monthlyCost()).isEqualByComparingTo("0.30");
        assertThat(result.networkMonthlySubtotal()).isEqualByComparingTo("0.30");
    }

    @Test
    void rejectsDuplicateTrafficCharges() {
        var f =
                flow(
                        "us-west-2",
                        List.of(
                                new Charge(ChargeKey.INTER_REGION_OUT, 1),
                                new Charge(ChargeKey.INTER_REGION_OUT, 1)));
        var result =
                calculate(List.of(transfer(f)), Map.of(1L, List.of(rate(1, "0", null, "1", "GB"))));
        assertThat(result.complete()).isFalse();
        assertThat(result.warnings().getFirst()).contains("Duplicate");
    }

    @Test
    void unknownUnitProducesAWarningInsteadOfZero() {
        var result =
                calculate(
                        List.of(item(1L, "1", "Unknown", Period.MONTH)),
                        Map.of(1L, List.of(rate(1, "0", null, "1", "GB"))));
        assertThat(result.complete()).isFalse();
        assertThat(result.items().getFirst().monthlyCost()).isNull();
    }

    @Test
    void retentionSupportsTheOfficialGbHoursAlias() {
        var base = item(1L, "10", "GB", Period.DAY);
        var retained =
                new Item(
                        base.id(),
                        base.name(),
                        "storage",
                        base.accountCode(),
                        base.rateId(),
                        base.quantity(),
                        base.consumption(),
                        base.consumptionUnit(),
                        base.period(),
                        30,
                        null);
        var result =
                calculate(
                        List.of(retained),
                        Map.of(1L, List.of(rate(1, "0", null, "0.001", "GB-Hours"))));
        assertThat(result.monthlyCost()).isEqualByComparingTo("216.00");
    }

    @Test
    void allowsOneRegionalTariffForTwoDistinctBillingEndpoints() {
        var f =
                new Flow(
                        "az-transfer",
                        "AmazonEC2",
                        "AmazonEC2",
                        "account-a",
                        "account-b",
                        "us-east-1",
                        "us-east-1",
                        "use1-az1",
                        "use1-az2",
                        Direction.INTERNAL,
                        Connectivity.DIRECT,
                        List.of(
                                new Charge(ChargeKey.INTER_AZ_OUT, 1),
                                new Charge(ChargeKey.INTER_AZ_IN, 1)),
                        List.of());
        var result =
                calculate(
                        List.of(transfer(f)),
                        Map.of(
                                1L,
                                List.of(
                                        rate(
                                                1,
                                                "0",
                                                null,
                                                "0.01",
                                                "GB",
                                                "us-east-1",
                                                "DataTransfer-Regional-Bytes",
                                                "Data Transfer"))));
        assertThat(result.complete()).isTrue();
        assertThat(result.monthlyCost()).isEqualByComparingTo("0.20");
        assertThat(result.byAccount().get("account-a")).isEqualByComparingTo("0.10");
        assertThat(result.byAccount().get("account-b")).isEqualByComparingTo("0.10");
    }

    @Test
    void snapshotCanBeSerializedAndReadWithoutLosingDecimals() {
        var result =
                calculate(
                        List.of(item(1L, "12", "GB", Period.YEAR)),
                        Map.of(1L, List.of(rate(1, "0", null, "0.123456789123", "GB"))));
        var json = new Json();
        var restored = json.read(json.write(result), PricingResult.class);
        assertThat(restored).isEqualTo(result);
    }
}
