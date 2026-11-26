package com.porto.ciops.coa.pop.price.system.service.architecture.domain;

import java.util.*;

/** Regional planning context, shared by every component in a structure. */
public record StructureSpecification(String description, String category, String environment, List<Location> locations, String primaryProvider) {
    public record Location(String provider, String regionCode) {}

    public void validate() {
        if(description==null||description.length()>2000) throw new IllegalArgumentException("A descrição deve ter até 2000 caracteres.");
        if(category==null||!Set.of("APPLICATION","PLATFORM","DATA","NETWORK","SECURITY","OTHER").contains(category)) throw new IllegalArgumentException("Categoria de estrutura inválida.");
        if(environment==null||!Set.of("DEVELOPMENT","TEST","HOMOLOGATION","PRODUCTION").contains(environment)) throw new IllegalArgumentException("Ambiente inválido.");
        if(locations==null||locations.isEmpty()||locations.size()>3) throw new IllegalArgumentException("Defina de uma a três clouds, com uma região por cloud.");
        Set<String> providers=new HashSet<>();
        for(var location:locations) {
            if(location==null||location.provider()==null||!Set.of("AWS","AZURE","GCP").contains(location.provider())||!providers.add(location.provider())||location.regionCode()==null||!location.regionCode().matches("[a-zA-Z0-9_.-]{1,100}"))
                throw new IllegalArgumentException("Defina uma região válida para cada cloud, sem clouds repetidas.");
        }
        if(primaryProvider==null||!providers.contains(primaryProvider)) throw new IllegalArgumentException("Escolha explicitamente um provedor principal entre os provedores da estrutura.");
    }
    public String region(String provider) {
        return locations.stream().filter(l->l.provider().equals(provider)).map(Location::regionCode).findFirst().orElse(null);
    }
    public boolean sameLocations(StructureSpecification other) {
        return other!=null&&new HashSet<>(locations).equals(new HashSet<>(other.locations));
    }
}
