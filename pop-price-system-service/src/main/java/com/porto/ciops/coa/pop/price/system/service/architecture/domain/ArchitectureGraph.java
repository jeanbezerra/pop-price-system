package com.porto.ciops.coa.pop.price.system.service.architecture.domain;

import com.porto.ciops.coa.pop.price.system.service.pricing.domain.PricingInput.*;
import java.math.BigDecimal;
import java.util.*;
import com.fasterxml.jackson.annotation.JsonFormat;

/** Portable graph document. UI-library internals are never persisted. */
public record ArchitectureGraph(List<Node> nodes, List<Edge> edges) {
    public record Node(UUID id,String name,double x,double y,Long rateId,String category,
            String accountCode,@JsonFormat(shape=JsonFormat.Shape.STRING) BigDecimal quantity,@JsonFormat(shape=JsonFormat.Shape.STRING) BigDecimal consumption,String consumptionUnit,
            Period period,Integer retentionDays,String availabilityZone,String provider,String serviceCode,String iconKey,String iconRelease,String iconAssetPath) {}
    public record Edge(UUID id,UUID source,UUID target,@JsonFormat(shape=JsonFormat.Shape.STRING) BigDecimal monthlyGb,Direction direction,
            Connectivity connectivity,List<Charge> charges) {}

    public void validate() {
        if(nodes==null||edges==null||nodes.size()+edges.size()>100) throw new IllegalArgumentException("Use no máximo 100 componentes e ligações por modelo.");
        Set<UUID> ids=new HashSet<>();
        for(var n:nodes) {
            if(n==null||n.id()==null||!ids.add(n.id())) throw new IllegalArgumentException("Componentes precisam de identificadores únicos.");
            text(n.name(),200,"Nome");text(n.category(),100,"Categoria");text(n.accountCode(),100,"Conta");text(n.consumptionUnit(),40,"Unidade");
            if(!Double.isFinite(n.x())||!Double.isFinite(n.y())||Math.abs(n.x())>100000||Math.abs(n.y())>100000||(n.rateId()!=null&&n.rateId()<=0)||n.period()==null)
                throw new IllegalArgumentException("Posição, tarifa ou período de componente inválido.");
            if(n.rateId()==null&&(n.provider()==null||!Set.of("AWS","AZURE","GCP","GENERIC").contains(n.provider())))
                throw new IllegalArgumentException("Informe a cloud do componente sem tarifa.");
            if(n.serviceCode()!=null&&n.serviceCode().length()>200||n.iconKey()!=null&&n.iconKey().length()>200||n.iconRelease()!=null&&n.iconRelease().length()>20)
                throw new IllegalArgumentException("Referência de componente inválida.");
            if(n.iconAssetPath()!=null&&!n.iconAssetPath().matches("/architecture-icons/[a-z0-9-]+/[0-9]{4}-[0-9]{2}-[0-9]{2}/[a-z0-9-]+\\.svg"))
                throw new IllegalArgumentException("Ícone de componente inválido.");
            decimal(n.quantity(),true,12,12);decimal(n.consumption(),false,18,12);
            if(n.availabilityZone()!=null&&n.availabilityZone().length()>100) throw new IllegalArgumentException("AZ inválida.");
            if(n.retentionDays()!=null&&(n.retentionDays()<1||n.retentionDays()>36500||n.period()!=Period.DAY))
                throw new IllegalArgumentException("Retenção exige consumo diário e de 1 a 36500 dias.");
        }
        Set<UUID> edgeIds=new HashSet<>();
        for(var e:edges) {
            if(e==null||e.id()==null||!edgeIds.add(e.id())||!ids.contains(e.source())||!ids.contains(e.target())||e.source().equals(e.target()))
                throw new IllegalArgumentException("Ligações devem conectar dois componentes existentes e distintos.");
            decimal(e.monthlyGb(),false,18,12);
            if(e.direction()==null||e.connectivity()==null||e.charges()==null||e.charges().size()>8)
                throw new IllegalArgumentException("Configure direção, conectividade e até oito cobranças por ligação.");
            Set<ChargeKey> keys=new HashSet<>();
            for(var c:e.charges()) if(c==null||c.key()==null||c.rateId()<=0||!keys.add(c.key())) throw new IllegalArgumentException("Cobranças de rede inválidas ou repetidas.");
        }
    }
    private static void text(String value,int max,String name) {
        if(value==null||value.isBlank()||value.length()>max) throw new IllegalArgumentException(name+" obrigatório, com até "+max+" caracteres.");
    }
    private static void decimal(BigDecimal value,boolean positive,int integer,int fraction) {
        if(value==null||value.signum()<0||(positive&&value.signum()==0)||value.scale()>fraction||value.precision()-value.scale()>integer)
            throw new IllegalArgumentException("Quantidade ou consumo inválido.");
    }
}
