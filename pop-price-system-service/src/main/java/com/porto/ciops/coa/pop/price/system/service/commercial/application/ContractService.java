package com.porto.ciops.coa.pop.price.system.service.commercial.application;

import com.porto.ciops.coa.pop.price.system.service.commercial.domain.CustomerContract;
import com.porto.ciops.coa.pop.price.system.service.commercial.persistence.CommercialRepository;
import com.porto.ciops.coa.pop.price.system.service.shared.ApiException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.*;
import java.util.UUID;

@Service
public class ContractService {
    private final CommercialRepository repository;
    private final ValuationService valuations;
    public ContractService(CommercialRepository repository,ValuationService valuations) { this.repository=repository;this.valuations=valuations; }
    @Transactional public CustomerContract create(String reference,String name,String customer,UUID valuationId,LocalDate startsOn,int months) {
        var value=valuations.get(valuationId);
        if (!value.usd().complete() || value.usd().items().isEmpty() || value.brl().monthlyCost()==null)
            throw new ApiException(422,"Calcule uma estimativa completa, com todos os componentes e fluxos precificados, antes de cadastrar o contrato.");
        var contract=new CustomerContract(UUID.randomUUID(),reference.trim(),name.trim(),customer.trim(),valuationId,value.estimateId(),startsOn,months,
                value.usd().monthlyCost(),value.brl().monthlyCost(),value.brl().monthlyCost().multiply(BigDecimal.valueOf(months)),value,Instant.now());
        if (!repository.save(contract)) throw new ApiException(409,"Já existe um contrato com essa referência.");
        return contract;
    }
    public CustomerContract get(UUID id) { return repository.contract(id).orElseThrow(()->ApiException.missing("Contrato")); }
    public ValuationService.ResultPage<CustomerContract> list(int size,int offset) {
        ValuationService.validatePage(size,offset); return ValuationService.page(repository.contracts(size,offset),size,offset);
    }
}
