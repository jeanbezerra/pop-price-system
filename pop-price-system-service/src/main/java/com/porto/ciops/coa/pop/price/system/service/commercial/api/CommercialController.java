package com.porto.ciops.coa.pop.price.system.service.commercial.api;

import com.porto.ciops.coa.pop.price.system.service.commercial.application.*;
import com.porto.ciops.coa.pop.price.system.service.commercial.domain.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.UUID;

@RestController @RequestMapping("/api/v1")
@Tag(name="Estimativas em reais e contratos",description="Valores comerciais preservam a estimativa em USD, a cotação PTAX de venda e o resultado convertido em BRL.")
public class CommercialController {
    private final ValuationService valuations;
    private final ContractService contracts;
    public CommercialController(ValuationService valuations,ContractService contracts) { this.valuations=valuations;this.contracts=contracts; }
    @GetMapping("/valuations") @Operation(summary="Listar estimativas convertidas",description="Retorna snapshots imutáveis de cálculo USD e BRL, com a cotação aplicada. Exemplo: GET /api/v1/valuations?size=20&offset=0.")
    public ValuationService.ResultPage<Valuation> valuations(@RequestParam(defaultValue="20") int size,@RequestParam(defaultValue="0") int offset) { return valuations.list(size,offset); }
    @GetMapping("/valuations/{id}") @Operation(summary="Consultar conversão preservada",description="Consulta a conversão pelo UUID, sem recalcular nem consultar o BCB. Retorna 404 quando inexistente.")
    public Valuation valuation(@PathVariable UUID id) { return valuations.get(id); }
    @PostMapping("/estimates/{id}/valuations")
    @Operation(summary="Calcular estimativa em USD e BRL",description="Calcula a revisão atual e converte os totais usando a PTAX de venda já sincronizada. Não faz chamadas remotas. Preserva cálculo, cotação e arredondamento. Resultados incompletos têm totais nulos e não podem originar contratos. Exemplo: {\"quoteId\":\"11111111-1111-4111-8111-111111111111\"}.")
    @ApiResponse(responseCode="200",description="Snapshot imutável, completo ou com pendências explícitas.")
    @ApiResponse(responseCode="404",description="Estimativa ou cotação inexistente.")
    public Valuation calculate(@PathVariable UUID id,@Valid @RequestBody Convert request) { return valuations.calculate(id,request.quoteId(),null,0); }
    @GetMapping("/contracts") @Operation(summary="Listar contratos cadastrados",description="Retorna cadastros comerciais vinculados a uma conversão imutável. Mudanças posteriores na PTAX não alteram os valores. Exemplo: GET /api/v1/contracts.")
    public ValuationService.ResultPage<CustomerContract> contracts(@RequestParam(defaultValue="20") int size,@RequestParam(defaultValue="0") int offset) { return contracts.list(size,offset); }
    @GetMapping("/contracts/{id}") @Operation(summary="Consultar contrato",description="Retorna cliente, vigência, vínculo com a estimativa e valores USD/BRL preservados. Retorna 404 quando inexistente.")
    public CustomerContract contract(@PathVariable UUID id) { return contracts.get(id); }
    @PostMapping("/contracts")
    @Operation(summary="Cadastrar contrato a partir de uma estimativa",description="Exige uma conversão completa existente. O servidor deriva valores mensais e total em BRL; o cliente não informa preços. Total = mensal BRL × meses, sem acrescentar impostos ou margens. Exemplo: {\"reference\":\"CT-2026-001\",\"name\":\"Observabilidade\",\"customerName\":\"Equipe plataforma\",\"valuationId\":\"11111111-1111-4111-8111-111111111111\",\"startsOn\":\"2026-12-01\",\"months\":12}.")
    @ApiResponse(responseCode="200",description="Contrato cadastrado com valores e cotação preservados.")
    @ApiResponse(responseCode="409",description="Referência de contrato duplicada.")
    @ApiResponse(responseCode="422",description="Estimativa incompleta ou sem componentes.")
    public CustomerContract create(@Valid @RequestBody CreateContract request) { return contracts.create(request.reference(),request.name(),request.customerName(),request.valuationId(),request.startsOn(),request.months()); }
    public record Convert(@NotNull UUID quoteId) {}
    public record CreateContract(@NotBlank @Size(max=100) String reference,@NotBlank @Size(max=200) String name,
            @NotBlank @Size(max=200) String customerName,@NotNull UUID valuationId,@NotNull LocalDate startsOn,@Min(1) @Max(120) int months) {}
}
