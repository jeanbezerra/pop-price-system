package com.porto.ciops.coa.pop.price.system.service.integrations.bcb;

import static org.assertj.core.api.Assertions.*;
import com.porto.ciops.coa.pop.price.system.service.shared.*;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.concurrent.atomic.AtomicReference;

class BcbPtaxClientTest {
    private final BcbPtaxClient client=new BcbPtaxClient("https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/",new Json());
    private static final String RESPONSE="""
            {"value":[
             {"tipoBoletim":"Intermediário","cotacaoCompra":9,"cotacaoVenda":10,"dataHoraCotacao":"2025-01-10 14:00:00.000"},
             {"tipoBoletim":"Fechamento","cotacaoCompra":5.9991,"cotacaoVenda":6.0001,"dataHoraCotacao":"2025-01-09 13:00:00.000"},
             {"tipoBoletim":"Fechamento","cotacaoCompra":6.0991,"cotacaoVenda":6.1001,"dataHoraCotacao":"2025-01-10 13:00:00.123"}
            ]}
            """;
    @Test void selectsLatestClosingBeforeWeekendWithExactDecimalsAndBrazilTime() {
        var quote=client.parse(RESPONSE,LocalDate.of(2025,1,12),"https://olinda.bcb.gov.br/test").quote();
        assertThat(quote.quotationDate()).isEqualTo(LocalDate.of(2025,1,10));
        assertThat(quote.sellRate()).isEqualByComparingTo("6.1001");
        assertThat(quote.quotationAt()).isEqualTo(Instant.parse("2025-01-10T16:00:00.123Z"));
    }
    @Test void missingClosingAndInvalidResponsesAreExplicitErrors() {
        assertThatThrownBy(()->client.parse("{\"value\":[]}",LocalDate.of(2025,1,12),"source"))
                .isInstanceOfSatisfying(ApiException.class,error->assertThat(error.status()).isEqualTo(422));
        for(String invalid:new String[]{"{}",RESPONSE.replace("6.1001","0"),RESPONSE.replace("6.1001","100000000000")})
            assertThatThrownBy(()->client.parse(invalid,LocalDate.of(2025,1,12),"source"))
                    .isInstanceOfSatisfying(ApiException.class,error->assertThat(error.status()).isEqualTo(502));
    }
    @Test void httpRequestMatchesTheOfficialOdataContract() throws Exception {
        var request=new AtomicReference<String>();
        var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/odata/",exchange->{request.set(exchange.getRequestURI().toString());byte[] body=RESPONSE.getBytes(StandardCharsets.UTF_8);exchange.sendResponseHeaders(200,body.length);exchange.getResponseBody().write(body);exchange.close();});
        server.start();
        try {
            var remote=new BcbPtaxClient("http://127.0.0.1:"+server.getAddress().getPort()+"/odata/",new Json());
            assertThat(remote.latestClosingOnOrBefore(LocalDate.of(2025,1,12)).quote().sellRate()).isEqualByComparingTo("6.1001");
            assertThat(request.get()).contains("CotacaoMoedaPeriodo(","%40moeda=%27USD%27","%40dataFinalCotacao=%2701-12-2025%27","tipoBoletim%20eq%20%27Fechamento%27");
        } finally { server.stop(0); }
    }
}
