package com.porto.ciops.coa.pop.price.system.service.pricing.domain;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** Consumption is distinct from provider prices; all quantities are explicit. */
public final class PricingInput {
    private PricingInput() {}

    public enum Period {
        HOUR,
        DAY,
        MONTH,
        YEAR
    }

    public enum Direction {
        INTERNET_IN,
        INTERNET_OUT,
        INTERNAL
    }

    public enum Connectivity {
        DIRECT,
        NAT_GATEWAY,
        TRANSIT_GATEWAY,
        VPC_ENDPOINT,
        PRIVATELINK,
        DIRECT_CONNECT
    }

    public enum ChargeKey {
        DATA_IN,
        DATA_OUT,
        INTER_REGION_IN,
        INTER_REGION_OUT,
        INTER_AZ_IN,
        INTER_AZ_OUT,
        NAT_PROCESSING,
        TRANSIT_PROCESSING,
        ENDPOINT_PROCESSING,
        PRIVATELINK_PROCESSING,
        DIRECT_CONNECT_OUT
    }

    public record Item(
            UUID id,
            String name,
            String category,
            String accountCode,
            Long rateId,
            BigDecimal quantity,
            BigDecimal consumption,
            String consumptionUnit,
            Period period,
            Integer retentionDays,
            Flow flow) {}

    public record Flow(
            String trafficKey,
            String sourceService,
            String destinationService,
            String sourceAccount,
            String destinationAccount,
            String sourceRegion,
            String destinationRegion,
            String sourceAz,
            String destinationAz,
            Direction direction,
            Connectivity connectivity,
            List<Charge> charges,
            List<Hop> intermediaries) {}

    public record Hop(String serviceCode, String accountCode, String regionCode) {}

    public record Charge(ChargeKey key, long rateId) {}
}
