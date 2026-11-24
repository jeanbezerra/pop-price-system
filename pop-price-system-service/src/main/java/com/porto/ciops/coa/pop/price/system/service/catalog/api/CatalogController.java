package com.porto.ciops.coa.pop.price.system.service.catalog.api;

import com.porto.ciops.coa.pop.price.system.service.catalog.application.CatalogService;
import com.porto.ciops.coa.pop.price.system.service.catalog.domain.*;
import com.porto.ciops.coa.pop.price.system.service.catalog.domain.CatalogViews.*;
import com.porto.ciops.coa.pop.price.system.service.shared.Page;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import org.springframework.web.bind.annotation.*;
import org.springdoc.core.annotations.ParameterObject;

/** Local catalog queries; no provider calls are made by these endpoints. */
@RestController
@RequestMapping("/api/v1/catalog")
@Tag(name = "Catálogo", description = "Consulta local de serviços, produtos, tarifas e histórico de preços versionados. Estes endpoints não chamam a AWS.")
public class CatalogController {
    private final CatalogService service;

    public CatalogController(CatalogService service) {
        this.service = service;
    }

    @GetMapping("/services")
    @Operation(summary = "Listar serviços descobertos", description = """
            Consulta os serviços já persistidos pela descoberta. Não chama o provedor.
            `lastSynchronizedAt` informa a conclusão mais recente de uma sincronização COMPLETED
            do serviço/provedor, considerando todas as regiões; é null quando não há sucesso registrado.
            A ordenação é por provedor/código. Quando `hasMore=true`, use `nextAfter` como
            `after` na próxima requisição, mantendo o filtro de provedor.

            Exemplo: `GET /api/v1/catalog/services?provider=AWS&size=50`.
            Próxima página: `GET /api/v1/catalog/services?provider=AWS&after=AWS%2FAmazonEKS&size=50`.
            Uma lista vazia não é erro e pode indicar que a descoberta ainda não foi executada.
            """)
    @ApiResponse(responseCode = "200", description = "Página de serviços com nextAfter quando houver continuação.", useReturnTypeSchema = true,
            content = @Content(mediaType = "application/json", examples = @ExampleObject(name = "Services", ref = "#/components/examples/Services")))
    @ApiResponse(responseCode = "400", ref = "#/components/responses/ServicePaginationInvalid")
    public CatalogService.ServicePage services(
            @Parameter(description = "Filtro exato de provedor; omita para consultar todos.", example = "AWS")
            @RequestParam(required = false) @Size(max = 30) String provider,
            @Parameter(description = "Cursor nextAfter da página anterior, no formato provedor/código. Omita na primeira página.", example = "AWS/AmazonEKS")
            @RequestParam(defaultValue = "") @Size(max = 300) String after,
            @Parameter(description = "Quantidade máxima por página, de 1 a 200.", example = "50", schema = @Schema(minimum = "1", maximum = "200"))
            @RequestParam(defaultValue = "50") int size) {
        return service.services(provider, after, size);
    }

    @GetMapping("/products")
    @Operation(summary = "Consultar produtos do catálogo local", description = """
            Lista produtos importados com filtros exatos combináveis. `category` representa
            a família do produto na fonte. `modality` seleciona produtos com termo dessa modalidade.
            `active=true` retorna ativos; `active=false` retorna apenas desativados.
            `attributes` deve ser um objeto JSON; seus pares são comparados por contenção.

            Exemplo: `GET /api/v1/catalog/products?provider=AWS&service=AmazonEKS&region=us-east-1&size=50`.
            Filtro JSON: acrescente `attributes=%7B%22regionCode%22%3A%22us-east-1%22%7D`.
            Para continuar, envie `afterId=nextAfterId` mantendo filtros e `sort`.
            JSON malformado em `attributes` ou paginação inválida retorna `400`.
            """)
    @ApiResponse(responseCode = "200", description = "Página de produtos; ausência de correspondência retorna items vazio.", useReturnTypeSchema = true,
            content = @Content(mediaType = "application/json", examples = @ExampleObject(name = "Products", ref = "#/components/examples/Products")))
    @ApiResponse(responseCode = "400", ref = "#/components/responses/CatalogQueryInvalid")
    public Page<Product> products(@ParameterObject @Valid @ModelAttribute Query query) {
        return service.products(query.filter(), query.cursor(), query.limit(), query.order());
    }

    @GetMapping("/rates")
    @Operation(summary = "Consultar tarifas e selecionar preços para uma estimativa", description = """
            Retorna dimensões de preço locais com unidade, moeda, modalidade, faixas, fonte e versão
            observada. Use um `id` real retornado aqui como `rateId` dos componentes ou cobranças de rede.
            Confira unidade, modalidade, região e atributos; a consulta não escolhe uma tarifa por você.
            `active=true` seleciona tarifas ativas; `active=false`, somente desativadas.

            Exemplo: `GET /api/v1/catalog/rates?provider=AWS&service=AmazonEKS&region=us-east-1&modality=OnDemand&size=50`.
            Quando `hasMore=true`, envie `afterId=nextAfterId` mantendo filtros e ordenação.
            Uma página vazia pode indicar que ainda falta sincronizar o serviço/região.
            """)
    @ApiResponse(responseCode = "200", description = "Tarifas versionadas e cursor da próxima página.", useReturnTypeSchema = true,
            content = @Content(mediaType = "application/json", examples = @ExampleObject(name = "Rates", ref = "#/components/examples/Rates")))
    @ApiResponse(responseCode = "400", ref = "#/components/responses/CatalogQueryInvalid")
    public Page<CatalogRate> rates(@ParameterObject @Valid @ModelAttribute Query query) {
        return service.rates(query.filter(), query.cursor(), query.limit(), query.order());
    }

    @GetMapping("/rates/{id}")
    @Operation(summary = "Consultar uma tarifa pelo identificador", description = """
            Retorna a tarifa e sua versão observada mais recente, incluindo faixa, fonte e estado ativo.
            Use para conferir o preço antes de incluí-lo em uma composição. O id pode se referir a uma
            tarifa desativada; consulte `active`. A criação de um cálculo aplicará as regras de precificação.

            Exemplo: `GET /api/v1/catalog/rates/123`. Substitua 123 pelo id retornado na listagem.
            Id inexistente retorna `404`; id não positivo ou com formato inválido retorna `400`.
            """)
    @ApiResponse(responseCode = "200", description = "Tarifa encontrada.", useReturnTypeSchema = true,
            content = @Content(mediaType = "application/json", examples = @ExampleObject(name = "Rate", ref = "#/components/examples/Rate")))
    @ApiResponse(responseCode = "404", ref = "#/components/responses/RateNotFound")
    public CatalogRate rate(
            @Parameter(description = "Id positivo da tarifa retornado por GET /catalog/rates.", example = "123")
            @PathVariable @Positive long id) {
        return service.rate(id);
    }

    @GetMapping("/rates/{id}/history")
    @Operation(summary = "Consultar o histórico de versões de uma tarifa", description = """
            Lista snapshots observados da dimensão de preço, com versão e URL da fonte.
            `validFrom`/`validTo` delimitam o período de observação no catálogo; `effectiveAt`
            dentro de `snapshot` é a vigência informada pelo provedor. São conceitos distintos.

            Exemplo: `GET /api/v1/catalog/rates/123/history?sort=desc&size=50`.
            Na próxima página, use `nextAfterId` como `afterId`; esse cursor é um id de versão.
            A tarifa precisa existir, caso contrário a API retorna `404`.
            """)
    @ApiResponse(responseCode = "200", description = "Versões observadas da tarifa.", useReturnTypeSchema = true,
            content = @Content(mediaType = "application/json", examples = @ExampleObject(name = "RateHistory", ref = "#/components/examples/RateHistory")))
    @ApiResponse(responseCode = "404", ref = "#/components/responses/RateNotFound")
    public Page<Version> history(
            @Parameter(description = "Id positivo da tarifa, não da versão.", example = "123")
            @PathVariable @Positive long id,
            @Parameter(description = "Id da última versão na direção selecionada. Use nextAfterId; 0 inicia a consulta.", example = "0", schema = @Schema(minimum = "0"))
            @RequestParam(defaultValue = "0") long afterId,
            @Parameter(description = "Quantidade por página, de 1 a 200.", example = "50", schema = @Schema(minimum = "1", maximum = "200"))
            @RequestParam(defaultValue = "50") int size,
            @Parameter(description = "Ordenação pelo id da versão.", example = "desc", schema = @Schema(allowableValues = {"asc", "desc"}))
            @RequestParam(defaultValue = "asc") String sort) {
        return service.history(id, afterId, size, sort);
    }

    @GetMapping("/changes")
    @Operation(summary = "Auditar alterações publicadas no catálogo", description = """
            Lista eventos INSERTED, UPDATED e DEACTIVATED associados às sincronizações.
            Consulta todo o histórico que corresponda aos filtros; `active` não restringe esta operação.
            Use `synchronizationId` para consultar a auditoria e `rateId` para consultar a tarifa.

            Exemplo: `GET /api/v1/catalog/changes?provider=AWS&service=AmazonEKS&region=us-east-1&sort=desc`.
            O cursor `nextAfterId` é o id da alteração, não o id da tarifa.
            """)
    @ApiResponse(responseCode = "200", description = "Página de alterações do catálogo.", useReturnTypeSchema = true,
            content = @Content(mediaType = "application/json", examples = @ExampleObject(name = "Changes", ref = "#/components/examples/Changes")))
    @ApiResponse(responseCode = "400", ref = "#/components/responses/CatalogQueryInvalid")
    public Page<Change> changes(@ParameterObject @Valid @ModelAttribute Query query) {
        return service.changes(query.filter(), query.cursor(), query.limit(), query.order());
    }

    public record Query(
            @Parameter(description = "Filtro exato do provedor.", example = "AWS")
            @Size(max = 30) String provider,
            @Parameter(description = "Service Code descoberto na fonte.", example = "AmazonEKS")
            @Size(max = 150) String service,
            @Parameter(description = "Região comercial do produto.", example = "us-east-1")
            @Size(max = 80) String region,
            @Parameter(description = "Família do produto na fonte, por correspondência exata.")
            @Size(max = 200) String category,
            @Parameter(description = "SKU real retornado pelo catálogo ou provedor.")
            @Size(max = 200) String sku,
            @Parameter(description = "Modalidade exata. O motor de estimativas suporta OnDemand.", example = "OnDemand")
            @Size(max = 40) String modality,
            @Parameter(description = "Objeto JSON de atributos por contenção; limite de 8000 caracteres. Envie com URL encoding.", example = "{\"regionCode\":\"us-east-1\"}", schema = @Schema(defaultValue = "{}"))
            @Size(max = 8000) String attributes,
            @Parameter(description = "true: somente ativos; false: somente desativados. Ignorado em /changes.", schema = @Schema(defaultValue = "true"))
            Boolean active,
            @Parameter(description = "Quantidade máxima de resultados por página.", example = "50", schema = @Schema(defaultValue = "50"))
            @Min(1) @Max(200) Integer size,
            @Parameter(description = "Cursor nextAfterId da página anterior. Omita ou use 0 na primeira página.", example = "0", schema = @Schema(defaultValue = "0"))
            @PositiveOrZero Long afterId,
            @Parameter(description = "Ordenação por id; mantenha a mesma direção entre páginas.", schema = @Schema(defaultValue = "asc", allowableValues = {"asc", "desc"}))
            @Pattern(regexp = "asc|desc") String sort) {
        CatalogFilter filter() {
            return new CatalogFilter(
                    provider,
                    service,
                    region,
                    category,
                    sku,
                    modality,
                    attributes == null ? "{}" : attributes,
                    active == null || active);
        }

        int limit() {
            return size == null ? 50 : size;
        }

        long cursor() {
            return afterId == null ? 0 : afterId;
        }

        String order() {
            return sort == null ? "asc" : sort;
        }
    }
}
