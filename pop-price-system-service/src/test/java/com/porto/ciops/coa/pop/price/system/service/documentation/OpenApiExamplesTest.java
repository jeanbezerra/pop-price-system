package com.porto.ciops.coa.pop.price.system.service.documentation;

import static org.assertj.core.api.Assertions.assertThat;

import com.porto.ciops.coa.pop.price.system.service.catalog.domain.CatalogRate;
import com.porto.ciops.coa.pop.price.system.service.estimation.api.EstimateRequests;
import com.porto.ciops.coa.pop.price.system.service.pricing.calculation.PricingEngine;
import com.porto.ciops.coa.pop.price.system.service.pricing.domain.PricingInput.Item;
import com.porto.ciops.coa.pop.price.system.service.shared.Json;
import com.porto.ciops.coa.pop.price.system.service.synchronization.api.SynchronizationController;

import jakarta.validation.Validation;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.core.io.ClassPathResource;

import tools.jackson.databind.JsonNode;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;

class OpenApiExamplesTest {
    private final Json json = new Json();

    @ParameterizedTest(name = "{0} matches the HTTP input contract")
    @MethodSource("requestExamples")
    void requestExamplesSatisfyValidation(String name, Class<?> contract) throws IOException {
        Object request = json.read(example(name).toString(), contract);
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            assertThat(factory.getValidator().validate(request)).as(name).isEmpty();
        }
    }

    static Stream<Arguments> requestExamples() {
        return Stream.of(
                Arguments.of("SyncRequest", SynchronizationController.Request.class),
                Arguments.of("CreateEstimate", EstimateRequests.Create.class),
                Arguments.of("AddHourlyItem", EstimateRequests.AddItem.class),
                Arguments.of("AddNoPriceItem", EstimateRequests.AddItem.class),
                Arguments.of("AddRetentionItem", EstimateRequests.AddItem.class),
                Arguments.of("AddNetworkItem", EstimateRequests.AddItem.class));
    }

    @Test
    void completeCalculationExampleUsesTheActualPricingRules() throws IOException {
        var expected = example("CalculationComplete");
        var price = json.read(example("Rate").toString(), CatalogRate.class);
        var item = json.read(example("Item").toString(), Item.class);
        var actual = new PricingEngine().calculate(
                UUID.fromString(expected.path("estimateId").asString()),
                expected.path("revision").asLong(), expected.path("name").asString(),
                expected.path("hoursPerMonth").decimalValue(), List.of(item),
                Map.of(price.id(), List.of(price)));
        assertThat(actual.complete()).isTrue();
        assertThat(actual.monthlyCost()).isEqualByComparingTo(expected.path("monthlyCost").decimalValue());
        assertThat(actual.annualCost()).isEqualByComparingTo(expected.path("annualCost").decimalValue());
        assertThat(actual.hourlyCost()).isEqualByComparingTo(expected.path("hourlyCost").decimalValue());
        assertThat(actual.knownMonthlySubtotal()).isEqualByComparingTo(actual.monthlyCost());
        assertThat(actual.items().getFirst().charges().getFirst().monthlyBilledConsumption())
                .isEqualByComparingTo(new BigDecimal("1440"));
        assertThat(actual.warnings()).isEmpty();
    }

    @Test
    void incompleteExampleDoesNotPresentTheKnownSubtotalAsATotal() throws IOException {
        var expected = example("CalculationIncomplete");
        var item = json.read(expected.path("items").get(0).path("component").toString(), Item.class);
        var actual = new PricingEngine().calculate(
                UUID.fromString(expected.path("estimateId").asString()),
                expected.path("revision").asLong(), expected.path("name").asString(),
                expected.path("hoursPerMonth").decimalValue(), List.of(item), Map.of());
        assertThat(actual.complete()).isFalse();
        assertThat(actual.monthlyCost()).isNull();
        assertThat(actual.annualCost()).isNull();
        assertThat(actual.hourlyCost()).isNull();
        assertThat(actual.knownMonthlySubtotal()).isEqualByComparingTo(expected.path("knownMonthlySubtotal").decimalValue());
        assertThat(actual.items().getFirst().status()).isEqualTo("UNPRICEABLE");
        assertThat(actual.warnings()).containsExactly(expected.path("warnings").get(0).asString());
    }

    private JsonNode example(String name) throws IOException {
        return json.tree(new ClassPathResource("openapi/examples.json")
                .getContentAsString(StandardCharsets.UTF_8)).path(name).path("value");
    }
}
