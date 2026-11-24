package com.porto.ciops.coa.pop.price.system.service.estimation.api;

import com.porto.ciops.coa.pop.price.system.service.estimation.application.EstimateService;
import com.porto.ciops.coa.pop.price.system.service.estimation.domain.Estimate;
import com.porto.ciops.coa.pop.price.system.service.pricing.domain.PricingInput.Item;
import com.porto.ciops.coa.pop.price.system.service.pricing.domain.PricingResult;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;

import jakarta.validation.Valid;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.UUID;

/** Architecture cart and reproducible calculation API. */
@RestController
@RequestMapping("/api/v1/estimates")
@Tag(name = "Estimativas", description = "Composição de arquitetura, inclusão e remoção de componentes, cálculo de custos em USD e consulta de snapshots imutáveis.")
public class EstimateController {
    private final EstimateService service;

    public EstimateController(EstimateService service) {
        this.service = service;
    }

    @PostMapping
    @Operation(summary = "Criar uma estimativa de arquitetura", description = """
            Cria uma composição vazia em USD, com nome e premissa explícita de horas mensais.
            Não inclui preços ou componentes automaticamente e não calcula custos nesta etapa.
            `hoursPerMonth` deve ser maior que zero e no máximo 744, com até seis casas decimais.

            Exemplo: `POST /api/v1/estimates`, `Content-Type: application/json`,
            corpo `{"name":"Plataforma de observabilidade","hoursPerMonth":720}`.
            Guarde o UUID `id` para incluir componentes e executar o cálculo.
            Nome vazio, horas ausentes ou fora do intervalo retornam `400`.
            """)
    @ApiResponse(responseCode = "201", description = "Composição criada, sem itens e sem cálculo anterior.", useReturnTypeSchema = true,
            content = @Content(mediaType = "application/json", examples = @ExampleObject(name = "Estimate", ref = "#/components/examples/Estimate")))
    public ResponseEntity<Estimate> create(
            @io.swagger.v3.oas.annotations.parameters.RequestBody(required = true,
                    description = "Nome da arquitetura e horas do mês modelado.",
                    content = @Content(mediaType = "application/json", examples = @ExampleObject(name = "CreateEstimate", ref = "#/components/examples/CreateEstimate")))
            @RequestBody @Valid EstimateRequests.Create request) {
        var created = service.create(request.name(), request.hoursPerMonth());
        return ResponseEntity.created(URI.create("/api/v1/estimates/" + created.id()))
                .body(created);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Consultar a composição e seu último cálculo", description = """
            Retorna a composição atual, seus componentes e o último snapshot de cálculo, se existir.
            `lastCalculation` pode ser nulo ou referir-se a uma revisão anterior: compare
            `revision` da composição com `lastCalculation.revision`. Incluir ou remover itens
            não recalcula automaticamente os custos.

            Exemplo: `GET /api/v1/estimates/11111111-1111-4111-8111-111111111111`.
            Substitua o UUID pelo id retornado na criação. Estimativa inexistente retorna `404`.
            """)
    @ApiResponse(responseCode = "200", description = "Composição atual e último cálculo conhecido.", useReturnTypeSchema = true,
            content = @Content(mediaType = "application/json", examples = {
                    @ExampleObject(name = "Estimate", ref = "#/components/examples/Estimate"),
                    @ExampleObject(name = "EstimateWithItems", ref = "#/components/examples/EstimateWithItems")}))
    @ApiResponse(responseCode = "404", ref = "#/components/responses/EstimateNotFound")
    public Estimate get(
            @Parameter(description = "UUID retornado ao criar a estimativa.", example = "11111111-1111-4111-8111-111111111111")
            @PathVariable UUID id) {
        return service.get(id);
    }

    @GetMapping
    @Operation(summary = "Listar estimativas de arquitetura", description = """
            Lista cabeçalhos de estimativas da mais recente para a mais antiga, com desempate por id.
            Esta listagem não carrega os componentes nem o último cálculo: `items` de cada estimativa
            vem vazio e `lastCalculation` nulo. Consulte `GET /estimates/{id}` para obter esses detalhes.

            Exemplo: `GET /api/v1/estimates?size=20&offset=0`.
            Quando `hasMore=true`, aumente `offset` pelo tamanho da página.
            Paginação fora dos limites retorna `400`.
            """)
    @ApiResponse(responseCode = "200", description = "Página resumida de estimativas; pode estar vazia.", useReturnTypeSchema = true,
            content = @Content(mediaType = "application/json", examples = @ExampleObject(name = "Estimates", ref = "#/components/examples/Estimates")))
    @ApiResponse(responseCode = "400", ref = "#/components/responses/OffsetPaginationInvalid")
    public EstimateService.EstimatePage list(
            @Parameter(description = "Quantidade máxima por página, de 1 a 200.", example = "20", schema = @Schema(minimum = "1", maximum = "200"))
            @RequestParam(defaultValue = "50") int size,
            @Parameter(description = "Quantidade de estimativas a pular, de 0 a 10000.", example = "0", schema = @Schema(minimum = "0", maximum = "10000"))
            @RequestParam(defaultValue = "0") int offset) {
        return service.list(size, offset);
    }

    @PostMapping("/{id}/items")
    @Operation(summary = "Incluir um componente de consumo ou fluxo de rede", description = """
            Acrescenta um item à composição e incrementa sua revisão. Não calcula custos nesta etapa.
            Há limite de 100 itens por estimativa. `quantity` multiplica o consumo informado.

            **Recurso:** selecione um `rateId` real em `GET /catalog/rates`. Para duas unidades
            em uso contínuo com tarifa Hrs: `quantity=2`, `consumption=1`, `consumptionUnit=Hrs`, `period=HOUR`.
            Sem `rateId`, o item também é aceito; o cálculo posterior o marcará como UNPRICEABLE.

            **Retenção:** use uma tarifa de armazenamento, consumo de ingestão diária,
            `period=DAY` e `retentionDays`. Uma combinação incompatível gera aviso no cálculo.

            **Rede:** informe `flow`, sem `rateId` de recurso e sem `retentionDays`.
            `accountCode` deve ser igual a `flow.sourceAccount`; `trafficKey` precisa ser único na estimativa
            e cada chave de `flow.charges` pode aparecer uma vez. As tarifas de cada cobrança devem existir.
            Para comparar AZs entre contas, use IDs físicos como `use1-az1`.

            Exemplo: `POST /api/v1/estimates/11111111-1111-4111-8111-111111111111/items`
            com um dos exemplos do corpo. Substitua os ids ilustrativos pelos retornos reais.
            `400`: campos ou combinações inválidas; `404`: estimativa ou tarifa ausente;
            `409`: trafficKey repetido; `422`: limite de componentes atingido.
            """)
    @ApiResponse(responseCode = "201", description = "Componente incluído, com UUID próprio.", useReturnTypeSchema = true,
            content = @Content(mediaType = "application/json", examples = @ExampleObject(name = "Item", ref = "#/components/examples/Item")))
    @ApiResponse(responseCode = "404", ref = "#/components/responses/EstimateOrRateNotFound")
    @ApiResponse(responseCode = "409", ref = "#/components/responses/TrafficConflict")
    @ApiResponse(responseCode = "422", ref = "#/components/responses/EstimateItemLimit")
    public ResponseEntity<Item> add(
            @Parameter(description = "UUID da estimativa que receberá o componente.", example = "11111111-1111-4111-8111-111111111111")
            @PathVariable UUID id,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(required = true,
                    description = "Escolha um dos exemplos: recurso por hora, ingestão com retenção, consumo sem preço ou fluxo de rede.",
                    content = @Content(mediaType = "application/json", examples = {
                            @ExampleObject(name = "AddHourlyItem", ref = "#/components/examples/AddHourlyItem"),
                            @ExampleObject(name = "AddRetentionItem", ref = "#/components/examples/AddRetentionItem"),
                            @ExampleObject(name = "AddNoPriceItem", ref = "#/components/examples/AddNoPriceItem"),
                            @ExampleObject(name = "AddNetworkItem", ref = "#/components/examples/AddNetworkItem")}))
            @RequestBody @Valid EstimateRequests.AddItem request) {
        var item = service.add(id, request.command());
        return ResponseEntity.created(URI.create("/api/v1/estimates/" + id + "/items/" + item.id()))
                .body(item);
    }

    @DeleteMapping("/{id}/items/{itemId}")
    @Operation(summary = "Remover um componente da composição", description = """
            Remove o componente indicado desta estimativa e incrementa a revisão.
            Snapshots de cálculos anteriores permanecem consultáveis e não são recalculados ou apagados.

            Exemplo: `DELETE /api/v1/estimates/11111111-1111-4111-8111-111111111111/items/22222222-2222-4222-8222-222222222222`.
            Não envie corpo. O sucesso retorna `204` sem conteúdo.
            Estimativa inexistente, item inexistente ou item de outra estimativa retornam `404`.
            """)
    @ApiResponse(responseCode = "204", description = "Componente removido; resposta sem corpo.", content = @Content)
    @ApiResponse(responseCode = "404", ref = "#/components/responses/EstimateItemNotFound")
    public ResponseEntity<Void> delete(
            @Parameter(description = "UUID da estimativa.", example = "11111111-1111-4111-8111-111111111111")
            @PathVariable UUID id,
            @Parameter(description = "UUID do item retornado na inclusão; deve pertencer a esta estimativa.", example = "22222222-2222-4222-8222-222222222222")
            @PathVariable UUID itemId) {
        service.delete(id, itemId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/calculate")
    @Operation(summary = "Calcular custos e salvar um snapshot imutável", description = """
            Calcula a composição atual com uma leitura consistente das tarifas locais e persiste
            um novo snapshot. Retorna custos por item, mês, ano e hora, agrupamentos por serviço,
            região, conta e categoria, além de faixas e versões de preço utilizadas.
            Não consulta a AWS nem altera o catálogo. O anual representa 12 meses modelados.

            Exemplo: `POST /api/v1/estimates/11111111-1111-4111-8111-111111111111/calculate`, sem corpo.
            Cada chamada gera outro `calculationId`; guarde-o para reproduzir a consulta depois.

            **Resultado incompleto também é sucesso HTTP 200.** Sem itens, sem preço, com unidade
            incompatível, modalidade não suportada ou regra de rede não implementada, confira
            `complete=false`, `warnings` e linhas UNPRICEABLE. `hourlyCost`, `monthlyCost` e
            `annualCost` ficam nulos. `knownMonthlySubtotal` soma somente os componentes precificados.
            Estimativa inexistente retorna `404`; contenção temporária de banco pode retornar `409`.
            """)
    @ApiResponse(responseCode = "200", description = "Novo snapshot, completo ou incompleto com avisos.", useReturnTypeSchema = true,
            content = @Content(mediaType = "application/json", examples = {
                    @ExampleObject(name = "CalculationComplete", ref = "#/components/examples/CalculationComplete"),
                    @ExampleObject(name = "CalculationIncomplete", ref = "#/components/examples/CalculationIncomplete")}))
    @ApiResponse(responseCode = "404", ref = "#/components/responses/EstimateNotFound")
    public PricingResult calculate(
            @Parameter(description = "UUID da composição que será calculada.", example = "11111111-1111-4111-8111-111111111111")
            @PathVariable UUID id) {
        return service.calculate(id);
    }

    @GetMapping("/{id}/calculations/{calculationId}")
    @Operation(summary = "Consultar um cálculo histórico sem recalcular", description = """
            Recupera exatamente o snapshot salvo para esta estimativa, incluindo sua revisão,
            premissas, preços, faixas, agrupamentos e avisos. O resultado não muda após uma
            sincronização de preços nem após a remoção de componentes da composição.

            Exemplo: `GET /api/v1/estimates/11111111-1111-4111-8111-111111111111/calculations/44444444-4444-4444-8444-444444444444`.
            Use `calculationId` retornado pelo endpoint calculate. Se o snapshot não existir
            ou pertencer a outra estimativa, a API retorna `404`.
            """)
    @ApiResponse(responseCode = "200", description = "Snapshot imutável do cálculo selecionado.", useReturnTypeSchema = true,
            content = @Content(mediaType = "application/json", examples = {
                    @ExampleObject(name = "CalculationComplete", ref = "#/components/examples/CalculationComplete"),
                    @ExampleObject(name = "CalculationIncomplete", ref = "#/components/examples/CalculationIncomplete")}))
    @ApiResponse(responseCode = "404", ref = "#/components/responses/CalculationNotFound")
    public PricingResult calculation(
            @Parameter(description = "UUID da estimativa à qual o cálculo deve pertencer.", example = "11111111-1111-4111-8111-111111111111")
            @PathVariable UUID id,
            @Parameter(description = "UUID retornado por calculate; não é o id de um componente.", example = "44444444-4444-4444-8444-444444444444")
            @PathVariable UUID calculationId) {
        return service.calculation(id, calculationId);
    }
}
