package com.porto.ciops.coa.pop.price.system.service.pricing.calculation;

import java.math.BigDecimal;
import java.math.MathContext;
import java.util.Locale;
import java.util.Map;

/** SI and IEC conversions are explicit; unknown billing units are rejected, never guessed. */
public final class UnitConverter {
    private static final MathContext MC = MathContext.DECIMAL128;
    private static final Map<String, BigDecimal> VOLUME =
            Map.of(
                    "bytes",
                    BigDecimal.ONE,
                    "kb",
                    new BigDecimal("1000"),
                    "mb",
                    new BigDecimal("1000000"),
                    "gb",
                    new BigDecimal("1000000000"),
                    "tb",
                    new BigDecimal("1000000000000"),
                    "kib",
                    new BigDecimal("1024"),
                    "mib",
                    new BigDecimal("1048576"),
                    "gib",
                    new BigDecimal("1073741824"),
                    "tib",
                    new BigDecimal("1099511627776"));

    public BigDecimal convert(BigDecimal amount, String from, String to, BigDecimal hours) {
        String source = normalize(from), target = normalize(to);
        if (source.equals(target)) return amount;
        var a = unit(source, hours);
        var b = unit(target, hours);
        if (!a.family.equals(b.family))
            throw new IllegalArgumentException(
                    "Incompatible or unsupported units: " + from + " -> " + to);
        return amount.multiply(a.numerator)
                .multiply(b.denominator)
                .divide(b.numerator.multiply(a.denominator), MC);
    }

    public boolean storage(String unit) {
        String u = normalize(unit);
        return u.endsWith("-mo") || u.endsWith("-hrs");
    }

    public boolean hourlyStorage(String unit) {
        return normalize(unit).endsWith("-hrs");
    }

    public String storageVolume(String unit) {
        return normalize(unit).replace("-mo", "").replace("-hrs", "");
    }

    private Unit unit(String value, BigDecimal hours) {
        if (VOLUME.containsKey(value)) return new Unit("volume", VOLUME.get(value));
        if (storage(value)) {
            var volume = VOLUME.get(storageVolume(value));
            if (volume != null)
                return new Unit("storage", volume, value.endsWith("-hrs") ? hours : BigDecimal.ONE);
        }
        return switch (value) {
            case "requests", "request", "operations", "operation" ->
                    new Unit("requests", BigDecimal.ONE);
            case "1000requests", "1krequests" -> new Unit("requests", new BigDecimal("1000"));
            case "1000000requests", "1mrequests" -> new Unit("requests", new BigDecimal("1000000"));
            case "hrs", "hours", "hour" -> new Unit("time", BigDecimal.ONE);
            case "seconds", "second" -> new Unit("time", BigDecimal.ONE, new BigDecimal("3600"));
            default -> throw new IllegalArgumentException("Unsupported unit: " + value);
        };
    }

    private String normalize(String value) {
        return value.toLowerCase(Locale.ROOT)
                .replace(" ", "")
                .replace("-months", "-mo")
                .replace("-month", "-mo")
                .replace("-hours", "-hrs");
    }

    private record Unit(String family, BigDecimal numerator, BigDecimal denominator) {
        private Unit(String family, BigDecimal numerator) {
            this(family, numerator, BigDecimal.ONE);
        }
    }
}
