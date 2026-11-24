package com.porto.ciops.coa.pop.price.system.service.exchange.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** Immutable BCB quotation. Sell rate expresses BRL per USD. */
public record ExchangeQuote(UUID id, LocalDate quotationDate, Instant quotationAt,
        BigDecimal buyRate, BigDecimal sellRate, String source, String bulletin,
        String sourceUrl, Instant synchronizedAt) {}
