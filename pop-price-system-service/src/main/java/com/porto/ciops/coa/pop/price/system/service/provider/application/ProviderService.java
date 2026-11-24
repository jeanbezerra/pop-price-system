package com.porto.ciops.coa.pop.price.system.service.provider.application;

import com.porto.ciops.coa.pop.price.system.service.provider.persistence.ProviderRepository;
import com.porto.ciops.coa.pop.price.system.service.provider.spi.ProviderCatalog;
import com.porto.ciops.coa.pop.price.system.service.shared.ApiException;

import org.springframework.stereotype.Service;

import java.util.List;
import java.util.function.Supplier;

/** Coordinates provider discovery separately from rate synchronization. */
@Service
public class ProviderService {
    private final ProviderRegistry registry;
    private final ProviderRepository repository;

    public ProviderService(ProviderRegistry registry, ProviderRepository repository) {
        this.registry = registry;
        this.repository = repository;
    }

    public Discovery discover(String provider, String service) {
        var remote = registry.get(provider);
        var services =
                call(() -> service == null ? remote.services() : List.of(remote.service(service)));
        List<String> regions = List.of();
        if (service != null) {
            regions = call(() -> remote.regions(service));
        }
        repository.services(provider, services);
        repository.regions(provider, regions);
        return new Discovery(services, regions);
    }

    public void validateScope(ProviderCatalog.Scope scope) {
        var discovered = discover(scope.provider(), scope.serviceCode());
        if (!discovered.regions().contains(scope.regionCode()))
            throw new ApiException(422, "Region not available for this service");
    }

    public ProviderCatalog.QueryPage query(
            String provider, String service, String region, String sku, String nextToken) {
        var remote = registry.get(provider);
        return call(() -> remote.query(service, region, sku, nextToken));
    }

    private <T> T call(Supplier<T> operation) {
        try {
            return operation.get();
        } catch (ApiException ex) {
            throw ex;
        } catch (RuntimeException ex) {
            org.slf4j.LoggerFactory.getLogger(ProviderService.class)
                    .warn("Provider request failed", ex);
            throw new ApiException(502, "Provider request unavailable");
        }
    }

    public record Discovery(List<ProviderCatalog.Service> services, List<String> regions) {}
}
