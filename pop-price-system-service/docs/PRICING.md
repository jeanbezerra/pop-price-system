# Regras de precificação

Preço público do provedor, consumo informado e custo calculado são conceitos separados. O resultado é uma estimativa em USD; não representa a cobrança efetiva, impostos ou descontos negociados.

## Consumo e períodos

`quantity` multiplica o consumo. `period` define o período da taxa de consumo: `HOUR` multiplica por `hoursPerMonth`, `DAY` multiplica por horas/24, `MONTH` mantém o valor, e `YEAR` divide por 12. Horas mensais são obrigatórias e limitadas a 744; não existe premissa universal de 730 horas. O anual representa 12 meses modelados, não um calendário específico.

Para uma instância ligada todo o mês, informe `consumption=1`, `consumptionUnit=Hrs`, `period=HOUR`. Para um volume mensal de requisições, informe o total com `period=MONTH`. O consumidor deve escolher as dimensões de preço correspondentes à arquitetura real: a API não supõe número de nós EKS, instâncias, IOPS ou amplificação de telemetria.

Unidades idênticas podem ser cobradas diretamente. Conversões conhecidas incluem GB/TB decimais, GiB/TiB binários, Bytes, horas/segundos, requisições individuais/milhões e GB-mês/GB-hora. `GB=10^9 bytes` e `GiB=2^30 bytes` são premissas explícitas no snapshot. Quando o serviço AWS atribuir outra convenção ao rótulo da unidade, informe o consumo já na unidade nativa da tarifa; a API não identifica automaticamente convenções particulares de cada produto. Unidades incompatíveis tornam o componente não precificável.

Para retenção em estado estacionário, informe ingestão diária em uma unidade de volume, `period=DAY`, `retentionDays` e uma tarifa de armazenamento mensal ou horário. O volume médio é ingestão diária × dias de retenção. Para GB-hora, esse volume também multiplica as horas mensais. Compressão, crescimento inicial da retenção, replicação, classes e operações devem ser modelados como premissas/itens separados.

## Faixas e arredondamento

As faixas são progressivas: `[rangeBegin, rangeEnd)`, com `null` como limite infinito. O motor rejeita lacunas, sobreposição, consumo além da última faixa finita e dimensões condicionais (`appliesTo` não vazio). Não presume que benefícios condicionais ou free tiers da conta se aplicam à arquitetura.

O consumo de itens na mesma conta e conjunto de tarifas é agregado dentro da estimativa antes de aplicar as faixas. O custo é alocado proporcionalmente aos componentes, com o resíduo decimal atribuído ao último componente. Não se agregam estimativas distintas, contas de uma organização ou consumo real externo ao modelo.

Todos os valores monetários usam `BigDecimal`. Divisões usam `DECIMAL128`; custos são somados antes do arredondamento. Valores apresentados usam duas casas e `HALF_EVEN`. O anual é calculado a partir do custo mensal sem arredondar. Valores de linhas e agrupamentos arredondados independentemente podem diferir do total em centavos; o snapshot mantém as alocações e custos de faixa sem arredondamento intermediário.

## Rede e conectividade

Um item de rede usa `flow`, não `rateId` de recurso. O consumo é um volume unidirecional. `trafficKey` identifica unicamente esse tráfego na estimativa; repeti-lo gera `409`. Uma chave de cobrança não pode aparecer duas vezes no fluxo. A mesma tarifa pode ser usada para pontas distintas quando sua regra permitir (por exemplo, uma tarifa regional aplicável a ambas as AZs). Um fluxo de retorno deve representar outro volume/direção e ter sua própria chave.

Tarifas são selecionadas explicitamente do catálogo por `flow.charges`. Não há um resolvedor automático universal de tarifas. O motor verifica unidade, região comercial, família/Usage Type e os atributos `fromRegionCode`/`toRegionCode` quando presentes. O usuário deve conferir as condições e isenções do SKU, especialmente quando a origem só publicar nomes de localidades. Uma tarifa de tráfego não cobre automaticamente o custo fixo horário de NAT, endpoints ou demais componentes; inclua esses recursos como itens separados.

| Topologia | Chaves necessárias |
| --- | --- |
| Internet entrada | `DATA_IN` |
| Internet saída | `DATA_OUT` |
| Regiões distintas | `INTER_REGION_OUT`, `INTER_REGION_IN` |
| Mesma região, AZs distintas | `INTER_AZ_OUT`, `INTER_AZ_IN` |
| EC2 privado, conexão direta na mesma AZ física | Sem cobrança de transferência nessa regra |
| NAT Gateway | Acrescenta `NAT_PROCESSING` |
| Transit Gateway | Acrescenta `TRANSIT_PROCESSING` |
| VPC Endpoint | Acrescenta `ENDPOINT_PROCESSING` |
| PrivateLink | Acrescenta `PRIVATELINK_PROCESSING` |
| Direct Connect | Acrescenta `DIRECT_CONNECT_OUT`, sujeito à existência de tarifa adequada |

Transferência entre contas não acrescenta uma chave de cobrança. Para comparar AZs entre contas, informe **IDs físicos**, como `use1-az1`; nomes como `us-east-1a` não garantem a mesma localização. O custo de cada lado é atribuído à conta correspondente.

As duas pontas de uma transferência inter-regional/inter-AZ exigem evidência explícita de tarifa, inclusive para uma ponta gratuita. Sem essa evidência a estimativa permanece incompleta; nenhuma tarifa zero é criada. O motor é conservador: uma isenção específica ainda não implementada pode resultar em componente não precificável. O conjunto de chaves deve corresponder exatamente à regra do caminho selecionado.

`flow.intermediaries` registra, em ordem, serviços intermediários com conta/região. Caminhos encadeados são preservados, mas retornam não precificáveis até que suas regras específicas sejam implementadas. Regras de tráfego na mesma AZ entre serviços diferentes de EC2 também não são inferidas. As regras iniciais não representam todas as combinações AWS, cobranças transfronteiriças, peering, tráfego público entre serviços, tiers de organização ou isenções comerciais.

## Resultados incompletos e histórico

Preço ausente/desativado, modalidade não suportada, tarifa futura sem versão efetiva disponível, unidade incompatível, faixas inválidas ou regra de rede não implementada produzem `UNPRICEABLE` com justificativa. Os custos consolidados ficam nulos, e `knownMonthlySubtotal` identifica apenas os componentes precificados. Preços oficiais realmente iguais a zero podem produzir custo zero.

Cada cálculo recebe `calculationId` e registra a revisão da composição, consumo, premissas e `versionId` de todas as faixas. Snapshots persistidos não são recalculados por consultas GET e não são sobrescritos. Uma nova chamada a `/calculate` usa o catálogo vigente e cria outro snapshot.

## Limites atuais

Inicialmente só são calculados On-Demand em USD. Reserved Instances, Savings Plans, contratos privados, créditos, impostos e descontos não são inferidos. A integração é extensível a outros provedores, mas somente AWS está implementada. Cada composição admite até 100 componentes e cada fluxo até 8 tarifas/intermediários.
