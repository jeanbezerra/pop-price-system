package com.porto.ciops.coa.pop.price.system.service.documentation;

import com.porto.ciops.coa.pop.price.system.service.shared.Json;
import io.swagger.v3.oas.models.examples.Example;
import io.swagger.v3.oas.models.media.*;
import io.swagger.v3.oas.models.responses.ApiResponse;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.*;
import org.springframework.core.io.ClassPathResource;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Extends the existing documentation contract to every portal operation. */
@Configuration @Profile("!prd & (dev | hml)")
public class PortalOpenApiConfiguration {
    @Bean OpenApiCustomizer portalExamples() throws IOException {
        var json=new Json();
        var examples=json.tree(new ClassPathResource("openapi/portal-examples.json").getContentAsString(StandardCharsets.UTF_8));
        return api->api.getPaths().forEach((path,item)->item.readOperationsMap().forEach((method,operation)->{
            String key=method.name()+" "+path; var example=examples.path(key);
            if(example.isMissingNode()) return;
            if(operation.getDescription()==null||!operation.getDescription().contains("Exemplo"))
                operation.setDescription(Objects.toString(operation.getDescription(),"")+"\n\nExemplo: `"+key+"`. Os identificadores e valores do exemplo JSON são ilustrativos; use os retornados pela API.");
            var response=operation.getResponses().computeIfAbsent("200",ignored->new ApiResponse().description("Operação concluída."));
            var content=response.getContent()==null?new Content():response.getContent();
            var media=content.get("application/json");
            if(media==null) {
                media=new MediaType();
                if(content.containsKey("*/*")) media.setSchema(content.remove("*/*").getSchema());
                content.addMediaType("application/json",media);
            }
            if(media.getSchema()==null) {
                String schema=path.startsWith("/api/v1/architecture-models")
                        ? (path.endsWith("/estimates")?"Valuation":"ArchitectureModel")
                        : path.startsWith("/api/v1/exchange-rates")?"ExchangeQuote"
                        : path.startsWith("/api/v1/contracts")?"CustomerContract"
                        : path.equals("/api/v1/parameters")?"Parameters":"Valuation";
                String resolved=api.getComponents().getSchemas().keySet().stream()
                        .filter(name->name.equals(schema)||name.endsWith("."+schema)).findFirst()
                        .orElseThrow(()->new IllegalStateException("Missing response schema: "+schema));
                media.setSchema(new Schema<>().$ref("#/components/schemas/"+resolved));
            }
            media.addExamples("Exemplo ilustrativo",new Example().value(json.read(example.path("response").toString(),Object.class)));
            response.setContent(content);
            if(example.has("request")&&operation.getRequestBody()!=null) {
                var body=operation.getRequestBody().getContent();
                var request=body.get("application/json");
                if(request==null) { request=new MediaType();if(body.containsKey("*/*")) request.setSchema(body.remove("*/*").getSchema());body.addMediaType("application/json",request); }
                request.addExamples("Exemplo ilustrativo",new Example().value(json.read(example.path("request").toString(),Object.class)));
            }
            operation.getResponses().forEach((status,error)->{
                if(!status.matches("[45]\\d\\d")||error.get$ref()!=null) return;
                var problem=new MediaType().schema(new Schema<>().$ref("#/components/schemas/ApiProblem"))
                        .addExamples("Falha ilustrativa",new Example().value(Map.of("status",Integer.parseInt(status),"title","Falha na operação",
                                "detail",Objects.toString(error.getDescription(),"Confira os dados e tente novamente."),"instance",path,"correlationId","exemplo-portal-001")));
                error.setContent(new Content().addMediaType("application/problem+json",problem));
            });
        }));
    }
}
