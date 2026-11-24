package com.porto.ciops.coa.pop.price.system.service.integrations.aws;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.porto.ciops.coa.pop.price.system.service.provider.spi.ProviderCatalog.*;
import com.porto.ciops.coa.pop.price.system.service.shared.Json;

import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;

class AwsPriceFileParserTest {
    private final AwsPriceFileParser parser = new AwsPriceFileParser();
    private final Scope scope = new Scope("AWS", "AmazonEC2", "us-east-1");
    private final String fixture =
            """
            {"formatVersion":"v1.0","offerCode":"AmazonEC2","version":"fixture-1",
             "products":{"fixture-sku":{"sku":"fixture-sku","productFamily":"Compute",
                 "attributes":{"regionCode":"us-east-1","usagetype":"BoxUsage","operation":"RunInstances"}}},
             "terms":{"OnDemand":{"fixture-sku":{"fixture-term":{"sku":"fixture-sku","offerTermCode":"fixture-term",
                 "effectiveDate":"2026-01-01T00:00:00Z","termAttributes":{},"priceDimensions":{
                 "fixture-rate":{"rateCode":"fixture-rate","unit":"Hrs","description":"Test fixture only",
                 "beginRange":"0","endRange":"Inf","pricePerUnit":{"USD":"0.123456789123"},"appliesTo":[]}}}}}}}
            """;

    @Test
    void streamsProductsAndUsdOnDemandRates() {
        var sink = mock(Sink.class);
        parse(fixture, sink);
        verify(sink)
                .product(
                        argThat(
                                p ->
                                        p.sku().equals("fixture-sku")
                                                && p.operation().equals("RunInstances")));
        verify(sink)
                .rate(
                        argThat(
                                r ->
                                        r.unitPrice().toPlainString().equals("0.123456789123")
                                                && r.rangeEnd() == null));
    }

    @Test
    void rejectsTruncatedFileWithoutConfirmingCompleteness() {
        assertThatThrownBy(
                        () -> parse(fixture.substring(0, fixture.length() - 10), mock(Sink.class)))
                .isInstanceOf(RuntimeException.class);
    }

    @Test
    void rejectsEmptyOrMissingOnDemandSource() {
        assertThatThrownBy(() -> parse("{\"products\":{},\"terms\":{}}", mock(Sink.class)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsAnotherCommercialRegion() {
        assertThatThrownBy(() -> parse(fixture.replace("us-east-1", "us-west-2"), mock(Sink.class)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void hashesAttributeObjectsIndependentlyOfPropertyOrder() {
        var json = new Json();
        assertThat(json.hash(json.tree("{\"a\":1,\"b\":2}")))
                .isEqualTo(json.hash(json.tree("{\"b\":2,\"a\":1}")));
    }

    @Test
    void rejectsAFileVersionDifferentFromItsOfficialReference() {
        assertThatThrownBy(
                        () ->
                                parser.parse(
                                        new ByteArrayInputStream(
                                                fixture.getBytes(StandardCharsets.UTF_8)),
                                        scope,
                                        "another-version",
                                        mock(Sink.class)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void equivalentDecimalRepresentationsHaveTheSameHash() {
        var json = new Json();
        assertThat(json.hash(json.tree("{\"price\":1.000}")))
                .isEqualTo(json.hash(json.tree("{\"price\":1}")));
    }

    private void parse(String content, Sink sink) {
        parser.parse(
                new ByteArrayInputStream(content.getBytes(StandardCharsets.UTF_8)), scope, sink);
    }
}
