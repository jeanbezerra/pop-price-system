package com.porto.ciops.coa.pop.price.system.service.components.persistence;

import com.porto.ciops.coa.pop.price.system.service.components.domain.ComponentCatalog.*;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import com.porto.ciops.coa.pop.price.system.service.shared.Json;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class ComponentRepository {
    private final JdbcClient jdbc;
    private final Json json;
    private static final String SELECT_COMPONENT = """
        SELECT c.id,c.provider,c.service_code,s.name AS service_name,c.name,c.category,c.description,
               c.status,c.revision,c.created_at,c.updated_at,c.characteristics::text,COALESCE(cat.name,c.category) AS category_name,
               i.provider AS icon_provider,i.icon_key AS icon_key,i.release AS icon_release,
               i.name AS icon_name,i.kind AS icon_kind,i.category AS icon_category,i.tags AS icon_tags,
               i.asset_path AS icon_asset_path,i.sha256 AS icon_sha256,i.source_url AS icon_source_url
          FROM pop_price_system_service.architecture_component c
          LEFT JOIN pop_price_system_service.cloud_service s ON s.provider=c.provider AND s.code=c.service_code
          LEFT JOIN pop_price_system_service.architecture_component_category cat ON cat.provider=c.provider AND cat.code=c.category
          LEFT JOIN pop_price_system_service.architecture_icon i ON i.provider=c.provider AND i.icon_key=c.icon_key AND i.release=c.icon_release
        """;

    public ComponentRepository(JdbcClient jdbc, Json json) { this.jdbc = jdbc; this.json = json; }

    public List<Provider> providers() {
        return jdbc.sql("SELECT code,name FROM pop_price_system_service.architecture_component_provider ORDER BY position,code")
                .query((rs,n) -> new Provider(rs.getString(1),rs.getString(2))).list();
    }

    private static Icon icon(ResultSet rs, String prefix) throws SQLException {
        if (rs.getString(prefix + "key") == null) return null;
        return new Icon(rs.getString(prefix + "provider"), rs.getString(prefix + "key"), rs.getString(prefix + "release"),
                rs.getString(prefix + "name"), rs.getString(prefix + "kind"), rs.getString(prefix + "category"),
                rs.getString(prefix + "tags"), rs.getString(prefix + "asset_path"), rs.getString(prefix + "sha256"), rs.getString(prefix + "source_url"));
    }

    private Component component(ResultSet rs, int n) throws SQLException { return new Component(rs.getObject("id", UUID.class),
            rs.getString("provider"), rs.getString("service_code"), rs.getString("service_name"), rs.getString("name"),
            rs.getString("category"), rs.getString("description"), Status.valueOf(rs.getString("status")), icon(rs, "icon_"),
            rs.getLong("revision"), rs.getTimestamp("created_at").toInstant(), rs.getTimestamp("updated_at").toInstant(),
            List.of(json.read(rs.getString("characteristics"), Characteristic[].class)),rs.getString("category_name")); }

    public List<Category> categories(String provider) {
        return jdbc.sql("SELECT provider,code,name,original_name,source_url,origin FROM pop_price_system_service.architecture_component_category WHERE provider=:provider ORDER BY name,code")
                .param("provider", provider).query((rs,n) -> new Category(rs.getString(1),rs.getString(2),rs.getString(3),rs.getString(4),rs.getString(5),rs.getString(6))).list();
    }

    public List<Icon> icons(String provider, String category, String query, String after, int limit) {
        return jdbc.sql("""
            SELECT provider,icon_key AS key,release,name,kind,category,tags,asset_path,sha256,source_url
              FROM pop_price_system_service.architecture_icon
             WHERE (:provider='' OR provider=:provider)
               AND (:category='' OR category=:category)
               AND (strpos(lower(name || ' ' || tags),lower(:query))>0 OR :query='')
               AND (provider || '/' || icon_key || '/' || release)>:after
             ORDER BY provider,icon_key,release LIMIT :limit
            """).param("provider", provider).param("category", category).param("query", query).param("after", after).param("limit", limit)
                .query((rs,n) -> icon(rs, "")).list();
    }

    public Optional<Icon> icon(String provider, String key, String release) {
        return jdbc.sql("""
            SELECT provider,icon_key AS key,release,name,kind,category,tags,asset_path,sha256,source_url
              FROM pop_price_system_service.architecture_icon WHERE provider=:provider AND icon_key=:key AND release=:release
            """).param("provider", provider).param("key", key).param("release", release)
                .query((rs,n) -> icon(rs, "")).optional();
    }

    public List<Component> list(Filter f, String after, int limit) {
        return jdbc.sql(SELECT_COMPONENT + """
             WHERE c.deleted_at IS NULL
               AND (:provider='' OR c.provider=:provider) AND (:service='' OR c.service_code=:service)
               AND (:linked IS NULL OR (c.service_code IS NOT NULL)=:linked)
               AND (:category='' OR c.category=:category) AND (:status='' OR c.status=:status)
               AND (:query='' OR strpos(lower(c.name),lower(:query))>0)
               AND (:after='' OR c.id>CAST(NULLIF(:after,'') AS uuid))
             ORDER BY c.id LIMIT :limit
            """).param("provider", f.provider()).param("service", f.service()).param("category", f.category())
                .param("linked", f.linked(), java.sql.Types.BOOLEAN)
                .param("status", f.status()).param("query", f.query()).param("after", after).param("limit", limit)
                .query(this::component).list();
    }

    public Optional<Component> get(UUID id) {
        return jdbc.sql(SELECT_COMPONENT + " WHERE c.id=:id AND c.deleted_at IS NULL").param("id", id).query(this::component).optional();
    }

    public void create(UUID id, Draft d) {
        bind(jdbc.sql("""
            INSERT INTO pop_price_system_service.architecture_component(id,provider,service_code,name,category,description,status,icon_key,icon_release,characteristics)
            VALUES (:id,:provider,:service,:name,:category,:description,:status,:iconKey,:iconRelease,CAST(:characteristics AS jsonb))
            """), d).param("id", id).update();
    }

    public boolean update(UUID id, Draft d) {
        return bind(jdbc.sql("""
            UPDATE pop_price_system_service.architecture_component
               SET provider=:provider,service_code=:service,name=:name,category=:category,description=:description,
                   status=:status,icon_key=:iconKey,icon_release=:iconRelease,characteristics=CAST(:characteristics AS jsonb),revision=revision+1,updated_at=now()
             WHERE id=:id AND revision=:revision AND deleted_at IS NULL
            """), d).param("id", id).param("revision", d.revision()).update() == 1;
    }

    public boolean softDelete(UUID id, long revision) {
        return jdbc.sql("""
            UPDATE pop_price_system_service.architecture_component
               SET deleted_at=now(),updated_at=now(),revision=revision+1
             WHERE id=:id AND revision=:revision AND deleted_at IS NULL
            """).param("id", id).param("revision", revision).update() == 1;
    }

    private JdbcClient.StatementSpec bind(JdbcClient.StatementSpec statement, Draft d) {
        return statement.param("provider", d.provider()).param("service", d.serviceCode(), java.sql.Types.VARCHAR).param("name", d.name())
                .param("category", d.category()).param("description", d.description()).param("status", d.status().name())
                .param("iconKey", d.iconKey(), java.sql.Types.VARCHAR).param("iconRelease", d.iconRelease(), java.sql.Types.VARCHAR)
                .param("characteristics", json.write(d.characteristics()));
    }
}
