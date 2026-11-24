package com.porto.ciops.coa.pop.price.system.service.commercial.domain;

import com.porto.ciops.coa.pop.price.system.service.exchange.domain.ExchangeQuote;
import com.porto.ciops.coa.pop.price.system.service.pricing.domain.PricingResult;
import java.math.*;
import java.time.Instant;
import java.util.UUID;

/** Immutable source USD calculation plus the exact PTAX used for BRL conversion. */
public record Valuation(UUID id, UUID estimateId, UUID modelId, long modelRevision,
        PricingResult usd, ExchangeQuote exchangeQuote, BrlTotals brl, Instant createdAt) {
    public record BrlTotals(BigDecimal hourlyCost, BigDecimal monthlyCost, BigDecimal annualCost,
            BigDecimal knownMonthlySubtotal, String currency, String rounding) {}

    public static Valuation convert(PricingResult usd, ExchangeQuote quote, UUID modelId, long modelRevision) {
        if (!"USD".equals(usd.currency())) throw new IllegalArgumentException("A origem do cálculo deve estar em USD.");
        var rate = quote.sellRate();
        return new Valuation(UUID.randomUUID(), usd.estimateId(), modelId, modelRevision, usd, quote,
                new BrlTotals(money(usd.hourlyCost(),rate),money(usd.monthlyCost(),rate),money(usd.annualCost(),rate),
                        money(usd.knownMonthlySubtotal(),rate),"BRL","USD total × PTAX venda; 2 casas decimais; HALF_UP"), Instant.now());
    }
    private static BigDecimal money(BigDecimal value, BigDecimal rate) { return value == null ? null : value.multiply(rate).setScale(2,RoundingMode.HALF_UP); }
}
