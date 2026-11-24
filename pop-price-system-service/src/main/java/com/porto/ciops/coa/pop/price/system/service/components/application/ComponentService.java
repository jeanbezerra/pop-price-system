package com.porto.ciops.coa.pop.price.system.service.components.application;

import com.porto.ciops.coa.pop.price.system.service.catalog.application.CatalogService;
import com.porto.ciops.coa.pop.price.system.service.components.domain.ComponentCatalog.*;
import com.porto.ciops.coa.pop.price.system.service.components.persistence.ComponentRepository;
import com.porto.ciops.coa.pop.price.system.service.shared.ApiException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.UUID;
import java.util.List;
import java.util.HashSet;
import java.util.Locale;

/** Public visual component contract. Synchronization never writes these definitions. */
@Service
public class ComponentService {
    private final ComponentRepository repository;
    private final CatalogService catalog;
    public ComponentService(ComponentRepository repository, CatalogService catalog) {
        this.repository = repository;
        this.catalog = catalog;
    }

    public List<Provider> providers() { return repository.providers(); }

    public List<Category> categories(String provider) { return repository.categories(bounded(provider, 100)); }

    public Results<Icon> icons(String provider, String query, String after, int size, String category) {
        page(size, after);
        return Results.of(repository.icons(bounded(provider, 100), bounded(category,100), bounded(query, 200), text(after), size + 1), size,
                i -> i.provider() + "/" + i.key() + "/" + i.release());
    }

    public Results<Component> list(Filter filter, String after, int size) {
        page(size, after);
        if (!text(after).isEmpty()) UUID.fromString(after);
        var f = new Filter(bounded(filter.provider(), 100), bounded(filter.service(), 200), bounded(filter.category(), 100),
                bounded(filter.status(), 20), bounded(filter.query(), 200), filter.linked());
        if (!f.status().isEmpty()) Status.valueOf(f.status());
        return Results.of(repository.list(f, text(after), size + 1), size, c -> c.id().toString());
    }

    public Component get(UUID id) {
        return repository.get(id).orElseThrow(() -> ApiException.missing("Componente de arquitetura"));
    }

    @Transactional
    public Component create(Draft draft) {
        var d = validate(draft, null);
        var id = UUID.randomUUID();
        repository.create(id, d);
        return get(id);
    }

    @Transactional
    public Component update(UUID id, Draft draft) {
        var current = get(id);
        var d = validate(draft, current);
        if (!repository.update(id, d))
            throw new ApiException(409, "O componente foi alterado por outra sessão. Reabra o cadastro antes de salvar.");
        return get(id);
    }

    @Transactional
    public void delete(UUID id, long revision) {
        if (revision < 0) throw new ApiException(400, "Informe uma revisão válida.");
        get(id);
        if (!repository.softDelete(id, revision))
            throw new ApiException(409, "O componente foi alterado por outra sessão. Atualize a listagem antes de excluir.");
    }

    private Draft validate(Draft d, Component current) {
        if (d == null || d.status() == null || d.revision() < 0) throw new ApiException(400, "Informe situação e revisão válidas.");
        var normalized = new Draft(required(d.provider(), 100), nullable(d.serviceCode()), required(d.name(), 200),
                required(d.category(), 100), bounded(d.description(), 2000), d.status(), nullable(d.iconKey()), nullable(d.iconRelease()), d.revision(), characteristics(d.characteristics()));
        if (providers().stream().noneMatch(p -> p.code().equals(normalized.provider())))
            throw new ApiException(422, "Selecione um provedor de componentes cadastrado.");
        boolean generic = "GENERIC".equals(normalized.provider());
        if (generic && (normalized.serviceCode() != null || normalized.iconKey() != null || normalized.iconRelease() != null))
            throw new ApiException(422, "Componentes genéricos usam a representação padrão e não possuem vínculo cloud.");
        if (normalized.serviceCode() != null) catalog.requireService(normalized.provider(), normalized.serviceCode());
        if ((normalized.iconKey() == null) != (normalized.iconRelease() == null))
            throw new ApiException(422, "Informe o ícone e sua versão juntos.");
        if (!generic && normalized.status() == Status.ACTIVE && normalized.iconKey() == null)
            throw new ApiException(422, "Selecione um ícone antes de ativar o componente.");
        if (!generic && normalized.status() == Status.ACTIVE && normalized.serviceCode() == null)
            throw new ApiException(422, "Vincule um serviço cloud antes de ativar o componente.");
        if (normalized.iconKey() != null)
            repository.icon(normalized.provider(), normalized.iconKey(), normalized.iconRelease())
                    .orElseThrow(() -> new ApiException(422, "Selecione um ícone existente do mesmo provedor do serviço."));
        boolean unchangedLegacyCategory = current != null && current.provider().equals(normalized.provider()) && current.category().equals(normalized.category());
        if (!unchangedLegacyCategory && categories(normalized.provider()).stream().noneMatch(c -> c.code().equals(normalized.category())))
            throw new ApiException(422, "Selecione uma categoria da lista do provedor. Categorias existentes são preservadas até sua revisão.");
        return normalized;
    }

    private static List<Characteristic> characteristics(List<Characteristic> values) {
        if (values == null) return List.of();
        if (values.size() > 30) throw new ApiException(400, "Use até 30 características por componente.");
        var names = new HashSet<String>();
        return values.stream().map(value -> {
            if (value == null) throw new ApiException(400, "Característica inválida.");
            var name = required(value.name(), 100);
            if (!names.add(name.toLowerCase(Locale.ROOT))) throw new ApiException(422, "Use nomes diferentes para as características.");
            return new Characteristic(name, required(value.value(), 1000));
        }).toList();
    }

    private static void page(int size, String after) {
        if (size < 1 || size > 100 || text(after).length() > 500) throw new ApiException(400, "Paginação inválida.");
    }
    private static String text(String value) { return value == null ? "" : value.trim(); }
    private static String nullable(String value) { return text(value).isEmpty() ? null : bounded(value, 200); }
    private static String bounded(String value, int max) {
        var result = text(value);
        if (result.length() > max) throw new ApiException(400, "Campo excede o tamanho permitido.");
        return result;
    }
    private static String required(String value, int max) {
        var result = bounded(value, max);
        if (result.isEmpty()) throw new ApiException(400, "Preencha os campos obrigatórios do componente.");
        return result;
    }
}
