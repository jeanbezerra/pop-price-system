package com.porto.ciops.coa.pop.price.system.service.provider.application;

import com.porto.ciops.coa.pop.price.system.service.provider.spi.ProviderCatalog;
import com.porto.ciops.coa.pop.price.system.service.shared.ApiException;

import org.springframework.stereotype.Component;

import java.util.List;

/** Resolves installed providers without coupling catalog or estimates to an SDK. */
@Component
public class ProviderRegistry {
    private final List<ProviderCatalog> providers;

    public ProviderRegistry(List<ProviderCatalog> providers) {
        this.providers = List.copyOf(providers);
    }

    public ProviderCatalog get(String code) {
        return providers.stream()
                .filter(p -> p.provider().equals(code))
                .findFirst()
                .orElseThrow(() -> new ApiException(400, "Unsupported cloud provider"));
    }
}
