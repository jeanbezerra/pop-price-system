package com.porto.ciops.coa.pop.price.system.service.parameters;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;

@RestController @RequestMapping("/api/v1/parameters") @Tag(name="Parâmetros do portal")
public class PortalParametersController {
    private final PortalParametersService service;
    public PortalParametersController(PortalParametersService service) { this.service=service; }
    @GetMapping @Operation(summary="Consultar premissas para novos modelos",description="Retorna horas mensais e revisão. Esta configuração não altera modelos, estimativas ou contratos já existentes.")
    public PortalParametersService.Parameters get() { return service.get(); }
    @PutMapping @Operation(summary="Definir horas mensais padrão",description="Salva uma premissa visível e editável ao criar um Canvas. Não representa uma taxa de preço. Exemplo: {\"hoursPerMonth\":720,\"revision\":0}. Retorna 409 se outra sessão alterou a revisão.")
    public PortalParametersService.Parameters update(@Valid @RequestBody Update request) { return service.update(request.hoursPerMonth(),request.revision()); }
    public record Update(@NotNull @DecimalMin(value="0",inclusive=false) @DecimalMax("744") @Digits(integer=3,fraction=6) BigDecimal hoursPerMonth,@Min(0) long revision) {}
}
