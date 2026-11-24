package com.porto.ciops.coa.pop.price.system.service.documentation;

import com.porto.ciops.coa.pop.price.system.service.shared.Json;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.examples.Example;
import io.swagger.v3.oas.models.headers.Header;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.media.*;
import io.swagger.v3.oas.models.parameters.HeaderParameter;
import io.swagger.v3.oas.models.responses.ApiResponse;

import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.Resource;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

/** Shared HTTP documentation; feature-specific operation descriptions stay with their APIs. */
@Configuration(proxyBeanMethods = false)
@Profile("(dev | hml) & !prd")
public class OpenApiConfiguration {
    @Bean
    OpenAPI popPriceSystemOpenApi(
            Json json, @Value("classpath:openapi/examples.json") Resource examples) throws IOException {
        var components = new Components();
        var definitions = json.tree(examples.getContentAsString(StandardCharsets.UTF_8));
        definitions.properties().forEach(entry -> {
            var definition = entry.getValue();
            components.addExamples(entry.getKey(), new Example()
                    .summary(definition.path("summary").asString())
                    .description(definition.path("description").asString())
                    .value(json.read(definition.path("value").toString(), Object.class)));
        });

        var problemSchema = new ObjectSchema();
        problemSchema
                .description("Erro HTTP em application/problem+json. correlationId também acompanha o cabeçalho X-Correlation-ID. violations aparece em erros de validação do corpo.")
                .addProperty("type", new StringSchema().format("uri").description("Tipo do problema, quando informado."))
                .addProperty("title", new StringSchema().example("Bad Request"))
                .addProperty("status", new IntegerSchema().example(400))
                .addProperty("detail", new StringSchema().description("Mensagem produzida pela API, sem SQL, credenciais ou stack trace."))
                .addProperty("instance", new StringSchema().format("uri-reference").description("Caminho da requisição que falhou."))
                .addProperty("correlationId", new StringSchema().example("exemplo-obs-001"))
                .addProperty("violations", new ArraySchema().items(new ObjectSchema()
                        .addProperty("field", new StringSchema().example("name"))
                        .addProperty("message", new StringSchema().example("must not be blank"))));
        problemSchema.setRequired(List.of("title", "status", "detail", "correlationId"));
        components.addSchemas("ApiProblem", problemSchema);
        components.addHeaders("CorrelationId", new Header()
                .description("Identificador para correlacionar esta resposta com os logs.")
                .schema(new StringSchema()).example("exemplo-obs-001"));
        components.addParameters("CorrelationId", new HeaderParameter()
                .name("X-Correlation-ID")
                .required(false)
                .description("Opcional: 1 a 80 caracteres alfanuméricos, ponto, hífen ou sublinhado. Se ausente ou inválido, a API gera outro identificador. Sempre é devolvido na resposta.")
                .schema(new StringSchema()).example("exemplo-obs-001"));

        components.addResponses("InvalidRequest", problem(
                "Parâmetros, UUID, JSON ou campos do corpo inválidos. Corrija a requisição antes de repetir.", "InvalidRequest", "ValidationFailure"));
        components.addResponses("CatalogQueryInvalid", problem(
                "Filtros ou paginação inválidos; attributes precisa conter um objeto JSON de até 8000 caracteres.", "InvalidRequest", "InvalidAttributes"));
        components.addResponses("ServicePaginationInvalid", problem(
                "size precisa estar entre 1 e 200; parâmetros com tipo inválido também retornam 400.", "InvalidPagination", "InvalidRequest"));
        components.addResponses("OffsetPaginationInvalid", problem(
                "size precisa estar entre 1 e 200 e offset entre 0 e 10000.", "InvalidOffsetPagination", "InvalidRequest"));
        components.addResponses("ProviderInvalidRequest", problem(
                "Provedor sem integração instalada, serviço desconhecido ou parâmetros inválidos.", "UnsupportedProvider", "InvalidRequest"));
        components.addResponses("SynchronizationInvalidRequest", problem(
                "Escopo, corpo ou Idempotency-Key inválidos. A chave aceita somente letras, números, ponto, sublinhado, dois-pontos e hífen.",
                "InvalidIdempotencyKey", "UnsupportedProvider", "ValidationFailure"));
        components.addResponses("ProviderNotFound", problem("Provedor não cadastrado.", "ProviderNotFound"));
        components.addResponses("RateNotFound", problem("Tarifa não encontrada no catálogo local.", "RateNotFound"));
        components.addResponses("EstimateNotFound", problem("Estimativa não encontrada.", "EstimateNotFound"));
        components.addResponses("EstimateOrRateNotFound", problem("Estimativa ou tarifa indicada no componente não encontrada.", "EstimateNotFound", "RateNotFound"));
        components.addResponses("EstimateItemNotFound", problem("Estimativa ausente, item inexistente ou item que não pertence a esta composição.", "EstimateNotFound", "ItemNotFound"));
        components.addResponses("SynchronizationNotFound", problem("Auditoria de sincronização não encontrada.", "SynchronizationNotFound"));
        components.addResponses("CalculationNotFound", problem("Cálculo não encontrado para esta estimativa.", "CalculationNotFound"));
        components.addResponses("ConcurrentChange", problem(
                "Contenção temporária ou acesso concorrente no banco; tente novamente.", "ConcurrentChange"));
        components.addResponses("SynchronizationConflict", problem(
                "Já existe importação em execução ou a chave foi usada em outro escopo. Consulte a auditoria antes de tentar novamente.",
                "ScopeAlreadyRunning", "IdempotencyConflict", "ConcurrentChange"));
        components.addResponses("RetryConflict", problem(
                "A execução original não está FAILED ou existe outra importação em execução para o mesmo escopo.",
                "RetryConflict", "ScopeAlreadyRunning", "ConcurrentChange"));
        components.addResponses("TrafficConflict", problem(
                "trafficKey já foi incluído nesta estimativa ou houve contenção temporária no banco.",
                "TrafficConflict", "ConcurrentChange"));
        components.addResponses("UnsupportedScope", problem(
                "Região indisponível para o serviço ou ausência de lista oficial USD/JSON para o escopo. Confirme os códigos retornados pela descoberta.",
                "UnsupportedScope"));
        components.addResponses("EstimateItemLimit", problem(
                "A estimativa atingiu o limite de 100 componentes. Remova um item antes de incluir outro.", "EstimateItemLimit"));
        components.addResponses("ProviderUnavailable", problem(
                "Falha na consulta ao provedor. Confira as credenciais e permissões AWS, a conectividade e o correlationId nos logs.",
                "ProviderUnavailable"));
        components.addResponses("SynchronizationFailure", problem(
                "A importação falhou. O identificador da auditoria vem em detail; consulte seu estado antes de usar o endpoint retry.",
                "SynchronizationFailure"));
        components.addResponses("InternalError", problem(
                "Falha inesperada. Informe o correlationId ao investigar os logs.", "InternalError"));
        components.addResponses("UnsupportedMediaType", problem(
                "Tipo de conteúdo não suportado. Envie o corpo JSON com Content-Type: application/json.", "UnsupportedMediaType"));

        return new OpenAPI().components(components).info(new Info()
                .title("pop-price-system-service")
                .version("v1")
                .description("""
                        API para descobrir serviços AWS, importar preços públicos versionados e estimar custos de uma arquitetura em USD.

                        **Base local:** `http://localhost:8080/pop-price-system-service`. Os caminhos abaixo são relativos a esse contexto.
                        A documentação está disponível em `dev` e `hml`; `prd` a desabilita.

                        ### Roteiro prático
                        1. Liste os provedores com `GET /api/v1/providers`.
                        2. Descubra o serviço e suas regiões: `POST /api/v1/providers/AWS/discovery?service=AmazonEKS`.
                        3. Importe preços com `POST /api/v1/synchronizations`, corpo `{"provider":"AWS","serviceCode":"AmazonEKS","regionCode":"us-east-1"}` e, opcionalmente, `Idempotency-Key: eks-us-east-1-001`.
                        4. Consulte `GET /api/v1/catalog/rates?provider=AWS&service=AmazonEKS&region=us-east-1&modality=OnDemand`. Copie um `id` real e confira sua unidade e atributos.
                        5. Crie a composição com `POST /api/v1/estimates` e corpo `{"name":"Plataforma de observabilidade","hoursPerMonth":720}`. Guarde o UUID retornado.
                        6. Inclua componentes em `POST /api/v1/estimates/{id}/items`, escolhendo um dos exemplos do corpo. Substitua `rateId` pelo id real consultado.
                        7. Execute `POST /api/v1/estimates/{id}/calculate` sem corpo. Guarde `calculationId` para consultar o snapshot imutável.

                        ```sh
                        curl -X POST 'http://localhost:8080/pop-price-system-service/api/v1/estimates' \\
                          -H 'Content-Type: application/json' -H 'X-Correlation-ID: exemplo-obs-001' \\
                          -d '{"name":"Plataforma de observabilidade","hoursPerMonth":720}'
                        ```

                        ### Como interpretar os resultados
                        - A descoberta e a importação são manuais e síncronas. A importação aguarda a conclusão e retorna `200`; catálogos grandes podem demorar.
                        - Consultas ao catálogo leem os dados já persistidos. Uma lista vazia pode indicar que falta descobrir ou sincronizar o escopo.
                        - Produtos, tarifas e alterações usam `afterId`/`nextAfterId`; serviços usam `after`/`nextAfter`. Mantenha os filtros e a ordenação entre páginas. Estimativas e sincronizações usam `offset`.
                        - `quantity` multiplica o consumo. `period` define HOUR, DAY, MONTH ou YEAR; `hoursPerMonth` é uma premissa obrigatória, sem assumir 730 horas.
                        - Cálculos incompletos também retornam `200`: `complete=false`, itens `UNPRICEABLE`, avisos e totais consolidados nulos. `knownMonthlySubtotal` contém apenas os valores conhecidos; não representa o custo total.
                        - O cálculo anual corresponde a 12 meses modelados. As estimativas não incluem automaticamente impostos ou descontos negociados.
                        - **Todos os exemplos são ilustrativos.** UUIDs, ids, SKUs, fontes, versões e valores monetários não são dados existentes nem preços oficiais atuais. Use os retornos reais da API.

                        ### Erros e pré-requisitos
                        Os erros usam `application/problem+json`, com `status`, `title`, `detail`, `instance` e `correlationId`. O cabeçalho `X-Correlation-ID` também acompanha as respostas de sucesso.
                        Prepare o banco conforme o README. Operações remotas exigem credenciais AWS autorizadas; esta versão da API não implementa autenticação ou autorização HTTP.
                        """));
    }

    @Bean
    OpenApiCustomizer commonHttpDocumentation() {
        return api -> api.getPaths().forEach((path, item) -> {
            if (!path.startsWith("/api/v1/")) return;
            item.readOperations().forEach(operation -> {
                operation.addParametersItem(new HeaderParameter().$ref("#/components/parameters/CorrelationId"));
                var responses = operation.getResponses();
                responses.putIfAbsent("400", new ApiResponse().$ref("#/components/responses/InvalidRequest"));
                responses.putIfAbsent("409", new ApiResponse().$ref("#/components/responses/ConcurrentChange"));
                responses.putIfAbsent("500", new ApiResponse().$ref("#/components/responses/InternalError"));
                if (operation.getRequestBody() != null) {
                    responses.putIfAbsent("415", new ApiResponse().$ref("#/components/responses/UnsupportedMediaType"));
                }
                responses.values().stream().filter(response -> response.get$ref() == null)
                        .forEach(response -> {
                            response.addHeaderObject("X-Correlation-ID",
                                    new Header().$ref("#/components/headers/CorrelationId"));
                            // Merge the inferred return schema with the explicitly documented JSON examples.
                            var content = response.getContent();
                            if (content != null && content.containsKey("application/json")
                                    && content.containsKey("*/*")
                                    && content.get("application/json").getSchema() == null) {
                                content.get("application/json").setSchema(content.remove("*/*").getSchema());
                            }
                        });
            });
        });
    }

    private static ApiResponse problem(String description, String... examples) {
        var media = new MediaType().schema(new Schema<>().$ref("#/components/schemas/ApiProblem"));
        for (String example : examples) {
            media.addExamples(example, new Example().$ref("#/components/examples/" + example));
        }
        return new ApiResponse().description(description)
                .content(new Content().addMediaType("application/problem+json", media))
                .addHeaderObject("X-Correlation-ID", new Header().$ref("#/components/headers/CorrelationId"));
    }
}
