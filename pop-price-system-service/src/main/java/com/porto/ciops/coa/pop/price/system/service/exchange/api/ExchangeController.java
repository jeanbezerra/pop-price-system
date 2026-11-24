package com.porto.ciops.coa.pop.price.system.service.exchange.api;

import com.porto.ciops.coa.pop.price.system.service.exchange.application.ExchangeService;
import com.porto.ciops.coa.pop.price.system.service.exchange.domain.ExchangeQuote;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.*;

@RestController @RequestMapping("/api/v1/exchange-rates")
@Tag(name="Câmbio PTAX", description="Fechamentos oficiais BCB; valores de venda em BRL por USD, com histórico imutável.")
public class ExchangeController {
    private final ExchangeService service;
    public ExchangeController(ExchangeService service) { this.service=service; }
    @GetMapping @Operation(summary="Listar PTAX sincronizadas",description="Lê até 100 cotações persistidas, mais recentes primeiro. Não consulta o BCB. Exemplo: GET /api/v1/exchange-rates.")
    public List<ExchangeQuote> list() { return service.list(); }
    @PostMapping("/synchronize")
    @Operation(summary="Sincronizar fechamento PTAX USD",description="Consulta CotacaoMoedaPeriodo no BCB, filtra USD e tipoBoletim=Fechamento e guarda compra/venda e fonte. Usa o último fechamento até a data informada, em janela de 14 dias; fins de semana não geram uma cotação artificial. Venda é usada nas conversões. Repetir o mesmo fechamento reutiliza o registro. Exemplo: {\"date\":\"2026-11-17\"}.")
    @ApiResponse(responseCode="200",description="Cotação sincronizada ou já existente.")
    @ApiResponse(responseCode="400",description="Data inválida ou futura.")
    @ApiResponse(responseCode="422",description="Sem fechamento na janela consultada.")
    @ApiResponse(responseCode="502",description="BCB indisponível ou resposta inválida; histórico preservado.")
    public ExchangeQuote synchronize(@Valid @RequestBody Synchronize request) { return service.synchronize(request.date()); }
    public record Synchronize(@NotNull @Schema(example="2026-11-17") LocalDate date) {}
}
