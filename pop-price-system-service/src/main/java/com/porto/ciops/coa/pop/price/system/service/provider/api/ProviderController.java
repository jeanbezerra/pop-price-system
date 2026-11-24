package com.porto.ciops.coa.pop.price.system.service.provider.api;

import com.porto.ciops.coa.pop.price.system.service.catalog.application.CatalogService;
import com.porto.ciops.coa.pop.price.system.service.catalog.domain.CatalogViews.*;
import com.porto.ciops.coa.pop.price.system.service.provider.application.ProviderService;
import com.porto.ciops.coa.pop.price.system.service.provider.spi.ProviderCatalog;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;

import jakarta.validation.constraints.*;

import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Provider metadata and explicit remote discovery/verification operations. */
@RestController
@RequestMapping("/api/v1/providers")
@Tag(name = "Provedores", description = "Provedores e regiões locais, descoberta de metadados e verificação remota de produtos AWS.")
public class ProviderController {
    private final CatalogService catalog;
    private final ProviderService providers;

    public ProviderController(CatalogService catalog, ProviderService providers) {
        this.catalog = catalog;
        this.providers = providers;
    }

    @GetMapping
    @Operation(summary = "Listar provedores cadastrados", description = """
            Consulta os provedores cadastrados no banco, sem chamar APIs externas.
            O banco inicial inclui AWS. Use `code` nos endpoints de descoberta e sincronização.

            Exemplo: `GET /api/v1/providers`.
            """)
    @ApiResponse(responseCode = "200", description = "Provedores cadastrados, ordenados por código.", useReturnTypeSchema = true,
            content = @Content(mediaType = "application/json", examples = @ExampleObject(name = "Providers", ref = "#/components/examples/Providers")))
    public List<Provider> providers() {
        return catalog.providers();
    }

    @GetMapping("/{provider}/regions")
    @Operation(summary = "Listar regiões já descobertas", description = """
            Retorna as regiões persistidas do provedor; não faz consulta remota.
            Uma lista vazia indica que ainda não há regiões descobertas. Para preenchê-la,
            execute `POST /api/v1/providers/AWS/discovery?service=AmazonEKS`.

            Exemplo: `GET /api/v1/providers/AWS/regions`.
            """)
    @ApiResponse(responseCode = "200", description = "Regiões persistidas; pode retornar uma lista vazia.", useReturnTypeSchema = true,
            content = @Content(mediaType = "application/json", examples = @ExampleObject(name = "Regions", ref = "#/components/examples/Regions")))
    @ApiResponse(responseCode = "404", ref = "#/components/responses/ProviderNotFound")
    public List<Region> regions(
            @Parameter(description = "Código exato do provedor cadastrado.", example = "AWS")
            @PathVariable @Size(max = 30) String provider) {
        return catalog.regions(provider);
    }

    @PostMapping("/{provider}/discovery")
    @Operation(summary = "Descobrir serviços e regiões no provedor", description = """
            Consulta a AWS e persiste os metadados encontrados. Sem `service`, descobre os serviços
            e retorna `regions=[]`. Com `service`, descobre esse serviço e suas regiões comerciais.
            Não importa preços. Execute esta etapa antes de escolher o escopo da sincronização.
            A requisição é síncrona, não tem corpo e exige credenciais AWS com permissões de leitura.

            Exemplos: `POST /api/v1/providers/AWS/discovery` e
            `POST /api/v1/providers/AWS/discovery?service=AmazonEKS`.
            Códigos de provedor ou serviço inválidos podem retornar `400`; falhas remotas retornam `502`.
            """)
    @ApiResponse(responseCode = "200", description = "Metadados descobertos e persistidos.", useReturnTypeSchema = true,
            content = @Content(mediaType = "application/json", examples = @ExampleObject(name = "Discovery", ref = "#/components/examples/Discovery")))
    @ApiResponse(responseCode = "400", ref = "#/components/responses/ProviderInvalidRequest")
    @ApiResponse(responseCode = "502", ref = "#/components/responses/ProviderUnavailable")
    public ProviderService.Discovery discover(
            @Parameter(description = "Código do provedor com integração instalada; atualmente AWS.", example = "AWS")
            @PathVariable @Size(max = 30) String provider,
            @Parameter(description = "Service Code exato. Omita para descobrir todos os serviços; informe para descobrir também suas regiões.", example = "AmazonEKS")
            @RequestParam(required = false) @Size(max = 150) String service) {
        return providers.discover(provider, service);
    }

    @GetMapping("/{provider}/source-products")
    @Operation(summary = "Consultar uma página de produtos diretamente na AWS", description = """
            Consulta a Query API remota para verificar produtos e preços On-Demand na fonte,
            sem persistir ou alterar o catálogo local. Requer credenciais AWS autorizadas.
            Para continuar, reenvie `nextToken` mantendo os mesmos filtros; token nulo encerra a consulta.

            Exemplo: `GET /api/v1/providers/AWS/source-products?service=AmazonEKS&region=us-east-1`.
            Use `sku` apenas quando já conhecer um SKU real retornado pelo provedor.
            Tokens rejeitados e falhas de autenticação ou comunicação remota são traduzidos em `502`.
            """)
    @ApiResponse(responseCode = "200", description = "Página remota e token de continuação, quando houver.", useReturnTypeSchema = true,
            content = @Content(mediaType = "application/json", examples = @ExampleObject(name = "SourceProducts", ref = "#/components/examples/SourceProducts")))
    @ApiResponse(responseCode = "400", ref = "#/components/responses/ProviderInvalidRequest")
    @ApiResponse(responseCode = "502", ref = "#/components/responses/ProviderUnavailable")
    public ProviderCatalog.QueryPage query(
            @Parameter(description = "Provedor com integração instalada.", example = "AWS")
            @PathVariable @Size(max = 30) String provider,
            @Parameter(description = "Service Code retornado pela descoberta.", example = "AmazonEKS")
            @RequestParam @NotBlank @Size(max = 150) String service,
            @Parameter(description = "Código comercial da região; global é aceito para serviços globais.", example = "us-east-1")
            @RequestParam @NotBlank @Size(max = 80) String region,
            @Parameter(description = "SKU exato retornado pela fonte; omita para listar produtos do escopo.")
            @RequestParam(required = false) @Size(max = 200) String sku,
            @Parameter(description = "Token opaco recebido na página anterior. Não crie um valor manualmente.")
            @RequestParam(required = false) @Size(max = 10000) String nextToken) {
        return providers.query(provider, service, region, sku, nextToken);
    }
}
