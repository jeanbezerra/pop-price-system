package com.porto.ciops.coa.pop.price.system.service.exchange.application;

import com.porto.ciops.coa.pop.price.system.service.exchange.domain.ExchangeQuote;
import com.porto.ciops.coa.pop.price.system.service.exchange.persistence.ExchangeRepository;
import com.porto.ciops.coa.pop.price.system.service.shared.ApiException;
import org.springframework.stereotype.Service;
import java.time.*;
import java.util.*;

@Service
public class ExchangeService {
    private final PtaxSource source;
    private final ExchangeRepository repository;
    public ExchangeService(PtaxSource source, ExchangeRepository repository) { this.source=source; this.repository=repository; }
    // No transaction during the remote call. The insert is atomic and append-only.
    public ExchangeQuote synchronize(LocalDate date) {
        LocalDate today = LocalDate.now(ZoneId.of("America/Sao_Paulo"));
        if (date.isAfter(today) || date.isBefore(LocalDate.of(1992,1,1))) throw new ApiException(400,"Escolha uma data entre 1992 e hoje.");
        return repository.insert(source.latestClosingOnOrBefore(date));
    }
    public ExchangeQuote get(UUID id) { return repository.find(id).orElseThrow(() -> ApiException.missing("Cotação PTAX")); }
    public List<ExchangeQuote> list() { return repository.list(); }
}
