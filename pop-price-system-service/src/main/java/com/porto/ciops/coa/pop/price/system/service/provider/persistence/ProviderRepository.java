package com.porto.ciops.coa.pop.price.system.service.provider.persistence;

import com.porto.ciops.coa.pop.price.system.service.provider.spi.ProviderCatalog.Service;
import com.porto.ciops.coa.pop.price.system.service.shared.Json;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.util.List;

/** Persists metadata discovered from a provider, without static service/region lists. */
@Repository
public class ProviderRepository {
    private final JdbcClient jdbc;
    private final Json json;

    public ProviderRepository(JdbcClient jdbc, Json json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    public void services(String provider, List<Service> services) {
        for (var service : services)
            jdbc.sql(
                            """
                            INSERT INTO pop_price_system_service.cloud_service(provider,code,name,attributes) VALUES(:provider,:code,:name,CAST(:attrs AS jsonb))
                            ON CONFLICT(provider,code) DO UPDATE SET name=excluded.name,attributes=excluded.attributes
                             WHERE cloud_service.name IS DISTINCT FROM excluded.name OR cloud_service.attributes IS DISTINCT FROM excluded.attributes
                            """)
                    .param("provider", provider)
                    .param("code", service.code())
                    .param("name", service.name())
                    .param("attrs", json.write(service.attributes()))
                    .update();
    }

    public void regions(String provider, List<String> regions) {
        for (String region : regions)
            jdbc.sql(
                            """
                            INSERT INTO pop_price_system_service.cloud_region(provider,code,name) VALUES(:provider,:region,:region) ON CONFLICT DO NOTHING
                            """)
                    .param("provider", provider)
                    .param("region", region)
                    .update();
    }
}
