package com.porto.ciops.coa.pop.price.system.service.components.domain;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Visual definitions are independent of provider metadata and price dimensions. */
public final class ComponentCatalog {
    private ComponentCatalog() {}

    public enum Status { PENDING, ACTIVE, INACTIVE }

    public record Provider(String code, String name) {}

    public record Category(String provider, String code, String name, String originalName, String sourceUrl, String origin) {}

    public record Characteristic(String name, String value) {}

    public record Icon(String provider, String key, String release, String name, String kind,
            String category, String tags, String assetPath, String sha256, String sourceUrl) {}

    public record Component(UUID id, String provider, String serviceCode, String serviceName,
            String name, String category, String description, Status status, Icon icon,
            long revision, Instant createdAt, Instant updatedAt, List<Characteristic> characteristics, String categoryName) {}

    public record Draft(String provider, String serviceCode, String name, String category,
            String description, Status status, String iconKey, String iconRelease, long revision, List<Characteristic> characteristics) {}

    public record Filter(String provider, String service, String category, String status, String query, Boolean linked) {}

    public record Results<T>(List<T> items, int size, boolean hasMore, String nextAfter) {
        public static <T> Results<T> of(List<T> rows, int size, java.util.function.Function<T,String> cursor) {
            var items = List.copyOf(rows.subList(0, Math.min(size, rows.size())));
            boolean more = rows.size() > size;
            return new Results<>(items, size, more, more ? cursor.apply(items.getLast()) : null);
        }
    }
}
