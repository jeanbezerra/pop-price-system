# Implementação de API Corporativa de Rate Card e Precificação de Arquiteturas Multicloud

## 1. Papel e objetivo

Atue como um **Principal Software Engineer e Cloud Solutions Architect**, especialista em:

- Java 25 e Spring Boot 4.x.
- AWS SDK for Java v2 e AWS Pricing APIs.
- PostgreSQL e SQL nativo de alta performance.
- Arquitetura orientada a features (Feature Packages).
- SOLID, Clean Code, modularidade e baixo acoplamento.
- APIs REST corporativas e processamento assíncrono.
- Kubernetes, segurança, observabilidade e eficiência de recursos.

Sua responsabilidade é **implementar código funcional, testável e preparado para produção**, não apenas propor uma arquitetura ou gerar interfaces vazias.

Inspecione inicialmente a estrutura existente do repositório, preserve as convenções do projeto e aproveite as dependências compatíveis já disponíveis.

## 2. Contexto de negócio

Precisamos desenvolver uma API responsável por construir e manter um **catálogo centralizado de preços de componentes de infraestrutura e serviços de cloud computing**, denominado Rate Card.

A solução será multicloud, mas o primeiro provedor implementado será a AWS.

O Rate Card será utilizado por arquitetos de soluções, engenheiros de plataforma e especialistas em observabilidade para selecionar componentes de infraestrutura e calcular custos estimados de arquiteturas.

A experiência funcional deverá ser semelhante a um checkout: o usuário adiciona componentes, define quantidades, características técnicas, regiões e consumo esperado, e a API calcula o custo estimado.

O foco inicial são arquiteturas corporativas de observabilidade, contemplando:

- Logs, métricas, traces e profiles.
- Ingestão, processamento, armazenamento e retenção de telemetria.
- Recursos computacionais e infraestrutura Kubernetes.
- Rede, conectividade e transferências de dados.
- Fluxos de comunicação entre serviços, regiões e contas AWS.
- Inventário de componentes e itens de configuração (ICs).

A solução deve diferenciar claramente **preço público do provedor**, **consumo estimado** e **custo calculado**.

Não confundir estimativa com cobrança efetiva da AWS.

## 3. Requisitos técnicos obrigatórios

Utilize:

- Java 25.
- Spring Boot 4.x, na versão estável compatível com o projeto.
- Spring MVC / Spring Web, sem WebFlux.
- PostgreSQL.
- Spring JDBC com `JdbcClient` ou `NamedParameterJdbcTemplate`.
- AWS SDK for Java v2.
- Flyway para versionamento do banco.
- Bean Validation.
- Spring Boot Actuator.
- OpenAPI 3 / Swagger.
- JUnit, Mockito e Testcontainers.

### Regras de implementação

1. Aplicar SOLID e separação clara de responsabilidades.
2. Organizar a aplicação por Feature Packages, não por uma estrutura global de controllers, services e repositories.
3. Utilizar **consultas SQL nativas e parametrizadas** para toda a persistência.
4. Não utilizar JPA, Hibernate ou ORM.
5. Não utilizar Lombok nem MapStruct.
6. Utilizar Java Records para DTOs e objetos imutáveis quando apropriado.
7. Utilizar `BigDecimal` em todos os cálculos monetários.
8. Utilizar UTC para timestamps persistidos.
9. Implementar tratamento centralizado de exceções com Problem Details.
10. Documentar contratos públicos com JavaDoc e adicionar comentários objetivos em regras de negócio, cálculos financeiros, sincronizações e SQL complexo. Evitar comentários redundantes.
11. Evitar dependências e infraestrutura desnecessárias.
12. Otimizar a aplicação para baixo consumo de CPU e memória em Kubernetes.

## 4. Arquitetura de software

Adote um monólito modular orientado a features, permitindo futura extração de componentes sem introduzir microserviços prematuramente.

Sugestão de organização:

```text
com.company.ratecard
├── shared
│   ├── configuration
│   ├── exception
│   ├── security
│   └── pagination
├── provider
│   ├── api
│   ├── application
│   ├── domain
│   ├── persistence
│   └── spi
├── catalog
│   ├── api
│   ├── application
│   ├── domain
│   └── persistence
├── synchronization
│   ├── api
│   ├── application
│   ├── domain
│   └── persistence
├── pricing
│   ├── application
│   ├── domain
│   └── calculation
├── estimation
│   ├── api
│   ├── application
│   ├── domain
│   └── persistence
└── integrations
    └── aws
        ├── configuration
        ├── client
        ├── mapper
        └── synchronization
```

Defina interfaces claras para integração de provedores, permitindo implementar Azure e Google Cloud posteriormente.

O domínio de catálogo, sincronização e estimativas não deve depender diretamente de classes do SDK da AWS.

## 5. Integração com a AWS Pricing

Implementar integração real com os mecanismos oficiais da AWS:

- Price List Query API: `DescribeServices`, `GetAttributeValues` e `GetProducts`.
- Price List Bulk API: `ListPriceLists` e `GetPriceListFileUrl`.
- Arquivos oficiais de preços por serviço e região.
- AWS Price List SNS Notifications como mecanismo opcional de detecção de alterações.

### Requisitos de integração

- Diferenciar região de endpoint da Pricing API da região comercial do produto.
- Descobrir serviços e regiões disponíveis sem manter listas rígidas.
- Implementar paginação de respostas da AWS.
- Tratar throttling, indisponibilidade, timeouts e respostas parciais.
- Implementar retry exponencial com jitter.
- Utilizar a cadeia padrão de credenciais do AWS SDK.
- Nunca armazenar credenciais AWS diretamente no código.
- Processar arquivos grandes por streaming, evitando carregar todo o catálogo na memória.
- Registrar versão e origem oficial dos dados coletados.
- Priorizar preços On-Demand em USD na primeira implementação.
- Preservar modelo extensível para Reserved Instances, Savings Plans e outras modalidades de contratação.

Não presumir que a Price List API oferece diretamente um endpoint de diferenças incrementais.

## 6. Sincronização incremental e versionamento

Implementar um processo de sincronização que:

1. Identifique o provedor, serviço e região solicitados.
2. Consulte a versão do catálogo disponível na origem.
3. Compare com a última versão sincronizada com sucesso.
4. Evite downloads e processamento desnecessários quando a versão não tiver mudado.
5. Realize download e processamento quando necessário.
6. Normalize os produtos, atributos e dimensões de preços.
7. Compare o conteúdo normalizado com o catálogo persistido.
8. Identifique registros novos, alterados, inalterados e removidos da origem.
9. Persista apenas mudanças efetivas.
10. Preserve o histórico das versões anteriores.
11. Atualize o estado da sincronização somente após concluir as etapas necessárias com sucesso.

### Regras de consistência

- Utilizar identificadores estáveis da origem, como SKU e Rate Code, combinados às demais dimensões necessárias.
- Utilizar hash determinístico do conteúdo normalizado para identificar alterações.
- Implementar UPSERT com `INSERT ... ON CONFLICT` do PostgreSQL.
- Garantir idempotência.
- Evitar duplicações em sincronizações concorrentes.
- Preservar preços históricos com períodos de vigência.
- Desativar preços ausentes somente após confirmação de processamento completo da fonte.
- Não substituir o catálogo ativo por dados parciais em caso de falha.
- Permitir reprocessamento controlado de sincronizações com erro.

Persistir indicadores operacionais, incluindo quantidades de registros processados, inseridos, atualizados, inalterados e desativados.

## 7. Processamento assíncrono

As sincronizações devem ocorrer em background, sem bloquear requisições HTTP.

O endpoint de solicitação deve retornar `202 Accepted` e um identificador de acompanhamento.

Implementar fila lógica persistente no PostgreSQL, com:

- Tabela de jobs.
- Identificador único.
- Escopo do processamento.
- Estados `PENDING`, `RUNNING`, `COMPLETED`, `FAILED` e `CANCELLED`, quando aplicável.
- Contador de tentativas.
- Datas de criação, início e conclusão.
- Erro técnico estruturado.
- Métricas de processamento.
- Lease e heartbeat para recuperação de workers interrompidos.

Usar mecanismos transacionais, como `FOR UPDATE SKIP LOCKED`, para garantir concorrência segura entre múltiplas réplicas no Kubernetes.

Não depender exclusivamente de `@Async` com execução em memória.

Implementar agendamento periódico configurável para sincronização, além do disparo manual.

Não introduzir Kafka, RabbitMQ ou SQS sem justificativa concreta.

## 8. Modelo de dados

Projetar um modelo relacional normalizado que contemple, no mínimo:

- `cloud_provider`
- `cloud_region`
- `cloud_service`
- `cloud_product`
- `price_term`
- `price_dimension`
- `price_version`
- `catalog_sync_job`
- `catalog_sync_checkpoint`
- `catalog_change_history`
- `architecture_estimate`
- `architecture_estimate_item`

Adicionar tabelas complementares somente quando necessárias.

### Atributos fundamentais do Rate Card

Cada item precificável deve permitir identificar:

- Provedor cloud.
- Serviço.
- Região.
- SKU original.
- Categoria e família do produto.
- Atributos técnicos.
- Usage Type e Operation.
- Modalidade comercial.
- Term Code e Rate Code.
- Unidade original de cobrança.
- Moeda.
- Preço unitário.
- Início e término de faixa de consumo.
- Data de vigência.
- Versão da fonte.
- Estado de disponibilidade.
- Histórico de alterações.

Armazenar atributos específicos de cada provedor em JSONB quando apropriado, sem prejudicar consultas frequentes.

Definir índices, constraints, chaves únicas e estratégias de paginação compatíveis com grandes volumes.

## 9. Motor de precificação

Implementar um motor desacoplado de cálculo financeiro capaz de consumir o Rate Card.

O motor receberá uma composição de recursos com seus parâmetros de uso e produzirá uma estimativa detalhada.

### Capacidades necessárias

- Cálculo por hora, mês e ano.
- Quantidade de componentes.
- Preço por unidade de consumo.
- Armazenamento e retenção.
- Volume de ingestão.
- Requisições e operações.
- Faixas progressivas de preço.
- Descontos ou modalidades comerciais quando oficialmente suportados.
- Custos de rede e transferência de dados.
- Total por componente, serviço, região, conta e arquitetura.

Tratar corretamente unidades distintas, conversões, limites de faixas e arredondamento monetário.

Não assumir universalmente 730 horas por mês: disponibilizar premissas explícitas e configuráveis.

### Transferências de dados

Modelar fluxos com:

- Serviço de origem e destino.
- Conta de origem e destino.
- Região e, quando aplicável, Availability Zone.
- Direção da transferência.
- Volume estimado.
- Caminho de conectividade.
- Serviços intermediários.

Suportar cenários de:

- Data In e Data Out para Internet.
- Transferência entre AZs.
- Transferência entre regiões.
- Transferência entre contas AWS.
- Tráfego entre serviços.
- NAT Gateway.
- Transit Gateway.
- VPC Endpoints e PrivateLink.
- Direct Connect, quando houver informações de preços adequadas.

**Regra fundamental:** transferência entre contas não significa automaticamente uma cobrança adicional.

O cálculo deve considerar efetivamente a topologia, os serviços e as regras de tarifação aplicáveis, sem gerar dupla contabilização de tráfego.

Quando uma regra não estiver implementada ou não houver preço confiável, retornar o item como não precificável, com justificativa, em vez de assumir custo zero.

## 10. Escopo inicial de serviços AWS

Priorizar a descoberta e precificação de componentes relevantes para arquiteturas corporativas de observabilidade:

- EC2.
- EBS.
- S3.
- EKS.
- CloudWatch.
- VPC e componentes de conectividade.
- Serviços de Data Transfer.
- Load Balancing.
- NAT Gateway.
- Transit Gateway.
- Serviços de ingestão e transporte de eventos, conforme disponibilidade no catálogo oficial.

Identificar dinamicamente os Service Codes reais disponibilizados pela AWS.

Não inventar SKUs nem tarifas.

Desenvolver o primeiro fluxo completo com um subconjunto representativo desses serviços e manter os demais extensíveis.

## 11. APIs REST obrigatórias

Criar APIs versionadas em `/api/v1`.

### Catálogo

- `GET /providers`
- `GET /providers/{provider}/regions`
- `GET /catalog/services`
- `GET /catalog/products`
- `GET /catalog/rates`
- `GET /catalog/rates/{id}`
- `GET /catalog/rates/{id}/history`
- `GET /catalog/changes`

Permitir filtros por provedor, região, serviço, categoria, SKU, modalidade comercial e atributos relevantes.

Implementar paginação, ordenação e limites de tamanho de página.

Garantir que a navegação e a busca sejam realizadas no banco, sem carregar toda a coleção em memória.

### Sincronização

- `POST /synchronizations`
- `GET /synchronizations/{id}`
- `GET /synchronizations`
- `POST /synchronizations/{id}/retry`

Permitir selecionar os serviços e regiões da sincronização.

Prever idempotência de solicitações e rejeição ou reutilização controlada de jobs equivalentes em andamento.

### Estimativas de arquitetura

- `POST /estimates`
- `GET /estimates/{id}`
- `GET /estimates`
- `POST /estimates/{id}/items`
- `DELETE /estimates/{id}/items/{itemId}`
- `POST /estimates/{id}/calculate`

O cálculo será síncrono e deverá retornar:

- Resumo da arquitetura.
- Componentes selecionados.
- Preços e versões utilizados.
- Quantidades e unidades.
- Premissas de consumo.
- Breakdown por categoria e serviço.
- Custos de transferência.
- Custo mensal e anual.
- Total consolidado.
- Alertas de preços ausentes ou estimativas incompletas.

Preservar o snapshot dos preços utilizados em estimativas já calculadas para garantir reprodutibilidade histórica.

## 12. Contratos e qualidade das APIs

Implementar:

- DTOs independentes das entidades do banco.
- Validação de parâmetros e payloads.
- Respostas paginadas padronizadas.
- Ordenação determinística.
- Códigos HTTP semanticamente corretos.
- Identificadores de correlação.
- OpenAPI atualizado.
- Versionamento explícito.
- Segurança baseada em autenticação e autorização.

Separar permissões de consulta de permissões administrativas, especialmente para disparo e reprocessamento de sincronizações.

Evitar exposição de dados técnicos sensíveis em respostas de erro.

## 13. Performance e operação em Kubernetes

A aplicação será executada em containers Kubernetes.

Priorizar eficiência operacional:

- Baixa utilização de memória.
- Pools de conexão limitados e configuráveis.
- Streaming e processamento em lotes.
- Transações curtas.
- Persistência eficiente.
- Paginação SQL.
- Índices adequados.
- Controle de concorrência.
- Graceful shutdown.
- Readiness e liveness probes.
- Recursos e configurações externalizados.
- Logs estruturados e métricas via Actuator/Micrometer.

Preparar instrumentação OpenTelemetry para fluxos HTTP, banco de dados e sincronização, sem criar dependência obrigatória de um backend específico.

Evitar cache distribuído e infraestrutura adicional na implementação inicial.

## 14. Testes obrigatórios

Implementar testes unitários, de integração e de comportamento.

Cobrir especialmente:

1. Sincronização inicial de catálogo vazio.
2. Nova sincronização sem alterações.
3. Inclusão de novos produtos.
4. Alteração de preços existentes.
5. Preservação de histórico.
6. Falha durante processamento e recuperação.
7. Execução concorrente entre workers.
8. Paginação, filtros e ordenação.
9. Cálculo por preço unitário.
10. Cálculo por faixas progressivas.
11. Conversão de unidades.
12. Transferências inter-regionais e entre contas.
13. Prevenção de dupla cobrança.
14. Estimativas com preços ausentes.
15. Integridade dos cálculos com `BigDecimal`.

Utilizar PostgreSQL real por meio de Testcontainers para validar SQL, índices, constraints, UPSERT e locking.

Simular as respostas AWS em testes automatizados com fixtures representativas.

Não exigir acesso à AWS para executar a suíte de testes.

## 15. Documentação e entrega

Produzir:

- Código-fonte funcional.
- Migrations Flyway.
- Configurações por ambiente.
- README com instruções de execução.
- Documentação OpenAPI.
- Exemplos de requisições e respostas.
- Documentação das regras de precificação.
- Explicação das principais decisões arquiteturais.
- Instruções para autenticação AWS local e em Kubernetes.
- Testes automatizados.
- Resumo das limitações conhecidas.

Utilizar comentários técnicos relevantes no código e nas queries SQL, especialmente quando houver decisões não triviais de performance, concorrência ou cálculo.

## 16. Estratégia de execução

Trabalhe em incrementos funcionais:

**Fase 1 — Fundação**
- Inspecionar repositório e dependências.
- Organizar Feature Packages.
- Implementar banco, migrations, configurações e contratos-base.

**Fase 2 — AWS e sincronização**
- Integrar AWS Pricing.
- Implementar processamento e normalização.
- Persistir catálogo e histórico.
- Implementar jobs assíncronos e recuperação.

**Fase 3 — APIs do catálogo**
- Disponibilizar consultas paginadas.
- Implementar filtros e histórico.
- Documentar os contratos.

**Fase 4 — Precificação**
- Implementar carrinho de componentes.
- Desenvolver motor de cálculos.
- Implementar transferências de dados e estimativas.
- Persistir resultados e versões utilizadas.

**Fase 5 — Validação**
- Executar testes.
- Corrigir problemas identificados.
- Validar desempenho e consistência.
- Documentar a entrega.

### Critérios de aceite

A implementação será considerada funcional somente quando:

1. A API conseguir coletar preços reais da AWS.
2. Os preços forem persistidos corretamente no PostgreSQL.
3. Uma segunda sincronização sem alterações não gerar duplicações nem versões artificiais.
4. Uma mudança de preço for identificada e registrada historicamente.
5. A solicitação de sincronização retornar imediatamente um job rastreável.
6. O catálogo oferecer consulta síncrona, paginada e filtrável.
7. Um usuário conseguir montar uma composição de arquitetura e obter uma estimativa financeira.
8. Os cálculos utilizarem preços versionados e operações monetárias precisas.
9. As APIs apresentarem erros claros quando dados de preços estiverem ausentes.
10. A aplicação conseguir executar de maneira consistente com múltiplas réplicas.
11. Os testes automatizados principais estiverem passando.

**Instrução final:** implemente efetivamente as funcionalidades, sem limitar a entrega a uma proposta arquitetural, pseudocódigo, mocks permanentes ou estruturas vazias.

Antes de adicionar qualquer dependência ou componente de infraestrutura, justifique sua necessidade. Preserve a simplicidade operacional e priorize correção financeira, extensibilidade multicloud e performance.
