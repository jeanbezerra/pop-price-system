package com.porto.ciops.coa.pop.price.system.service.synchronization.application;

import com.porto.ciops.coa.pop.price.system.service.provider.application.*;
import com.porto.ciops.coa.pop.price.system.service.provider.spi.ProviderCatalog.*;
import com.porto.ciops.coa.pop.price.system.service.shared.*;
import com.porto.ciops.coa.pop.price.system.service.synchronization.domain.Synchronization;
import com.porto.ciops.coa.pop.price.system.service.synchronization.persistence.SynchronizationRepository;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.observation.Observation;
import io.micrometer.observation.ObservationRegistry;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.*;

/** Manual synchronous use case. No scheduler, in-memory work queue or database jobs. */
@Service
public class SynchronizationService {
    private static final Logger LOG = LoggerFactory.getLogger(SynchronizationService.class);
    private final SynchronizationRepository repository;
    private final ProviderRegistry providers;
    private final ProviderService discovery;
    private final TransactionTemplate transaction;
    private final MeterRegistry meters;
    private final ObservationRegistry observations;
    private final int staleSeconds;

    public SynchronizationService(
            SynchronizationRepository repository,
            ProviderRegistry providers,
            ProviderService discovery,
            TransactionTemplate transaction,
            MeterRegistry meters,
            ObservationRegistry observations,
            @Value("${ratecard.sync.stale-after-seconds:300}") int staleSeconds) {
        if (staleSeconds < 240)
            throw new IllegalArgumentException("Stale request timeout must be >= 240 seconds");
        this.repository = repository;
        this.providers = providers;
        this.discovery = discovery;
        this.transaction = transaction;
        this.meters = meters;
        this.observations = observations;
        this.staleSeconds = staleSeconds;
    }

    public Synchronization synchronize(Scope scope, String key) {
        return execute(scope, key, 1);
    }

    private Synchronization execute(Scope scope, String key, int attempt) {
        providers.get(scope.provider());
        if (key != null && (!key.matches("[a-zA-Z0-9._:-]{1,120}")))
            throw new ApiException(400, "Invalid Idempotency-Key");
        if (key != null) {
            var old = repository.byKey(key);
            if (old.isPresent()) return replay(old.get(), scope);
        }
        UUID id = UUID.randomUUID();
        boolean started =
                Boolean.TRUE.equals(
                        transaction.execute(
                                s -> repository.begin(id, scope, key, attempt, staleSeconds)));
        if (!started) {
            if (key != null) {
                var existing = repository.byKey(key);
                if (existing.isPresent()) return replay(existing.get(), scope);
            }
            throw new ApiException(409, "A synchronization for this scope is already running");
        }
        var observation =
                Observation.start("catalog.synchronization", observations)
                        .lowCardinalityKeyValue("provider", scope.provider());
        try (var ignored = observation.openScope()) {
            discovery.validateScope(scope);
            repository.heartbeat(id);
            var remote = providers.get(scope.provider());
            var source = remote.latest(scope);
            if (source.version().equals(repository.checkpoint(scope))) {
                transaction.executeWithoutResult(s -> repository.unchanged(id, source.version()));
            } else {
                var sink = new StagingSink(id);
                remote.stream(scope, source, sink);
                sink.flush();
                transaction.executeWithoutResult(s -> repository.publish(id, scope, source));
            }
            meters.counter("catalog.synchronizations", "outcome", "completed").increment();
            return get(id);
        } catch (RuntimeException ex) {
            observation.error(ex);
            String code =
                    ex instanceof IllegalArgumentException
                            ? "INVALID_SOURCE"
                            : ex instanceof ApiException
                                    ? "SOURCE_UNAVAILABLE"
                                    : "PROCESSING_ERROR";
            transaction.executeWithoutResult(s -> repository.fail(id, code));
            meters.counter("catalog.synchronizations", "outcome", "failed").increment();
            LOG.error("Synchronization {} failed", id, ex);
            if (ex instanceof ApiException business && business.status() < 500)
                throw new ApiException(
                        business.status(), business.getMessage() + " (synchronization " + id + ")");
            throw new ApiException(502, "Synchronization " + id + " failed; consult its status");
        } finally {
            observation.stop();
        }
    }

    private Synchronization replay(Synchronization existing, Scope scope) {
        if (!existing.scope().equals(scope))
            throw new ApiException(409, "Idempotency-Key already used with a different scope");
        if (existing.status().equals("RUNNING"))
            throw new ApiException(409, "Synchronization " + existing.id() + " is running");
        return existing;
    }

    public Synchronization get(UUID id) {
        return repository.find(id).orElseThrow(() -> ApiException.missing("Synchronization"));
    }

    public SyncPage list(int size, int offset) {
        return list(size, offset, "startedAt", "desc");
    }

    public SyncPage list(int size, int offset, String sortBy, String direction) {
        if (size < 1 || size > 200 || offset < 0 || offset > 10000)
            throw new ApiException(400, "Invalid pagination");
        if (!Set.of("startedAt", "serviceCode", "regionCode", "status", "processed").contains(sortBy)
                || !Set.of("asc", "desc").contains(direction))
            throw new ApiException(400, "Invalid synchronization sort");
        var fetched = repository.list(size, offset, sortBy, direction);
        return new SyncPage(
                List.copyOf(fetched.subList(0, Math.min(size, fetched.size()))),
                size,
                offset,
                fetched.size() > size);
    }

    public Synchronization retry(UUID id) {
        var original = get(id);
        if (!"FAILED".equals(original.status()))
            throw new ApiException(409, "Only failed synchronizations can be retried");
        return execute(original.scope(), null, original.attempt() + 1);
    }

    public record SyncPage(List<Synchronization> items, int size, int offset, boolean hasMore) {}

    private final class StagingSink implements Sink {
        private final UUID id;
        private final List<Product> products = new ArrayList<>(250);
        private final List<Rate> rates = new ArrayList<>(250);
        private long lastHeartbeat;

        private StagingSink(UUID id) {
            this.id = id;
        }

        @Override
        public void product(Product product) {
            products.add(product);
            if (products.size() == 250) flush();
        }

        @Override
        public void rate(Rate rate) {
            rates.add(rate);
            if (rates.size() == 250) flush();
        }

        @Override
        public void heartbeat() {
            long now = System.nanoTime();
            if (now - lastHeartbeat > 5_000_000_000L) {
                repository.heartbeat(id);
                lastHeartbeat = now;
            }
        }

        private void flush() {
            repository.heartbeat(id);
            repository.stageProducts(id, products);
            products.clear();
            repository.stageRates(id, rates);
            rates.clear();
        }
    }
}
