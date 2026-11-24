package com.porto.ciops.coa.pop.price.system.service.pricing.calculation;

import com.porto.ciops.coa.pop.price.system.service.catalog.domain.CatalogRate;
import com.porto.ciops.coa.pop.price.system.service.pricing.domain.PricingInput.*;

import java.util.*;

/** Explicit tariff selection by path and direction. Account boundaries alone never add a charge. */
public final class NetworkPricingPolicy {
    public Set<ChargeKey> required(Flow flow) {
        if (!flow.intermediaries().isEmpty())
            throw new IllegalArgumentException(
                    "Chained intermediary service tariffs are not implemented");
        Set<ChargeKey> required = EnumSet.noneOf(ChargeKey.class);
        switch (flow.direction()) {
            case INTERNET_IN -> required.add(ChargeKey.DATA_IN);
            case INTERNET_OUT -> required.add(ChargeKey.DATA_OUT);
            case INTERNAL -> {
                if (!flow.sourceRegion().equals(flow.destinationRegion())) {
                    required.add(ChargeKey.INTER_REGION_OUT);
                    required.add(ChargeKey.INTER_REGION_IN);
                } else {
                    if (flow.sourceAz() == null
                            || flow.destinationAz() == null
                            || !flow.sourceAz().matches("[a-z0-9]+-az[0-9]+")
                            || !flow.destinationAz().matches("[a-z0-9]+-az[0-9]+"))
                        throw new IllegalArgumentException(
                                "Physical AZ IDs (for example use1-az1) are required for"
                                        + " same-region flows");
                    if (!flow.sourceAz().equals(flow.destinationAz())) {
                        required.add(ChargeKey.INTER_AZ_OUT);
                        required.add(ChargeKey.INTER_AZ_IN);
                    } else if (!flow.sourceService().equals("AmazonEC2")
                            || !flow.destinationService().equals("AmazonEC2")) {
                        throw new IllegalArgumentException(
                                "Same-AZ service-specific transfer exemption is not implemented");
                    }
                }
            }
        }
        switch (flow.connectivity()) {
            case NAT_GATEWAY -> required.add(ChargeKey.NAT_PROCESSING);
            case TRANSIT_GATEWAY -> required.add(ChargeKey.TRANSIT_PROCESSING);
            case VPC_ENDPOINT -> required.add(ChargeKey.ENDPOINT_PROCESSING);
            case PRIVATELINK -> required.add(ChargeKey.PRIVATELINK_PROCESSING);
            case DIRECT_CONNECT -> required.add(ChargeKey.DIRECT_CONNECT_OUT);
            case DIRECT -> {}
        }
        Set<ChargeKey> supplied = EnumSet.noneOf(ChargeKey.class);
        for (var charge : flow.charges()) {
            if (!supplied.add(charge.key()))
                throw new IllegalArgumentException("Duplicate traffic charge");
        }
        if (!supplied.equals(required))
            throw new IllegalArgumentException(
                    "Select exactly the tariffs required for this path: " + required);
        return required;
    }

    public void validateTariff(Flow flow, ChargeKey key, CatalogRate rate) {
        if (!"AWS".equals(rate.provider()))
            throw new IllegalArgumentException("Network policy only supports AWS");
        String usage = (rate.usageType() + " " + rate.family()).toLowerCase(Locale.ROOT);
        boolean compatible =
                switch (key) {
                    case NAT_PROCESSING -> usage.contains("natgateway") && usage.contains("byte");
                    case TRANSIT_PROCESSING ->
                            usage.contains("transitgateway") && usage.contains("byte");
                    case ENDPOINT_PROCESSING, PRIVATELINK_PROCESSING ->
                            usage.contains("vpcendpoint") && usage.contains("byte");
                    case DIRECT_CONNECT_OUT ->
                            usage.contains("dx") || usage.contains("directconnect");
                    case DATA_IN, INTER_REGION_IN, INTER_AZ_IN ->
                            usage.contains("in-byte")
                                    || usage.contains("inbound")
                                    || usage.contains("regional-byte");
                    case DATA_OUT, INTER_REGION_OUT, INTER_AZ_OUT ->
                            usage.contains("out-byte")
                                    || usage.contains("outbound")
                                    || usage.contains("regional-byte");
                };
        if (!compatible)
            throw new IllegalArgumentException(
                    "Selected tariff does not match traffic charge " + key);
        boolean incoming =
                key == ChargeKey.DATA_IN
                        || key == ChargeKey.INTER_REGION_IN
                        || key == ChargeKey.INTER_AZ_IN;
        String region = incoming ? flow.destinationRegion() : flow.sourceRegion();
        if (!rate.regionCode().equals(region) && !rate.regionCode().equals("global"))
            throw new IllegalArgumentException("Tariff commercial region does not match flow");
        String from = rate.attributes().path("fromRegionCode").asString("");
        String to = rate.attributes().path("toRegionCode").asString("");
        if (!from.isEmpty() && !from.equals(flow.sourceRegion())
                || !to.isEmpty() && !to.equals(flow.destinationRegion()))
            throw new IllegalArgumentException("Tariff route does not match flow");
    }
}
