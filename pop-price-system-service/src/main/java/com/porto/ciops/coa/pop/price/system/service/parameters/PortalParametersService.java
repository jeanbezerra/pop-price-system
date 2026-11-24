package com.porto.ciops.coa.pop.price.system.service.parameters;

import com.porto.ciops.coa.pop.price.system.service.shared.ApiException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.Instant;

/** Small feature: one explicit default for new models; existing financial snapshots never change. */
@Service
public class PortalParametersService {
    private final JdbcClient jdbc;
    public PortalParametersService(JdbcClient jdbc) { this.jdbc=jdbc; }
    public Parameters get() { return jdbc.sql("SELECT hours_per_month,revision,updated_at FROM ratecard.portal_parameters WHERE singleton=true")
            .query((rs,n)->new Parameters(rs.getBigDecimal(1),rs.getLong(2),rs.getTimestamp(3).toInstant())).single(); }
    @Transactional public Parameters update(BigDecimal hours,long revision) {
        if(jdbc.sql("UPDATE ratecard.portal_parameters SET hours_per_month=:hours,revision=revision+1,updated_at=now() WHERE singleton=true AND revision=:revision")
                .param("hours",hours).param("revision",revision).update()!=1) throw new ApiException(409,"Parâmetros alterados por outra sessão. Atualize os dados antes de salvar.");
        return get();
    }
    public record Parameters(BigDecimal hoursPerMonth,long revision,Instant updatedAt) {}
}
