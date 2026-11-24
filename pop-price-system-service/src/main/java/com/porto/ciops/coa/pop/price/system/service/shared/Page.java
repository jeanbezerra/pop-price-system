package com.porto.ciops.coa.pop.price.system.service.shared;

import java.util.List;
import java.util.function.ToLongFunction;

/** Keyset pagination; afterId refers to the last id in the selected direction. */
public record Page<T>(List<T> items, int size, boolean hasMore, Long nextAfterId) {
    public static <T> Page<T> of(List<T> fetched, int size, ToLongFunction<T> id) {
        boolean more = fetched.size() > size;
        var items = List.copyOf(fetched.subList(0, Math.min(size, fetched.size())));
        return new Page<>(items, size, more, more ? id.applyAsLong(items.getLast()) : null);
    }

    public static void validate(int size, long afterId, String sort) {
        if (size < 1 || size > 200 || afterId < 0 || !("asc".equals(sort) || "desc".equals(sort)))
            throw new ApiException(400, "size must be 1..200, afterId >= 0 and sort asc or desc");
    }
}
