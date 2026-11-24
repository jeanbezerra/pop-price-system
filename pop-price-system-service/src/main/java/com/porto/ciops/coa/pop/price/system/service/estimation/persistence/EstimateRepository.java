package com.porto.ciops.coa.pop.price.system.service.estimation.persistence;

import com.porto.ciops.coa.pop.price.system.service.estimation.domain.Estimate;
import com.porto.ciops.coa.pop.price.system.service.pricing.domain.*;
import com.porto.ciops.coa.pop.price.system.service.pricing.domain.PricingInput.*;
import com.porto.ciops.coa.pop.price.system.service.shared.Json;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.*;

/**
 * Normalized composition tables; only immutable financial snapshots and provider-specific
 * attributes use JSONB.
 */
@Repository
public class EstimateRepository {
    private final JdbcClient jdbc;
    private final Json json;

    public EstimateRepository(JdbcClient jdbc, Json json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    public void create(UUID id, String name, BigDecimal hours) {
        jdbc.sql(
                        "INSERT INTO ratecard.architecture_estimate(id,name,hours_per_month)"
                                + " VALUES(:id,:name,:hours)")
                .param("id", id)
                .param("name", name)
                .param("hours", hours)
                .update();
    }

    public Optional<Estimate> header(UUID id, boolean lock) {
        return jdbc.sql(
                        """
                        SELECT id,name,hours_per_month,currency,revision,created_at,updated_at FROM ratecard.architecture_estimate WHERE id=:id
                        """
                                + (lock ? " FOR UPDATE" : ""))
                .param("id", id)
                .query(
                        (rs, n) ->
                                new Estimate(
                                        rs.getObject(1, UUID.class),
                                        rs.getString(2),
                                        rs.getBigDecimal(3),
                                        rs.getString(4),
                                        rs.getLong(5),
                                        rs.getTimestamp(6).toInstant(),
                                        rs.getTimestamp(7).toInstant(),
                                        List.of(),
                                        null))
                .optional();
    }

    public List<Estimate> list(int size, int offset) {
        return jdbc.sql(
                        """
                        SELECT id,name,hours_per_month,currency,revision,created_at,updated_at FROM ratecard.architecture_estimate
                         ORDER BY created_at DESC,id LIMIT :limit OFFSET :offset
                        """)
                .param("limit", size + 1)
                .param("offset", offset)
                .query(
                        (rs, n) ->
                                new Estimate(
                                        rs.getObject(1, UUID.class),
                                        rs.getString(2),
                                        rs.getBigDecimal(3),
                                        rs.getString(4),
                                        rs.getLong(5),
                                        rs.getTimestamp(6).toInstant(),
                                        rs.getTimestamp(7).toInstant(),
                                        List.of(),
                                        null))
                .list();
    }

    public List<Item> items(UUID estimateId) {
        Map<UUID, List<Hop>> hops = new HashMap<>();
        jdbc.sql(
                        """
                        SELECT h.item_id,h.service_code,h.account_code,h.region_code FROM ratecard.architecture_flow_hop h
                        JOIN ratecard.architecture_estimate_item i ON i.id=h.item_id WHERE i.estimate_id=:id ORDER BY h.item_id,h.position
                        """)
                .param("id", estimateId)
                .query(
                        (rs, n) -> {
                            hops.computeIfAbsent(
                                            rs.getObject(1, UUID.class),
                                            ignored -> new ArrayList<>())
                                    .add(
                                            new Hop(
                                                    rs.getString(2),
                                                    rs.getString(3),
                                                    rs.getString(4)));
                            return 0;
                        })
                .list();
        Map<UUID, List<Charge>> charges = new HashMap<>();
        jdbc.sql(
                        """
                        SELECT c.item_id,c.charge_key,c.rate_id FROM ratecard.architecture_flow_charge c
                        JOIN ratecard.architecture_estimate_item i ON i.id=c.item_id WHERE i.estimate_id=:id ORDER BY c.item_id,c.charge_key
                        """)
                .param("id", estimateId)
                .query(
                        (rs, n) -> {
                            charges.computeIfAbsent(
                                            rs.getObject(1, UUID.class),
                                            ignored -> new ArrayList<>())
                                    .add(
                                            new Charge(
                                                    ChargeKey.valueOf(rs.getString(2)),
                                                    rs.getLong(3)));
                            return 0;
                        })
                .list();
        return jdbc.sql(
                        """
                        SELECT i.id,i.name,i.category,i.account_code,i.rate_id,i.quantity,i.consumption,i.consumption_unit,
                               i.consumption_period,i.retention_days,i.traffic_key,f.item_id AS flow_id,f.source_service,f.destination_service,
                               f.source_account,f.destination_account,f.source_region,f.destination_region,f.source_az,f.destination_az,
                               f.direction,f.connectivity
                        FROM ratecard.architecture_estimate_item i LEFT JOIN ratecard.architecture_data_flow f ON f.item_id=i.id
                        WHERE i.estimate_id=:id ORDER BY i.created_at,i.id
                        """)
                .param("id", estimateId)
                .query(
                        (rs, n) -> {
                            UUID id = rs.getObject("id", UUID.class);
                            Flow flow =
                                    rs.getObject("flow_id") == null
                                            ? null
                                            : new Flow(
                                                    rs.getString("traffic_key"),
                                                    rs.getString("source_service"),
                                                    rs.getString("destination_service"),
                                                    rs.getString("source_account"),
                                                    rs.getString("destination_account"),
                                                    rs.getString("source_region"),
                                                    rs.getString("destination_region"),
                                                    rs.getString("source_az"),
                                                    rs.getString("destination_az"),
                                                    Direction.valueOf(rs.getString("direction")),
                                                    Connectivity.valueOf(
                                                            rs.getString("connectivity")),
                                                    List.copyOf(
                                                            charges.getOrDefault(id, List.of())),
                                                    List.copyOf(hops.getOrDefault(id, List.of())));
                            return new Item(
                                    id,
                                    rs.getString("name"),
                                    rs.getString("category"),
                                    rs.getString("account_code"),
                                    rs.getObject("rate_id", Long.class),
                                    rs.getBigDecimal("quantity"),
                                    rs.getBigDecimal("consumption"),
                                    rs.getString("consumption_unit"),
                                    Period.valueOf(rs.getString("consumption_period")),
                                    rs.getObject("retention_days", Integer.class),
                                    flow);
                        })
                .list();
    }

    public void add(UUID estimateId, Item item) {
        Map<String, Object> p = new HashMap<>();
        p.put("estimate", estimateId);
        p.put("id", item.id());
        p.put("name", item.name());
        p.put("category", item.category());
        p.put("account", item.accountCode());
        p.put("rate", item.rateId());
        p.put("quantity", item.quantity());
        p.put("consumption", item.consumption());
        p.put("unit", item.consumptionUnit());
        p.put("period", item.period().name());
        p.put("retention", item.retentionDays());
        p.put("traffic", item.flow() == null ? null : item.flow().trafficKey());
        jdbc.sql(
                        """
                        INSERT INTO ratecard.architecture_estimate_item(id,estimate_id,name,category,account_code,rate_id,quantity,
                            consumption,consumption_unit,consumption_period,retention_days,traffic_key)
                        VALUES(:id,:estimate,:name,:category,:account,:rate,:quantity,:consumption,:unit,:period,:retention,:traffic)
                        """)
                .params(p)
                .update();
        if (item.flow() != null) {
            var f = item.flow();
            p.put("sourceService", f.sourceService());
            p.put("destinationService", f.destinationService());
            p.put("sourceAccount", f.sourceAccount());
            p.put("destinationAccount", f.destinationAccount());
            p.put("sourceRegion", f.sourceRegion());
            p.put("destinationRegion", f.destinationRegion());
            p.put("sourceAz", f.sourceAz());
            p.put("destinationAz", f.destinationAz());
            p.put("direction", f.direction().name());
            p.put("connectivity", f.connectivity().name());
            jdbc.sql(
                            """
                            INSERT INTO ratecard.architecture_data_flow(item_id,source_service,destination_service,source_account,destination_account,
                                source_region,destination_region,source_az,destination_az,direction,connectivity)
                            VALUES(:id,:sourceService,:destinationService,:sourceAccount,:destinationAccount,:sourceRegion,:destinationRegion,
                                :sourceAz,:destinationAz,:direction,:connectivity)
                            """)
                    .params(p)
                    .update();
            for (var charge : f.charges())
                jdbc.sql(
                                "INSERT INTO"
                                    + " ratecard.architecture_flow_charge(item_id,charge_key,rate_id)"
                                    + " VALUES(:id,:key,:rate)")
                        .param("id", item.id())
                        .param("key", charge.key().name())
                        .param("rate", charge.rateId())
                        .update();
            for (int position = 0; position < f.intermediaries().size(); position++) {
                var hop = f.intermediaries().get(position);
                jdbc.sql(
                                """
                                INSERT INTO ratecard.architecture_flow_hop(item_id,position,service_code,account_code,region_code)
                                VALUES(:id,:position,:service,:account,:region)
                                """)
                        .param("id", item.id())
                        .param("position", position)
                        .param("service", hop.serviceCode())
                        .param("account", hop.accountCode())
                        .param("region", hop.regionCode())
                        .update();
            }
        }
        bump(estimateId);
    }

    public boolean delete(UUID estimate, UUID item) {
        boolean deleted =
                jdbc.sql(
                                        "DELETE FROM ratecard.architecture_estimate_item WHERE"
                                                + " estimate_id=:estimate AND id=:item")
                                .param("estimate", estimate)
                                .param("item", item)
                                .update()
                        == 1;
        if (deleted) bump(estimate);
        return deleted;
    }

    public void calculation(PricingResult result) {
        jdbc.sql(
                        """
                        INSERT INTO ratecard.architecture_estimate_calculation(id,estimate_id,revision,snapshot,calculated_at)
                        VALUES(:id,:estimate,:revision,CAST(:snapshot AS jsonb),:calculated)
                        """)
                .param("id", result.calculationId())
                .param("estimate", result.estimateId())
                .param("revision", result.revision())
                .param("snapshot", json.write(result))
                .param("calculated", java.sql.Timestamp.from(result.calculatedAt()))
                .update();
    }

    public Optional<PricingResult> lastCalculation(UUID id) {
        return jdbc.sql(
                        """
                        SELECT snapshot::text FROM ratecard.architecture_estimate_calculation WHERE estimate_id=:id
                        ORDER BY calculated_at DESC,id DESC LIMIT 1
                        """)
                .param("id", id)
                .query((rs, n) -> json.read(rs.getString(1), PricingResult.class))
                .optional();
    }

    public Optional<PricingResult> calculation(UUID estimate, UUID calculation) {
        return jdbc.sql(
                        "SELECT snapshot::text FROM ratecard.architecture_estimate_calculation"
                                + " WHERE estimate_id=:estimate AND id=:calculation")
                .param("estimate", estimate)
                .param("calculation", calculation)
                .query((rs, n) -> json.read(rs.getString(1), PricingResult.class))
                .optional();
    }

    private void bump(UUID id) {
        jdbc.sql(
                        "UPDATE ratecard.architecture_estimate SET"
                                + " revision=revision+1,updated_at=now() WHERE id=:id")
                .param("id", id)
                .update();
    }
}
