package com.porto.ciops.coa.pop.price.system.service.components;

import com.porto.ciops.coa.pop.price.system.service.catalog.application.CatalogService;
import com.porto.ciops.coa.pop.price.system.service.components.application.ComponentService;
import com.porto.ciops.coa.pop.price.system.service.components.domain.ComponentCatalog.*;
import com.porto.ciops.coa.pop.price.system.service.components.persistence.ComponentRepository;
import com.porto.ciops.coa.pop.price.system.service.shared.ApiException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.mockito.ArgumentCaptor;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class ComponentServiceTest {
    private final ComponentRepository repository = mock(ComponentRepository.class);
    private final CatalogService catalog = mock(CatalogService.class);
    private final ComponentService service = new ComponentService(repository, catalog);

    @BeforeEach void providers() {
        when(repository.providers()).thenReturn(List.of(new Provider("GENERIC","Genérico"),new Provider("AWS","Amazon Web Services"),new Provider("AZURE","Microsoft Azure")));
        when(repository.categories("AWS")).thenReturn(List.of(new Category("AWS","Compute","Computação","Compute",null,"PROVIDER")));
    }

    private Draft draft(Status status, String key, String release) {
        return new Draft("AWS", "AmazonEC2", " Servidor ", " Compute ", " Exemplo ", status, key, release, 0, List.of());
    }

    @Test void activationRequiresAnIcon() {
        assertThatThrownBy(() -> service.create(draft(Status.ACTIVE, null, null)))
                .isInstanceOf(ApiException.class).hasMessageContaining("antes de ativar");
        verify(repository, never()).create(any(), any());
    }

    @Test void rejectsUnknownOrDifferentProviderIcon() {
        when(repository.icon("AWS", "azure.compute", "2026-07-31")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.create(draft(Status.ACTIVE, "azure.compute", "2026-07-31")))
                .isInstanceOf(ApiException.class).hasMessageContaining("mesmo provedor");
        verify(repository, never()).create(any(), any());
    }

    @Test void iconKeyAndReleaseAreAtomic() {
        assertThatThrownBy(() -> service.create(draft(Status.PENDING, "aws.ec2", null)))
                .isInstanceOf(ApiException.class).hasMessageContaining("juntos");
        assertThatThrownBy(() -> service.create(draft(Status.PENDING, null, "2026-07-31")))
                .isInstanceOf(ApiException.class).hasMessageContaining("juntos");
    }

    @Test void pendingDraftWithoutIconIsNormalizedAndPersisted() {
        var saved = new Component(UUID.randomUUID(), "AWS", "AmazonEC2", "EC2", "Servidor", "Computação", "Exemplo", Status.PENDING, null, 0, null, null, List.of(), "Computação");
        when(repository.get(any())).thenReturn(Optional.of(saved));
        assertThat(service.create(draft(Status.PENDING, " ", ""))).isEqualTo(saved);
        var input = ArgumentCaptor.forClass(Draft.class);
        verify(repository).create(any(), input.capture());
        assertThat(input.getValue().name()).isEqualTo("Servidor");
        assertThat(input.getValue().iconKey()).isNull();
        verify(catalog).requireService("AWS", "AmazonEC2");
    }

    @Test void rejectsBlankRequiredFieldsAndInvalidPagination() {
        assertThatThrownBy(() -> service.create(new Draft("AWS", "AmazonEC2", "  ", "Compute", "", Status.PENDING, null, null, 0, List.of())))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.icons("AWS", "", "", 101, "")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.list(new Filter("", "", "", "UNKNOWN", "", null), "", 20)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.list(new Filter("", "", "", "", "", null), "invalid", 20)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test void staleRevisionCannotOverwriteAnotherSession() {
        var id = UUID.randomUUID();
        when(repository.get(id)).thenReturn(Optional.of(new Component(id,"AWS","AmazonEC2","EC2","Servidor","Compute","",Status.PENDING,null,1,null,null,List.of(),"Computação")));
        when(repository.update(eq(id), any())).thenReturn(false);
        assertThatThrownBy(() -> service.update(id, draft(Status.INACTIVE, null, null)))
                .isInstanceOf(ApiException.class).hasMessageContaining("outra sessão");
    }

    @Test void genericComponentsCannotHaveCloudLinks() {
        assertThatThrownBy(() -> service.create(new Draft("GENERIC","AmazonEC2","Servidor","Compute","",Status.ACTIVE,null,null,0,List.of())))
                .isInstanceOf(ApiException.class).hasMessageContaining("não possuem vínculo");
        verifyNoInteractions(catalog);
    }

    @Test void cloudActivationRequiresAServiceAndDistinctCharacteristics() {
        when(repository.icon("AWS","aws.ec2","2026-07-31")).thenReturn(Optional.of(new Icon("AWS","aws.ec2","2026-07-31","EC2","SERVICE","Compute","","", "", "")));
        assertThatThrownBy(() -> service.create(new Draft("AWS",null,"Servidor","Compute","",Status.ACTIVE,"aws.ec2","2026-07-31",0,List.of())))
                .isInstanceOf(ApiException.class).hasMessageContaining("Vincule um serviço");
        assertThatThrownBy(() -> service.create(new Draft("GENERIC",null,"Servidor","Compute","",Status.PENDING,null,null,0,List.of(new Characteristic("CPU","2"),new Characteristic(" cpu ","4")))))
                .isInstanceOf(ApiException.class).hasMessageContaining("nomes diferentes");
    }

    @Test void newCategoriesMustBelongToTheProvider() {
        assertThatThrownBy(() -> service.create(new Draft("AWS",null,"Servidor","Categoria livre","",Status.PENDING,null,null,0,List.of())))
                .isInstanceOf(ApiException.class).hasMessageContaining("categoria da lista");
        assertThatThrownBy(() -> service.create(new Draft("AZURE",null,"Servidor","Compute","",Status.PENDING,null,null,0,List.of())))
                .isInstanceOf(ApiException.class).hasMessageContaining("categoria da lista");
    }

    @Test void existingFreeTextCategoryCanBeKeptUntilReviewed() {
        var id = UUID.randomUUID();
        var current = new Component(id,"AWS",null,null,"Servidor","Categoria anterior","",Status.PENDING,null,0,null,null,List.of(),"Categoria anterior");
        when(repository.get(id)).thenReturn(Optional.of(current));
        when(repository.update(eq(id),any())).thenReturn(true);
        service.update(id, new Draft("AWS",null,"Servidor editado","Categoria anterior","",Status.PENDING,null,null,0,List.of()));
        verify(repository).update(eq(id),any());
    }

    @Test void deletionChecksRevisionAndRetainsTheDefinition() {
        var id = UUID.randomUUID();
        when(repository.get(id)).thenReturn(Optional.of(new Component(id,"AWS","AmazonEC2","EC2","Servidor","Compute","",Status.INACTIVE,null,2,null,null,List.of(),"Computação")));
        assertThatThrownBy(() -> service.delete(id, 1)).isInstanceOf(ApiException.class).hasMessageContaining("antes de excluir");
        when(repository.softDelete(id, 2)).thenReturn(true);
        service.delete(id, 2);
        verify(repository).softDelete(id, 2);
        verifyNoInteractions(catalog);
    }

    @Test void absentOrDeletedComponentsCannotBeDeletedAgain() {
        var id = UUID.randomUUID();
        assertThatThrownBy(() -> service.delete(id, -1)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.delete(id, 0)).isInstanceOf(ApiException.class).hasMessageContaining("not found");
        verify(repository, never()).softDelete(any(), anyLong());
    }
}
