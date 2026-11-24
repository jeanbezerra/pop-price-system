package com.porto.ciops.coa.pop.price.system.service.integrations.aws;

import com.porto.ciops.coa.pop.price.system.service.provider.spi.ProviderCatalog.*;

import org.springframework.stereotype.Component;

import tools.jackson.core.JsonToken;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.io.InputStream;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/** Streams the official JSON file one product/term at a time, without retaining the catalog. */
@Component
public class AwsPriceFileParser {
    // Embedded product trees must not consume/check the following sibling as a trailing root value.
    private final JsonMapper mapper =
            JsonMapper.builder().disable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS).build();

    public void parse(InputStream input, Scope scope, Sink sink) {
        parse(input, scope, null, sink);
    }

    public void parse(InputStream input, Scope scope, String expectedVersion, Sink sink) {
        boolean products = false;
        boolean terms = false;
        boolean service = false;
        boolean version = false;
        long productCount = 0;
        long rateCount = 0;
        try (var parser = mapper.createParser(input)) {
            if (parser.nextToken() != JsonToken.START_OBJECT)
                throw new IllegalArgumentException("Invalid price file");
            while (parser.nextToken() != JsonToken.END_OBJECT) {
                String field = parser.currentName();
                parser.nextToken();
                if ("products".equals(field)) {
                    requireObject(parser.currentToken());
                    products = true;
                    while (parser.nextToken() != JsonToken.END_OBJECT) {
                        String sku = parser.currentName();
                        parser.nextToken();
                        Product product = product(mapper.readTree(parser));
                        if (!sku.equals(product.sku()))
                            throw new IllegalArgumentException("Mismatched SKU");
                        String region = product.attributes().get("regionCode");
                        if (region != null
                                && !region.isEmpty()
                                && !"global".equals(scope.regionCode())
                                && !scope.regionCode().equals(region))
                            throw new IllegalArgumentException("Mismatched region");
                        sink.product(product);
                        if (++productCount % 100 == 0) sink.heartbeat();
                    }
                } else if ("terms".equals(field)) {
                    requireObject(parser.currentToken());
                    while (parser.nextToken() != JsonToken.END_OBJECT) {
                        String modality = parser.currentName();
                        parser.nextToken();
                        if (!"OnDemand".equals(modality)) {
                            parser.skipChildren();
                            continue;
                        }
                        requireObject(parser.currentToken());
                        terms = true;
                        while (parser.nextToken() != JsonToken.END_OBJECT) {
                            String sku = parser.currentName();
                            parser.nextToken();
                            for (Rate rate : rates(sku, mapper.readTree(parser))) {
                                sink.rate(rate);
                                rateCount++;
                            }
                            sink.heartbeat();
                        }
                    }
                } else if ("offerCode".equals(field)) {
                    service = true;
                    if (!scope.serviceCode().equals(mapper.readTree(parser).asString()))
                        throw new IllegalArgumentException("Mismatched service code");
                } else if ("version".equals(field)) {
                    version = true;
                    String actual = mapper.readTree(parser).asString();
                    if (actual.isBlank()
                            || expectedVersion != null && !expectedVersion.equals(actual))
                        throw new IllegalArgumentException("Mismatched source version");
                } else parser.skipChildren();
            }
            if (parser.nextToken() != null)
                throw new IllegalArgumentException("Trailing price file content");
        }
        // Empty or malformed sources are never authoritative evidence that all active prices
        // disappeared.
        if (!products || !terms || !service || !version || productCount == 0 || rateCount == 0)
            throw new IllegalArgumentException("Incomplete or empty On-Demand USD price file");
    }

    private void requireObject(JsonToken token) {
        if (token != JsonToken.START_OBJECT)
            throw new IllegalArgumentException("Expected JSON object");
    }

    public Product product(JsonNode node) {
        var attributes = strings(node.path("attributes"));
        return new Product(
                required(node, "sku"),
                node.path("productFamily").asString("Uncategorized"),
                attributes,
                attributes.getOrDefault("usagetype", ""),
                attributes.getOrDefault("operation", ""));
    }

    public List<Rate> rates(String sku, JsonNode terms) {
        List<Rate> result = new ArrayList<>();
        for (var entry : terms.properties()) {
            JsonNode term = entry.getValue();
            if (!sku.equals(required(term, "sku")))
                throw new IllegalArgumentException("Mismatched term SKU");
            for (var dimension : term.path("priceDimensions").properties()) {
                JsonNode d = dimension.getValue();
                if (!d.path("pricePerUnit").has("USD")) continue;
                String end = required(d, "endRange");
                var rate =
                        new Rate(
                                sku,
                                required(term, "offerTermCode"),
                                "OnDemand",
                                strings(term.path("termAttributes")),
                                required(d, "rateCode"),
                                "USD",
                                required(d, "unit"),
                                d.path("description").asString(""),
                                new BigDecimal(required(d, "beginRange")),
                                "Inf".equals(end) ? null : new BigDecimal(end),
                                new BigDecimal(d.path("pricePerUnit").path("USD").asString()),
                                Instant.parse(required(term, "effectiveDate")),
                                d.path("appliesTo")
                                        .valueStream()
                                        .map(JsonNode::asString)
                                        .sorted()
                                        .toList());
                if (rate.unitPrice().signum() < 0
                        || rate.rangeBegin().signum() < 0
                        || rate.rangeEnd() != null
                                && rate.rangeEnd().compareTo(rate.rangeBegin()) <= 0)
                    throw new IllegalArgumentException("Invalid price range");
                result.add(rate);
            }
        }
        return result;
    }

    private String required(JsonNode node, String field) {
        String value = node.path(field).asString("");
        if (value.isBlank()) throw new IllegalArgumentException("Missing price field: " + field);
        return value;
    }

    private Map<String, String> strings(JsonNode node) {
        Map<String, String> result = new TreeMap<>();
        node.properties().forEach(e -> result.put(e.getKey(), e.getValue().asString()));
        return result;
    }
}
