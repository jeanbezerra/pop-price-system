package com.porto.ciops.coa.pop.price.system.service.portal;

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
        return json.tree(response.body());
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
            var settings=call("GET","/parameters",null,200);
            call("PUT","/parameters",Map.of("hoursPerMonth",730,"revision",settings.path("revision").asLong()),200);
            call("PUT","/parameters",Map.of("hoursPerMonth",720,"revision",settings.path("revision").asLong()),409);
        } finally { bcb.stop(0); }
    }

    private record HistoryRow(UUID id, String service, String region, String status, long processed, java.time.Instant started) {}

    private void verifyServiceSynchronizationDates(org.springframework.jdbc.core.simple.JdbcClient jdbc) throws Exception {
        jdbc.sql("INSERT INTO ratecard.cloud_provider(code,name) VALUES('AZURE','Azure test')").update();
        jdbc.sql("INSERT INTO ratecard.cloud_service(provider,code,name) VALUES('AWS','SyncDate','Date test'),('AZURE','SyncDate','Date test'),('AWS','NeverSynced','Never'),('AWS','FailedOnly','Failed')").update();
        String[][] observations = {
                {"AWS", "SyncDate", "ca-central-1", "COMPLETED", "2025-01-10T12:00:00Z"},
                {"AWS", "SyncDate", "us-east-1", "COMPLETED", "2025-01-11T13:30:00Z"},
                {"AWS", "SyncDate", "ca-central-1", "FAILED", "2025-01-12T14:00:00Z"},
                {"AWS", "SyncDate", "us-east-1", "RUNNING", null},
                {"AZURE", "SyncDate", "eastus", "COMPLETED", "2025-01-14T15:00:00Z"},
                {"AWS", "FailedOnly", "us-east-1", "FAILED", "2025-01-15T15:00:00Z"}
        };
        for (String[] observation : observations) {
            jdbc.sql("INSERT INTO ratecard.catalog_synchronization(id,provider,service_code,region_code,status,finished_at) VALUES(:id,:provider,:service,:region,:status,:finished)")
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
            jdbc.sql("INSERT INTO ratecard.catalog_synchronization(id,provider,service_code,region_code,status,processed,started_at) VALUES(:id,'AWS',:service,:region,:status,:processed,:started)")
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
