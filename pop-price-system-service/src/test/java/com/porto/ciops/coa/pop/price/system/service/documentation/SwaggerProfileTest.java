package com.porto.ciops.coa.pop.price.system.service.documentation;

import static org.assertj.core.api.Assertions.assertThat;

import com.porto.ciops.coa.pop.price.system.service.PopPriceSystemServiceApplication;
import com.porto.ciops.coa.pop.price.system.service.shared.Json;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.boot.builder.SpringApplicationBuilder;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.List;

import tools.jackson.databind.JsonNode;

class SwaggerProfileTest {
    @ParameterizedTest(name = "profiles={0}, Swagger enabled={1}")
    @CsvSource({
        "'', true",
        "dev, true",
        "hml, true",
        "prd, false",
        "'dev,prd', false",
        "'hml,prd', false",
        "other, false"
    })
    void servesDocumentationOnlyForDevelopmentAndHomologation(
            String profiles, boolean enabled) throws Exception {
        try (var context =
                        new SpringApplicationBuilder(PopPriceSystemServiceApplication.class)
                                .run(
                                        "--spring.profiles.active=" + profiles,
                                        "--server.address=127.0.0.1",
                                        "--server.port=0",
                                        "--spring.main.banner-mode=off",
                                        "--logging.level.root=WARN",
                                        "--debug=false");
                var client =
                        HttpClient.newBuilder()
                                .followRedirects(HttpClient.Redirect.NORMAL)
                                .build()) {
            var environment = context.getEnvironment();
            String base =
                    "http://127.0.0.1:"
                            + environment.getRequiredProperty("local.server.port")
                            + "/pop-price-system-service";
            boolean documentationProfile =
                    environment.matchesProfiles("(dev | hml) & !prd");
            assertThat(documentationProfile).isEqualTo(enabled);

            for (String path : new String[] {"", "/", "/swagger-ui.html"}) {
                var response = get(client, base + path);
                assertThat(response.statusCode()).as("context %s", path)
                        .isEqualTo(enabled ? 200 : 404);
                if (enabled) {
                    assertThat(response.uri().getPath())
                            .isEqualTo("/pop-price-system-service/swagger-ui/index.html");
                    assertThat(response.body()).contains("<title>Swagger UI</title>");
                }
            }

            for (String path :
                    new String[] {
                        "/swagger-ui/index.html",
                        "/swagger-ui/swagger-initializer.js",
                        "/swagger-ui/swagger-ui.css",
                        "/swagger-ui/swagger-ui-bundle.js",
                        "/v3/api-docs/swagger-config",
                        "/v3/api-docs",
                        "/v3/api-docs.yaml"
                    }) {
                var response = get(client, base + path);
                assertThat(response.statusCode()).as("documentation %s", path)
                        .isEqualTo(enabled ? 200 : 404);
                if (enabled && path.equals("/v3/api-docs")) {
                    assertThat(response.body())
                            .contains("\"openapi\"", "\"/api/v1/catalog/rates\"", base);
                    assertDocumentedApi(new Json().tree(response.body()));
                }
                if (enabled && path.equals("/v3/api-docs/swagger-config")) {
                    assertThat(response.body())
                            .contains("\"url\":\"/pop-price-system-service/v3/api-docs\"");
                }
            }
            if (profiles.isEmpty()) assertDocumentedErrors(client, base);
        }
    }

    private static HttpResponse<String> get(HttpClient client, String url) throws Exception {
        return client.send(
                HttpRequest.newBuilder(URI.create(url)).GET().build(),
                HttpResponse.BodyHandlers.ofString());
    }

    private static void assertDocumentedApi(JsonNode document) {
        try { java.nio.file.Files.writeString(java.nio.file.Path.of("target/portal-openapi.json"),document.toString()); }
        catch(java.io.IOException ex) { throw new java.io.UncheckedIOException(ex); }
        assertThat(document.at("/info/title").asString()).isEqualTo("pop-price-system-service");
        assertThat(document.at("/info/description").asString())
                .contains("Roteiro prático", "curl", "complete=false", "ilustrativos");
        int operations = 0;
        for (var path : document.path("paths").properties()) {
            if (!path.getKey().startsWith("/api/v1/")) continue;
            for (var method : path.getValue().properties()) {
                if (!List.of("get", "post", "put", "delete").contains(method.getKey())) continue;
                operations++;
                String label = method.getKey() + " " + path.getKey();
                var operation = method.getValue();
                assertThat(operation.path("summary").asString()).as(label).isNotBlank();
                assertThat(operation.path("description").asString()).as(label).contains("Exemplo");
                var responses = operation.path("responses");
                for (String status : List.of("400", "409", "500")) {
                    var response = resolve(document, responses.path(status));
                    assertThat(response.path("description").asString()).as(label + " " + status).isNotBlank();
                    var content = response.at("/content/application~1problem+json");
                    assertThat(content.path("schema").path("$ref").asString())
                            .isEqualTo("#/components/schemas/ApiProblem");
                    assertThat(content.path("examples").size()).as(label + " error examples").isPositive();
                }
                var success = resolve(document, responses.has("201") ? responses.path("201") : responses.path("200"));
                if (responses.has("204")) {
                    assertThat(responses.path("204").path("content").isEmpty()).as(label).isTrue();
                } else {
                    var content = success.at("/content/application~1json");
                    assertThat(content.path("schema").isMissingNode()).as(label + " response schema: " + success).isFalse();
                    assertThat(content.path("examples").size()).as(label + " success examples").isPositive();
                }
                if (operation.has("requestBody")) {
                    var body = operation.at("/requestBody/content/application~1json");
                    assertThat(body.path("schema").isMissingNode()).as(label + " request schema").isFalse();
                    assertThat(body.path("examples").size()).as(label + " request examples").isPositive();
                }
            }
        }
        assertThat(operations).isEqualTo(46);
        assertThat(document.path("paths").has("/api/v1/architecture-models/{id}/estimates")).isTrue();
        assertThat(document.path("paths").has("/api/v1/exchange-rates/synchronize")).isTrue();
        assertThat(document.path("paths").has("/api/v1/contracts")).isTrue();

        for (String path : List.of("/api/v1/catalog/products", "/api/v1/catalog/rates", "/api/v1/catalog/changes")) {
            var names = new ArrayList<String>();
            for (var parameter : document.path("paths").path(path).at("/get/parameters")) {
                var resolved = resolve(document, parameter);
                names.add(resolved.path("name").asString());
                assertThat(resolved.path("description").asString()).as(path + " parameter").isNotBlank();
            }
            assertThat(names).contains("provider", "service", "region", "attributes", "size", "afterId", "sort", "X-Correlation-ID")
                    .doesNotContain("query");
        }
        assertThat(document.path("paths").path("/api/v1/estimates/{id}/items")
                .at("/post/requestBody/content/application~1json/examples").size()).isEqualTo(4);
        assertThat(document.path("paths").path("/api/v1/estimates/{id}/calculate")
                .at("/post/responses/200/content/application~1json/examples").size()).isEqualTo(2);
        assertLocalReferences(document, document);
    }

    private static JsonNode resolve(JsonNode document, JsonNode value) {
        return value.has("$ref") ? document.at(value.path("$ref").asString().substring(1)) : value;
    }

    private static void assertDocumentedErrors(HttpClient client, String base) throws Exception {
        for (String path : List.of("/api/v1/catalog/services?size=0",
                "/api/v1/catalog/products?attributes=%7B", "/api/v1/estimates/invalid-uuid")) {
            var request = HttpRequest.newBuilder(URI.create(base + path))
                    .header("X-Correlation-ID", "swagger-contract-test").GET().build();
            var response = client.send(request, HttpResponse.BodyHandlers.ofString());
            assertThat(response.statusCode()).as(path).isEqualTo(400);
            assertThat(response.headers().firstValue("Content-Type").orElse(""))
                    .startsWith("application/problem+json");
            assertThat(response.headers().firstValue("X-Correlation-ID")).contains("swagger-contract-test");
            var body = new Json().tree(response.body());
            assertThat(body.path("status").asInt()).isEqualTo(400);
            assertThat(body.path("title").asString()).isEqualTo("Bad Request");
            assertThat(body.path("detail").asString()).isNotBlank();
            assertThat(body.path("instance").asString()).startsWith("/pop-price-system-service/api/v1/");
            assertThat(body.path("correlationId").asString()).isEqualTo("swagger-contract-test");
        }
    }

    private static void assertLocalReferences(JsonNode document, JsonNode node) {
        if (node.isObject()) {
            if (node.has("$ref")) {
                String ref = node.path("$ref").asString();
                assertThat(ref).startsWith("#/");
                assertThat(document.at(ref.substring(1)).isMissingNode()).as(ref).isFalse();
            }
            node.properties().forEach(entry -> assertLocalReferences(document, entry.getValue()));
        } else if (node.isArray()) {
            node.forEach(child -> assertLocalReferences(document, child));
        }
    }
}
