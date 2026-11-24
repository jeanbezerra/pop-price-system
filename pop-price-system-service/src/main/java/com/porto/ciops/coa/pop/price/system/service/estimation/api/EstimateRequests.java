package com.porto.ciops.coa.pop.price.system.service.estimation.api;

import com.porto.ciops.coa.pop.price.system.service.pricing.domain.PricingInput;
import com.porto.ciops.coa.pop.price.system.service.pricing.domain.PricingInput.*;

import io.swagger.v3.oas.annotations.media.Schema;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** HTTP input contracts, separate from persistence and calculation objects. */
public final class EstimateRequests {
    private EstimateRequests() {}

    @Schema(description = "Premissas iniciais da composição. A moeda é USD e não é recebida no corpo.")
    public record Create(
            @Schema(description = "Nome da arquitetura que será estimada.", example = "Plataforma de observabilidade")
            @NotBlank @Size(max = 200) String name,
            @Schema(description = "Horas do mês modelado: maior que zero e no máximo 744, com até seis casas decimais. Não há valor padrão implícito.", example = "720")
            @NotNull
                    @DecimalMin(value = "0", inclusive = false)
                    @DecimalMax("744")
                    @Digits(integer = 3, fraction = 6)
                    BigDecimal hoursPerMonth) {}

    @Schema(description = "Consumo de recurso, armazenamento com retenção ou fluxo de rede. As combinações condicionais são descritas no endpoint de inclusão.")
    public record AddItem(
            @Schema(description = "Nome legível do componente.", example = "Cluster de observabilidade")
            @NotBlank @Size(max = 200) String name,
            @Schema(description = "Categoria livre usada para agrupar custos; não é a família do catálogo.", example = "compute")
            @NotBlank @Size(max = 100) String category,
            @Schema(description = "Identificador da conta para agrupamento. Em fluxos, deve ser igual a flow.sourceAccount.", example = "plataforma")
            @NotBlank @Size(max = 100) String accountCode,
            @Schema(description = "Id real de uma tarifa consultada em /catalog/rates. Ausente: componente sem preço. Não use junto de flow.", example = "123")
            @Positive Long rateId,
            @Schema(description = "Multiplicador positivo do consumo, com até 12 casas decimais.", example = "2")
            @NotNull
                    @DecimalMin(value = "0", inclusive = false)
                    @Digits(integer = 12, fraction = 12)
                    BigDecimal quantity,
            @Schema(description = "Consumo por unidade e por período. Zero é permitido. Para uso contínuo de uma tarifa Hrs, informe 1 com period=HOUR.", example = "1")
            @NotNull @DecimalMin("0") @Digits(integer = 18, fraction = 12) BigDecimal consumption,
            @Schema(description = "Unidade do consumo, compatível com a tarifa: por exemplo Hrs, GB ou GiB. GB e GiB usam convenções distintas.", example = "Hrs")
            @NotBlank @Size(max = 40) String consumptionUnit,
            @Schema(description = "Período do consumo: HOUR multiplica pelas horas mensais; DAY por horas/24; MONTH mantém; YEAR divide por 12.", example = "HOUR")
            @NotNull Period period,
            @Schema(description = "Dias de retenção de ingestão diária em estado estacionário. Requer period=DAY e tarifa de armazenamento; não pode acompanhar flow.", example = "30")
            @Min(1) @Max(36500) Integer retentionDays,
            @Schema(description = "Fluxo unidirecional de rede. Quando presente, não informe rateId de recurso nem retentionDays.")
            @Valid DataFlow flow) {
        Item command() {
            return new Item(
                    UUID.randomUUID(),
                    name,
                    category,
                    accountCode,
                    rateId,
                    quantity,
                    consumption,
                    consumptionUnit,
                    period,
                    retentionDays,
                    flow == null ? null : flow.command());
        }
    }

    @Schema(description = "Topologia e cobranças explícitas de um fluxo. Um fluxo de retorno é outro componente, com outra trafficKey.")
    public record DataFlow(
            @Schema(description = "Chave única de tráfego dentro da estimativa. Repetir a chave causa 409.", example = "telemetria-a-b")
            @NotBlank @Size(max = 100) String trafficKey,
            @Schema(description = "Service Code da origem.", example = "AmazonEC2")
            @NotBlank @Size(max = 150) String sourceService,
            @Schema(description = "Service Code do destino.", example = "AmazonEC2")
            @NotBlank @Size(max = 150) String destinationService,
            @Schema(description = "Conta de origem, igual ao accountCode do componente.", example = "conta-a")
            @NotBlank @Size(max = 100) String sourceAccount,
            @Schema(description = "Conta de destino, usada na atribuição de cobranças de entrada.", example = "conta-b")
            @NotBlank @Size(max = 100) String destinationAccount,
            @Schema(description = "Região comercial da origem.", example = "us-east-1")
            @NotBlank @Size(max = 80) String sourceRegion,
            @Schema(description = "Região comercial do destino.", example = "us-east-1")
            @NotBlank @Size(max = 80) String destinationRegion,
            @Schema(description = "AZ física da origem. Use o id físico para comparar contas distintas.", example = "use1-az1")
            @Size(max = 100) String sourceAz,
            @Schema(description = "AZ física do destino, quando conhecida.", example = "use1-az1")
            @Size(max = 100) String destinationAz,
            @Schema(description = "Direção do tráfego: entrada da internet, saída para internet ou fluxo interno.", example = "INTERNAL")
            @NotNull Direction direction,
            @Schema(description = "Tipo de conectividade. Cada caminho exige suas chaves de cobrança e tarifas compatíveis.", example = "DIRECT")
            @NotNull Connectivity connectivity,
            @Schema(description = "De zero a oito cobranças, sem chave repetida. Mesma AZ física entre EC2 privados via DIRECT aceita lista vazia; demais topologias podem exigir tarifas explícitas.")
            @NotNull @Size(max = 8) List<@NotNull @Valid FlowCharge> charges,
            @Schema(description = "Serviços intermediários em ordem, até oito. Caminhos encadeados são preservados, mas ficam UNPRICEABLE até existir regra específica. Ausente equivale a lista vazia.")
            @Size(max = 8) List<@NotNull @Valid IntermediateService> intermediaries) {
        Flow command() {
            return new Flow(
                    trafficKey,
                    sourceService,
                    destinationService,
                    sourceAccount,
                    destinationAccount,
                    sourceRegion,
                    destinationRegion,
                    sourceAz,
                    destinationAz,
                    direction,
                    connectivity,
                    charges.stream()
                            .map(c -> new PricingInput.Charge(c.key(), c.rateId()))
                            .toList(),
                    intermediaries == null
                            ? List.of()
                            : intermediaries.stream()
                                    .map(
                                            h ->
                                                    new Hop(
                                                            h.serviceCode(),
                                                            h.accountCode(),
                                                            h.regionCode()))
                                    .toList());
        }
    }

    @Schema(description = "Serviço intermediário de um caminho de rede.")
    public record IntermediateService(
            @Schema(description = "Service Code do intermediário.", example = "AmazonVPC")
            @NotBlank @Size(max = 150) String serviceCode,
            @Schema(description = "Conta à qual o intermediário pertence.", example = "rede-compartilhada")
            @NotBlank @Size(max = 100) String accountCode,
            @Schema(description = "Região do intermediário.", example = "us-east-1")
            @NotBlank @Size(max = 80) String regionCode) {}

    @Schema(description = "Tarifa escolhida para uma cobrança do fluxo; chaves não podem se repetir.")
    public record FlowCharge(
            @Schema(description = "Papel da cobrança. Tráfego inter-regional exige INTER_REGION_OUT e INTER_REGION_IN, com tarifas explícitas para as duas pontas.", example = "INTER_REGION_OUT")
            @NotNull ChargeKey key,
            @Schema(description = "Id positivo de tarifa real do catálogo, compatível com a unidade, a região e o tipo de transferência.", example = "789")
            @Positive long rateId) {}
}
