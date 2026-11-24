package com.porto.ciops.coa.pop.price.system.service.integrations.bcb;

import com.porto.ciops.coa.pop.price.system.service.exchange.application.PtaxSource;
import com.porto.ciops.coa.pop.price.system.service.exchange.domain.ExchangeQuote;
import com.porto.ciops.coa.pop.price.system.service.shared.ApiException;
import com.porto.ciops.coa.pop.price.system.service.shared.Json;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.time.format.*;
import java.util.*;
import tools.jackson.databind.JsonNode;

/** Implements the exact CotacaoMoedaPeriodo contract from BCB's PTAX v1 Swagger. */
@Component
public class BcbPtaxClient implements PtaxSource {
    private static final ZoneId ZONE = ZoneId.of("America/Sao_Paulo");
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("MM-dd-uuuu");
    private static final DateTimeFormatter TIMESTAMP = new DateTimeFormatterBuilder()
            .appendPattern("uuuu-MM-dd HH:mm:ss").optionalStart()
            .appendFraction(java.time.temporal.ChronoField.NANO_OF_SECOND, 0, 9, true).optionalEnd().toFormatter();
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final URI base;
    private final Json json;

    public BcbPtaxClient(@Value("${app.exchange.ptax-base-url:https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/}") String base, Json json) {
        this.base = URI.create(base.endsWith("/") ? base : base + "/");
        if (!Set.of("http", "https").contains(this.base.getScheme())) throw new IllegalArgumentException("Invalid PTAX base URL");
        this.json = json;
    }

    @Override public Observation latestClosingOnOrBefore(LocalDate date) {
        String path = "CotacaoMoedaPeriodo(moeda=@moeda,dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)";
        String query = "?%40moeda=" + encode("'USD'") + "&%40dataInicial=" + encode("'" + DATE.format(date.minusDays(14)) + "'")
                + "&%40dataFinalCotacao=" + encode("'" + DATE.format(date) + "'")
                + "&%24filter=" + encode("tipoBoletim eq 'Fechamento'")
                + "&%24orderby=" + encode("dataHoraCotacao desc") + "&%24top=100&%24format=json";
        URI uri = base.resolve(path + query);
        try {
            var response = http.send(HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(30))
                    .header("Accept", "application/json").GET().build(), HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200 || response.body().length() > 1_000_000)
                throw new ApiException(502, "Não foi possível consultar a PTAX no BCB. Tente novamente.");
            return parse(response.body(), date, uri.toString());
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new ApiException(502, "Consulta à PTAX interrompida.");
        } catch (java.io.IOException ex) {
            throw new ApiException(502, "BCB indisponível ou tempo de consulta excedido. A cotação anterior foi preservada.");
        }
    }

    public Observation parse(String body, LocalDate requested, String sourceUrl) {
        try {
            JsonNode values = json.tree(body).path("value");
            if (!values.isArray()) throw new IllegalArgumentException("Missing OData value");
            ExchangeQuote latest = null;
            for (JsonNode row : values) {
                if (!"Fechamento".equals(row.path("tipoBoletim").asString())) continue;
                LocalDateTime local = LocalDateTime.parse(row.path("dataHoraCotacao").asString(), TIMESTAMP);
                if (local.toLocalDate().isAfter(requested) || local.toLocalDate().isBefore(requested.minusDays(14))) continue;
                if (!row.path("cotacaoVenda").isNumber() || !row.path("cotacaoCompra").isNumber()) throw new IllegalArgumentException("Invalid rate");
                var buy = row.path("cotacaoCompra").decimalValue();
                var sell = row.path("cotacaoVenda").decimalValue();
                if (buy.signum() <= 0 || sell.signum() <= 0 || sell.precision()-sell.scale()>10 || sell.scale() > 10 || buy.precision()-buy.scale()>10 || buy.scale() > 10)
                    throw new IllegalArgumentException("Invalid rate precision");
                Instant instant = local.atZone(ZONE).toInstant();
                if (latest == null || instant.isAfter(latest.quotationAt())) latest = new ExchangeQuote(
                        UUID.randomUUID(), local.toLocalDate(), instant, buy, sell, "BCB_PTAX", "Fechamento", sourceUrl, Instant.now());
            }
            if (latest == null) throw new ApiException(422, "Não há fechamento PTAX nos 14 dias anteriores à data escolhida. Selecione outra data.");
            return new Observation(latest, body);
        } catch (ApiException ex) { throw ex; }
        catch (RuntimeException ex) { throw new ApiException(502, "O BCB retornou uma cotação inválida. Nenhum valor foi substituído."); }
    }
    private static String encode(String value) { return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20"); }
}
