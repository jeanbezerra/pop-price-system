package com.porto.ciops.coa.pop.price.system.service.commercial.persistence;

import com.porto.ciops.coa.pop.price.system.service.commercial.domain.*;
import com.porto.ciops.coa.pop.price.system.service.shared.Json;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import java.util.*;

@Repository
public class CommercialRepository {
    private final JdbcClient jdbc;
    private final Json json;
    public CommercialRepository(JdbcClient jdbc, Json json) { this.jdbc=jdbc;this.json=json; }
    public Valuation save(Valuation v) {
        jdbc.sql("INSERT INTO ratecard.estimate_valuation(id,estimate_id,calculation_id,model_id,quote_id,snapshot) VALUES(:id,:estimate,:calculation,:model,:quote,CAST(:snapshot AS jsonb))")
                .param("id",v.id()).param("estimate",v.estimateId()).param("calculation",v.usd().calculationId())
                .param("model",v.modelId()).param("quote",v.exchangeQuote().id()).param("snapshot",json.write(v)).update();
        return v;
    }
    public Optional<Valuation> valuation(UUID id) {
        return jdbc.sql("SELECT snapshot FROM ratecard.estimate_valuation WHERE id=:id").param("id",id).query((rs,n)->json.read(rs.getString(1),Valuation.class)).optional();
    }
    public List<Valuation> valuations(int size, int offset) {
        return jdbc.sql("SELECT snapshot FROM ratecard.estimate_valuation ORDER BY created_at DESC,id LIMIT :size OFFSET :offset")
                .param("size",size+1).param("offset",offset).query((rs,n)->json.read(rs.getString(1),Valuation.class)).list();
    }
    public boolean save(CustomerContract c) {
        return jdbc.sql("INSERT INTO ratecard.customer_contract(id,reference,name,customer_name,valuation_id,starts_on,months,snapshot) VALUES(:id,:ref,:name,:customer,:valuation,:start,:months,CAST(:snapshot AS jsonb)) ON CONFLICT(reference) DO NOTHING")
                .param("id",c.id()).param("ref",c.reference()).param("name",c.name()).param("customer",c.customerName())
                .param("valuation",c.valuationId()).param("start",c.startsOn()).param("months",c.months()).param("snapshot",json.write(c)).update()==1;
    }
    public Optional<CustomerContract> contract(UUID id) {
        return jdbc.sql("SELECT snapshot FROM ratecard.customer_contract WHERE id=:id").param("id",id).query((rs,n)->json.read(rs.getString(1),CustomerContract.class)).optional();
    }
    public List<CustomerContract> contracts(int size,int offset) {
        return jdbc.sql("SELECT snapshot FROM ratecard.customer_contract ORDER BY created_at DESC,id LIMIT :size OFFSET :offset")
                .param("size",size+1).param("offset",offset).query((rs,n)->json.read(rs.getString(1),CustomerContract.class)).list();
    }
}
