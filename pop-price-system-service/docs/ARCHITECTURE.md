# Decisões de arquitetura

## Fronteiras

O pacote raiz existente foi mantido. Features: `provider`, `catalog`, `synchronization`, `pricing`, `estimation`, `integrations.aws` e `shared`. Controllers validam HTTP e chamam application services; SQL está nos adapters de persistência. O motor financeiro é Java puro. `ProviderCatalog` é a porta de descoberta, consulta e streaming sem classes do AWS SDK no domínio de catálogo/sincronização/estimativas.

`CatalogService` é o contrato de consulta usado pelas estimativas. `ProviderService` coordena os metadados; `SynchronizationService` coordena uma importação manual. Não há service interfaces sem outra implementação, ORM, Lombok ou MapStruct.

## Banco e consistência

O script `../pop-price-system-database/deploy.sql` consolida a definição final das 27 tabelas, constraints e índices, os parâmetros iniciais e os três seeds por provedor numa única transação. As antigas migrations foram incorporadas ao script; não há runner de migrations nem atualização de uma instalação prévia. Uma falha desfaz toda a implantação, inclusive seeds. Não cria triggers, funções armazenadas ou jobs. O processo Java é responsável por estado, timestamps e regras de negócio. `python ../pop-price-system-database/validation/portal_local.py verify-deploy` valida a estrutura com dados e falhas deliberadas em bancos isolados.

Provedores, regiões, serviços, produtos, termos, dimensões e versões têm identidades relacionais. SKUs são únicos por provedor/serviço/região, termos por produto/código/modalidade e dimensões por termo/rate code/moeda. JSONB guarda atributos variáveis do provedor e snapshots imutáveis. Itens de arquitetura, topologia, cobranças e hops são normalizados em tabelas próprias.

Uma requisição cria uma auditoria `RUNNING`. Um índice parcial único impede duas execuções simultâneas do mesmo escopo, inclusive em réplicas diferentes. O identificador da requisição também delimita o staging. Heartbeats avançam durante o processamento; uma nova solicitação pode marcar como `FAILED` uma execução abandonada e limpar seu staging. Não há fila, polling, worker, lease renovado por agendador ou execução diferida.

Chamadas AWS e download não ocorrem dentro da transação de publicação. Produtos e dimensões são normalizados em lotes de 250. A conclusão do parser confirma presença de metadados/produtos/termos e EOF válido. A publicação bloqueia a auditoria e exige `RUNNING`; assim, uma execução marcada como abandonada não consegue publicar depois. Staging órfão é limpo na próxima execução do mesmo escopo.

A publicação usa `INSERT ... ON CONFLICT`, altera apenas conteúdo efetivamente distinto, registra alterações, encerra versões anteriores, abre novas versões e atualiza o checkpoint na mesma transação. Produtos/dimensões ausentes são desativados apenas depois de a fonte inteira ser validada. Erros fazem rollback da publicação e mantêm catálogo/checkpoint anteriores.

O hash SHA-256 normaliza ordem de atributos e representação decimal. Um fingerprint determinístico combina hashes de produto e tarifa para versionar também mudanças técnicas. `price_version.valid_from/valid_to` são instantes de observação no catálogo; a vigência comercial do provedor é preservada em `snapshot.effectiveAt`. Uma mudança na versão da fonte sem mudança no conteúdo não cria histórico artificial.

Consultas extensas usam keyset e índices sobre os filtros principais. Listas operacionais menores usam OFFSET limitado. Os índices iniciais correspondem às consultas implementadas; seu dimensionamento final requer volume e planos de execução do ambiente real. A publicação de fontes grandes é uma transação atômica potencialmente longa; não foi feito benchmark de produção.

Alterações da composição bloqueiam a arquitetura. O cálculo usa uma transação `REPEATABLE_READ` e captura preços de uma visão consistente do banco. Snapshots de cálculos são append-only pela aplicação. Contenção temporária é reportada como conflito recuperável.

## Integração e limites deliberados

A API AWS não fornece um diff incremental. A versão oficial é comparada com o checkpoint; versões iguais dispensam download. Versões diferentes são processadas integralmente por streaming e comparadas no banco. Falhas parciais não são consideradas evidência de remoção. SDK e download têm timeouts e retries limitados com backoff/jitter.

O fluxo inicial atende catálogos genéricos On-Demand/USD, incluindo preços computacionais, armazenamento, operações e conectividade disponíveis na fonte. Não existem SKUs/tarifas de produção embutidos. Fixtures sintéticas ficam apenas em testes. EKS foi usado na conferência manual com arquivo oficial público, sem credenciais.

A execução assíncrona com `202`, a fila persistente e o agendamento do escopo original foram substituídos por importação síncrona por orientação posterior. Autenticação, autorização, Flyway e Testcontainers também foram removidos por essa orientação. SNS e sincronização periódica não foram adicionados. Testes complexos, benchmark e validação operacional no cluster ficam para a próxima etapa.

## Referências oficiais

- [AWS Pricing SDK v2](https://docs.aws.amazon.com/java/api/latest/software/amazon/awssdk/services/pricing/PricingClient.html)
- [Formato de arquivos de preços](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/reading-service-price-list-file-for-services.html)
- [Índices e arquivos públicos oficiais](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/using-the-aws-price-list-bulk-api-fetching-price-list-files-manually.html)
- [EKS Pod Identity](https://docs.aws.amazon.com/eks/latest/userguide/pod-identities.html)
- [PostgreSQL: SELECT e locks](https://www.postgresql.org/docs/18/sql-select.html)
- [Spring Boot 4.0](https://docs.spring.io/spring-boot/4.0/reference/using/build-systems.html)
