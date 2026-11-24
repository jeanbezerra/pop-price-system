package com.porto.ciops.coa.pop.price.system.service.commercial;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.porto.ciops.coa.pop.price.system.service.commercial.application.*;
import com.porto.ciops.coa.pop.price.system.service.commercial.domain.*;
import com.porto.ciops.coa.pop.price.system.service.commercial.persistence.CommercialRepository;
import com.porto.ciops.coa.pop.price.system.service.exchange.domain.ExchangeQuote;
import com.porto.ciops.coa.pop.price.system.service.pricing.domain.PricingResult;
import com.porto.ciops.coa.pop.price.system.service.shared.*;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.UUID;

class ValuationTest {
    private final Json json=new Json();
    private PricingResult result(String example) throws Exception { return json.read(json.tree(new ClassPathResource("openapi/examples.json").getContentAsString(StandardCharsets.UTF_8)).path(example).path("value").toString(),PricingResult.class); }
    private ExchangeQuote quote(String rate) { return new ExchangeQuote(UUID.randomUUID(),LocalDate.of(2025,1,10),Instant.parse("2025-01-10T16:00:00Z"),new BigDecimal("5"),new BigDecimal(rate),"BCB_PTAX","Fechamento","https://olinda.bcb.gov.br/",Instant.now()); }
    @Test void convertsExactSourceAmountsAndKeepsTheOriginalSnapshot() throws Exception {
        var usd=result("CalculationComplete");var rate=quote("5.4321");
        var valuation=Valuation.convert(usd,rate,null,0);
        assertThat(valuation.brl().monthlyCost()).isEqualByComparingTo("782.22");
        assertThat(valuation.brl().annualCost()).isEqualByComparingTo("9386.67");
        assertThat(valuation.usd()).isSameAs(usd);
        assertThat(valuation.exchangeQuote()).isSameAs(rate);
        assertThat(json.read(json.write(valuation),Valuation.class)).isEqualTo(valuation);
    }
    @Test void missingPricesNeverBecomeAZeroTotalOrAContract() throws Exception {
        var valuation=Valuation.convert(result("CalculationIncomplete"),quote("5.4321"),null,0);
        assertThat(valuation.brl().monthlyCost()).isNull();
        var repository=mock(CommercialRepository.class);var valuations=mock(ValuationService.class);
        when(valuations.get(valuation.id())).thenReturn(valuation);
        assertThatThrownBy(()->new ContractService(repository,valuations).create("CT1","Test","Customer",valuation.id(),LocalDate.now(),12))
                .isInstanceOfSatisfying(ApiException.class,error->assertThat(error.status()).isEqualTo(422));
        verifyNoInteractions(repository);
    }
    @Test void contractPreservesItsQuoteAndUsesTheRoundedMonthlyAmountForItsTerm() throws Exception {
        var valuation=Valuation.convert(result("CalculationComplete"),quote("5.4321"),null,0);
        var repository=mock(CommercialRepository.class);var valuations=mock(ValuationService.class);
        when(valuations.get(valuation.id())).thenReturn(valuation);when(repository.save(any(CustomerContract.class))).thenReturn(true);
        var contract=new ContractService(repository,valuations).create("CT1","Test","Customer",valuation.id(),LocalDate.of(2025,2,1),12);
        assertThat(contract.totalBrl()).isEqualByComparingTo("9386.64");
        assertThat(contract.valuation()).isSameAs(valuation);
        assertThat(contract.valuation().exchangeQuote().sellRate()).isEqualByComparingTo("5.4321");
    }
}
