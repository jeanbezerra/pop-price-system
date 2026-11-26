package com.porto.ciops.coa.pop.price.system.service.catalog.persistence;

import com.porto.ciops.coa.pop.price.system.service.catalog.domain.*;
import com.porto.ciops.coa.pop.price.system.service.catalog.domain.CatalogViews.*;
import com.porto.ciops.coa.pop.price.system.service.shared.Json;

import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** All user values are bound parameters. Pagination and JSONB filtering run in PostgreSQL. */
@Repository
public class CatalogRepository {
    private final JdbcClient jdbc;
    private final Json json;
    private static final String RATE_SELECT =
            """
            SELECT d.id, v.id AS version_id, p.provider, p.service_code, p.region_code, p.sku, p.family,
                   p.attributes::text, p.usage_type, p.operation, t.modality, t.term_code, d.rate_code,
                   d.unit, d.currency, d.unit_price, d.range_begin, d.range_end, d.effective_at,
                   v.source_version, v.source_url, d.active, d.applies_to::text
              FROM pop_price_system_service.price_dimension d JOIN pop_price_system_service.price_term t ON t.id=d.term_id
              JOIN pop_price_system_service.cloud_product p ON p.id=t.product_id
              JOIN LATERAL (SELECT pv.id, pv.source_version, pv.source_url FROM pop_price_system_service.price_version pv
                             WHERE pv.dimension_id=d.id ORDER BY pv.id DESC LIMIT 1) v ON true
            """;

    public CatalogRepository(JdbcClient jdbc, Json json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    public List<Provider> providers() {
        return jdbc.sql("SELECT code,name FROM pop_price_system_service.cloud_provider ORDER BY code")
                .query((rs, n) -> new Provider(rs.getString(1), rs.getString(2)))
                .list();
    }

    public boolean serviceExists(String provider, String code) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM pop_price_system_service.cloud_service WHERE provider=:provider AND code=:code)")
                .param("provider", provider).param("code", code).query(Boolean.class).single();
    }

    public List<Region> regions(String provider) {
        return jdbc.sql(
                        "SELECT provider,code,name FROM pop_price_system_service.cloud_region WHERE"
                                + " provider=:provider ORDER BY code")
                .param("provider", provider)
                .query((rs, n) -> new Region(rs.getString(1), rs.getString(2), rs.getString(3)))
                .list();
    }

    public List<Service> services(String provider, String after, int limit) {
        return jdbc.sql(
                        """
                        SELECT s.provider,s.code,s.name,s.attributes::text,sync.last_synchronized_at
                          FROM pop_price_system_service.cloud_service s
                          LEFT JOIN (
                            SELECT provider,service_code,max(finished_at) AS last_synchronized_at
                              FROM pop_price_system_service.catalog_synchronization
                             WHERE status='COMPLETED' AND (:provider::text IS NULL OR provider=:provider)
                             GROUP BY provider,service_code
                          ) sync ON sync.provider=s.provider AND sync.service_code=s.code
                         WHERE (:provider::text IS NULL OR s.provider=:provider) AND (s.provider || '/' || s.code)>:after
                         ORDER BY s.provider,s.code LIMIT :limit
                        """)
                .param("provider", provider)
                .param("after", after)
                .param("limit", limit)
                .query(
                        (rs, n) ->
                                new Service(
                                        rs.getString(1),
                                        rs.getString(2),
                                        rs.getString(3),
                                        json.tree(rs.getString(4)),
                                        rs.getTimestamp(5) == null ? null : rs.getTimestamp(5).toInstant()))
                .list();
    }

    public List<Product> products(CatalogFilter f, long cursor, int size, String sort) {
        String sql =
                """
                SELECT p.id,p.provider,p.service_code,p.region_code,p.sku,p.family,p.attributes::text,
                       p.usage_type,p.operation,p.active FROM pop_price_system_service.cloud_product p WHERE
                """
                        + productFilter()
                        + """
                         AND p.active=:active AND (:modality::text IS NULL OR EXISTS (
                           SELECT 1 FROM pop_price_system_service.price_term t WHERE t.product_id=p.id AND t.modality=:modality))
                        """;
        return jdbc.sql(sql + cursor("p.id", sort))
                .params(params(f, cursor, size))
                .query(
                        (rs, n) ->
                                new Product(
                                        rs.getLong(1),
                                        rs.getString(2),
                                        rs.getString(3),
                                        rs.getString(4),
                                        rs.getString(5),
                                        rs.getString(6),
                                        json.tree(rs.getString(7)),
                                        rs.getString(8),
                                        rs.getString(9),
                                        rs.getBoolean(10)))
                .list();
    }

    public List<CatalogRate> rates(CatalogFilter f, long cursor, int size, String sort) {
        return jdbc.sql(
                        RATE_SELECT
                                + " WHERE "
                                + productFilter()
                                + """
                                 AND d.active=:active AND (:modality::text IS NULL OR t.modality=:modality)
                                """
                                + cursor("d.id", sort))
                .params(params(f, cursor, size))
                .query(rateMapper())
                .list();
    }

    public java.util.Optional<CatalogRate> rate(long id) {
        return jdbc.sql(RATE_SELECT + " WHERE d.id=:id")
                .param("id", id)
                .query(rateMapper())
                .optional();
    }

    public List<CatalogRate> tiers(long rateId) {
        return jdbc.sql(
                        RATE_SELECT
                                + """
                                 WHERE d.active AND t.modality='OnDemand' AND d.effective_at<=now()
                                   AND (d.term_id,d.currency,d.unit)=(SELECT term_id,currency,unit FROM pop_price_system_service.price_dimension WHERE id=:id)
                                 ORDER BY d.range_begin,d.id
                                """)
                .param("id", rateId)
                .query(rateMapper())
                .list();
    }

    public List<Version> history(long rateId, long cursor, int size, String sort) {
        return jdbc.sql(
                        """
                        SELECT v.id,v.source_version,v.source_url,v.snapshot::text,v.valid_from,v.valid_to
                          FROM pop_price_system_service.price_version v WHERE v.dimension_id=:rate
                        """
                                + cursor("v.id", sort))
                .param("rate", rateId)
                .param("cursor", cursor)
                .param("limit", size + 1)
                .query(
                        (rs, n) ->
                                new Version(
                                        rs.getLong(1),
                                        rs.getString(2),
                                        rs.getString(3),
                                        json.tree(rs.getString(4)),
                                        rs.getTimestamp(5).toInstant(),
                                        rs.getTimestamp(6) == null
                                                ? null
                                                : rs.getTimestamp(6).toInstant()))
                .list();
    }

    public List<Change> changes(CatalogFilter f, long cursor, int size, String sort) {
        return jdbc.sql(
                        """
                        SELECT h.id,h.synchronization_id,h.dimension_id,h.change_type,h.changed_at
                          FROM pop_price_system_service.catalog_change_history h JOIN pop_price_system_service.price_dimension d ON d.id=h.dimension_id
                          JOIN pop_price_system_service.price_term t ON t.id=d.term_id JOIN pop_price_system_service.cloud_product p ON p.id=t.product_id
                         WHERE
                        """
                                + productFilter()
                                + " AND (:modality::text IS NULL OR t.modality=:modality)"
                                + cursor("h.id", sort))
                .params(params(f, cursor, size))
                .query(
                        (rs, n) ->
                                new Change(
                                        rs.getLong(1),
                                        rs.getString(2),
                                        rs.getLong(3),
                                        rs.getString(4),
                                        rs.getTimestamp(5).toInstant()))
                .list();
    }

    private String productFilter() {
        return """
        (:provider::text IS NULL OR p.provider=:provider) AND (:service::text IS NULL OR p.service_code=:service)
        AND (:region::text IS NULL OR p.region_code=:region) AND (:category::text IS NULL OR p.family=:category)
        AND (:sku::text IS NULL OR p.sku=:sku) AND p.attributes @> CAST(:attributes AS jsonb)
        """;
    }

    private String cursor(String column, String sort) {
        return " AND (:cursor=0 OR "
                + column
                + ("asc".equals(sort) ? ">" : "<")
                + ":cursor) ORDER BY "
                + column
                + ("asc".equals(sort) ? " ASC" : " DESC")
                + " LIMIT :limit";
    }

    private Map<String, Object> params(CatalogFilter f, long cursor, int size) {
        Map<String, Object> p = new HashMap<>();
        p.put("provider", f.provider());
        p.put("service", f.service());
        p.put("region", f.region());
        p.put("category", f.category());
        p.put("sku", f.sku());
        p.put("modality", f.modality());
        p.put("attributes", f.attributes());
        p.put("active", f.active());
        p.put("cursor", cursor);
        p.put("limit", size + 1);
        return p;
    }

    private RowMapper<CatalogRate> rateMapper() {
        return (rs, n) ->
                new CatalogRate(
                        rs.getLong("id"),
                        rs.getLong("version_id"),
                        rs.getString("provider"),
                        rs.getString("service_code"),
                        rs.getString("region_code"),
                        rs.getString("sku"),
                        rs.getString("family"),
                        json.tree(rs.getString("attributes")),
                        rs.getString("usage_type"),
                        rs.getString("operation"),
                        rs.getString("modality"),
                        rs.getString("term_code"),
                        rs.getString("rate_code"),
                        rs.getString("unit"),
                        rs.getString("currency"),
                        rs.getBigDecimal("unit_price"),
                        rs.getBigDecimal("range_begin"),
                        rs.getBigDecimal("range_end"),
                        rs.getTimestamp("effective_at").toInstant(),
                        rs.getString("source_version"),
                        rs.getString("source_url"),
                        rs.getBoolean("active"),
                        json.tree(rs.getString("applies_to")));
    }
}
