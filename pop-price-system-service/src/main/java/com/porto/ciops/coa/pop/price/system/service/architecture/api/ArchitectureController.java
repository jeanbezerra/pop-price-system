package com.porto.ciops.coa.pop.price.system.service.architecture.api;

import com.porto.ciops.coa.pop.price.system.service.architecture.application.ArchitectureService;
import com.porto.ciops.coa.pop.price.system.service.architecture.domain.*;
import com.porto.ciops.coa.pop.price.system.service.commercial.domain.Valuation;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;
import java.util.UUID;

@RestController @RequestMapping("/api/v1/architecture-models")
@Tag(name="Canvas e modelos",description="Rascunhos visuais, publicação de modelos reutilizáveis e geração de estimativas com PTAX.")
public class ArchitectureController {
    private final ArchitectureService service;
    public ArchitectureController(ArchitectureService service) { this.service=service; }
    @GetMapping @Operation(summary="Listar estruturas",description="Retorna itens paginados e total filtrado. Filtros: q (nome ou provedor, texto literal), provider (AWS/AZURE/GCP/GENERIC), category, environment, status (DRAFT/PUBLISHED), lifecycle (ACTIVE padrão, ARCHIVED ou ALL). Excluídas logicamente nunca aparecem. sort aceita provider, name, category, environment, status, region, componentCount, predictedMonthlyCost, createdAt ou updatedAt (padrão). direction aceita ASC ou DESC (padrão); ID desempata e valores desconhecidos ficam ao final. size aceita 1 a 100 e offset não negativo. Ordenação e filtros antecedem a paginação. Exemplo: GET /api/v1/architecture-models?provider=AWS&sort=name&direction=ASC&size=20&offset=0.")
    public ArchitectureService.ModelPage list(@RequestParam(required=false) String status,
            @RequestParam(defaultValue="ACTIVE") String lifecycle, @RequestParam(defaultValue="") String q,
            @RequestParam(defaultValue="") String provider, @RequestParam(defaultValue="") String category,
            @RequestParam(defaultValue="") String environment, @RequestParam(defaultValue="updatedAt") String sort,
            @RequestParam(defaultValue="DESC") String direction, @RequestParam(defaultValue="20") int size,
            @RequestParam(defaultValue="0") int offset) {
        return service.list(new StructureSearch(status,lifecycle,q,provider,category,environment,sort,direction,size,offset));
    }
    @PostMapping("/{id}/archive") @Operation(summary="Arquivar estrutura",description="Preserva o desenho e impede alterações e novas estimativas até desarquivar. Exemplo: {\"revision\":1}.")
    public ArchitectureModel archive(@PathVariable UUID id,@Valid @RequestBody Revision request) { return service.archive(id,request.revision(),true); }
    @PostMapping("/{id}/unarchive") @Operation(summary="Desarquivar estrutura",description="Retoma a situação anterior, preservando a publicação. Exemplo: {\"revision\":2}.")
    public ArchitectureModel unarchive(@PathVariable UUID id,@Valid @RequestBody Revision request) { return service.archive(id,request.revision(),false); }
    @DeleteMapping("/{id}") @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    @Operation(summary="Excluir estrutura logicamente",description="Oculta a estrutura sem remover o desenho, estimativas ou contratos históricos. Exemplo: DELETE /api/v1/architecture-models/{id}?revision=2.")
    public void delete(@PathVariable UUID id,@RequestParam @Min(0) long revision) { service.delete(id,revision); }
    @GetMapping("/{id}") @Operation(summary="Abrir estrutura pelo ID",description="Retorna a especificação (categoria, ambiente, descrição, provedor principal e regiões por cloud), componentes, posições, ligações e revisão. Quando informada, a especificação exige primaryProvider entre os provedores de locations. Tarifas são referências do catálogo local; não há consulta remota. Retorna 404 se a estrutura não existe. Exemplo: GET /api/v1/architecture-models/{id}.")
    public ArchitectureModel get(@PathVariable UUID id) { return service.get(id); }
    @PostMapping @Operation(summary="Salvar nova estrutura",description="Salva o documento visual, com até 100 componentes e ligações no total. Componentes podem começar sem tarifa (rateId null, com provider AWS, AZURE, GCP ou GENERIC). Tarifas vinculadas exigem USD e estado ativo. Para gerar estimativas, todos os componentes devem ter tarifa. Exemplo inicial: {\"name\":\"Plataforma\",\"hoursPerMonth\":720,\"graph\":{\"nodes\":[],\"edges\":[]},\"revision\":0}.")
    @ApiResponse(responseCode="200",description="Rascunho persistido.") @ApiResponse(responseCode="400",description="Documento inválido.") @ApiResponse(responseCode="422",description="Tarifa inativa ou moeda não suportada.")
    public ArchitectureModel create(@Valid @RequestBody Save request) { return service.create(request.name(),request.hoursPerMonth(),request.graph(),request.specification()); }
    @PutMapping("/{id}") @Operation(summary="Salvar alterações do Canvas",description="Exige a revisão lida ao abrir. Apenas rascunhos são editáveis. Uma região já especificada não pode ser trocada; duplique a estrutura para comparar cenários. Documentos históricos sem especificação podem defini-la, limpando tarifas e AZs incompatíveis. Exemplo: mesmo JSON da criação, com revision atual.")
    @ApiResponse(responseCode="409",description="Revisão desatualizada ou modelo publicado.")
    public ArchitectureModel update(@PathVariable UUID id,@Valid @RequestBody Save request) { return service.update(id,request.name(),request.hoursPerMonth(),request.graph(),request.revision(),request.specification()); }
    @PostMapping("/{id}/publish") @Operation(summary="Publicar modelo reutilizável",description="Consolida um rascunho não vazio no catálogo final. O modelo publicado fica imutável e pode gerar várias estimativas ou novas cópias. Exemplo: {\"revision\":1}.")
    @ApiResponse(responseCode="409",description="Revisão desatualizada ou já publicado.") @ApiResponse(responseCode="422",description="Canvas sem componentes.")
    public ArchitectureModel publish(@PathVariable UUID id,@Valid @RequestBody Revision request) { return service.publish(id,request.revision()); }
    @PostMapping("/{id}/duplicate") @Operation(summary="Duplicar estrutura com contexto regional",description="Sem corpo, preserva o contexto original. Com corpo, exige nome, horas mensais, revisão de origem e specification com categoria, ambiente, descrição e locations (provider e regionCode). Regiões alteradas desvinculam tarifas, AZs e cobranças de rede afetadas; o desenho e os consumos são preservados. Exemplo: consulte o JSON de request; use a revisão atual da origem.")
    public ArchitectureModel duplicate(@PathVariable UUID id,@Valid @RequestBody(required=false) Duplicate request) { return request==null?service.duplicate(id):service.duplicate(id,request.name(),request.hoursPerMonth(),request.specification(),request.revision()); }
    @PostMapping("/{id}/estimates") @Operation(summary="Gerar estimativa do modelo em USD e BRL",description="Usa a revisão informada, tarifas locais e uma PTAX já sincronizada. Componentes e fluxos são incluídos atomicamente em uma nova estimativa, com identificadores próprios. Ligações sem tarifas ou topologia suportada ficam UNPRICEABLE; o sistema nunca presume tráfego gratuito. Exemplo: {\"revision\":1,\"name\":\"Cenário produção\",\"quoteId\":\"11111111-1111-4111-8111-111111111111\"}.")
    @ApiResponse(responseCode="200",description="Estimativa e conversão preservadas, completas ou com pendências explícitas.") @ApiResponse(responseCode="409",description="O modelo mudou.") @ApiResponse(responseCode="422",description="Canvas vazio ou tarifa inativa.")
    public Valuation estimate(@PathVariable UUID id,@Valid @RequestBody Estimate request) { return service.estimate(id,request.revision(),request.name(),request.quoteId()); }
    public record Save(@NotBlank @Size(max=200) String name,@NotNull @DecimalMin(value="0",inclusive=false) @DecimalMax("744") @Digits(integer=3,fraction=6) BigDecimal hoursPerMonth,@NotNull ArchitectureGraph graph,@Min(0) long revision,StructureSpecification specification) {}
    public record Duplicate(@NotBlank @Size(max=200) String name,@NotNull @DecimalMin(value="0",inclusive=false) @DecimalMax("744") @Digits(integer=3,fraction=6) BigDecimal hoursPerMonth,@NotNull StructureSpecification specification,@Min(0) long revision) {}
    public record Revision(@Min(0) long revision) {}
    public record Estimate(@Min(0) long revision,@NotBlank @Size(max=200) String name,@NotNull UUID quoteId) {}
}
