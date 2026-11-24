package com.porto.ciops.coa.pop.price.system.service.estimation.application;

import com.porto.ciops.coa.pop.price.system.service.catalog.application.CatalogService;
import com.porto.ciops.coa.pop.price.system.service.catalog.domain.CatalogRate;
import com.porto.ciops.coa.pop.price.system.service.estimation.domain.Estimate;
import com.porto.ciops.coa.pop.price.system.service.estimation.persistence.EstimateRepository;
import com.porto.ciops.coa.pop.price.system.service.pricing.calculation.PricingEngine;
import com.porto.ciops.coa.pop.price.system.service.pricing.domain.*;
import com.porto.ciops.coa.pop.price.system.service.pricing.domain.PricingInput.Item;
import com.porto.ciops.coa.pop.price.system.service.shared.ApiException;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

import java.math.BigDecimal;
import java.util.*;

/**
 * Serializes composition changes and captures a consistent database snapshot for financial
 * calculations.
 */
@Service
public class EstimateService {
    private final EstimateRepository repository;
    private final CatalogService catalog;
    private final PricingEngine engine = new PricingEngine();

    public EstimateService(EstimateRepository repository, CatalogService catalog) {
        this.repository = repository;
        this.catalog = catalog;
    }

    @Transactional
    public Estimate create(String name, BigDecimal hours) {
        UUID id = UUID.randomUUID();
        repository.create(id, name, hours);
        return header(id, false);
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Estimate get(UUID id) {
        var header = header(id, false);
        return new Estimate(
                header.id(),
                header.name(),
                header.hoursPerMonth(),
                header.currency(),
                header.revision(),
                header.createdAt(),
                header.updatedAt(),
                repository.items(id),
                repository.lastCalculation(id).orElse(null));
    }

    public EstimatePage list(int size, int offset) {
        if (size < 1 || size > 200 || offset < 0 || offset > 10000)
            throw new ApiException(400, "Invalid pagination");
        var fetched = repository.list(size, offset);
        return new EstimatePage(
                List.copyOf(fetched.subList(0, Math.min(size, fetched.size()))),
                size,
                offset,
                fetched.size() > size);
    }

    @Transactional
    public Item add(UUID id, Item input) {
        header(id, true);
        var existing = repository.items(id);
        if (existing.size() >= 100) throw new ApiException(422, "At most 100 items per estimate");
        if (input.flow() != null) {
            if (input.rateId() != null || input.retentionDays() != null)
                throw new ApiException(400, "A flow cannot use a resource tariff or retention");
            if (!input.accountCode().equals(input.flow().sourceAccount()))
                throw new ApiException(400, "Flow accountCode must equal sourceAccount");
            if (existing.stream()
                    .anyMatch(
                            i ->
                                    i.flow() != null
                                            && i.flow()
                                                    .trafficKey()
                                                    .equals(input.flow().trafficKey())))
                throw new ApiException(409, "Traffic key already included in this estimate");
            Set<PricingInput.ChargeKey> keys = new HashSet<>();
            for (var charge : input.flow().charges()) {
                if (!keys.add(charge.key()))
                    throw new ApiException(400, "Duplicate traffic charge");
                catalog.rate(charge.rateId());
            }
        } else if (input.rateId() != null) catalog.rate(input.rateId());
        repository.add(id, input);
        return input;
    }

    @Transactional
    public void delete(UUID id, UUID item) {
        header(id, true);
        if (!repository.delete(id, item)) throw ApiException.missing("Estimate item");
    }

    @Transactional(isolation = Isolation.REPEATABLE_READ)
    public PricingResult calculate(UUID id) {
        var header = header(id, true);
        var items = repository.items(id);
        Map<Long, List<CatalogRate>> rates = new HashMap<>();
        for (var item : items) {
            if (item.rateId() != null) rates.computeIfAbsent(item.rateId(), catalog::tiers);
            if (item.flow() != null)
                item.flow()
                        .charges()
                        .forEach(c -> rates.computeIfAbsent(c.rateId(), catalog::tiers));
        }
        var result =
                engine.calculate(
                        id, header.revision(), header.name(), header.hoursPerMonth(), items, rates);
        repository.calculation(result);
        return result;
    }

    public PricingResult calculation(UUID estimate, UUID calculation) {
        return repository
                .calculation(estimate, calculation)
                .orElseThrow(() -> ApiException.missing("Calculation"));
    }

    private Estimate header(UUID id, boolean lock) {
        return repository.header(id, lock).orElseThrow(() -> ApiException.missing("Estimate"));
    }

    public record EstimatePage(List<Estimate> items, int size, int offset, boolean hasMore) {}
}
