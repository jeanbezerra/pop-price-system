package com.porto.ciops.coa.pop.price.system.service.commercial.application;

import com.porto.ciops.coa.pop.price.system.service.commercial.domain.Valuation;
import com.porto.ciops.coa.pop.price.system.service.commercial.persistence.CommercialRepository;
import com.porto.ciops.coa.pop.price.system.service.estimation.application.EstimateService;
import com.porto.ciops.coa.pop.price.system.service.exchange.application.ExchangeService;
import com.porto.ciops.coa.pop.price.system.service.shared.ApiException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import java.util.*;

@Service
public class ValuationService {
    private final CommercialRepository repository;
    private final EstimateService estimates;
    private final ExchangeService exchange;
    public ValuationService(CommercialRepository repository, EstimateService estimates, ExchangeService exchange) {
        this.repository=repository;this.estimates=estimates;this.exchange=exchange;
    }
    @Transactional(isolation=Isolation.REPEATABLE_READ)
    public Valuation calculate(UUID estimate, UUID quote, UUID model, long modelRevision) {
        var quotation=exchange.get(quote);
        var usd=estimates.calculate(estimate);
        return repository.save(Valuation.convert(usd,quotation,model,modelRevision));
    }
    public Valuation get(UUID id) { return repository.valuation(id).orElseThrow(()->ApiException.missing("Conversão da estimativa")); }
    public ResultPage<Valuation> list(int size,int offset) { validatePage(size,offset);return page(repository.valuations(size,offset),size,offset); }
    public static void validatePage(int size,int offset) { if(size<1||size>100||offset<0||offset>10000) throw new ApiException(400,"Paginação inválida."); }
    public static <T> ResultPage<T> page(List<T> fetched,int size,int offset) { return new ResultPage<>(List.copyOf(fetched.subList(0,Math.min(size,fetched.size()))),size,offset,fetched.size()>size); }
    public record ResultPage<T>(List<T> items,int size,int offset,boolean hasMore) {}
}
