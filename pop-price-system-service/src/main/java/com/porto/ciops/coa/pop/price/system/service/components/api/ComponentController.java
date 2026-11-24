package com.porto.ciops.coa.pop.price.system.service.components.api;

import com.porto.ciops.coa.pop.price.system.service.components.application.ComponentService;
import com.porto.ciops.coa.pop.price.system.service.components.domain.ComponentCatalog.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import java.util.UUID;
import java.util.List;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "Componentes de arquitetura")
@ApiResponses({
    @ApiResponse(responseCode = "404", description = "Componente ou serviço do catálogo não encontrado."),
    @ApiResponse(responseCode = "422", description = "Ícone ausente, versão inválida ou provedor incompatível para a configuração solicitada.")
})
public class ComponentController {
    private final ComponentService service;
    public ComponentController(ComponentService service) { this.service = service; }

    @GetMapping("/architecture-component-providers")
    @Operation(summary = "Consultar provedores para o cadastro de componentes", description = "Inclui Genérico e os provedores cloud disponíveis para autoria, independentemente das integrações de preço instaladas.")
    public List<Provider> providers() { return service.providers(); }

    @GetMapping("/architecture-component-categories")
    @Operation(summary = "Consultar categorias do provedor", description = "Categorias da biblioteca oficial do provedor, com identidade original e rótulo de apresentação. GENERIC retorna categorias neutras do portal. Um provedor sem biblioteca importada retorna uma lista vazia.")
    public List<Category> categories(@RequestParam String provider) { return service.categories(provider); }

    @GetMapping("/architecture-icons")
    @Operation(summary = "Consultar ícones oficiais versionados", description = "Filtra por provedor e busca em nome e termos. Paginação por cursor nextAfter; arquivos são distribuídos localmente pelo frontend.")
    public Results<Icon> icons(@RequestParam(defaultValue = "") String provider, @RequestParam(defaultValue = "") String query,
            @RequestParam(defaultValue = "") String after, @RequestParam(defaultValue = "24") int size,
            @RequestParam(defaultValue = "") String category) {
        return service.icons(provider, query, after, size, category);
    }

    @GetMapping("/architecture-components")
    @Operation(summary = "Consultar componentes cadastrados", description = "Filtra por provedor, código do serviço, categoria, situação, nome e presença de vínculo com serviço. Use nextAfter como after para a próxima página, mantendo os mesmos filtros.")
    public Results<Component> list(@RequestParam(defaultValue = "") String provider, @RequestParam(defaultValue = "") String service,
            @RequestParam(defaultValue = "") String category, @RequestParam(defaultValue = "") String status,
            @RequestParam(defaultValue = "") String query, @RequestParam(defaultValue = "") String after,
            @RequestParam(defaultValue = "20") int size,
            @Parameter(description = "true: com serviço vinculado; false: sem serviço vinculado; omitido: todos, incluindo genéricos.")
            @RequestParam(required = false) Boolean linked) {
        return this.service.list(new Filter(provider, service, category, status, query, linked), after, size);
    }

    @GetMapping("/architecture-components/{id}")
    @Operation(summary = "Consultar configuração de um componente", description = "Retorna serviço, representação visual, situação e revisão usados na edição.")
    public Component get(@PathVariable UUID id) { return service.get(id); }

    @PostMapping("/architecture-components")
    @Operation(summary = "Cadastrar componente", description = "Comece pelo provedor e pelas características. PENDING pode ser salvo sem serviço ou ícone. ACTIVE exige serviço e ícone do provedor, exceto em componentes GENERIC, que usam representação padrão e não possuem vínculo cloud. Não altera tarifas ou metadados sincronizados.")
    public Component create(@Valid @RequestBody Input input) { return service.create(input.draft()); }

    @PutMapping("/architecture-components/{id}")
    @Operation(summary = "Editar ou desativar componente", description = "Envia a configuração completa e a revisão atual. Retorna 409 se outra sessão alterou o registro. INACTIVE preserva o cadastro.")
    public Component update(@PathVariable UUID id, @Valid @RequestBody Input input) { return service.update(id, input.draft()); }

    @DeleteMapping("/architecture-components/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Excluir componente logicamente", description = "Oculta o componente da listagem e da edição, preservando os dados no banco. A revisão deve corresponder ao cadastro atual; conflitos retornam 409. Exemplo: `DELETE /api/v1/architecture-components/{id}?revision=0`, usando o UUID e a revisão retornados pela consulta. Não remove ícones, serviços ou referências históricas.")
    @ApiResponse(responseCode = "204", description = "Componente excluído logicamente, sem corpo de resposta.")
    public void delete(@PathVariable UUID id,
            @Parameter(description = "Revisão atual do componente, retornada na listagem ou consulta.")
            @RequestParam @Min(0) long revision) { service.delete(id, revision); }

    public record Input(@NotBlank @Size(max = 100) String provider, @Size(max = 200) String serviceCode,
            @NotBlank @Size(max = 200) String name, @NotBlank @Size(max = 100) String category,
            @Size(max = 2000) String description, @NotNull Status status,
            @Size(max = 200) String iconKey, @Size(max = 200) String iconRelease, @Min(0) long revision,
            @Size(max = 30) List<Characteristic> characteristics) {
        Draft draft() { return new Draft(provider, serviceCode, name, category, description, status, iconKey, iconRelease, revision, characteristics); }
    }
}
