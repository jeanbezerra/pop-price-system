package com.porto.ciops.coa.pop.price.system.service.architecture.persistence;

import com.porto.ciops.coa.pop.price.system.service.architecture.domain.*;
import com.porto.ciops.coa.pop.price.system.service.shared.Json;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import java.math.BigDecimal;
import java.util.*;

@Repository
public class ArchitectureRepository {
    private final JdbcClient jdbc;
    private final Json json;
    public ArchitectureRepository(JdbcClient jdbc,Json json) { this.jdbc=jdbc;this.json=json; }
    public void create(UUID id,String name,BigDecimal hours,ArchitectureGraph graph,StructureSpecification specification) {
        jdbc.sql("INSERT INTO pop_price_system_service.architecture_model(id,name,hours_per_month,graph,specification) VALUES(:id,:name,:hours,CAST(:graph AS jsonb),CAST(:specification AS jsonb))")
                .param("id",id).param("name",name).param("hours",hours).param("graph",json.write(graph)).param("specification",specification==null?null:json.write(specification),java.sql.Types.VARCHAR).update();
    }
    public Optional<ArchitectureModel> get(UUID id,boolean lock) {
        return jdbc.sql("SELECT id,name,hours_per_month,graph,status,revision,created_at,updated_at,published_at,archived_at,specification FROM pop_price_system_service.architecture_model WHERE id=:id AND deleted_at IS NULL"+(lock?" FOR UPDATE":""))
                .param("id",id).query((rs,n)->new ArchitectureModel(rs.getObject("id",UUID.class),rs.getString("name"),rs.getBigDecimal("hours_per_month"),
                        json.read(rs.getString("graph"),ArchitectureGraph.class),rs.getString("status"),rs.getLong("revision"),rs.getTimestamp("created_at").toInstant(),
                        rs.getTimestamp("updated_at").toInstant(),rs.getTimestamp("published_at")==null?null:rs.getTimestamp("published_at").toInstant(),
                        rs.getTimestamp("archived_at")==null?null:rs.getTimestamp("archived_at").toInstant(),json.read(rs.getString("specification")==null?"null":rs.getString("specification"),StructureSpecification.class))).optional();
    }
    public boolean update(UUID id,String name,BigDecimal hours,ArchitectureGraph graph,long revision,StructureSpecification specification) {
        return jdbc.sql("UPDATE pop_price_system_service.architecture_model SET name=:name,hours_per_month=:hours,graph=CAST(:graph AS jsonb),specification=CAST(:specification AS jsonb),revision=revision+1,updated_at=now() WHERE id=:id AND revision=:revision AND status='DRAFT' AND archived_at IS NULL AND deleted_at IS NULL")
                .param("id",id).param("name",name).param("hours",hours).param("graph",json.write(graph)).param("revision",revision).param("specification",specification==null?null:json.write(specification),java.sql.Types.VARCHAR).update()==1;
    }
    public boolean publish(UUID id,long revision) {
        return jdbc.sql("UPDATE pop_price_system_service.architecture_model SET status='PUBLISHED',published_at=now(),revision=revision+1,updated_at=now() WHERE id=:id AND revision=:revision AND status='DRAFT' AND archived_at IS NULL AND deleted_at IS NULL")
                .param("id",id).param("revision",revision).update()==1;
    }
    public boolean lifecycle(UUID id,long revision,String action) {
        String assignment=switch(action) {
            case "archive" -> "archived_at=now()";
            case "unarchive" -> "archived_at=NULL";
            case "delete" -> "deleted_at=now()";
            default -> throw new IllegalArgumentException("Ação inválida.");
        };
        String condition=switch(action) { case "archive" -> " AND archived_at IS NULL"; case "unarchive" -> " AND archived_at IS NOT NULL"; default -> ""; };
        return jdbc.sql("UPDATE pop_price_system_service.architecture_model SET "+assignment+",revision=revision+1,updated_at=now() WHERE id=:id AND revision=:revision AND deleted_at IS NULL"+condition)
                .param("id",id).param("revision",revision).update()==1;
    }
    public record SearchResult(List<ArchitectureModel.Summary> items, long total) {}
    public SearchResult list(StructureSearch search) {
        String projection = """
                SELECT m.id,m.name,m.hours_per_month,m.status,m.revision,m.updated_at,m.published_at,m.created_at,m.archived_at,m.specification,
                  jsonb_array_length(m.graph->'nodes') AS component_count,
                  COALESCE((SELECT jsonb_agg(c.provider ORDER BY c.provider)::text FROM (
                    SELECT DISTINCT COALESCE(p.provider,n->>'provider','GENERIC') AS provider
                    FROM jsonb_array_elements(m.graph->'nodes') n
                    LEFT JOIN pop_price_system_service.price_dimension d ON d.id=(n->>'rateId')::bigint
                    LEFT JOIN pop_price_system_service.price_term t ON t.id=d.term_id
                    LEFT JOIN pop_price_system_service.cloud_product p ON p.id=t.product_id
                    UNION SELECT l->>'provider' AS provider FROM jsonb_array_elements(m.specification->'locations') l
                  ) c),'[]') AS clouds,
                  (v.snapshot->'usd'->>'monthlyCost')::numeric AS predicted_cost,
                  (v.snapshot->>'modelRevision')::bigint AS cost_revision
                FROM pop_price_system_service.architecture_model m
                LEFT JOIN LATERAL (SELECT snapshot FROM pop_price_system_service.estimate_valuation WHERE model_id=m.id ORDER BY created_at DESC,id DESC LIMIT 1) v ON true
                WHERE m.deleted_at IS NULL
                """;
        String filtered = "SELECT * FROM (" + projection + """
                ) s WHERE (:status='' OR status=:status)
                AND (:lifecycle='ALL' OR (:lifecycle='ACTIVE' AND archived_at IS NULL) OR (:lifecycle='ARCHIVED' AND archived_at IS NOT NULL))
                AND (:q='' OR strpos(lower(name || ' ' || clouds::text),lower(:q)) > 0)
                AND (:provider='' OR CAST(clouds AS jsonb) @> jsonb_build_array(CAST(:provider AS text)))
                AND (:category='' OR specification->>'category'=:category)
                AND (:environment='' OR specification->>'environment'=:environment)
                """;
        Map<String,Object> params = Map.of("status",search.status(),"lifecycle",search.lifecycle(),"q",search.q(),
                "provider",search.provider(),"category",search.category(),"environment",search.environment());
        String column = switch (search.sort()) {
            case "provider" -> "specification->>'primaryProvider'";
            case "name" -> "lower(name)";
            case "category" -> "specification->>'category'";
            case "environment" -> "specification->>'environment'";
            case "status" -> "CASE WHEN archived_at IS NOT NULL THEN 'ARCHIVED' ELSE status END";
            case "region" -> "(SELECT l->>'regionCode' FROM jsonb_array_elements(specification->'locations') l WHERE l->>'provider'=specification->>'primaryProvider' LIMIT 1)";
            case "componentCount" -> "component_count";
            case "predictedMonthlyCost" -> "predicted_cost";
            case "createdAt" -> "created_at";
            case "updatedAt" -> "updated_at";
            default -> throw new IllegalArgumentException("Unsupported sort.");
        };
        if (!Set.of("ASC","DESC").contains(search.direction())) throw new IllegalArgumentException("Unsupported direction.");
        long[] total = {0};
        var rows = jdbc.sql("SELECT f.*,count(*) OVER() AS total_count FROM (" + filtered + ") f ORDER BY " + column + " " + search.direction() + " NULLS LAST,id LIMIT :size OFFSET :offset")
                .params(params).param("size",search.size()).param("offset",search.offset())
                .query((rs,n)-> { total[0]=rs.getLong("total_count"); return new ArchitectureModel.Summary(rs.getObject("id",UUID.class),rs.getString("name"),rs.getBigDecimal("hours_per_month"),rs.getString("status"),rs.getLong("revision"),
                        rs.getTimestamp("updated_at").toInstant(),rs.getTimestamp("published_at")==null?null:rs.getTimestamp("published_at").toInstant(),
                        rs.getTimestamp("created_at").toInstant(),rs.getTimestamp("archived_at")==null?null:rs.getTimestamp("archived_at").toInstant(),
                        Arrays.asList(json.read(rs.getString("clouds"),String[].class)),rs.getInt("component_count"),rs.getBigDecimal("predicted_cost"),rs.getObject("cost_revision",Long.class),json.read(rs.getString("specification")==null?"null":rs.getString("specification"),StructureSpecification.class)); }).list();
        if (rows.isEmpty()) total[0] = jdbc.sql("SELECT count(*) FROM (" + filtered + ") f").params(params).query(Long.class).single();
        return new SearchResult(rows,total[0]);
    }
}
