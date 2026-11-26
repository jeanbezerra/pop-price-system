package com.porto.ciops.coa.pop.price.system.service.components;

import com.porto.ciops.coa.pop.price.system.service.PopPriceSystemServiceApplication;
import com.porto.ciops.coa.pop.price.system.service.shared.Json;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.jdbc.core.simple.JdbcClient;
import tools.jackson.databind.JsonNode;
import java.net.URI;
import java.net.http.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;

/** Explicit opt-in: real HTTP and PostgreSQL; never calls AWS or modifies the local application database. */
@EnabledIfEnvironmentVariable(named = "COMPONENT_TEST_DATABASE_URL", matches = "jdbc:postgresql://.*")
class ComponentWorkflowTest {
    private final Json json = new Json();
    private String base;
    private HttpClient client;

    private JsonNode call(String method, String path, Object body, int status) throws Exception {
        var request = HttpRequest.newBuilder(URI.create(base + path)).header("Content-Type", "application/json")
                .method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(json.write(body)));
        var response = client.send(request.build(), HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).as(method + " " + path + ": " + response.body()).isEqualTo(status);
        if (status == 204) {
            assertThat(response.body()).isEmpty();
            return json.tree("null");
        }
        return json.tree(response.body());
    }

    private org.springframework.context.ConfigurableApplicationContext start() {
        var context = new SpringApplicationBuilder(PopPriceSystemServiceApplication.class).run(
                "--spring.profiles.active=dev", "--server.address=127.0.0.1", "--server.port=0",
                "--spring.main.banner-mode=off", "--logging.level.root=WARN", "--debug=false",
                "--spring.datasource.url=" + System.getenv("COMPONENT_TEST_DATABASE_URL"),
                "--spring.datasource.username=" + System.getenv("COMPONENT_TEST_DATABASE_USER"),
                "--spring.datasource.password=" + System.getenv("COMPONENT_TEST_DATABASE_PASSWORD"));
        base = "http://127.0.0.1:" + context.getEnvironment().getProperty("local.server.port") + "/pop-price-system-service/api/v1";
        return context;
    }

    private List<JsonNode> components(String filters) throws Exception {
        var items = new ArrayList<JsonNode>();
        String after = "";
        while (true) {
            var page = call("GET", "/architecture-components?size=100" + filters + "&after=" + after, null, 200);
            page.path("items").forEach(items::add);
            if (!page.path("hasMore").asBoolean()) return items;
            var next = page.path("nextAfter").asString();
            assertThat(next).isNotBlank().isNotEqualTo(after);
            after = next;
        }
    }

    @Test void registrationValidationPaginationAndRestart() throws Exception {
        String id, genericId, deletedId;
        try (var http = HttpClient.newHttpClient(); var context = start()) {
            client = http;
            var jdbc = context.getBean(JdbcClient.class);
            jdbc.sql("INSERT INTO pop_price_system_service.cloud_service(provider,code,name) VALUES ('AWS','AmazonEC2','Amazon EC2') ON CONFLICT DO NOTHING").update();
            jdbc.sql("INSERT INTO pop_price_system_service.cloud_provider(code,name) VALUES ('AZURE','Microsoft Azure') ON CONFLICT DO NOTHING").update();
            jdbc.sql("INSERT INTO pop_price_system_service.cloud_service(provider,code,name) VALUES ('AZURE','Compute','Azure Compute') ON CONFLICT DO NOTHING").update();
            var icons = call("GET", "/architecture-icons?provider=AWS&query=EC2&size=1", null, 200);
            assertThat(icons.at("/items/0/key").asString()).isEqualTo("aws.ec2");
            var firstPage = call("GET", "/architecture-icons?provider=AWS&size=1", null, 200);
            assertThat(firstPage.path("hasMore").asBoolean()).isTrue();
            var next = call("GET", "/architecture-icons?provider=AWS&size=1&after=" + firstPage.path("nextAfter").asString(), null, 200);
            assertThat(next.at("/items/0/key").asString()).isNotEqualTo(firstPage.at("/items/0/key").asString());
            var draft = new HashMap<String,Object>(Map.of("provider","AWS","serviceCode","AmazonEC2","name","Servidor gerenciado","category","Compute","description","Uso interno","status","PENDING","revision",0));
            var created = call("POST", "/architecture-components", draft, 200);
            id = created.path("id").asString();
            assertThat(created.path("icon").isNull()).isTrue();
            draft.put("status", "ACTIVE");
            call("PUT", "/architecture-components/" + id, draft, 422);
            draft.put("iconKey", "aws.ec2"); draft.put("iconRelease", "2026-07-31");
            var active = call("PUT", "/architecture-components/" + id, draft, 200);
            assertThat(active.at("/icon/assetPath").asString()).endsWith("/ec2.svg");
            call("PUT", "/architecture-components/" + id, draft, 409);
            draft.put("provider", "AZURE"); draft.put("serviceCode", "Compute");
            call("POST", "/architecture-components", draft, 422);
            draft.put("provider", "AWS"); draft.put("serviceCode", "Missing");
            call("POST", "/architecture-components", draft, 404);
            draft.put("serviceCode", "AmazonEC2"); draft.put("name", " ");
            call("POST", "/architecture-components", draft, 400);
            draft.put("name", "Outro servidor");
            call("POST", "/architecture-components", draft, 200);
            var page = call("GET", "/architecture-components?size=1", null, 200);
            assertThat(page.path("hasMore").asBoolean()).isTrue();
            var second = call("GET", "/architecture-components?size=1&after=" + page.path("nextAfter").asString(), null, 200);
            assertThat(second.at("/items/0/id").asString()).isNotEqualTo(page.at("/items/0/id").asString());
            assertThat(call("GET", "/architecture-components?query=gerenciado&provider=AWS&service=AmazonEC2&status=ACTIVE", null, 200).path("items").size()).isEqualTo(1);
            assertThat(call("GET", "/architecture-components?status=PENDING&query=gerenciado", null, 200).path("items").size()).isZero();
            assertThat(call("GET", "/architecture-components?category=Other", null, 200).path("items").size()).isZero();
            jdbc.sql("UPDATE pop_price_system_service.architecture_component SET category='Legacy category' WHERE id=CAST(:id AS uuid)").param("id",id).update();
            draft.put("category","Legacy category");
            call("POST", "/architecture-components", draft, 422);
            draft.put("name", "Servidor editado"); draft.put("status", "INACTIVE"); draft.put("revision", 1);
            call("PUT", "/architecture-components/" + id, draft, 200);
            assertThatThrownBy(() -> jdbc.sql("UPDATE pop_price_system_service.architecture_component SET provider='AZURE',service_code='Compute' WHERE id=CAST(:id AS uuid)").param("id", id).update())
                    .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
            var providers = call("GET", "/architecture-component-providers", null, 200);
            assertThat(providers.valueStream().map(p -> p.path("code").asString()).toList()).contains("GENERIC","AWS","AZURE","GCP");
            var categories = call("GET", "/architecture-component-categories?provider=AWS", null, 200);
            assertThat(categories.size()).isEqualTo(27);
            assertThat(categories.valueStream().map(c -> c.path("code").asString()).toList()).contains("Compute","Storage","Management-Tools");
            assertThat(call("GET", "/architecture-component-categories?provider=AZURE", null, 200).size()).isEqualTo(29);
            assertThat(call("GET", "/architecture-component-categories?provider=GCP", null, 200).size()).isEqualTo(26);
            assertThat(call("GET", "/architecture-component-categories?provider=UNAVAILABLE", null, 200).size()).isZero();
            var computeIcons = call("GET", "/architecture-icons?provider=AWS&category=Compute", null, 200);
            assertThat(computeIcons.path("items").size()).isPositive();
            assertThat(computeIcons.path("hasMore").asBoolean()).isTrue();
            assertThat(computeIcons.path("items").valueStream().map(i -> i.path("category").asString()).toList()).containsOnly("Compute");
            var generic = new HashMap<String,Object>(Map.of("provider","GENERIC","name","Aplicação interna","category","application","status","ACTIVE",
                    "characteristics",List.of(Map.of("name"," Memória ","value"," 8 GiB ")),"revision",0));
            var independent = call("POST", "/architecture-components", generic, 200);
            genericId = independent.path("id").asString();
            assertThat(independent.path("serviceCode").isNull()).isTrue();
            assertThat(independent.at("/characteristics/0/name").asString()).isEqualTo("Memória");
            generic.put("serviceCode","AmazonEC2");
            call("POST", "/architecture-components", generic, 422);
            generic.remove("serviceCode"); generic.put("provider","AZURE"); generic.put("status","PENDING");
            call("POST", "/architecture-components", generic, 422);
            generic.put("provider","AWS"); generic.put("category","Compute");
            var unlinked = call("POST", "/architecture-components", generic, 200);
            assertThat(unlinked.path("serviceCode").isNull()).isTrue();
            generic.put("serviceCode","AmazonEC2");
            var linked = call("PUT", "/architecture-components/" + unlinked.path("id").asString(), generic, 200);
            assertThat(linked.path("serviceName").asString()).isEqualTo("Amazon EC2");
            generic.put("serviceCode","Missing"); generic.put("revision",1);
            call("PUT", "/architecture-components/" + unlinked.path("id").asString(), generic, 404);
            var allComponents = components("");
            var withService = components("&linked=true");
            var withoutService = components("&linked=false");
            assertThat(withService).isNotEmpty().allSatisfy(c -> assertThat(c.path("serviceCode").isNull()).isFalse());
            assertThat(withoutService).isNotEmpty().allSatisfy(c -> assertThat(c.path("serviceCode").isNull()).isTrue());
            var linkedIds = withService.stream().map(c -> c.path("id").asString()).toList();
            var unlinkedIds = withoutService.stream().map(c -> c.path("id").asString()).toList();
            assertThat(linkedIds).doesNotContainAnyElementsOf(unlinkedIds);
            var combinedIds = new ArrayList<>(linkedIds);
            combinedIds.addAll(unlinkedIds);
            assertThat(combinedIds).containsExactlyInAnyOrderElementsOf(allComponents.stream().map(c -> c.path("id").asString()).toList());
            assertThat(unlinkedIds).contains(genericId);
            assertThat(linkedIds).contains(id);
            assertThat(components("&linked=false&provider=GENERIC")).hasSize(1);
            assertThat(components("&linked=true&provider=GENERIC")).isEmpty();
            assertThat(components("&linked=false&provider=AWS&service=AmazonEC2")).isEmpty();
            assertThat(components("&linked=true&provider=AWS&service=AmazonEC2&status=INACTIVE&query=editado&category=Legacy%20category")).hasSize(1);
            call("GET", "/architecture-components?linked=invalid", null, 400);
            var removable = new HashMap<String,Object>(Map.of("provider","GENERIC","name","Componente removível","category","application","status","ACTIVE",
                    "characteristics",List.of(Map.of("name","Purpose","value","Retain")),"revision",0));
            deletedId = call("POST", "/architecture-components", removable, 200).path("id").asString();
            call("DELETE", "/architecture-components/" + deletedId, null, 400);
            call("DELETE", "/architecture-components/" + deletedId + "?revision=-1", null, 400);
            call("DELETE", "/architecture-components/" + deletedId + "?revision=1", null, 409);
            call("GET", "/architecture-components/" + deletedId, null, 200);
            call("DELETE", "/architecture-components/" + deletedId + "?revision=0", null, 204);
            call("GET", "/architecture-components/" + deletedId, null, 404);
            call("PUT", "/architecture-components/" + deletedId, removable, 404);
            call("DELETE", "/architecture-components/" + deletedId + "?revision=1", null, 404);
            assertThat(components("&query=remov%C3%ADvel")).isEmpty();
            var retained = jdbc.sql("SELECT name,status,revision,characteristics::text,deleted_at IS NOT NULL AS deleted FROM pop_price_system_service.architecture_component WHERE id=CAST(:id AS uuid)")
                    .param("id",deletedId).query().singleRow();
            assertThat(retained).containsEntry("name","Componente removível").containsEntry("status","ACTIVE").containsEntry("revision",1L).containsEntry("deleted",true);
            assertThat(retained.get("characteristics").toString()).contains("Purpose","Retain");
        }
        try (var http = HttpClient.newHttpClient(); var context = start()) {
            client = http;
            var persisted = call("GET", "/architecture-components/" + id, null, 200);
            assertThat(persisted.path("name").asString()).isEqualTo("Servidor editado");
            assertThat(persisted.path("status").asString()).isEqualTo("INACTIVE");
            assertThat(persisted.path("revision").asLong()).isEqualTo(2);
            assertThat(persisted.path("category").asString()).isEqualTo("Legacy category");
            assertThat(persisted.at("/icon/key").asString()).isEqualTo("aws.ec2");
            var generic = call("GET", "/architecture-components/" + genericId, null, 200);
            assertThat(generic.path("provider").asString()).isEqualTo("GENERIC");
            assertThat(generic.at("/characteristics/0/value").asString()).isEqualTo("8 GiB");
            call("GET", "/architecture-components/" + deletedId, null, 404);
        }
    }
}
