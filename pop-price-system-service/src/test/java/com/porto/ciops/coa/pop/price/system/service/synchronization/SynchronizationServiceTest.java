package com.porto.ciops.coa.pop.price.system.service.synchronization;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.porto.ciops.coa.pop.price.system.service.provider.application.*;
import com.porto.ciops.coa.pop.price.system.service.provider.spi.ProviderCatalog;
import com.porto.ciops.coa.pop.price.system.service.provider.spi.ProviderCatalog.*;
import com.porto.ciops.coa.pop.price.system.service.shared.ApiException;
import com.porto.ciops.coa.pop.price.system.service.synchronization.application.SynchronizationService;
import com.porto.ciops.coa.pop.price.system.service.synchronization.domain.Synchronization;
import com.porto.ciops.coa.pop.price.system.service.synchronization.persistence.SynchronizationRepository;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import io.micrometer.observation.ObservationRegistry;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.*;

import java.time.Instant;
import java.util.*;
import java.util.function.Consumer;

class SynchronizationServiceTest {
    private final SynchronizationRepository repository = mock(SynchronizationRepository.class);
    private final ProviderCatalog remote = mock(ProviderCatalog.class);
    private final ProviderService discovery = mock(ProviderService.class);
    private final TransactionTemplate transaction = mock(TransactionTemplate.class);
    private final Scope scope = new Scope("AWS", "AmazonEC2", "us-east-1");
    private final Source source =
            new Source("v1", "https://example.test/prices.json", "official-reference");
    private SynchronizationService service;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setup() {
        when(remote.provider()).thenReturn("AWS");
        when(remote.latest(scope)).thenReturn(source);
        when(repository.begin(any(), eq(scope), any(), anyInt(), anyInt())).thenReturn(true);
        when(repository.find(any()))
                .thenAnswer(i -> Optional.of(audit(i.getArgument(0), "COMPLETED")));
        when(transaction.execute(any()))
                .thenAnswer(
                        i ->
                                ((TransactionCallback<?>) i.getArgument(0))
                                        .doInTransaction(new SimpleTransactionStatus()));
        doAnswer(
                        i -> {
                            ((Consumer<org.springframework.transaction.TransactionStatus>)
                                            i.getArgument(0))
                                    .accept(new SimpleTransactionStatus());
                            return null;
                        })
                .when(transaction)
                .executeWithoutResult(any());
        service =
                new SynchronizationService(
                        repository,
                        new ProviderRegistry(List.of(remote)),
                        discovery,
                        transaction,
                        new SimpleMeterRegistry(),
                        ObservationRegistry.create(),
                        300);
    }

    @Test
    void initialImportPublishesOnlyAfterCompleteSourceConsumption() {
        service.synchronize(scope, null);
        var order = inOrder(remote, repository);
        order.verify(remote).latest(scope);
        order.verify(remote).stream(eq(scope), eq(source), any());
        order.verify(repository).publish(any(), eq(scope), eq(source));
    }

    @Test
    void sameVersionSkipsDownloadAndPublication() {
        when(repository.checkpoint(scope)).thenReturn("v1");
        service.synchronize(scope, null);
        verify(remote, never()).stream(any(), any(), any());
        verify(repository, never()).publish(any(), any(), any());
        verify(repository).unchanged(any(), eq("v1"));
    }

    @Test
    void partialSourceFailsWithoutPublishingCatalogOrCheckpoint() {
        doThrow(new IllegalArgumentException("truncated source")).when(remote).stream(
                any(), any(), any());
        assertThatThrownBy(() -> service.synchronize(scope, null))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("failed");
        verify(repository).fail(any(), eq("INVALID_SOURCE"));
        verify(repository, never()).publish(any(), any(), any());
    }

    @Test
    void historyPreservesRequestedOrderingAndTrimsTheLookaheadRow() {
        var first = audit(UUID.randomUUID(), "COMPLETED");
        var second = audit(UUID.randomUUID(), "COMPLETED");
        when(repository.list(1, 10, "processed", "asc")).thenReturn(List.of(first, second));
        var page = service.list(1, 10, "processed", "asc");
        assertThat(page.items()).containsExactly(first);
        assertThat(page.hasMore()).isTrue();
        assertThat(page.size()).isEqualTo(1);
        assertThat(page.offset()).isEqualTo(10);
    }

    @Test
    void historyRejectsUnsupportedSortingBeforeQueryingTheDatabase() {
        assertThatThrownBy(() -> service.list(10, 0, "startedAt;DROP TABLE audit", "asc"))
                .isInstanceOfSatisfying(ApiException.class, error -> assertThat(error.status()).isEqualTo(400));
        assertThatThrownBy(() -> service.list(10, 0, "startedAt", "backwards"))
                .isInstanceOfSatisfying(ApiException.class, error -> assertThat(error.status()).isEqualTo(400));
        verify(repository, never()).list(anyInt(), anyInt(), anyString(), anyString());
    }

    @Test
    void rejectsConcurrentRequestForSameScope() {
        when(repository.begin(any(), eq(scope), any(), anyInt(), anyInt())).thenReturn(false);
        assertThatThrownBy(() -> service.synchronize(scope, null))
                .isInstanceOfSatisfying(
                        ApiException.class, e -> assertThat(e.status()).isEqualTo(409));
        verify(remote, never()).latest(any());
    }

    @Test
    void idempotencyKeyReplaysCompletedRequest() {
        var old = audit(UUID.randomUUID(), "COMPLETED");
        when(repository.byKey("request-1")).thenReturn(Optional.of(old));
        assertThat(service.synchronize(scope, "request-1")).isEqualTo(old);
        verify(repository, never()).begin(any(), any(), any(), anyInt(), anyInt());
    }

    @Test
    void retriesFailedExecutionWithANewAuditId() {
        UUID original = UUID.randomUUID();
        when(repository.find(original)).thenReturn(Optional.of(audit(original, "FAILED")));
        service.retry(original);
        verify(repository)
                .begin(argThat(id -> !id.equals(original)), eq(scope), isNull(), eq(2), eq(300));
    }

    private Synchronization audit(UUID id, String status) {
        return new Synchronization(
                id, scope, status, 1, Instant.now(), Instant.now(), null, "v1", 0, 0, 0, 0, 0);
    }
}
