package com.porto.ciops.coa.pop.price.system.service.exchange.persistence;

import com.porto.ciops.coa.pop.price.system.service.exchange.application.PtaxSource.Observation;
import com.porto.ciops.coa.pop.price.system.service.exchange.domain.ExchangeQuote;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import java.util.*;

@Repository
public class ExchangeRepository {
    private static final String COLUMNS = "id,quotation_date,quotation_at,buy_rate,sell_rate,source,bulletin,source_url,synchronized_at";
    private final JdbcClient jdbc;
    public ExchangeRepository(JdbcClient jdbc) { this.jdbc = jdbc; }
    private final org.springframework.jdbc.core.RowMapper<ExchangeQuote> mapper = (rs,n) -> new ExchangeQuote(
            rs.getObject("id",UUID.class),rs.getObject("quotation_date",java.time.LocalDate.class),rs.getTimestamp("quotation_at").toInstant(),
            rs.getBigDecimal("buy_rate"),rs.getBigDecimal("sell_rate"),rs.getString("source"),rs.getString("bulletin"),rs.getString("source_url"),rs.getTimestamp("synchronized_at").toInstant());
    public ExchangeQuote insert(Observation observation) {
        var q = observation.quote();
        jdbc.sql("INSERT INTO ratecard.exchange_quote(id,quotation_date,quotation_at,buy_rate,sell_rate,source,bulletin,source_url,payload) VALUES(:id,:day,:at,:buy,:sell,:source,:bulletin,:url,CAST(:payload AS jsonb)) ON CONFLICT(quotation_at,buy_rate,sell_rate) DO NOTHING")
                .param("id",q.id()).param("day",q.quotationDate()).param("at",java.sql.Timestamp.from(q.quotationAt()))
                .param("buy",q.buyRate()).param("sell",q.sellRate()).param("source",q.source()).param("bulletin",q.bulletin())
                .param("url",q.sourceUrl()).param("payload",observation.payload()).update();
        return jdbc.sql("SELECT " + COLUMNS + " FROM ratecard.exchange_quote WHERE quotation_at=:at AND buy_rate=:buy AND sell_rate=:sell")
                .param("at",java.sql.Timestamp.from(q.quotationAt())).param("buy",q.buyRate()).param("sell",q.sellRate()).query(mapper).single();
    }
    public Optional<ExchangeQuote> find(UUID id) { return jdbc.sql("SELECT " + COLUMNS + " FROM ratecard.exchange_quote WHERE id=:id").param("id",id).query(mapper).optional(); }
    public List<ExchangeQuote> list() { return jdbc.sql("SELECT " + COLUMNS + " FROM ratecard.exchange_quote ORDER BY quotation_at DESC,synchronized_at DESC,id LIMIT 100").query(mapper).list(); }
}
