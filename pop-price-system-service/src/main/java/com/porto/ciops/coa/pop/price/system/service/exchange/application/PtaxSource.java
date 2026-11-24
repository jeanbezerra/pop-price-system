package com.porto.ciops.coa.pop.price.system.service.exchange.application;

import com.porto.ciops.coa.pop.price.system.service.exchange.domain.ExchangeQuote;
import java.time.LocalDate;

/** Remote boundary; synchronization never invents a quote when BCB has no bulletin. */
public interface PtaxSource {
    Observation latestClosingOnOrBefore(LocalDate date);
    record Observation(ExchangeQuote quote, String payload) {}
}
