package com.porto.ciops.coa.pop.price.system.service.integrations.aws;

import com.porto.ciops.coa.pop.price.system.service.provider.spi.ProviderCatalog;
import com.porto.ciops.coa.pop.price.system.service.shared.ApiException;

import org.springframework.stereotype.Component;

import software.amazon.awssdk.services.pricing.PricingClient;
import software.amazon.awssdk.services.pricing.model.*;

import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URI;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;
import java.util.regex.Pattern;

/** Real AWS Query and Bulk APIs using default credentials and bounded, streaming HTTP downloads. */
@Component
public class AwsPricingCatalog implements ProviderCatalog {
    // The ARN contains currency before the file version; keep the reference separate from it.
    private static final Pattern PRICE_LIST_REFERENCE =
            Pattern.compile(
                    "arn:[a-zA-Z0-9-]+:pricing:::price-list/aws/(?<service>[^/]+)/USD/(?<version>[0-9]{14})(?:/(?<region>[^/]+))?");
    private final PricingClient client;
    private final AwsPriceFileParser parser;

    public AwsPricingCatalog(PricingClient client, AwsPriceFileParser parser) {
        this.client = client;
        this.parser = parser;
    }

    @Override
    public String provider() {
        return "AWS";
    }

    @Override
    public List<Service> services() {
        List<Service> services = new ArrayList<>();
        client.describeServicesPaginator(DescribeServicesRequest.builder().maxResults(100).build())
                .forEach(
                        page ->
                                page.services()
                                        .forEach(
                                                s ->
                                                        services.add(
                                                                new Service(
                                                                        s.serviceCode(),
                                                                        s.serviceCode(),
                                                                        s.attributeNames()))));
        return List.copyOf(services);
    }

    @Override
    public List<String> regions(String serviceCode) {
        var metadata = client.describeServices(r -> r.serviceCode(serviceCode));
        if (metadata.services().isEmpty()) throw new ApiException(400, "Unknown AWS service code");
        if (!metadata.services().getFirst().attributeNames().contains("regionCode"))
            return bulkRegions(serviceCode);
        List<String> regions = new ArrayList<>();
        client.getAttributeValuesPaginator(
                        GetAttributeValuesRequest.builder()
                                .serviceCode(serviceCode)
                                .attributeName("regionCode")
                                .maxResults(100)
                                .build())
                .forEach(
                        page ->
                                page.attributeValues()
                                        .forEach(
                                                v -> {
                                                    if (!v.value().isBlank())
                                                        regions.add(v.value());
                                                }));
        return regions.isEmpty()
                ? bulkRegions(serviceCode)
                : regions.stream().distinct().sorted().toList();
    }

    private List<String> bulkRegions(String serviceCode) {
        var regions = new ArrayList<String>();
        client.listPriceListsPaginator(
                        ListPriceListsRequest.builder()
                                .serviceCode(serviceCode)
                                .currencyCode("USD")
                                .effectiveDate(Instant.now())
                                .maxResults(100)
                                .build())
                .forEach(
                        page ->
                                page.priceLists()
                                        .forEach(
                                                p ->
                                                        regions.add(
                                                                p.regionCode() == null
                                                                                || p.regionCode()
                                                                                        .isBlank()
                                                                        ? "global"
                                                                        : p.regionCode())));
        return regions.stream().distinct().sorted().toList();
    }

    @Override
    public Service service(String code) {
        var result = client.describeServices(r -> r.serviceCode(code));
        if (result.services().isEmpty()) throw new ApiException(400, "Unknown AWS service code");
        var service = result.services().getFirst();
        return new Service(service.serviceCode(), service.serviceCode(), service.attributeNames());
    }

    @Override
    public Source latest(Scope scope) {
        var request =
                ListPriceListsRequest.builder()
                        .serviceCode(scope.serviceCode())
                        .currencyCode("USD")
                        .effectiveDate(Instant.now())
                        .maxResults(100);
        if (!"global".equals(scope.regionCode())) request.regionCode(scope.regionCode());
        var lists = new ArrayList<PriceList>();
        client.listPriceListsPaginator(request.build())
                .forEach(page -> lists.addAll(page.priceLists()));
        var selected =
                lists.stream()
                        .filter(p -> p.fileFormats().contains("json"))
                        .filter(
                                p ->
                                        scope.regionCode().equals(p.regionCode())
                                                || "global".equals(scope.regionCode())
                                                        && (p.regionCode() == null
                                                                || p.regionCode().isBlank()))
                        .max(Comparator.comparing(PriceList::priceListArn))
                        .orElseThrow(
                                () ->
                                        new ApiException(
                                                422,
                                                "No official USD JSON price list for this scope"));
        var reference = PRICE_LIST_REFERENCE.matcher(selected.priceListArn());
        if (!reference.matches()
                || !scope.serviceCode().equals(reference.group("service"))
                || !(scope.regionCode().equals(reference.group("region"))
                        || "global".equals(scope.regionCode()) && reference.group("region") == null))
            throw new IllegalArgumentException("Invalid AWS price list reference for this scope");
        String url =
                client.getPriceListFileUrl(
                                GetPriceListFileUrlRequest.builder()
                                        .priceListArn(selected.priceListArn())
                                        .fileFormat("json")
                                        .build())
                        .url();
        return new Source(reference.group("version"), url, selected.priceListArn());
    }

    @Override
    public void stream(Scope scope, Source source, Sink sink) {
        URI uri = URI.create(source.url());
        if (!"https".equals(uri.getScheme())
                || uri.getHost() == null
                || !(uri.getHost().equals("pricing.us-east-1.amazonaws.com")
                        || uri.getHost().endsWith(".amazonaws.com")))
            throw new IllegalArgumentException("Non-official AWS price URL");
        for (int attempt = 0; attempt < 4; attempt++) {
            sink.heartbeat();
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) uri.toURL().openConnection();
                connection.setConnectTimeout(10000);
                connection.setReadTimeout(30000);
                connection.setInstanceFollowRedirects(false);
                int status = connection.getResponseCode();
                if (status == 200) {
                    try (var input = connection.getInputStream()) {
                        parser.parse(input, scope, source.version(), sink);
                    }
                    return;
                }
                if (status != 429 && status < 500)
                    throw new ApiException(502, "AWS price download rejected");
            } catch (IOException ex) {
                if (attempt == 3) throw new ApiException(502, "AWS price download failed");
            } finally {
                if (connection != null) connection.disconnect();
            }
            if (attempt < 3) {
                try {
                    Thread.sleep(
                            ThreadLocalRandom.current()
                                    .nextLong(250L << attempt, 1000L << attempt));
                } catch (InterruptedException ex) {
                    Thread.currentThread().interrupt();
                    throw new ApiException(503, "Synchronization interrupted");
                }
            }
        }
        throw new ApiException(502, "AWS price source unavailable");
    }

    /** One remote Query API page, useful for source verification without downloading a file. */
    public QueryPage query(String service, String region, String sku, String nextToken) {
        List<Filter> filters = new ArrayList<>();
        if (!"global".equals(region))
            filters.add(
                    Filter.builder()
                            .type(FilterType.TERM_MATCH)
                            .field("regionCode")
                            .value(region)
                            .build());
        if (sku != null)
            filters.add(
                    Filter.builder().type(FilterType.TERM_MATCH).field("sku").value(sku).build());
        var page =
                client.getProducts(
                        r ->
                                r.serviceCode(service)
                                        .filters(filters)
                                        .maxResults(100)
                                        .nextToken(nextToken));
        var mapper = JsonMapper.builder().build();
        var products =
                page.priceList().stream()
                        .map(mapper::readTree)
                        .map(
                                n ->
                                        new QueryProduct(
                                                parser.product(n.path("product")),
                                                parser.rates(
                                                        n.path("product").path("sku").asString(),
                                                        n.path("terms").path("OnDemand"))))
                        .toList();
        return new QueryPage(products, page.nextToken());
    }
}
