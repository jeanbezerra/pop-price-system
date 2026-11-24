package com.porto.ciops.coa.pop.price.system.service.catalog.application;

import com.porto.ciops.coa.pop.price.system.service.catalog.domain.*;
import com.porto.ciops.coa.pop.price.system.service.catalog.domain.CatalogViews.*;
import com.porto.ciops.coa.pop.price.system.service.catalog.persistence.CatalogRepository;
import com.porto.ciops.coa.pop.price.system.service.shared.*;

import org.springframework.stereotype.Service;

import java.util.List;

/** Public catalog query contract, also used by the pricing application. */
@Service
public class CatalogService {
    private final CatalogRepository repository;
    private final Json json;

    public CatalogService(CatalogRepository repository, Json json) {
        this.repository = repository;
        this.json = json;
    }

    public List<Provider> providers() {
        return repository.providers();
    }

    /** Validate a discovered service without coupling consumers to catalog persistence. */
    public void requireService(String provider, String code) {
        if (!repository.serviceExists(provider, code)) throw ApiException.missing("Serviço do catálogo");
    }

    public List<Region> regions(String provider) {
        if (providers().stream().noneMatch(p -> p.code().equals(provider)))
            throw ApiException.missing("Provider");
        return repository.regions(provider);
    }

    public ServicePage services(String provider, String after, int size) {
        Page.validate(size, 0, "asc");
        var fetched = repository.services(provider, after, size + 1);
        var items = List.copyOf(fetched.subList(0, Math.min(size, fetched.size())));
        return new ServicePage(
                items,
                size,
                fetched.size() > size,
                fetched.size() > size
                        ? items.getLast().provider() + "/" + items.getLast().code()
                        : null);
    }

    public Page<Product> products(CatalogFilter f, long after, int size, String sort) {
        validate(f, after, size, sort);
        return Page.of(repository.products(f, after, size, sort), size, Product::id);
    }

    public Page<CatalogRate> rates(CatalogFilter f, long after, int size, String sort) {
        validate(f, after, size, sort);
        return Page.of(repository.rates(f, after, size, sort), size, CatalogRate::id);
    }

    public CatalogRate rate(long id) {
        return repository.rate(id).orElseThrow(() -> ApiException.missing("Rate"));
    }

    public List<CatalogRate> tiers(long rateId) {
        return repository.tiers(rateId);
    }

    public Page<Version> history(long id, long after, int size, String sort) {
        Page.validate(size, after, sort);
        rate(id);
        return Page.of(repository.history(id, after, size, sort), size, Version::id);
    }

    public Page<Change> changes(CatalogFilter f, long after, int size, String sort) {
        validate(f, after, size, sort);
        return Page.of(repository.changes(f, after, size, sort), size, Change::id);
    }

    private void validate(CatalogFilter f, long after, int size, String sort) {
        Page.validate(size, after, sort);
        try {
            if (f.attributes().length() > 8000 || !json.tree(f.attributes()).isObject())
                throw new ApiException(
                        400, "attributes must be a JSON object of at most 8000 characters");
        } catch (tools.jackson.core.JacksonException ex) {
            throw new ApiException(400, "attributes must contain valid JSON");
        }
    }

    public record ServicePage(
            List<CatalogViews.Service> items, int size, boolean hasMore, String nextAfter) {}
}
