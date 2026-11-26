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
        return create(name,hours,graph,null);
    }
    @Transactional public ArchitectureModel create(String name,BigDecimal hours,ArchitectureGraph graph,StructureSpecification specification) {
        validate(graph);validateSpecification(specification);validateScope(graph,specification);
        if(specification!=null) graph=regionalCopy(graph,null,specification);
        UUID id=UUID.randomUUID();repository.create(id,name.trim(),hours,graph,specification);return get(id);
    }
    public ArchitectureModel get(UUID id) { return repository.get(id,false).orElseThrow(()->ApiException.missing("Modelo de arquitetura")); }
    @Transactional public ArchitectureModel update(UUID id,String name,BigDecimal hours,ArchitectureGraph graph,long revision) {
        return update(id,name,hours,graph,revision,null);
    }
    @Transactional public ArchitectureModel update(UUID id,String name,BigDecimal hours,ArchitectureGraph graph,long revision,StructureSpecification specification) {
        if(graph==null) throw new ApiException(400,"Informe o documento do Canvas.");
        graph.validate();
        var current=get(id);var context=specification==null?current.specification():specification;
        validateSpecification(context);
        if(current.specification()!=null&&!current.specification().sameLocations(context)) throw new ApiException(409,"Para comparar outra região, duplique a estrutura. A região desta versão foi preservada.");
        if(current.specification()==null&&context!=null) graph=regionalCopy(graph,null,context);
        validate(graph);validateScope(graph,context);
        if(!repository.update(id,name.trim(),hours,graph,revision,context)) throw new ApiException(409,"O modelo foi alterado ou publicado. Reabra a versão atual; para editar um publicado, crie uma cópia.");
        return get(id);
    }
    @Transactional public ArchitectureModel publish(UUID id,long revision) {
        var model=repository.get(id,true).orElseThrow(()->ApiException.missing("Modelo de arquitetura"));
        if(model.graph().nodes().isEmpty()) throw new ApiException(422,"Adicione ao menos um componente antes de publicar o modelo.");
        validate(model.graph());
        validateScope(model.graph(),model.specification());
        if(!repository.publish(id,revision)) throw new ApiException(409,"O modelo foi alterado ou já foi publicado. Reabra a versão atual.");
        return get(id);
    }
    @Transactional public ArchitectureModel duplicate(UUID id) {
        return duplicate(id,null,null,null,null);
    }
    @Transactional public ArchitectureModel duplicate(UUID id,String name,BigDecimal hours,StructureSpecification specification,Long revision) {
        var model=repository.get(id,true).orElseThrow(()->ApiException.missing("Estrutura"));UUID copy=UUID.randomUUID();
        if(revision!=null&&model.revision()!=revision) throw new ApiException(409,"A estrutura mudou. Atualize a lista antes de duplicar.");
        var context=specification==null?model.specification():specification;validateSpecification(context);
        var graph=context==null?model.graph():regionalCopy(model.graph(),model.specification(),context);
        validateScope(graph,context);
        repository.create(copy,name==null?model.name().substring(0,Math.min(180,model.name().length()))+" (cópia)":name.trim(),hours==null?model.hoursPerMonth():hours,graph,context);
        return get(copy);
    }
    @Transactional public ArchitectureModel archive(UUID id,long revision,boolean archived) {
        get(id);
        if(!repository.lifecycle(id,revision,archived?"archive":"unarchive")) throw new ApiException(409,"A estrutura mudou. Atualize a lista antes de tentar novamente.");
        return get(id);
    }
    @Transactional public void delete(UUID id,long revision) {
        get(id);
        if(!repository.lifecycle(id,revision,"delete")) throw new ApiException(409,"A estrutura mudou. Atualize a lista antes de excluir.");
    }
    public ModelPage list(String status,int size,int offset) {
        return list(status,"ACTIVE",size,offset);
    }
    public ModelPage list(String status,String lifecycle,int size,int offset) {
        return list(new StructureSearch(status,lifecycle,"","","","","updatedAt","DESC",size,offset));
    }
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public ModelPage list(StructureSearch search) {
        search.validate();
        var result=repository.list(search);
        return new ModelPage(result.items(),search.size(),search.offset(),(long)search.offset()+result.items().size()<result.total(),result.total());
    }
    @Transactional(isolation=Isolation.REPEATABLE_READ)
    public Valuation estimate(UUID id,long revision,String name,UUID quoteId) {
        var model=repository.get(id,true).orElseThrow(()->ApiException.missing("Modelo de arquitetura"));
        if(model.archivedAt()!=null) throw new ApiException(409,"Desarquive a estrutura antes de gerar uma estimativa.");
        if(model.revision()!=revision) throw new ApiException(409,"O modelo mudou. Reabra-o antes de calcular.");
        if(model.graph().nodes().isEmpty()) throw new ApiException(422,"Adicione componentes antes de estimar.");
        var graph=model.graph();var rates=validate(graph);
        validateScope(graph,model.specification());
        if(graph.nodes().stream().anyMatch(n->n.rateId()==null)) throw new ApiException(422,"Vincule uma tarifa a cada componente antes de precificar a estrutura.");
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
        for(var node:graph.nodes()) if(node.rateId()!=null) rates.computeIfAbsent(node.rateId(),this::activeRate);
        for(var edge:graph.edges()) for(var charge:edge.charges()) rates.computeIfAbsent(charge.rateId(),this::activeRate);
        return rates;
    }
    private CatalogRate activeRate(long id) {
        var rate=catalog.rate(id);
        if(!rate.active()||!"USD".equals(rate.currency())) throw new ApiException(422,"Selecione tarifas USD ativas no catálogo sincronizado.");
        return rate;
    }
    private void validateSpecification(StructureSpecification specification) {
        if(specification==null) return; // Existing API clients and historical documents remain readable.
        specification.validate();
        for(var location:specification.locations()) {
            if(catalog.regions(location.provider()).stream().noneMatch(r->r.code().equals(location.regionCode())))
                throw new ApiException(422,"A região "+location.regionCode()+" não está disponível no catálogo de "+location.provider()+".");
        }
    }
    private void validateScope(ArchitectureGraph graph,StructureSpecification specification) {
        if(specification==null) return;
        for(var node:graph.nodes()) {
            if(node.rateId()==null) {
                if(!"GENERIC".equals(node.provider())&&specification.region(node.provider())==null) throw new ApiException(422,"O componente usa uma cloud fora da especificação da estrutura.");
            } else {
                var rate=catalog.rate(node.rateId());requireScopedRate(rate,specification);
                if(node.provider()!=null&&!node.provider().equals(rate.provider())||node.serviceCode()!=null&&!node.serviceCode().equals(rate.serviceCode()))
                    throw new ApiException(422,"A tarifa deve pertencer à cloud e ao serviço do componente.");
            }
        }
        for(var edge:graph.edges()) for(var charge:edge.charges()) requireScopedRate(catalog.rate(charge.rateId()),specification);
    }
    private void requireScopedRate(CatalogRate rate,StructureSpecification specification) {
        if(!rate.regionCode().equals(specification.region(rate.provider()))) throw new ApiException(422,"A tarifa não pertence à região definida na estrutura.");
    }
    private ArchitectureGraph regionalCopy(ArchitectureGraph graph,StructureSpecification before,StructureSpecification after) {
        if(before!=null&&before.sameLocations(after)) return graph;
        Set<UUID> changed=new HashSet<>();
        var nodes=graph.nodes().stream().map(n->{
            var rate=n.rateId()==null?null:catalog.rate(n.rateId());
            String provider=rate==null?n.provider():rate.provider();
            boolean different=rate!=null?!Objects.equals(rate.regionCode(),after.region(provider)):before==null?n.availabilityZone()!=null:!Objects.equals(before.region(provider),after.region(provider));
            if(different) changed.add(n.id());
            return new ArchitectureGraph.Node(n.id(),n.name(),n.x(),n.y(),different?null:n.rateId(),n.category(),n.accountCode(),n.quantity(),n.consumption(),n.consumptionUnit(),n.period(),n.retentionDays(),different?null:n.availabilityZone(),provider,rate==null?n.serviceCode():rate.serviceCode(),n.iconKey(),n.iconRelease(),n.iconAssetPath());
        }).toList();
        var edges=graph.edges().stream().map(e->new ArchitectureGraph.Edge(e.id(),e.source(),e.target(),e.monthlyGb(),e.direction(),e.connectivity(),
                changed.contains(e.source())||changed.contains(e.target())?List.of():e.charges().stream().filter(c->{var r=catalog.rate(c.rateId());return Objects.equals(r.regionCode(),after.region(r.provider()));}).toList())).toList();
        return new ArchitectureGraph(nodes,edges);
    }
    private static String blankToNull(String value) { return value==null||value.isBlank()?null:value; }
    public record ModelPage(List<ArchitectureModel.Summary> items,int size,int offset,boolean hasMore,long total) {}
}
