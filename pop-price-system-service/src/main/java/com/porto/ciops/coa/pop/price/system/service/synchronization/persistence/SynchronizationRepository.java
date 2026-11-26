package com.porto.ciops.coa.pop.price.system.service.synchronization.persistence;

import com.porto.ciops.coa.pop.price.system.service.provider.spi.ProviderCatalog.*;
import com.porto.ciops.coa.pop.price.system.service.shared.*;
import com.porto.ciops.coa.pop.price.system.service.synchronization.domain.Synchronization;

import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.util.*;

/** Staging writes are bounded; publication and checkpoint advancement share one transaction. */
@Repository
public class SynchronizationRepository {
    private final JdbcClient jdbc;
    private final NamedParameterJdbcTemplate batch;
    private final Json json;
    private static final String COLUMNS =
            "id,provider,service_code,region_code,status,attempt,started_at,finished_at,error_code,source_version,processed,inserted,updated,unchanged,deactivated";

    public SynchronizationRepository(JdbcClient jdbc, NamedParameterJdbcTemplate batch, Json json) {
        this.jdbc = jdbc;
        this.batch = batch;
        this.json = json;
    }

    public Optional<Synchronization> find(UUID id) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM pop_price_system_service.catalog_synchronization WHERE id=:id")
                .param("id", id)
                .query(mapper())
                .optional();
    }

    public Optional<Synchronization> byKey(String key) {
        return jdbc.sql(
                        "SELECT "
                                + COLUMNS
                                + " FROM pop_price_system_service.catalog_synchronization WHERE"
                                + " idempotency_key=:key")
                .param("key", key)
                .query(mapper())
                .optional();
    }

    public List<Synchronization> list(int size, int offset, String sortBy, String direction) {
        String column = switch (sortBy) {
            case "startedAt" -> "started_at";
            case "serviceCode" -> "service_code";
            case "regionCode" -> "region_code";
            // Match the displayed order: Concluída, Em execução, Falhou.
            case "status" -> "CASE status WHEN 'COMPLETED' THEN 0 WHEN 'RUNNING' THEN 1 ELSE 2 END";
            case "processed" -> "processed";
            default -> throw new IllegalArgumentException("Invalid synchronization sort");
        };
        String order = switch (direction) {
            case "asc" -> "ASC";
            case "desc" -> "DESC";
            default -> throw new IllegalArgumentException("Invalid synchronization direction");
        };
        // Only fixed SQL fragments enter ORDER BY; the UUID breaks ties across pages.
        return jdbc.sql(
                        "SELECT "
                                + COLUMNS
                                + " FROM pop_price_system_service.catalog_synchronization ORDER BY " + column
                                + " " + order + (sortBy.equals("startedAt") ? "" : ",started_at DESC")
                                + ",id ASC LIMIT :limit OFFSET :offset")
                .param("limit", size + 1)
                .param("offset", offset)
                .query(mapper())
                .list();
    }

    public boolean begin(UUID id, Scope scope, String key, int attempt, int staleSeconds) {
        var p = params(id, scope);
        p.put("key", key);
        p.put("attempt", attempt);
        p.put("stale", staleSeconds);
        // A new request recovers abandoned requests. The old execution is fenced by its immutable
        // id and state.
        jdbc.sql(
                        """
                        UPDATE pop_price_system_service.catalog_synchronization SET status='FAILED',error_code='REQUEST_INTERRUPTED',finished_at=now()
                         WHERE provider=:provider AND service_code=:service AND region_code=:region AND status='RUNNING'
                           AND heartbeat_at < now()-make_interval(secs => :stale)
                        """)
                .params(p)
                .update();
        jdbc.sql(
                        """
                        DELETE FROM pop_price_system_service.catalog_stage_rate s USING pop_price_system_service.catalog_synchronization r
                         WHERE s.synchronization_id=r.id AND r.provider=:provider AND r.service_code=:service
                           AND r.region_code=:region AND r.status='FAILED'
                        """)
                .params(p)
                .update();
        jdbc.sql(
                        """
                        DELETE FROM pop_price_system_service.catalog_stage_product s USING pop_price_system_service.catalog_synchronization r
                         WHERE s.synchronization_id=r.id AND r.provider=:provider AND r.service_code=:service
                           AND r.region_code=:region AND r.status='FAILED'
                        """)
                .params(p)
                .update();
        return jdbc.sql(
                                """
                                INSERT INTO pop_price_system_service.catalog_synchronization(id,provider,service_code,region_code,status,idempotency_key,attempt)
                                VALUES (:id,:provider,:service,:region,'RUNNING',:key,:attempt) ON CONFLICT DO NOTHING
                                """)
                        .params(p)
                        .update()
                == 1;
    }

    public String checkpoint(Scope scope) {
        return jdbc.sql(
                        "SELECT source_version FROM pop_price_system_service.catalog_sync_checkpoint WHERE"
                                + " provider=:provider AND service_code=:service AND"
                                + " region_code=:region")
                .params(params(null, scope))
                .query(String.class)
                .optional()
                .orElse(null);
    }

    public void heartbeat(UUID id) {
        if (jdbc.sql(
                                "UPDATE pop_price_system_service.catalog_synchronization SET heartbeat_at=now()"
                                        + " WHERE id=:id AND status='RUNNING'")
                        .param("id", id)
                        .update()
                != 1) throw new ApiException(409, "Synchronization is no longer active");
    }

    public void stageProducts(UUID id, List<Product> products) {
        var rows =
                products.stream()
                        .map(
                                p ->
                                        new MapSqlParameterSource()
                                                .addValue("id", id)
                                                .addValue("sku", p.sku())
                                                .addValue("family", p.family())
                                                .addValue("attrs", json.write(p.attributes()))
                                                .addValue("usage", p.usageType())
                                                .addValue("operation", p.operation())
                                                .addValue("hash", json.hash(p)))
                        .toArray(MapSqlParameterSource[]::new);
        if (rows.length == 0) return;
        batch.batchUpdate(
                """
                INSERT INTO pop_price_system_service.catalog_stage_product(synchronization_id,sku,family,attributes,usage_type,operation,content_hash)
                VALUES(:id,:sku,:family,CAST(:attrs AS jsonb),:usage,:operation,:hash)
                ON CONFLICT(synchronization_id,sku) DO UPDATE SET family=excluded.family,attributes=excluded.attributes,
                    usage_type=excluded.usage_type,operation=excluded.operation,content_hash=excluded.content_hash
                """,
                rows);
    }

    public void stageRates(UUID id, List<Rate> rates) {
        var rows =
                rates.stream()
                        .map(
                                r ->
                                        new MapSqlParameterSource()
                                                .addValue("id", id)
                                                .addValue("sku", r.sku())
                                                .addValue("term", r.termCode())
                                                .addValue("modality", r.modality())
                                                .addValue("attrs", json.write(r.termAttributes()))
                                                .addValue("code", r.rateCode())
                                                .addValue("currency", r.currency())
                                                .addValue("unit", r.unit())
                                                .addValue("description", r.description())
                                                .addValue("begin", r.rangeBegin())
                                                .addValue("end", r.rangeEnd())
                                                .addValue("price", r.unitPrice())
                                                .addValue(
                                                        "effective",
                                                        java.sql.Timestamp.from(r.effectiveAt()))
                                                .addValue("applies", json.write(r.appliesTo()))
                                                .addValue("hash", json.hash(r)))
                        .toArray(MapSqlParameterSource[]::new);
        if (rows.length == 0) return;
        batch.batchUpdate(
                """
                INSERT INTO pop_price_system_service.catalog_stage_rate(synchronization_id,sku,term_code,modality,term_attributes,rate_code,currency,
                    unit,description,range_begin,range_end,unit_price,effective_at,applies_to,content_hash)
                VALUES(:id,:sku,:term,:modality,CAST(:attrs AS jsonb),:code,:currency,:unit,:description,:begin,:end,:price,:effective,CAST(:applies AS jsonb),:hash)
                ON CONFLICT(synchronization_id,sku,term_code,modality,rate_code,currency) DO UPDATE SET
                    term_attributes=excluded.term_attributes,unit=excluded.unit,description=excluded.description,
                    range_begin=excluded.range_begin,range_end=excluded.range_end,unit_price=excluded.unit_price,
                    effective_at=excluded.effective_at,applies_to=excluded.applies_to,content_hash=excluded.content_hash
                """,
                rows);
    }

    public void publish(UUID id, Scope scope, Source source) {
        var p = params(id, scope);
        p.put("version", source.version());
        p.put("url", source.url());
        guard(id);
        long orphan =
                jdbc.sql(
                                """
                                SELECT count(*) FROM pop_price_system_service.catalog_stage_rate r LEFT JOIN pop_price_system_service.catalog_stage_product p
                                  ON p.synchronization_id=r.synchronization_id AND p.sku=r.sku
                                 WHERE r.synchronization_id=:id AND p.sku IS NULL
                                """)
                        .param("id", id)
                        .query(Long.class)
                        .single();
        long count =
                jdbc.sql(
                                "SELECT count(*) FROM pop_price_system_service.catalog_stage_rate WHERE"
                                        + " synchronization_id=:id")
                        .param("id", id)
                        .query(Long.class)
                        .single();
        if (orphan > 0 || count == 0)
            throw new IllegalArgumentException("Incomplete catalog staging");
        jdbc.sql(
                        """
                        INSERT INTO pop_price_system_service.cloud_product(provider,service_code,region_code,sku,family,attributes,usage_type,operation,content_hash)
                        SELECT :provider,:service,:region,sku,family,attributes,usage_type,operation,content_hash
                          FROM pop_price_system_service.catalog_stage_product WHERE synchronization_id=:id
                        ON CONFLICT(provider,service_code,region_code,sku) DO UPDATE SET family=excluded.family,
                            attributes=excluded.attributes,usage_type=excluded.usage_type,operation=excluded.operation,
                            content_hash=excluded.content_hash,active=true
                         WHERE cloud_product.content_hash<>excluded.content_hash OR NOT cloud_product.active
                        """)
                .params(p)
                .update();
        jdbc.sql(
                        """
                        INSERT INTO pop_price_system_service.price_term(product_id,term_code,modality,attributes)
                        SELECT DISTINCT p.id,r.term_code,r.modality,r.term_attributes FROM pop_price_system_service.catalog_stage_rate r
                        JOIN pop_price_system_service.cloud_product p ON p.provider=:provider AND p.service_code=:service AND p.region_code=:region AND p.sku=r.sku
                         WHERE r.synchronization_id=:id
                        ON CONFLICT(product_id,term_code,modality) DO UPDATE SET attributes=excluded.attributes
                         WHERE price_term.attributes IS DISTINCT FROM excluded.attributes
                        """)
                .params(p)
                .update();
        // Capture only effective changes. Combining product+dimension hashes also versions
        // technical attribute changes.
        jdbc.sql(
                        """
                        WITH changed AS (
                          INSERT INTO pop_price_system_service.price_dimension(term_id,rate_code,currency,unit,description,range_begin,range_end,
                              unit_price,effective_at,applies_to,content_hash,active)
                          SELECT t.id,r.rate_code,r.currency,r.unit,r.description,r.range_begin,r.range_end,r.unit_price,
                                 r.effective_at,r.applies_to,md5(r.content_hash || p.content_hash),true
                            FROM pop_price_system_service.catalog_stage_rate r JOIN pop_price_system_service.cloud_product p
                              ON p.provider=:provider AND p.service_code=:service AND p.region_code=:region AND p.sku=r.sku
                            JOIN pop_price_system_service.price_term t ON t.product_id=p.id AND t.term_code=r.term_code AND t.modality=r.modality
                           WHERE r.synchronization_id=:id
                          ON CONFLICT(term_id,rate_code,currency) DO UPDATE SET unit=excluded.unit,description=excluded.description,
                              range_begin=excluded.range_begin,range_end=excluded.range_end,unit_price=excluded.unit_price,
                              effective_at=excluded.effective_at,applies_to=excluded.applies_to,content_hash=excluded.content_hash,active=true
                           WHERE price_dimension.content_hash<>excluded.content_hash OR NOT price_dimension.active
                          RETURNING id
                        ) INSERT INTO pop_price_system_service.catalog_change_history(synchronization_id,dimension_id,change_type)
                          SELECT :id,c.id,CASE WHEN EXISTS(SELECT 1 FROM pop_price_system_service.price_version v WHERE v.dimension_id=c.id)
                                              THEN 'UPDATED' ELSE 'INSERTED' END FROM changed c
                        """)
                .params(p)
                .update();
        // Absence is meaningful only after the parser confirmed the entire source and publication
        // was fenced.
        jdbc.sql(
                        """
                        WITH removed AS (
                          UPDATE pop_price_system_service.price_dimension d SET active=false FROM pop_price_system_service.price_term t,pop_price_system_service.cloud_product p
                           WHERE d.term_id=t.id AND t.product_id=p.id AND p.provider=:provider AND p.service_code=:service
                             AND p.region_code=:region AND d.active AND t.modality='OnDemand' AND d.currency='USD' AND NOT EXISTS (
                               SELECT 1 FROM pop_price_system_service.catalog_stage_rate r WHERE r.synchronization_id=:id AND r.sku=p.sku
                                AND r.term_code=t.term_code AND r.modality=t.modality AND r.rate_code=d.rate_code AND r.currency=d.currency)
                          RETURNING d.id
                        ) INSERT INTO pop_price_system_service.catalog_change_history(synchronization_id,dimension_id,change_type)
                          SELECT :id,id,'DEACTIVATED' FROM removed
                        """)
                .params(p)
                .update();
        jdbc.sql(
                        """
                        UPDATE pop_price_system_service.price_version v SET valid_to=now() WHERE v.valid_to IS NULL AND EXISTS (
                          SELECT 1 FROM pop_price_system_service.catalog_change_history h WHERE h.synchronization_id=:id AND h.dimension_id=v.dimension_id)
                        """)
                .params(p)
                .update();
        jdbc.sql(
                        """
                        INSERT INTO pop_price_system_service.price_version(dimension_id,source_version,source_url,content_hash,snapshot,valid_from)
                        SELECT d.id,:version,:url,d.content_hash,
                          jsonb_build_object('provider',p.provider,'serviceCode',p.service_code,'regionCode',p.region_code,'sku',p.sku,
                            'family',p.family,'attributes',p.attributes,'modality',t.modality,'termCode',t.term_code,
                            'termAttributes',t.attributes,'rateCode',d.rate_code,'unit',d.unit,'currency',d.currency,
                            'unitPrice',d.unit_price,'rangeBegin',d.range_begin,'rangeEnd',d.range_end,'effectiveAt',d.effective_at,
                            'description',d.description,'appliesTo',d.applies_to),now()
                          FROM pop_price_system_service.catalog_change_history h JOIN pop_price_system_service.price_dimension d ON d.id=h.dimension_id
                          JOIN pop_price_system_service.price_term t ON t.id=d.term_id JOIN pop_price_system_service.cloud_product p ON p.id=t.product_id
                         WHERE h.synchronization_id=:id AND h.change_type<>'DEACTIVATED'
                        """)
                .params(p)
                .update();
        jdbc.sql(
                        """
                        UPDATE pop_price_system_service.cloud_product p SET active=false WHERE provider=:provider AND service_code=:service
                          AND region_code=:region AND active AND NOT EXISTS (
                            SELECT 1 FROM pop_price_system_service.catalog_stage_product s WHERE s.synchronization_id=:id AND s.sku=p.sku)
                        """)
                .params(p)
                .update();
        jdbc.sql(
                        """
                        INSERT INTO pop_price_system_service.catalog_sync_checkpoint(provider,service_code,region_code,source_version,source_url,synchronized_at,synchronization_id)
                        VALUES(:provider,:service,:region,:version,:url,now(),:id)
                        ON CONFLICT(provider,service_code,region_code) DO UPDATE SET source_version=excluded.source_version,
                          source_url=excluded.source_url,synchronized_at=excluded.synchronized_at,synchronization_id=excluded.synchronization_id
                        """)
                .params(p)
                .update();
        jdbc.sql(
                        """
                        UPDATE pop_price_system_service.catalog_synchronization SET status='COMPLETED',finished_at=now(),source_version=:version,
                          processed=(SELECT count(*) FROM pop_price_system_service.catalog_stage_rate WHERE synchronization_id=:id),
                          inserted=(SELECT count(*) FROM pop_price_system_service.catalog_change_history WHERE synchronization_id=:id AND change_type='INSERTED'),
                          updated=(SELECT count(*) FROM pop_price_system_service.catalog_change_history WHERE synchronization_id=:id AND change_type='UPDATED'),
                          deactivated=(SELECT count(*) FROM pop_price_system_service.catalog_change_history WHERE synchronization_id=:id AND change_type='DEACTIVATED')
                         WHERE id=:id
                        """)
                .params(p)
                .update();
        jdbc.sql(
                        "UPDATE pop_price_system_service.catalog_synchronization SET"
                                + " unchanged=processed-inserted-updated WHERE id=:id")
                .params(p)
                .update();
        clean(id);
    }

    public void unchanged(UUID id, String version) {
        guard(id);
        jdbc.sql(
                        "UPDATE pop_price_system_service.catalog_synchronization SET"
                            + " status='COMPLETED',finished_at=now(),source_version=:version WHERE"
                            + " id=:id")
                .param("id", id)
                .param("version", version)
                .update();
    }

    public void fail(UUID id, String code) {
        jdbc.sql(
                        "UPDATE pop_price_system_service.catalog_synchronization SET"
                            + " status='FAILED',finished_at=now(),error_code=:code WHERE id=:id AND"
                            + " status='RUNNING'")
                .param("id", id)
                .param("code", code)
                .update();
        clean(id);
    }

    public void clean(UUID id) {
        jdbc.sql("DELETE FROM pop_price_system_service.catalog_stage_rate WHERE synchronization_id=:id")
                .param("id", id)
                .update();
        jdbc.sql("DELETE FROM pop_price_system_service.catalog_stage_product WHERE synchronization_id=:id")
                .param("id", id)
                .update();
    }

    private void guard(UUID id) {
        var status =
                jdbc.sql(
                                "SELECT status FROM pop_price_system_service.catalog_synchronization WHERE id=:id"
                                        + " FOR UPDATE")
                        .param("id", id)
                        .query(String.class)
                        .single();
        if (!"RUNNING".equals(status))
            throw new ApiException(409, "Synchronization is no longer active");
    }

    private Map<String, Object> params(UUID id, Scope scope) {
        Map<String, Object> p = new HashMap<>();
        p.put("id", id);
        p.put("provider", scope.provider());
        p.put("service", scope.serviceCode());
        p.put("region", scope.regionCode());
        return p;
    }

    private RowMapper<Synchronization> mapper() {
        return (rs, n) ->
                new Synchronization(
                        rs.getObject("id", UUID.class),
                        new Scope(
                                rs.getString("provider"),
                                rs.getString("service_code"),
                                rs.getString("region_code")),
                        rs.getString("status"),
                        rs.getInt("attempt"),
                        rs.getTimestamp("started_at").toInstant(),
                        rs.getTimestamp("finished_at") == null
                                ? null
                                : rs.getTimestamp("finished_at").toInstant(),
                        rs.getString("error_code"),
                        rs.getString("source_version"),
                        rs.getLong("processed"),
                        rs.getLong("inserted"),
                        rs.getLong("updated"),
                        rs.getLong("unchanged"),
                        rs.getLong("deactivated"));
    }
}
