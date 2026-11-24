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
    @GetMapping @Operation(summary="Listar modelos de arquitetura",description="Filtra DRAFT ou PUBLISHED. A persona é apenas organização de trabalho, sem restrição de acesso. Exemplo: GET /api/v1/architecture-models?status=PUBLISHED.")
    public ArchitectureService.ModelPage list(@RequestParam(required=false) String status,@RequestParam(defaultValue="20") int size,@RequestParam(defaultValue="0") int offset) { return service.list(status,size,offset); }
    @GetMapping("/{id}") @Operation(summary="Abrir modelo no Canvas",description="Retorna componentes, posições, ligações e revisão. Tarifas são referências do catálogo local; não há consulta remota. Retorna 404 se o modelo não existe.")
    public ArchitectureModel get(@PathVariable UUID id) { return service.get(id); }
    @PostMapping @Operation(summary="Salvar novo rascunho",description="Salva o documento visual, com até 100 componentes e ligações no total. Componentes exigem tarifas USD ativas já sincronizadas. Exemplo inicial: {\"name\":\"Plataforma\",\"hoursPerMonth\":720,\"graph\":{\"nodes\":[],\"edges\":[]},\"revision\":0}.")
    @ApiResponse(responseCode="200",description="Rascunho persistido.") @ApiResponse(responseCode="400",description="Documento inválido.") @ApiResponse(responseCode="422",description="Tarifa inativa ou moeda não suportada.")
    public ArchitectureModel create(@Valid @RequestBody Save request) { return service.create(request.name(),request.hoursPerMonth(),request.graph()); }
    @PutMapping("/{id}") @Operation(summary="Salvar alterações do Canvas",description="Exige a revisão lida ao abrir. Apenas rascunhos são editáveis. Publicados devem ser copiados, preservando o catálogo final. Mesmo corpo da criação; informe revision atual.")
    @ApiResponse(responseCode="409",description="Revisão desatualizada ou modelo publicado.")
    public ArchitectureModel update(@PathVariable UUID id,@Valid @RequestBody Save request) { return service.update(id,request.name(),request.hoursPerMonth(),request.graph(),request.revision()); }
    @PostMapping("/{id}/publish") @Operation(summary="Publicar modelo reutilizável",description="Consolida um rascunho não vazio no catálogo final. O modelo publicado fica imutável e pode gerar várias estimativas ou novas cópias. Exemplo: {\"revision\":1}.")
    @ApiResponse(responseCode="409",description="Revisão desatualizada ou já publicado.") @ApiResponse(responseCode="422",description="Canvas sem componentes.")
    public ArchitectureModel publish(@PathVariable UUID id,@Valid @RequestBody Revision request) { return service.publish(id,request.revision()); }
    @PostMapping("/{id}/duplicate") @Operation(summary="Criar rascunho a partir de modelo",description="Sem corpo. Copia componentes, ligações e premissas para um novo rascunho editável, mantendo o modelo original.")
    public ArchitectureModel duplicate(@PathVariable UUID id) { return service.duplicate(id); }
    @PostMapping("/{id}/estimates") @Operation(summary="Gerar estimativa do modelo em USD e BRL",description="Usa a revisão informada, tarifas locais e uma PTAX já sincronizada. Componentes e fluxos são incluídos atomicamente em uma nova estimativa, com identificadores próprios. Ligações sem tarifas ou topologia suportada ficam UNPRICEABLE; o sistema nunca presume tráfego gratuito. Exemplo: {\"revision\":1,\"name\":\"Cenário produção\",\"quoteId\":\"11111111-1111-4111-8111-111111111111\"}.")
    @ApiResponse(responseCode="200",description="Estimativa e conversão preservadas, completas ou com pendências explícitas.") @ApiResponse(responseCode="409",description="O modelo mudou.") @ApiResponse(responseCode="422",description="Canvas vazio ou tarifa inativa.")
    public Valuation estimate(@PathVariable UUID id,@Valid @RequestBody Estimate request) { return service.estimate(id,request.revision(),request.name(),request.quoteId()); }
    public record Save(@NotBlank @Size(max=200) String name,@NotNull @DecimalMin(value="0",inclusive=false) @DecimalMax("744") @Digits(integer=3,fraction=6) BigDecimal hoursPerMonth,@NotNull ArchitectureGraph graph,@Min(0) long revision) {}
    public record Revision(@Min(0) long revision) {}
    public record Estimate(@Min(0) long revision,@NotBlank @Size(max=200) String name,@NotNull UUID quoteId) {}
}
