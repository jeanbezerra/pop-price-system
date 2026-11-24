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
    public void create(UUID id,String name,BigDecimal hours,ArchitectureGraph graph) {
        jdbc.sql("INSERT INTO ratecard.architecture_model(id,name,hours_per_month,graph) VALUES(:id,:name,:hours,CAST(:graph AS jsonb))")
                .param("id",id).param("name",name).param("hours",hours).param("graph",json.write(graph)).update();
    }
    public Optional<ArchitectureModel> get(UUID id,boolean lock) {
        return jdbc.sql("SELECT id,name,hours_per_month,graph,status,revision,created_at,updated_at,published_at FROM ratecard.architecture_model WHERE id=:id"+(lock?" FOR UPDATE":""))
                .param("id",id).query((rs,n)->new ArchitectureModel(rs.getObject("id",UUID.class),rs.getString("name"),rs.getBigDecimal("hours_per_month"),
                        json.read(rs.getString("graph"),ArchitectureGraph.class),rs.getString("status"),rs.getLong("revision"),rs.getTimestamp("created_at").toInstant(),
                        rs.getTimestamp("updated_at").toInstant(),rs.getTimestamp("published_at")==null?null:rs.getTimestamp("published_at").toInstant())).optional();
    }
    public boolean update(UUID id,String name,BigDecimal hours,ArchitectureGraph graph,long revision) {
        return jdbc.sql("UPDATE ratecard.architecture_model SET name=:name,hours_per_month=:hours,graph=CAST(:graph AS jsonb),revision=revision+1,updated_at=now() WHERE id=:id AND revision=:revision AND status='DRAFT'")
                .param("id",id).param("name",name).param("hours",hours).param("graph",json.write(graph)).param("revision",revision).update()==1;
    }
    public boolean publish(UUID id,long revision) {
        return jdbc.sql("UPDATE ratecard.architecture_model SET status='PUBLISHED',published_at=now(),revision=revision+1,updated_at=now() WHERE id=:id AND revision=:revision AND status='DRAFT'")
                .param("id",id).param("revision",revision).update()==1;
    }
    public List<ArchitectureModel.Summary> list(String status,int size,int offset) {
        return jdbc.sql("SELECT id,name,hours_per_month,status,revision,updated_at,published_at FROM ratecard.architecture_model WHERE (:status='' OR status=:status) ORDER BY updated_at DESC,id LIMIT :size OFFSET :offset")
                .param("status",status==null?"":status).param("size",size+1).param("offset",offset)
                .query((rs,n)->new ArchitectureModel.Summary(rs.getObject("id",UUID.class),rs.getString("name"),rs.getBigDecimal("hours_per_month"),rs.getString("status"),rs.getLong("revision"),
                        rs.getTimestamp("updated_at").toInstant(),rs.getTimestamp("published_at")==null?null:rs.getTimestamp("published_at").toInstant())).list();
    }
}
