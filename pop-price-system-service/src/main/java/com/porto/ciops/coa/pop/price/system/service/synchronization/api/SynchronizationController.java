package com.porto.ciops.coa.pop.price.system.service.synchronization.api;

import com.porto.ciops.coa.pop.price.system.service.provider.spi.ProviderCatalog.Scope;
import com.porto.ciops.coa.pop.price.system.service.synchronization.application.SynchronizationService;
import com.porto.ciops.coa.pop.price.system.service.synchronization.domain.Synchronization;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.UUID;

/** Synchronous imports and audit lookup, with controlled reprocessing and request idempotency. */
@RestController
@RequestMapping("/api/v1/synchronizations")
@Tag(name = "Sincronizações", description = "Importação manual e síncrona de um serviço/região, consulta da auditoria e repetição controlada de falhas.")
public class SynchronizationController {
    private final SynchronizationService service;

    public SynchronizationController(SynchronizationService service) {
        this.service = service;
    }

    @PostMapping
    @Operation(
            summary = "Importar preços de um serviço e uma região",
            description = """
                    Descobre e valida o escopo, obtém a lista oficial USD/JSON e publica seus produtos,
                    tarifas e versões no catálogo. O catálogo só é publicado após a leitura completa da fonte.
                    Se a versão já foi importada, conclui sem baixar e publicar novamente.

                    A chamada é síncrona e retorna `200` ao terminar. Não cria job em background.
                    Para catálogos grandes, ajuste o timeout do cliente/gateway e mantenha a conexão aberta.

                    Exemplo: `POST /api/v1/synchronizations`, `Content-Type: application/json`,
                    `Idempotency-Key: eks-us-east-1-001` e o corpo do exemplo abaixo.
                    Guarde `id` para consultar a auditoria. A mesma chave e escopo reapresentam uma
                    execução finalizada, inclusive FAILED; não reiniciam a importação.
                    Para uma nova importação, use uma chave nova. Uma execução RUNNING ou chave usada
                    em outro escopo gera `409`. Falha de importação retorna `502` com o UUID em `detail`.
                    """)
    @ApiResponse(responseCode = "200", description = "Auditoria concluída ou reapresentada pela chave de idempotência.", useReturnTypeSchema = true,
            content = @Content(mediaType = "application/json", examples = {
                    @ExampleObject(name = "Synchronization", ref = "#/components/examples/Synchronization"),
                    @ExampleObject(name = "SynchronizationFailed", ref = "#/components/examples/SynchronizationFailed")}))
    @ApiResponse(responseCode = "409", ref = "#/components/responses/SynchronizationConflict")
    @ApiResponse(responseCode = "400", ref = "#/components/responses/SynchronizationInvalidRequest")
    @ApiResponse(responseCode = "422", ref = "#/components/responses/UnsupportedScope")
    @ApiResponse(responseCode = "502", ref = "#/components/responses/SynchronizationFailure")
    public ResponseEntity<Synchronization> synchronize(
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                    required = true, description = "Um único escopo descoberto no provedor. Use os códigos retornados pela API de descoberta.",
                    content = @Content(mediaType = "application/json", examples = @ExampleObject(name = "SyncRequest", ref = "#/components/examples/SyncRequest")))
            @RequestBody @Valid Request request,
            @Parameter(description = "Chave opcional de 1 a 120 caracteres: letras, números, ponto, sublinhado, dois-pontos ou hífen. Reutilize somente no mesmo escopo; uma chave nova solicita nova importação.", example = "eks-us-east-1-001", schema = @Schema(minLength = 1, maxLength = 120, pattern = "[a-zA-Z0-9._:-]{1,120}"))
            @RequestHeader(name = "Idempotency-Key", required = false) String key) {
        var result =
                service.synchronize(
                        new Scope(request.provider(), request.serviceCode(), request.regionCode()),
                        key);
        return ResponseEntity.ok()
                .location(URI.create("/api/v1/synchronizations/" + result.id()))
                .body(result);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Consultar a auditoria de uma sincronização", description = """
            Retorna escopo, estado RUNNING/COMPLETED/FAILED, tentativa, instantes, versão da fonte
            e contadores de processamento. Em falhas, consulte `errorCode`; detalhes técnicos ficam nos logs.
            Os contadores e a versão podem estar vazios ou zerados antes da publicação.

            Exemplo: `GET /api/v1/synchronizations/33333333-3333-4333-8333-333333333333`.
            Use o UUID retornado na importação ou indicado na mensagem de erro `502`.
            A consulta não dispara ou reinicia o processamento. UUID desconhecido retorna `404`.
            """)
    @ApiResponse(responseCode = "200", description = "Estado e contadores da execução.", useReturnTypeSchema = true,
            content = @Content(mediaType = "application/json", examples = {
                    @ExampleObject(name = "Synchronization", ref = "#/components/examples/Synchronization"),
                    @ExampleObject(name = "SynchronizationFailed", ref = "#/components/examples/SynchronizationFailed")}))
    @ApiResponse(responseCode = "404", ref = "#/components/responses/SynchronizationNotFound")
    public Synchronization get(
            @Parameter(description = "UUID da auditoria retornado pela importação.", example = "33333333-3333-4333-8333-333333333333")
            @PathVariable UUID id) {
        return service.get(id);
    }

    @GetMapping
    @Operation(summary = "Listar auditorias de sincronização", description = """
            Lista execuções manuais, da mais recente para a mais antiga por padrão, com desempate por id.
            Ordene o histórico completo antes da paginação com `sortBy=startedAt|serviceCode|regionCode|status|processed`
            e `direction=asc|desc`. Situação segue a ordem Concluída, Em execução, Falhou.
            Exemplo: `GET /api/v1/synchronizations?size=20&offset=0`.
            Se `hasMore=true`, avance `offset` pelo tamanho da página, mantendo `size`.
            `size` fora de 1..200 ou `offset` fora de 0..10000 retorna `400`.
            """)
    @ApiResponse(responseCode = "200", description = "Página de auditorias; pode estar vazia.", useReturnTypeSchema = true,
            content = @Content(mediaType = "application/json", examples = @ExampleObject(name = "Synchronizations", ref = "#/components/examples/Synchronizations")))
    @ApiResponse(responseCode = "400", ref = "#/components/responses/OffsetPaginationInvalid")
    public SynchronizationService.SyncPage list(
            @Parameter(description = "Quantidade máxima por página.", example = "20", schema = @Schema(minimum = "1", maximum = "200"))
            @RequestParam(defaultValue = "50") int size,
            @Parameter(description = "Quantidade de auditorias a pular; máximo 10000.", example = "0", schema = @Schema(minimum = "0", maximum = "10000"))
            @RequestParam(defaultValue = "0") int offset,
            @Parameter(description = "Coluna de ordenação.", schema = @Schema(allowableValues = {"startedAt", "serviceCode", "regionCode", "status", "processed"}))
            @RequestParam(defaultValue = "startedAt") String sortBy,
            @Parameter(description = "Direção da ordenação.", schema = @Schema(allowableValues = {"asc", "desc"}))
            @RequestParam(defaultValue = "desc") String direction) {
        return service.list(size, offset, sortBy, direction);
    }

    @PostMapping("/{id}/retry")
    @Operation(summary = "Repetir uma sincronização que falhou", description = """
            Aceita somente uma auditoria em estado FAILED. Cria outra execução para o mesmo escopo,
            com novo UUID e `attempt` incrementado, preservando a auditoria anterior.
            Não reutiliza a chave de idempotência da execução original. A nova importação é síncrona.

            Exemplo: `POST /api/v1/synchronizations/33333333-3333-4333-8333-333333333333/retry`, sem corpo.
            UUID inexistente retorna `404`; execução que não está FAILED ou escopo ocupado retorna `409`.
            Corrija credenciais, conectividade ou escopo antes de repetir uma falha; nova falha retorna `502`.
            """)
    @ApiResponse(responseCode = "200", description = "Nova auditoria, com outro UUID e tentativa incrementada.", useReturnTypeSchema = true,
            content = @Content(mediaType = "application/json", examples = @ExampleObject(name = "RetrySynchronization", ref = "#/components/examples/RetrySynchronization")))
    @ApiResponse(responseCode = "404", ref = "#/components/responses/SynchronizationNotFound")
    @ApiResponse(responseCode = "409", ref = "#/components/responses/RetryConflict")
    @ApiResponse(responseCode = "422", ref = "#/components/responses/UnsupportedScope")
    @ApiResponse(responseCode = "502", ref = "#/components/responses/SynchronizationFailure")
    public Synchronization retry(
            @Parameter(description = "UUID de uma execução em estado FAILED.", example = "33333333-3333-4333-8333-333333333333")
            @PathVariable UUID id) {
        return service.retry(id);
    }

    @Schema(description = "Escopo de importação: um provedor, um serviço e uma região por chamada.")
    public record Request(
            @Schema(description = "Código do provedor com integração instalada.", example = "AWS")
            @NotBlank @Size(max = 30) String provider,
            @Schema(description = "Service Code obtido na descoberta.", example = "AmazonEKS")
            @NotBlank @Size(max = 150) String serviceCode,
            @Schema(description = "Código de região retornado para o serviço.", example = "us-east-1")
            @NotBlank @Size(max = 80) String regionCode) {}
}
