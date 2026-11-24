package com.porto.ciops.coa.pop.price.system.service.architecture.application;

import com.porto.ciops.coa.pop.price.system.service.architecture.domain.*;
import com.porto.ciops.coa.pop.price.system.service.architecture.persistence.ArchitectureRepository;
import com.porto.ciops.coa.pop.price.system.service.catalog.application.CatalogService;
import com.porto.ciops.coa.pop.price.system.service.catalog.domain.CatalogRate;
import com.porto.ciops.coa.pop.price.system.service.commercial.application.ValuationService;
import com.porto.ciops.coa.pop.price.system.service.commercial.domain.Valuation;
import com.porto.ciops.coa.pop.price.system.service.estimation.application.EstimateService;
import com.porto.ciops.coa.pop.price.system.service.pricing.domain.PricingInput.*;
import com.porto.ciops.coa.pop.price.system.service.shared.ApiException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import java.math.BigDecimal;
import java.util.*;

@Service
public class ArchitectureService {
    private final ArchitectureRepository repository;
    private final CatalogService catalog;
    private final EstimateService estimates;
    private final ValuationService valuations;
    public ArchitectureService(ArchitectureRepository repository,CatalogService catalog,EstimateService estimates,ValuationService valuations) {
        this.repository=repository;this.catalog=catalog;this.estimates=estimates;this.valuations=valuations;
    }
    @Transactional public ArchitectureModel create(String name,BigDecimal hours,ArchitectureGraph graph) {
        validate(graph);UUID id=UUID.randomUUID();repository.create(id,name.trim(),hours,graph);return get(id);
    }
    public ArchitectureModel get(UUID id) { return repository.get(id,false).orElseThrow(()->ApiException.missing("Modelo de arquitetura")); }
    @Transactional public ArchitectureModel update(UUID id,String name,BigDecimal hours,ArchitectureGraph graph,long revision) {
        get(id);validate(graph);
        if(!repository.update(id,name.trim(),hours,graph,revision)) throw new ApiException(409,"O modelo foi alterado ou publicado. Reabra a versão atual; para editar um publicado, crie uma cópia.");
        return get(id);
    }
    @Transactional public ArchitectureModel publish(UUID id,long revision) {
        var model=repository.get(id,true).orElseThrow(()->ApiException.missing("Modelo de arquitetura"));
        if(model.graph().nodes().isEmpty()) throw new ApiException(422,"Adicione ao menos um componente antes de publicar o modelo.");
        validate(model.graph());
        if(!repository.publish(id,revision)) throw new ApiException(409,"O modelo foi alterado ou já foi publicado. Reabra a versão atual.");
        return get(id);
    }
    @Transactional public ArchitectureModel duplicate(UUID id) {
        var model=get(id);UUID copy=UUID.randomUUID();
        repository.create(copy,model.name().substring(0,Math.min(180,model.name().length()))+" (cópia)",model.hoursPerMonth(),model.graph());
        return get(copy);
    }
    public ModelPage list(String status,int size,int offset) {
        if(status!=null&&!Set.of("DRAFT","PUBLISHED").contains(status)||size<1||size>100||offset<0||offset>10000) throw new ApiException(400,"Filtro ou paginação inválida.");
        var rows=repository.list(status,size,offset);return new ModelPage(List.copyOf(rows.subList(0,Math.min(size,rows.size()))),size,offset,rows.size()>size);
    }
    @Transactional(isolation=Isolation.REPEATABLE_READ)
    public Valuation estimate(UUID id,long revision,String name,UUID quoteId) {
        var model=repository.get(id,true).orElseThrow(()->ApiException.missing("Modelo de arquitetura"));
        if(model.revision()!=revision) throw new ApiException(409,"O modelo mudou. Reabra-o antes de calcular.");
        if(model.graph().nodes().isEmpty()) throw new ApiException(422,"Adicione componentes antes de estimar.");
        var graph=model.graph();var rates=validate(graph);
        var estimate=estimates.create(name.trim(),model.hoursPerMonth());
        Map<UUID,ArchitectureGraph.Node> nodes=new HashMap<>();
        for(var n:graph.nodes()) {
            nodes.put(n.id(),n);
            estimates.add(estimate.id(),new Item(UUID.randomUUID(),n.name(),n.category(),n.accountCode(),n.rateId(),n.quantity(),n.consumption(),n.consumptionUnit(),n.period(),n.retentionDays(),null));
        }
        for(var e:graph.edges()) {
            var from=nodes.get(e.source());var to=nodes.get(e.target());var source=rates.get(from.rateId());var destination=rates.get(to.rateId());
            var flow=new Flow(e.id().toString(),source.serviceCode(),destination.serviceCode(),from.accountCode(),to.accountCode(),
                    source.regionCode(),destination.regionCode(),blankToNull(from.availabilityZone()),blankToNull(to.availabilityZone()),e.direction(),e.connectivity(),e.charges(),List.of());
            estimates.add(estimate.id(),new Item(UUID.randomUUID(),from.name()+" → "+to.name(),"network",from.accountCode(),null,BigDecimal.ONE,e.monthlyGb(),"GB",Period.MONTH,null,flow));
        }
        return valuations.calculate(estimate.id(),quoteId,model.id(),model.revision());
    }
    private Map<Long,CatalogRate> validate(ArchitectureGraph graph) {
        if(graph==null) throw new ApiException(400,"Informe o documento do Canvas.");
        graph.validate();Map<Long,CatalogRate> rates=new HashMap<>();
        for(var node:graph.nodes()) rates.computeIfAbsent(node.rateId(),this::activeRate);
        for(var edge:graph.edges()) for(var charge:edge.charges()) rates.computeIfAbsent(charge.rateId(),this::activeRate);
        return rates;
    }
    private CatalogRate activeRate(long id) {
        var rate=catalog.rate(id);
        if(!rate.active()||!"USD".equals(rate.currency())) throw new ApiException(422,"Selecione tarifas USD ativas no catálogo sincronizado.");
        return rate;
    }
    private static String blankToNull(String value) { return value==null||value.isBlank()?null:value; }
    public record ModelPage(List<ArchitectureModel.Summary> items,int size,int offset,boolean hasMore) {}
}
