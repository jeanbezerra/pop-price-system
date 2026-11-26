# pop-price-system-service

API Java 25 / Spring Boot 4.0.9 para catálogo versionado de preços públicos AWS e estimativas de arquitetura. Persistência exclusivamente com Spring JDBC e SQL parametrizado, organizada por feature.

As instruções posteriores ao `docs/ESCOPO.md` foram aplicadas: **sem Flyway, Testcontainers, Spring Security, triggers, stored functions ou jobs**. A sincronização é manual e síncrona. O banco é implantado explicitamente por [`../pop-price-system-database/deploy.sql`](../pop-price-system-database/deploy.sql). Bean Validation valida os contratos HTTP; esta versão não implementa autenticação ou autorização.

## Planejamento de componentes de arquitetura

Os [requisitos de gestão de componentes e entrega por fases](docs/REQUISITOS_COMPONENTES_ARQUITETURA.md) orientam o cadastro que associa serviços cloud a ícones de arquitetura. A fase 1 está implementada; a gestão de pendências e a integração com o canvas permanecem nas fases 2 e 3.

O cadastro usa `/api/v1/architecture-icons` e `/api/v1/architecture-components`, com busca, filtros e paginação por `nextAfter`. Provedores de autoria são consultados em `/api/v1/architecture-component-providers`, incluindo Genérico, AWS, Azure e GCP sem criar integrações ou serviços fictícios. Componentes cloud pendentes podem ser salvos sem serviço ou ícone; a ativação exige ambos. Genéricos usam representação padrão e não possuem vínculo cloud. Características são persistidas como até 30 pares de nome e valor. A edição envia a revisão atual e retorna `409` em conflito.

A listagem aceita `linked=true` para componentes com serviço, `linked=false` para componentes sem serviço (incluindo Genérico), ou o parâmetro omitido para todos. O critério combina com os demais filtros e deve ser mantido ao enviar `after` nas próximas páginas.

As ações da linha ficam no menu de três pontos: Editar, Desativar e Excluir componente. Excluir pede confirmação e chama `DELETE /api/v1/architecture-components/{id}?revision=<atual>`, retornando `204` sem corpo. O deploy inclui `deleted_at`; a exclusão preenche essa data e incrementa a revisão, preservando identificação, situação, características e referências. Registros excluídos não aparecem em consultas de autoria, retornam `404` por ID e não podem ser editados; revisão desatualizada retorna `409`. Desativar mantém o cadastro visível como Inativo. A importação AWS não recria nem restaura registros excluídos. Não há operação de restauração nesta entrega.

Toda a estrutura está consolidada em [`../pop-price-system-database/deploy.sql`](../pop-price-system-database/deploy.sql): as 27 tabelas, constraints, índices, parâmetros iniciais e cargas dos provedores são criados em uma única transação. As antigas migrations foram incorporadas à definição final das tabelas e removidas, assim como os comandos locais `migrate-*`. O deploy é exclusivo para bancos vazios; instalações anteriores exigem uma atualização específica para seu estado e não devem executar esse script.

Os seeds permanecem separados por provedor em [`../pop-price-system-database/seeds/aws.sql`](../pop-price-system-database/seeds/aws.sql), [`../pop-price-system-database/seeds/azure.sql`](../pop-price-system-database/seeds/azure.sql) e [`../pop-price-system-database/seeds/gcp.sql`](../pop-price-system-database/seeds/gcp.sql), com versões e origens preservadas nos metadados. O deploy os inclui após criar todas as dependências; o seed AWS carrega categorias, ícones e componentes, nessa ordem. A execução não depende de baixar arquivos ou do checkout web.

Validação isolada do cadastro: `python ../pop-price-system-database/validation/portal_local.py verify-components`. O comando cria e preserva um banco exclusivo a partir do deploy consolidado para testar HTTP, constraints, paginação, edição concorrente e persistência após reiniciar a aplicação. Não altera os dados do banco local da aplicação.

Biblioteca AWS completa: 810 ícones, 27 categorias e 769 componentes de serviço/recurso. Para importar no banco local com a estrutura atual, execute `python ../pop-price-system-database/validation/portal_local.py import-aws-components-local`: salva backup completo de pop_price_system_service em `../pop-price-system-database/target/`, aplica `../pop-price-system-database/seeds/aws.sql` em transação e verifica repetibilidade e preservação dos cadastros anteriores. `python ../pop-price-system-database/validation/portal_local.py verify-aws-components` testa a carga em banco isolado. Todos os componentes importados começam pendentes; os 137 mapeamentos revisados só vinculam códigos presentes no catálogo. A carga não sobrescreve edições nem completa vínculos de registros já existentes. Mais detalhes no [procedimento de importação](../pop-price-system-web/docs/IMPORTACAO_COMPONENTES_AWS.md).

## Executar

Requisitos: Java 25, PostgreSQL e Maven Wrapper. O DDL foi conferido em PostgreSQL 18.6. Não são necessárias extensões no banco.

O schema utilizado é `pop_price_system_service`, configurado também como padrão das conexões Hikari. Para bancos existentes com `ratecard`, siga a [migração do schema](../pop-price-system-database/README.md): pare o serviço, salve backup, renomeie o schema com `20261126_rename_application_schema.sql` e reinicie com esta versão. Essa migração precede as migrações de estruturas ainda pendentes. Banco, usuário e prefixos de configuração não precisam ser renomeados.

1. Crie um banco vazio e uma conexão com permissão para criar o schema.
2. Execute o script uma única vez no banco vazio (o script é transacional e não apaga objetos existentes):

```sh
psql "$DATABASE_URL_PSQL" -X -v ON_ERROR_STOP=1 -f ../pop-price-system-database/deploy.sql
```

3. Configure a aplicação. Exemplo PowerShell:

```powershell
$env:DATABASE_URL = 'jdbc:postgresql://localhost:5432/pop_database_db'
$env:DATABASE_USER = '<usuario do banco>'
$env:DATABASE_PASSWORD = '<senha do banco>'
$env:AWS_PROFILE = '<perfil local>'
$env:SPRING_PROFILES_ACTIVE = 'dev'
.\mvnw.cmd spring-boot:run
```

Linux/macOS: `./mvnw spring-boot:run`, usando as mesmas variáveis de ambiente. O processo não executa DDL automaticamente.

### Validar a estrutura com dados

```sh
python ../pop-price-system-database/validation/portal_local.py verify-deploy
```

O comando cria bancos locais isolados e executa o deploy completo, inclusões válidas nas 27 tabelas, inclusões inválidas com verificação do SQLSTATE, repetição dos seeds e rollback integral após falha. Também confere que executar o deploy sobre um banco já instalado falha sem alterar seus dados. Os dados sintéticos existem apenas nesses bancos de teste, preservados para inspeção; o relatório fica em `../pop-price-system-database/target/deploy-verification.json`.

Os validadores Python ficam em `../pop-price-system-database/validation/` e seus scripts SQL em `../pop-price-system-database/validation/sql/`. A implantação fica em `../pop-price-system-database/deploy.sql`, com os seeds em `../pop-price-system-database/seeds/`.

O contexto da aplicação é `/pop-price-system-service` em todos os ambientes. Os caminhos de API descritos abaixo são relativos a esse contexto.

- Swagger UI: `http://localhost:8080/pop-price-system-service/` (redireciona para a interface)
- Entrada tradicional do Swagger: `http://localhost:8080/pop-price-system-service/swagger-ui.html`
- OpenAPI: `http://localhost:8080/pop-price-system-service/v3/api-docs`
- Readiness: `/pop-price-system-service/actuator/health/readiness` (inclui banco)
- Liveness: `/pop-price-system-service/actuator/health/liveness`
- Métricas: `/pop-price-system-service/actuator/metrics`

Sem profile explícito, a aplicação usa `dev` como padrão para execução local, inclusive pelo VS Code, e abre o Swagger ao acessar a raiz do contexto. Swagger UI e OpenAPI ficam disponíveis em `dev` ou `hml` e desabilitados em `prd` e nos demais profiles. Se `prd` estiver ativo junto com `dev` ou `hml`, a documentação continua desabilitada. Selecione o ambiente pela variável `SPRING_PROFILES_ACTIVE` (`dev`, `hml` ou `prd`); o manifesto Kubernetes define `prd` explicitamente.

No VS Code, selecione `pop-price-system-service (dev)`, `(hml)` ou `(prd)` em **Run and Debug** e inicie com `F5`. As opções `dev` e `hml` abrem o navegador no contexto correto quando o Tomcat estiver pronto; `prd` não abre a documentação. A raiz `http://localhost:8080/` está fora do contexto desta aplicação.

O Swagger contém o roteiro de descoberta → sincronização → consulta de tarifas → composição → cálculo, descrições das 21 operações, parâmetros, corpos e exemplos de sucesso e erro. Em operações com corpo, selecione o cenário no campo **Examples** e use **Try it out** após substituir os identificadores ilustrativos pelos retornos reais. Os exemplos monetários servem para explicar o cálculo e não são cotações atuais da AWS. Erros usam `application/problem+json` com `correlationId`; um cálculo incompleto retorna `200` com `complete=false`, avisos e totais consolidados nulos.

## Fluxo de uso

1. `POST /api/v1/providers/AWS/discovery` descobre e persiste os Service Codes reais. `?service=<codigo>` também descobre as regiões daquele serviço.
2. `GET /api/v1/catalog/services` e `GET /api/v1/providers/AWS/regions` consultam os metadados já persistidos.
3. `POST /api/v1/synchronizations` importa **um serviço e uma região por requisição**:

```json
{"provider":"AWS","serviceCode":"AmazonEKS","regionCode":"us-east-1"}
```

Use os códigos retornados pela descoberta. A resposta `200` contém o identificador, estado e contadores da execução concluída. Não há processamento em background. Catálogos grandes podem exigir uma conexão HTTP longa e timeout adequado no gateway. `GET /synchronizations/{id}` e a listagem permitem consultar a auditoria durante e após a execução.

4. `GET /api/v1/catalog/rates?provider=AWS&service=AmazonEKS&region=us-east-1&modality=OnDemand` retorna preços. Selecione um `id` real, com os atributos, modalidade e unidade desejados.
5. `POST /api/v1/estimates` cria a composição:

```json
{"name":"Plataforma de observabilidade","hoursPerMonth":720}
```

6. `POST /api/v1/estimates/{id}/items` adiciona um componente. `rateId` deve ser substituído pelo identificador selecionado no catálogo; nenhum SKU ou preço fictício é criado pela aplicação.

```json
{
  "name":"Componente com cobrança horária",
  "category":"compute",
  "accountCode":"conta-plataforma",
  "rateId":123,
  "quantity":2,
  "consumption":1,
  "consumptionUnit":"Hrs",
  "period":"HOUR"
}
```

7. `POST /api/v1/estimates/{id}/calculate` calcula e salva um snapshot imutável. A resposta inclui versões e preços utilizados, faixas, consumo, premissas, custos mensal/anual/horário e agrupamentos por serviço, região, conta e categoria.

`GET /estimates/{id}` retorna a composição e o último cálculo. A revisão desse cálculo pode ser anterior à composição atual. `GET /estimates/{id}/calculations/{calculationId}` recupera qualquer snapshot conhecido, mesmo após alteração de preços ou remoção de itens.

Exemplos adicionais: [`docs/requests.http`](docs/requests.http). Regras e limites financeiros: [`docs/PRICING.md`](docs/PRICING.md). Decisões: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Consulta e erros

Produtos, preços e alterações aceitam `provider`, `service`, `region`, `category` (família do produto), `sku`, `modality` e `attributes` (objeto JSON, enviado com URL encoding). A modalidade em produtos filtra a existência de um termo correspondente. `active=true` é o padrão para produtos e preços; alterações consultam todo o histórico.

Catálogo e histórico de preços usam paginação por chave: `size=1..200`, `sort=asc|desc`, `afterId=<nextAfterId>`. Serviços usam `after=<nextAfter>` e ordenação por provedor/código. Auditoria de sincronizações e estimativas usam `size` e `offset` limitado a 10.000. A ordenação inclui identificadores determinísticos e as consultas paginam no banco.

Erros usam `application/problem+json`, sem SQL, credenciais ou stack trace no corpo, e incluem `correlationId`. `X-Correlation-ID` acompanha respostas e logs. Payload inválido retorna `400`, recurso ausente `404`, conflito de execução ou composição `409` e falha de sincronização `502`. Uma estimativa incompleta retorna `200`, `complete=false`, alertas e totais consolidados nulos; o subtotal conhecido é separado.

`Idempotency-Key` reapresenta a auditoria da mesma requisição e não aceita outro escopo. Uma execução em andamento do mesmo escopo gera `409`. Use `POST /synchronizations/{id}/retry` para uma execução `FAILED`; a tentativa recebe outro identificador. Uma nova solicitação do escopo recupera execuções interrompidas cujo heartbeat expirou (`SYNC_STALE_AFTER_SECONDS`, padrão 300, mínimo 240). Nesse caso use uma chave nova; a chave anterior continua identificando a tentativa anterior. Não existe recuperação agendada.

## AWS

O cliente usa `DefaultCredentialsProvider`: variáveis de ambiente, perfis locais e credenciais de workload. `AWS_PRICING_REGION` configura o endpoint da API (padrão `us-east-1`), independentemente da região comercial solicitada.

Para desenvolvimento, autentique o perfil local pelo mecanismo da sua organização e defina `AWS_PROFILE`. Credenciais temporárias também podem ser fornecidas pelas variáveis padrão do SDK. Nenhuma credencial AWS é persistida. Os módulos STS, SSO e SSO OIDC dão suporte a perfis federados e workloads.

Em EKS, associe uma role ao ServiceAccount usando Pod Identity ou IRSA. A aplicação usa a cadeia padrão, sem access keys nos manifests. A role precisa das ações de leitura `pricing:DescribeServices`, `pricing:GetAttributeValues`, `pricing:GetProducts`, `pricing:ListPriceLists` e `pricing:GetPriceListFileUrl`. O endpoint HTTP dos arquivos oficiais também deve estar acessível.

A descoberta usa `DescribeServices` / `GetAttributeValues`, com fallback de descoberta de regiões pela Bulk API. A importação usa `ListPriceLists`, `GetPriceListFileUrl` e streaming JSON. `/providers/{provider}/source-products?service=...&region=...` usa `GetProducts` para uma página remota de verificação (`nextToken`); não altera o catálogo.

## Dependências e operação

JDBC evita ORM; Validation protege os contratos; AWS SDK v2 integra os serviços oficiais e a cadeia de credenciais; Actuator fornece métricas/saúde; Springdoc gera OpenAPI. JUnit/Mockito cobrem regras locais sem banco ou AWS. Nenhum broker ou cache foi adicionado.

`DB_POOL_SIZE` (8), `HTTP_THREADS` (32) e `SYNC_STALE_AFTER_SECONDS` são configuráveis. Pool pequeno, staging em lotes de 250, streaming e publicação SQL em conjunto limitam memória e tráfego com o banco. Cada réplica compartilha os índices de exclusão de execuções ativas por escopo.

`Dockerfile` empacota o JAR. `deployment/kubernetes.yml` é um exemplo com duas réplicas, probes, shutdown e configuração externa. Prepare o banco manualmente antes de subir a aplicação. Configure o Secret `ratecard-database` com as chaves `url`, `username` e `password` e ajuste a imagem e o ServiceAccount.

Logs são estruturados. O caso de uso de sincronização cria uma Micrometer Observation e contadores `catalog.synchronizations`. Para tracing HTTP/JDBC/AWS, é possível montar um OpenTelemetry Java Agent e configurar `JAVA_TOOL_OPTIONS=-javaagent:/otel/opentelemetry-javaagent.jar`, `OTEL_SERVICE_NAME` e `OTEL_EXPORTER_OTLP_ENDPOINT`. Não há backend obrigatório; a exportação das Observations depende dos handlers de tracing instalados no ambiente.

## Verificação

```powershell
.\mvnw.cmd clean verify
```

Os testes locais não exigem AWS, Docker ou banco e focam parser, idempotência, publicação após fonte completa, falha de importação, faixas, precisão, retenção, conversões e regras de rede. A suíte complexa de integração foi adiada conforme solicitado. Também foram conferidos manualmente o DDL, os repositórios e as APIs em PostgreSQL temporário, incluindo importação de um arquivo oficial EKS e cálculo com preço versionado.

As chamadas autenticadas da Query/Bulk API exigem um perfil AWS autorizado e não são executadas pela suíte local. A validação com arquivo público oficial não substitui a conferência dessas permissões no ambiente de destino.
