package com.porto.ciops.coa.pop.price.system.service.provider.spi;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/** Provider-neutral discovery and streaming contract; no SDK types cross this boundary. */
public interface ProviderCatalog {
    String provider();

    List<Service> services();

    Service service(String code);

    List<String> regions(String serviceCode);

    Source latest(Scope scope);

    void stream(Scope scope, Source source, Sink sink);

    QueryPage query(String service, String region, String sku, String nextToken);

    record QueryPage(List<QueryProduct> items, String nextToken) {}

    record QueryProduct(Product product, List<Rate> rates) {}

    record Scope(String provider, String serviceCode, String regionCode) {}

    record Service(String code, String name, List<String> attributes) {}

    record Source(String version, String url, String reference) {}

    record Product(
            String sku,
            String family,
            Map<String, String> attributes,
            String usageType,
            String operation) {}

    record Rate(
            String sku,
            String termCode,
            String modality,
            Map<String, String> termAttributes,
            String rateCode,
            String currency,
            String unit,
            String description,
            BigDecimal rangeBegin,
            BigDecimal rangeEnd,
            BigDecimal unitPrice,
            Instant effectiveAt,
            List<String> appliesTo) {}

    interface Sink {
        void product(Product product);

        void rate(Rate rate);

        void heartbeat();
    }
}
