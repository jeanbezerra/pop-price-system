package com.porto.ciops.coa.pop.price.system.service.shared;

import org.springframework.stereotype.Component;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Map;
import java.util.TreeMap;

/** JSON boundary codec and deterministic hashes for normalized provider content. */
@Component
public final class Json {
    private final JsonMapper mapper = JsonMapper.builder().build();

    public String write(Object value) {
        return mapper.writeValueAsString(value);
    }

    public JsonNode tree(String value) {
        return mapper.readTree(value);
    }

    public <T> T read(String value, Class<T> type) {
        return mapper.readValue(value, type);
    }

    public String hash(Object value) {
        try {
            return HexFormat.of()
                    .formatHex(
                            MessageDigest.getInstance("SHA-256")
                                    .digest(
                                            write(canonical(mapper.valueToTree(value)))
                                                    .getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException(ex);
        }
    }

    private Object canonical(JsonNode node) {
        if (node.isObject()) {
            Map<String, Object> sorted = new TreeMap<>();
            node.properties().forEach(e -> sorted.put(e.getKey(), canonical(e.getValue())));
            return sorted;
        }
        if (node.isArray()) return node.valueStream().map(this::canonical).toList();
        if (node.isNumber()) return node.decimalValue().stripTrailingZeros();
        return node;
    }
}
