package com.porto.ciops.coa.pop.price.system.service.synchronization.domain;

import com.porto.ciops.coa.pop.price.system.service.provider.spi.ProviderCatalog.Scope;

import java.time.Instant;
import java.util.UUID;

/** Audit of a manual synchronous execution; not a background job. */
public record Synchronization(
        UUID id,
        Scope scope,
        String status,
        int attempt,
        Instant startedAt,
        Instant finishedAt,
        String errorCode,
        String sourceVersion,
        long processed,
        long inserted,
        long updated,
        long unchanged,
        long deactivated) {}
