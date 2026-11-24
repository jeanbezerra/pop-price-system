package com.porto.ciops.coa.pop.price.system.service.integrations.aws;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.porto.ciops.coa.pop.price.system.service.provider.spi.ProviderCatalog.*;
import org.junit.jupiter.api.Test;
import software.amazon.awssdk.services.pricing.PricingClient;
import software.amazon.awssdk.services.pricing.model.*;
import software.amazon.awssdk.services.pricing.paginators.ListPriceListsIterable;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;

class AwsPricingCatalogTest {
    private final PricingClient client = mock(PricingClient.class);
    private final AwsPriceFileParser parser = new AwsPriceFileParser();
    private final AwsPricingCatalog catalog = new AwsPricingCatalog(client, parser);
    private final Scope scope = new Scope("AWS", "AmazonEKS", "ca-central-1");
    private static final String VERSION = "20261118230000";
    private static final String ARN = "arn:aws:pricing:::price-list/aws/AmazonEKS/USD/" + VERSION + "/ca-central-1";
    private static final String URL = "https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonEKS/" + VERSION + "/ca-central-1/index.json";

    private void priceList(String arn, String region) {
        var request = ListPriceListsRequest.builder().build();
        when(client.listPriceListsPaginator(any(ListPriceListsRequest.class)))
                .thenReturn(new ListPriceListsIterable(client, request));
        when(client.listPriceLists(any(ListPriceListsRequest.class)))
                .thenReturn(ListPriceListsResponse.builder().priceLists(PriceList.builder()
                        .priceListArn(arn).regionCode(region).currencyCode("USD").fileFormats("json").build()).build());
        when(client.getPriceListFileUrl(any(GetPriceListFileUrlRequest.class)))
                .thenReturn(GetPriceListFileUrlResponse.builder().url(URL).build());
    }

    @Test
    void regionalReferenceUsesTheFileVersionRatherThanTheCurrencyOrArn() {
        priceList(ARN, "ca-central-1");
        var source = catalog.latest(scope);
        assertThat(source.version()).isEqualTo(VERSION);
        assertThat(source.reference()).isEqualTo(ARN);
        assertThat(source.url()).isEqualTo(URL);
        verify(client).getPriceListFileUrl(GetPriceListFileUrlRequest.builder()
                .priceListArn(ARN).fileFormat("json").build());

        // The version selected by the adapter must be accepted by the real file parser.
        var body = """
                {"offerCode":"AmazonEKS","version":"%s",
                 "products":{"test":{"sku":"test","attributes":{"regionCode":"ca-central-1"}}},
                 "terms":{"OnDemand":{"test":{"term":{"sku":"test","offerTermCode":"term",
                   "effectiveDate":"2026-11-18T00:00:00Z","priceDimensions":{"rate":{
                     "rateCode":"rate","unit":"Hrs","beginRange":"0","endRange":"Inf",
                     "pricePerUnit":{"USD":"0.1"}}}}}}}}
                """.formatted(VERSION);
        var sink = mock(Sink.class);
        parser.parse(new ByteArrayInputStream(body.getBytes(StandardCharsets.UTF_8)), scope, source.version(), sink);
        verify(sink).product(any());
        verify(sink).rate(any());
    }

    @Test
    void globalReferenceWithoutARegionHasTheSameVersionContract() {
        String arn = "arn:aws:pricing:::price-list/aws/AmazonEKS/USD/" + VERSION;
        priceList(arn, "");
        var source = catalog.latest(new Scope("AWS", "AmazonEKS", "global"));
        assertThat(source.version()).isEqualTo(VERSION);
        assertThat(source.reference()).isEqualTo(arn);
    }

    @Test
    void rejectsMalformedOrMismatchedReferencesBeforeDownloading() {
        for (String invalid : new String[] {
                ARN.replace(VERSION, "invalid"), ARN.replace("AmazonEKS", "AmazonEC2"),
                ARN.replace("USD", "BRL"), ARN.replace("/ca-central-1", "/us-east-1") }) {
            priceList(invalid, "ca-central-1");
            assertThatThrownBy(() -> catalog.latest(scope)).isInstanceOf(IllegalArgumentException.class);
        }
        verify(client, never()).getPriceListFileUrl(any(GetPriceListFileUrlRequest.class));
    }
}
