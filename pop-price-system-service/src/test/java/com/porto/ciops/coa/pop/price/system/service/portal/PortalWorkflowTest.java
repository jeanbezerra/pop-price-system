package com.porto.ciops.coa.pop.price.system.service.portal;

import com.porto.ciops.coa.pop.price.system.service.architecture.domain.StructureSearch;

import static org.assertj.core.api.Assertions.*;
import com.porto.ciops.coa.pop.price.system.service.PopPriceSystemServiceApplication;
import com.porto.ciops.coa.pop.price.system.service.shared.Json;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.builder.SpringApplicationBuilder;
import tools.jackson.databind.JsonNode;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Explicit opt-in; uses real PostgreSQL and HTTP, with only the external BCB boundary stubbed. */
@EnabledIfEnvironmentVariable(named="PORTAL_TEST_DATABASE_URL",matches="jdbc:postgresql://.*")
class PortalWorkflowTest {
    private final Json json=new Json();
    private String base;
    private HttpClient client;
    private JsonNode call(String method,String path,Object body,int status) throws Exception {
        var request=HttpRequest.newBuilder(URI.create(base+path)).header("Content-Type","application/json")
                .method(method,body==null?HttpRequest.BodyPublishers.noBody():HttpRequest.BodyPublishers.ofString(json.write(body)));
        var response=client.send(request.build(),HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).as(method+" "+path+": "+response.body()).isEqualTo(status);
        return json.tree(response.body().isBlank()?"null":response.body());
    }
    @Test void modelsAreReusableAndContractsFreezeTheExactExchangeQuote() throws Exception {
        var bcb=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        bcb.createContext("/odata/",request->{byte[] body="{\"value\":[{\"tipoBoletim\":\"Fechamento\",\"cotacaoCompra\":5.4311,\"cotacaoVenda\":5.4321,\"dataHoraCotacao\":\"2025-01-10 13:00:00.000\"}]}".getBytes(StandardCharsets.UTF_8);request.sendResponseHeaders(200,body.length);request.getResponseBody().write(body);request.close();});
        bcb.start();
        try(var context=new SpringApplicationBuilder(PopPriceSystemServiceApplication.class).run(
                "--spring.profiles.active=dev","--server.address=127.0.0.1","--server.port=0","--spring.main.banner-mode=off","--logging.level.root=WARN","--debug=false",
                "--spring.datasource.url="+System.getenv("PORTAL_TEST_DATABASE_URL"),"--spring.datasource.username="+System.getenv("PORTAL_TEST_DATABASE_USER"),
                "--spring.datasource.password="+System.getenv("PORTAL_TEST_DATABASE_PASSWORD"),"--app.exchange.ptax-base-url=http://127.0.0.1:"+bcb.getAddress().getPort()+"/odata/");
            var http=HttpClient.newHttpClient()) {
            client=http;base="http://127.0.0.1:"+context.getEnvironment().getProperty("local.server.port")+"/pop-price-system-service/api/v1";
            assertThat(context.getBean(org.springframework.jdbc.core.simple.JdbcClient.class).sql("SELECT current_schema()").query(String.class).single()).isEqualTo("pop_price_system_service");
            verifySynchronizationHistory(context.getBean(org.springframework.jdbc.core.simple.JdbcClient.class));
            verifyServiceSynchronizationDates(context.getBean(org.springframework.jdbc.core.simple.JdbcClient.class));
            var quote=call("POST","/exchange-rates/synchronize",Map.of("date","2025-01-12"),200);
            assertThat(quote.path("quotationDate").asString()).isEqualTo("2025-01-10");
            var repeated=call("POST","/exchange-rates/synchronize",Map.of("date","2025-01-12"),200);
            assertThat(repeated.path("id").asString()).isEqualTo(quote.path("id").asString());
            var rate=call("GET","/catalog/rates",null,200).path("items").get(0).path("id").asLong();
            String first=UUID.randomUUID().toString(),second=UUID.randomUUID().toString();
            var a=new LinkedHashMap<String,Object>(Map.of("id",first,"name","Servidor A","x",0,"y",0,"rateId",rate,"category","compute","accountCode","principal","quantity","1.000000000001","consumption","1","consumptionUnit","Hrs"));
            a.put("period","HOUR");a.put("availabilityZone","use1-az1");
            var b=new LinkedHashMap<String,Object>(a);b.put("id",second);b.put("name","Servidor B");b.put("x",400);b.put("quantity","1");
            var edge=Map.of("id",UUID.randomUUID().toString(),"source",first,"target",second,"monthlyGb","100","direction","INTERNAL","connectivity","DIRECT","charges",List.of());
            var graph=Map.of("nodes",List.of(a,b),"edges",List.of(edge));
            var input=new HashMap<String,Object>(Map.of("name","Modelo reutilizável","hoursPerMonth",720,"graph",graph,"revision",0));
            var model=call("POST","/architecture-models",input,200);String id=model.path("id").asString();
            assertThat(model.at("/graph/nodes/0/quantity").asString()).isEqualTo("1.000000000001");
            var updated=call("PUT","/architecture-models/"+id,input,200);assertThat(updated.path("revision").asLong()).isEqualTo(1);
            call("PUT","/architecture-models/"+id,input,409);
            var published=call("POST","/architecture-models/"+id+"/publish",Map.of("revision",1),200);
            assertThat(published.path("status").asString()).isEqualTo("PUBLISHED");
            input.put("revision",2);call("PUT","/architecture-models/"+id,input,409);
            var copied=call("POST","/architecture-models/"+id+"/duplicate",null,200);
            assertThat(copied.path("id").asString()).isNotEqualTo(id);assertThat(copied.path("status").asString()).isEqualTo("DRAFT");
            var estimateBody=Map.of("name","Cenário 1","revision",2,"quoteId",quote.path("id").asString());
            var value=call("POST","/architecture-models/"+id+"/estimates",estimateBody,200);
            assertThat(value.at("/usd/complete").asBoolean()).isTrue();
            assertThat(value.at("/brl/monthlyCost").decimalValue()).isEqualByComparingTo("782.22");
            var other=call("POST","/architecture-models/"+id+"/estimates",estimateBody,200);
            assertThat(other.path("estimateId").asString()).isNotEqualTo(value.path("estimateId").asString());
            var contractBody=Map.of("reference","CT-TEST-1","name","Plataforma","customerName","Equipe teste","valuationId",value.path("id").asString(),"startsOn","2025-02-01","months",6);
            var contract=call("POST","/contracts",contractBody,200);
            assertThat(contract.path("totalBrl").decimalValue()).isEqualByComparingTo("4693.32");
            assertThat(contract.at("/valuation/exchangeQuote/id").asString()).isEqualTo(quote.path("id").asString());
            call("POST","/contracts",contractBody,409);
            var before=call("GET","/estimates",null,200).path("items").size();
            call("POST","/architecture-models/"+id+"/estimates",Map.of("name","Não persistir","revision",2,"quoteId",UUID.randomUUID().toString()),404);
            assertThat(call("GET","/estimates",null,200).path("items").size()).isEqualTo(before);
            verifyRegionalSpecification(input,context.getBean(org.springframework.jdbc.core.simple.JdbcClient.class));
            verifyStructureLifecycle(id,quote.path("id").asString(),input,context.getBean(org.springframework.jdbc.core.simple.JdbcClient.class));
            verifyStructureSearch(context.getBean(org.springframework.jdbc.core.simple.JdbcClient.class));
            var settings=call("GET","/parameters",null,200);
            call("PUT","/parameters",Map.of("hoursPerMonth",730,"revision",settings.path("revision").asLong()),200);
            call("PUT","/parameters",Map.of("hoursPerMonth",720,"revision",settings.path("revision").asLong()),409);
        } finally { bcb.stop(0); }
    }

    private record HistoryRow(UUID id, String service, String region, String status, long processed, java.time.Instant started) {}

    private void verifyStructureSearch(org.springframework.jdbc.core.simple.JdbcClient jdbc) throws Exception {
        UUID last = null;
        for (int index=0;index<26;index++) {
            last=UUID.randomUUID();
            var specification=Map.of("description","","primaryProvider","AWS","category",index%2==0?"PLATFORM":"OTHER",
                    "environment",index%3==0?"PRODUCTION":"DEVELOPMENT","locations",List.of(Map.of("provider","AWS","regionCode","us-east-1")));
            jdbc.sql("INSERT INTO pop_price_system_service.architecture_model(id,name,hours_per_month,graph,specification) VALUES(:id,:name,720,CAST(:graph AS jsonb),CAST(:spec AS jsonb))")
                    .param("id",last).param("name",String.format("Ordenacao ZZ %02d",index))
                    .param("graph","{\"nodes\":[],\"edges\":[]}").param("spec",json.write(specification)).update();
        }
        String baseQuery="/architecture-models?q=Ordenacao&sort=name&direction=ASC&size=10";
        var first=call("GET",baseQuery,null,200);
        assertThat(first.path("total").asLong()).isEqualTo(26);
        assertThat(first.path("items").size()).isEqualTo(10);
        assertThat(first.at("/items/0/name").asString()).isEqualTo("Ordenacao ZZ 00");
        assertThat(first.path("hasMore").asBoolean()).isTrue();
        var next=call("GET",baseQuery+"&offset=20",null,200);
        assertThat(next.path("total").asLong()).isEqualTo(26);
        assertThat(next.path("items").size()).isEqualTo(6);
        assertThat(next.at("/items/0/name").asString()).isEqualTo("Ordenacao ZZ 20");
        assertThat(next.path("hasMore").asBoolean()).isFalse();
        assertThat(call("GET",baseQuery+"&offset=100",null,200).path("total").asLong()).isEqualTo(26);
        assertThat(call("GET",baseQuery.replace("ASC","DESC"),null,200).at("/items/0/name").asString()).isEqualTo("Ordenacao ZZ 25");
        assertThat(call("GET",baseQuery+"&provider=AWS&category=PLATFORM&environment=PRODUCTION",null,200).path("total").asLong()).isEqualTo(5);
        assertThat(call("GET",baseQuery+"&provider=AZURE",null,200).path("total").asLong()).isZero();
        assertThat(call("GET",baseQuery.replace("q=Ordenacao","q=Ordenacao%25"),null,200).path("total").asLong()).isZero();
        jdbc.sql("UPDATE pop_price_system_service.architecture_model SET archived_at=now() WHERE id=:id").param("id",last).update();
        assertThat(call("GET",baseQuery+"&lifecycle=ARCHIVED",null,200).path("total").asLong()).isEqualTo(1);
        assertThat(call("GET",baseQuery+"&lifecycle=ALL",null,200).path("total").asLong()).isEqualTo(26);
        jdbc.sql("UPDATE pop_price_system_service.architecture_model SET deleted_at=now() WHERE id=:id").param("id",last).update();
        assertThat(call("GET",baseQuery+"&lifecycle=ALL",null,200).path("total").asLong()).isEqualTo(25);
        for (String sort:StructureSearch.SORTS) call("GET","/architecture-models?sort="+sort+"&direction=DESC&size=1",null,200);
        call("GET","/architecture-models?sort=name%3BDROP",null,400);
        call("GET","/architecture-models?direction=SIDEWAYS",null,400);
        call("GET","/architecture-models?provider=INVALID",null,400);
        call("GET","/architecture-models?size=101",null,400);
    }

    private void verifyRegionalSpecification(Map<String,Object> original,org.springframework.jdbc.core.simple.JdbcClient jdbc) throws Exception {
        jdbc.sql("INSERT INTO pop_price_system_service.cloud_region(provider,code,name) VALUES('AWS','ca-central-1','Canada Central') ON CONFLICT DO NOTHING").update();
        var firstSpec=Map.of("description","Cenário regional","category","PLATFORM","environment","PRODUCTION","primaryProvider","AWS","locations",List.of(Map.of("provider","AWS","regionCode","us-east-1")));
        var secondSpec=new HashMap<String,Object>(firstSpec);secondSpec.put("locations",List.of(Map.of("provider","AWS","regionCode","ca-central-1")));
        var input=new HashMap<String,Object>(original);input.put("revision",0);input.put("specification",firstSpec);
        var saved=call("POST","/architecture-models",input,200);String id=saved.path("id").asString();
        var invalidDocument=new HashMap<String,Object>();invalidDocument.put("nodes",null);invalidDocument.put("edges",List.of());
        var invalidSave=new HashMap<String,Object>(input);invalidSave.put("graph",invalidDocument);
        call("PUT","/architecture-models/"+id,invalidSave,400);
        assertThat(saved.at("/specification/locations/0/regionCode").asString()).isEqualTo("us-east-1");
        assertThat(saved.at("/specification/primaryProvider").asString()).isEqualTo("AWS");
        assertThat(jdbc.sql("SELECT specification->>'environment' FROM pop_price_system_service.architecture_model WHERE id=:id").param("id",UUID.fromString(id)).query(String.class).single()).isEqualTo("PRODUCTION");
        input.put("specification",secondSpec);call("PUT","/architecture-models/"+id,input,409);
        var duplicate=Map.of("name","Cenário Canadá","hoursPerMonth",720,"revision",0,"specification",secondSpec);
        var copied=call("POST","/architecture-models/"+id+"/duplicate",duplicate,200);String copyId=copied.path("id").asString();
        assertThat(copied.at("/graph/nodes/0/rateId").isNull()).isTrue();
        assertThat(copied.at("/graph/nodes/0/availabilityZone").isNull()).isTrue();
        assertThat(copied.at("/graph/nodes/0/provider").asString()).isEqualTo("AWS");
        assertThat(copied.at("/graph/nodes/0/quantity").asString()).isEqualTo("1.000000000001");
        assertThat(copied.at("/graph/edges/0/charges").isEmpty()).isTrue();
        call("PUT","/architecture-models/"+copyId,input,422); // Old region's rates cannot be reintroduced.
        assertThat(call("GET","/architecture-models/"+copyId,null,200).path("revision").asLong()).isZero();
        var unchanged=call("GET","/architecture-models/"+id,null,200);
        assertThat(unchanged.at("/specification/locations/0/regionCode").asString()).isEqualTo("us-east-1");
        assertThat(unchanged.at("/graph/nodes/0/rateId").isNull()).isFalse();
        var same=call("POST","/architecture-models/"+id+"/duplicate",null,200);
        assertThat(same.path("specification")).isEqualTo(saved.path("specification"));
        assertThat(same.path("graph")).isEqualTo(saved.path("graph"));
        var invalidSpec=new HashMap<String,Object>(firstSpec);invalidSpec.put("locations",List.of(Map.of("provider","AWS","regionCode","unknown-region")));
        input.put("specification",invalidSpec);call("POST","/architecture-models",input,422);
        invalidSpec.put("locations",List.of(Map.of("provider","AWS","regionCode","us-east-1"),Map.of("provider","AWS","regionCode","ca-central-1")));
        call("POST","/architecture-models",input,400);
        // A historical draft keeps its ID and graph when configured; incompatible old prices are cleared.
        var legacy=call("POST","/architecture-models",original,200);input.put("specification",secondSpec);
        var configured=call("PUT","/architecture-models/"+legacy.path("id").asString(),input,200);
        assertThat(configured.at("/graph/nodes/0/rateId").isNull()).isTrue();
        assertThat(configured.path("id")).isEqualTo(legacy.path("id"));
        var missingPrimary=new HashMap<String,Object>(firstSpec);missingPrimary.remove("primaryProvider");
        input.put("specification",missingPrimary);call("POST","/architecture-models",input,400);
        missingPrimary.put("primaryProvider","AZURE");call("POST","/architecture-models",input,400);
        jdbc.sql("INSERT INTO pop_price_system_service.cloud_region(provider,code,name) VALUES('AZURE','eastus','East US') ON CONFLICT DO NOTHING").update();
        var multiSpec=new HashMap<String,Object>(firstSpec);
        multiSpec.put("primaryProvider","AZURE");
        multiSpec.put("locations",List.of(Map.of("provider","AWS","regionCode","us-east-1"),Map.of("provider","AZURE","regionCode","eastus")));
        input.put("specification",multiSpec);
        var multi=call("POST","/architecture-models",input,200);
        assertThat(multi.at("/specification/primaryProvider").asString()).isEqualTo("AZURE");
        assertThat(jdbc.sql("SELECT specification->>'primaryProvider' FROM pop_price_system_service.architecture_model WHERE id=:id").param("id",UUID.fromString(multi.path("id").asString())).query(String.class).single()).isEqualTo("AZURE");
        multiSpec.put("primaryProvider","AWS");
        var primaryCopy=call("POST","/architecture-models/"+multi.path("id").asString()+"/duplicate",Map.of("name","Outro principal","hoursPerMonth",720,"revision",0,"specification",multiSpec),200);
        assertThat(primaryCopy.path("graph")).isEqualTo(multi.path("graph"));
        assertThat(primaryCopy.at("/specification/primaryProvider").asString()).isEqualTo("AWS");
    }

    private void verifyStructureLifecycle(String publishedId,String quoteId,Map<String,Object> input,org.springframework.jdbc.core.simple.JdbcClient jdbc) throws Exception {
        var summary=call("GET","/architecture-models?lifecycle=ALL",null,200).path("items").valueStream()
                .filter(row->row.path("id").asString().equals(publishedId)).findFirst().orElseThrow();
        assertThat(summary.path("componentCount").asInt()).isEqualTo(2);
        assertThat(summary.path("clouds").get(0).asString()).isEqualTo("AWS");
        assertThat(summary.path("createdAt").asString()).isNotBlank();
        assertThat(summary.path("predictedMonthlyCost").decimalValue()).isEqualByComparingTo("144.00");
        assertThat(summary.path("costRevision").asLong()).isEqualTo(2);
        var archived=call("POST","/architecture-models/"+publishedId+"/archive",Map.of("revision",2),200);
        assertThat(archived.path("status").asString()).isEqualTo("PUBLISHED");
        call("POST","/architecture-models/"+publishedId+"/unarchive",Map.of("revision",2),409);
        call("POST","/architecture-models/"+publishedId+"/estimates",Map.of("revision",3,"name","Arquivada","quoteId",quoteId),409);
        assertThat(call("GET","/architecture-models",null,200).path("items").valueStream().noneMatch(row->row.path("id").asString().equals(publishedId))).isTrue();
        assertThat(call("GET","/architecture-models?lifecycle=ARCHIVED",null,200).path("items").get(0).path("id").asString()).isEqualTo(publishedId);
        var restored=call("POST","/architecture-models/"+publishedId+"/unarchive",Map.of("revision",3),200);
        assertThat(restored.path("status").asString()).isEqualTo("PUBLISHED");

        var node=new LinkedHashMap<String,Object>();
        node.put("id",UUID.randomUUID().toString());node.put("name","Recurso sem preço");node.put("x",12);node.put("y",24);
        node.put("rateId",null);node.put("provider","AZURE");node.put("category","compute");node.put("accountCode","principal");
        node.put("quantity","1");node.put("consumption","1");node.put("consumptionUnit","Hrs");node.put("period","HOUR");
        var save=new HashMap<String,Object>(input);save.put("revision",0);save.put("name","Estrutura em desenho");save.put("graph",Map.of("nodes",List.of(node),"edges",List.of()));
        var draft=call("POST","/architecture-models",save,200);String id=draft.path("id").asString();
        call("POST","/architecture-models/"+id+"/estimates",Map.of("revision",0,"name","Sem tarifas","quoteId",quoteId),422);
        call("POST","/architecture-models/"+id+"/archive",Map.of("revision",0),200);
        save.put("revision",1);call("PUT","/architecture-models/"+id,save,409);
        call("POST","/architecture-models/"+id+"/publish",Map.of("revision",1),409);
        call("POST","/architecture-models/"+id+"/unarchive",Map.of("revision",1),200);
        call("DELETE","/architecture-models/"+id+"?revision=1",null,409);
        call("DELETE","/architecture-models/"+id+"?revision=2",null,204);
        call("GET","/architecture-models/"+id,null,404);
        assertThat(call("GET","/architecture-models?lifecycle=ALL",null,200).path("items").valueStream().noneMatch(row->row.path("id").asString().equals(id))).isTrue();
        assertThat(jdbc.sql("SELECT deleted_at IS NOT NULL AND jsonb_array_length(graph->'nodes')=1 FROM pop_price_system_service.architecture_model WHERE id=:id").param("id",UUID.fromString(id)).query(Boolean.class).single()).isTrue();
        call("DELETE","/architecture-models/"+publishedId+"?revision=4",null,204);
        assertThat(call("GET","/contracts",null,200).path("items").size()).isEqualTo(1);
        assertThat(call("GET","/valuations",null,200).path("items").size()).isEqualTo(2);
    }

    private void verifyServiceSynchronizationDates(org.springframework.jdbc.core.simple.JdbcClient jdbc) throws Exception {
        jdbc.sql("INSERT INTO pop_price_system_service.cloud_provider(code,name) VALUES('AZURE','Azure test')").update();
        jdbc.sql("INSERT INTO pop_price_system_service.cloud_service(provider,code,name) VALUES('AWS','SyncDate','Date test'),('AZURE','SyncDate','Date test'),('AWS','NeverSynced','Never'),('AWS','FailedOnly','Failed')").update();
        String[][] observations = {
                {"AWS", "SyncDate", "ca-central-1", "COMPLETED", "2025-01-10T12:00:00Z"},
                {"AWS", "SyncDate", "us-east-1", "COMPLETED", "2025-01-11T13:30:00Z"},
                {"AWS", "SyncDate", "ca-central-1", "FAILED", "2025-01-12T14:00:00Z"},
                {"AWS", "SyncDate", "us-east-1", "RUNNING", null},
                {"AZURE", "SyncDate", "eastus", "COMPLETED", "2025-01-14T15:00:00Z"},
                {"AWS", "FailedOnly", "us-east-1", "FAILED", "2025-01-15T15:00:00Z"}
        };
        for (String[] observation : observations) {
            jdbc.sql("INSERT INTO pop_price_system_service.catalog_synchronization(id,provider,service_code,region_code,status,finished_at) VALUES(:id,:provider,:service,:region,:status,:finished)")
                    .param("id", UUID.randomUUID()).param("provider", observation[0]).param("service", observation[1])
                    .param("region", observation[2]).param("status", observation[3])
                    .param("finished", observation[4] == null ? null : java.sql.Timestamp.from(java.time.Instant.parse(observation[4])), java.sql.Types.TIMESTAMP).update();
        }
        var aws = call("GET", "/catalog/services?provider=AWS&size=200", null, 200).path("items");
        var synced = aws.valueStream().filter(row -> row.path("code").asString().equals("SyncDate")).findFirst().orElseThrow();
        assertThat(synced.path("lastSynchronizedAt").asString()).isEqualTo("2025-01-11T13:30:00Z");
        for (String code : List.of("NeverSynced", "FailedOnly")) {
            var row = aws.valueStream().filter(item -> item.path("code").asString().equals(code)).findFirst().orElseThrow();
            assertThat(row.path("lastSynchronizedAt").isNull()).as(code).isTrue();
        }
        var azure = call("GET", "/catalog/services?provider=AZURE&size=200", null, 200).path("items").get(0);
        assertThat(azure.path("lastSynchronizedAt").asString()).isEqualTo("2025-01-14T15:00:00Z");
        var firstPage = call("GET", "/catalog/services?provider=AZURE&size=1", null, 200).path("items").get(0);
        assertThat(firstPage).isEqualTo(azure);
    }

    private void verifySynchronizationHistory(org.springframework.jdbc.core.simple.JdbcClient jdbc) throws Exception {
        var rows = new ArrayList<HistoryRow>();
        for (int index = 0; index < 6; index++) {
            var row = new HistoryRow(UUID.nameUUIDFromBytes(("history-" + index).getBytes(StandardCharsets.UTF_8)),
                    index % 2 == 0 ? "AmazonS3" : "AmazonEKS", index % 3 == 0 ? "us-east-1" : "ca-central-1",
                    new String[]{"COMPLETED", "RUNNING", "FAILED"}[index % 3], index % 3 == 0 ? 100 : 2,
                    java.time.Instant.parse("2025-01-0" + (index % 2 + 1) + "T12:00:00Z"));
            rows.add(row);
            jdbc.sql("INSERT INTO pop_price_system_service.catalog_synchronization(id,provider,service_code,region_code,status,processed,started_at) VALUES(:id,'AWS',:service,:region,:status,:processed,:started)")
                    .param("id",row.id()).param("service",row.service()).param("region",row.region())
                    .param("status",row.status()).param("processed",row.processed())
                    .param("started",java.sql.Timestamp.from(row.started())).update();
        }
        for (String field : List.of("startedAt", "serviceCode", "regionCode", "status", "processed")) {
            Comparator<HistoryRow> primary = switch (field) {
                case "serviceCode" -> Comparator.comparing(HistoryRow::service);
                case "regionCode" -> Comparator.comparing(HistoryRow::region);
                case "status" -> Comparator.comparingInt(row -> List.of("COMPLETED", "RUNNING", "FAILED").indexOf(row.status()));
                case "processed" -> Comparator.comparingLong(HistoryRow::processed);
                default -> Comparator.comparing(HistoryRow::started);
            };
            for (String direction : List.of("asc", "desc")) {
                Comparator<HistoryRow> order = direction.equals("desc") ? primary.reversed() : primary;
                if (!field.equals("startedAt")) order = order.thenComparing(HistoryRow::started, Comparator.reverseOrder());
                order = order.thenComparing(row -> row.id().toString());
                var expected = rows.stream().sorted(order).map(row -> row.id().toString()).toList();
                var actual = new ArrayList<String>();
                for (int offset = 0; offset < rows.size(); offset += 2) {
                    var page = call("GET", "/synchronizations?size=2&offset=" + offset + "&sortBy=" + field + "&direction=" + direction, null, 200);
                    page.path("items").forEach(row -> actual.add(row.path("id").asString()));
                    assertThat(page.path("hasMore").asBoolean()).isEqualTo(offset + 2 < rows.size());
                }
                assertThat(actual).as(field + " " + direction).containsExactlyElementsOf(expected);
            }
        }
        call("GET", "/synchronizations?sortBy=invalid", null, 400);
        call("GET", "/synchronizations?direction=invalid", null, 400);
    }
}
