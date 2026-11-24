# Plano técnico para integrar ícones de arquitetura AWS

Estudo e implementação de 20/11/2026 dos [requisitos de componentes de arquitetura](../../pop-price-system-service/docs/REQUISITOS_COMPONENTES_ARQUITETURA.md). Situação: fase 1 implementada; integração com pendências e canvas ainda prevista para as fases 2 e 3. As seções de desenho técnico abaixo descrevem a solução e suas evoluções.

A integração pode utilizar SVGs oficiais servidos em `public`, sem biblioteca adicional de ícones ou dependência de CDN em execução. O cadastro persistido na API fará a associação entre serviço e ícone; um componente React comum exibirá a representação no formulário, na biblioteca e, posteriormente, no canvas.

## Pontos existentes que serão aproveitados

### Fluxo atual de autoria

Categoria de arquitetura utiliza Combobox Fluent pesquisável, com categorias extraídas das bibliotecas oficiais de AWS, Azure e GCP. A lista de Genérico é mantida pelo portal. A identidade da categoria é persistida e seu nome de apresentação é devolvido em `categoryName`. `GET /api/v1/architecture-component-categories?provider=...` fornece as opções; `category` filtra `GET /api/v1/architecture-icons`.

Os metadados incluem 27 categorias AWS, 29 Azure, 26 GCP e oito neutras. A extração é reproduzível por `scripts/import-architecture-icons.py` e `scripts/import-provider-categories.py`, com pacotes e hashes fixados. A biblioteca completa inclui 810 SVGs e 769 componentes; consulte [cobertura e procedimento de carga](IMPORTACAO_COMPONENTES_AWS.md). Os seeds são consolidados em `aws.sql`, `azure.sql` e `gcp.sql`, incluídos pelo `../pop-price-system-database/deploy.sql` após a criação das tabelas. A carga AWS alinha a categoria dos ícones à pasta oficial de origem. Reimportar os seeds preserva categorias livres anteriores dos componentes.

Novos cadastros exigem uma opção válida do provedor. Uma categoria antiga pode ser mantida ao editar o mesmo registro e provedor, ficando sinalizada como categoria anterior. Trocar de provedor limpa categorias incompatíveis; escolher uma categoria prepara o filtro da Iconografia, que pode ser ampliado sem substituir o ícone aplicado.

Criar e editar componentes abre `/construtor/componentes/novo` e `/construtor/componentes/{id}`. Nessas páginas, uma barra lateral própria substitui a navegação geral, e o formulário utiliza toda a largura disponível com prévia do componente. As etapas são Provedor, Características, Iconografia, Serviço cloud e Revisão.

O cadastro oferece Genérico, Amazon Web Services, Microsoft Azure e Google Cloud. A lista de provedores de autoria é separada das integrações de preços instaladas. A API a expõe em `GET /api/v1/architecture-component-providers`.

Características são pares de nome e valor persistidos, com até 30 entradas e nomes distintos. O vínculo cloud pode ser preenchido posteriormente; um componente cloud pendente não precisa de serviço ou ícone. Componentes genéricos usam a representação padrão e podem ser ativados sem vínculo. A troca de provedor preserva as características e limpa o serviço e o ícone incompatíveis. A ativação cloud continua exigindo serviço e ícone do mesmo provedor.

Essa evolução integra a definição final de `../pop-price-system-database/deploy.sql`. As características não são parâmetros de cálculo financeiro. Os testes de cadastro cobrem as rotas dedicadas, Genérico, vínculo posterior, seleção por teclado, acessibilidade automatizada e uso em desktop e notebook.

| Ponto do projeto                                  | Uso na implementação                                                                   |
| ------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `src/components/provider-icon.tsx`                | Referência para servir imagens locais; mantém os logos dos provedores                  |
| `src/components/portal/canvas-view.tsx`           | `ResourceCard` usa `CloudRegular`; receberá o ícone cadastrado na fase 3               |
| `src/lib/contracts.ts`                            | `CatalogService` já fornece a identidade de provedor e código do serviço               |
| `src/lib/component-contracts.ts`                  | Contratos de componentes, ícones, filtros e páginas, separados dos contratos do canvas |
| `src/lib/component-api.ts` e `src/app/actions.ts` | Acesso à API pelo servidor, seguindo o padrão existente                                |
| `scripts/check-assets.mjs`                        | Já percorre os SVGs de `public` e verifica conteúdo ativo e referências externas       |
| `scripts/build.mjs`                               | Já copia todo o diretório `public` para o artefato standalone                          |
| Backend `catalog`                                 | Fornece o serviço descoberto; os metadados visuais ficam em cadastro separado          |
| Backend `architecture`                            | Persiste o grafo em JSON e será integrado ao cadastro na fase 3                        |

Os logos em `public/providers` são provenientes do Devicon e identificam provedores. Os ícones de arquitetura AWS terão origem e avisos próprios. Os ícones Fluent continuam nas ações e na navegação.

## Pacote oficial e verificação inicial

Origem: [AWS Architecture Icons](https://aws.amazon.com/architecture/icons/).

Pacote inspecionado: [Icon package de 31/07/2026](https://d1.awsstatic.com/onedam/marketing-channels/website/public/shared/architecture-icon-release/Icon-package_07312026.5846e92413caa21490223536cc97f1269e44fa92.zip).

SHA256 do ZIP recebido: `d2d166c453526471749d520e0db022c459abef759d2946cf2dd1d1c992dc6526`.

A verificação inicial examinou os SVGs de EC2, S3, EKS, CloudWatch, Lambda, RDS e VPC. A importação completa agora valida todos os 810 SVGs com parsing XML, rejeição de conteúdo ativo e referências externas. `check-assets.mjs` também confere hashes, identidades, categorias e distribuição dos arquivos no standalone.

Todos os arquivos dessa amostra possuem `viewBox="0 0 80 80"` e dimensões intrínsecas de 80 px, apesar do sufixo `_64`. Preservar o conteúdo e a proporção originais e controlar apenas o tamanho de exibição, com `object-fit: contain`. Manter as cores oficiais, sem aplicar tokens de cor do Fluent aos desenhos.

## Organização dos arquivos e manifesto

Criar `public/architecture-icons/aws/2026-07-31/` com os SVGs selecionados e nomes locais estáveis, como `ec2.svg`, `s3.svg` e `eks.svg`. Manter versões anteriores enquanto houver modelos que as referenciem.

Adicionar `public/architecture-icons/ASSET-SOURCES.md` com origem, data de obtenção, versão, hash do pacote e os avisos aplicáveis ao conjunto AWS. Não aplicar a licença do Devicon aos novos arquivos.

Criar um manifesto versionado com os seguintes campos:

| Campo                         | Finalidade                                  |
| ----------------------------- | ------------------------------------------- |
| `schemaVersion`               | Versão do formato do manifesto              |
| `provider`                    | Provedor do conjunto                        |
| `release`                     | Versão do pacote, inicialmente `2026-07-31` |
| `sourceUrl` e `packageSha256` | Rastreabilidade da origem                   |
| `key`                         | Identidade lógica estável, como `aws.ec2`   |
| `name`                        | Nome para busca e apresentação              |
| `kind`                        | Serviço, recurso, categoria ou agrupamento  |
| `category` e `tags`           | Organização e termos de busca               |
| `assetPath`                   | Caminho local da imagem                     |
| `sourcePath`                  | Caminho original dentro do ZIP              |
| `sha256`                      | Hash do SVG distribuído                     |

O manifesto será a fonte de preparação da biblioteca. Um utilitário de manutenção deverá verificar arquivos, duplicidades e hashes e gerar os registros de metadados para o backend. Os registros gerados e a atualização aditiva do banco serão versionados no repositório do serviço e aplicados explicitamente, conforme a operação atual. Não baixar ícones na inicialização da API nem durante a sincronização de preços.

A geração ocorre durante a manutenção da biblioteca; os builds e a execução dos dois projetos não devem depender da presença do outro checkout. O mesmo identificador de versão do conjunto deve permitir conferir a correspondência entre os registros da API e os arquivos entregues pelo frontend.

## Associação persistida e contratos propostos

Criar uma feature `components` no backend, com API, application service, domínio e persistência JDBC conforme as convenções existentes. Um application service coeso é suficiente para o cadastro; a feature de arquitetura deverá consumir seu contrato público ao validar componentes.

Manter dois conceitos persistidos: o registro versionado de ícone e o componente editável. O registro de ícone guarda provedor, chave, versão e metadados do manifesto. O componente guarda identificador próprio, provedor e código do serviço, nome de apresentação, categoria, descrição, situação e referência ao ícone versionado.

O vínculo usa provedor, chave do ícone e versão; o caminho do arquivo é um atributo resolvido a partir desses metadados. A API deve validar a existência do serviço e do ícone e a compatibilidade entre provedores. A sincronização continua atualizando seus dados de catálogo, sem escrever nos componentes.

Contratos HTTP propostos, a detalhar na fase 1:

| Operação                                      | Contrato                                   |
| --------------------------------------------- | ------------------------------------------ |
| Consultar ícones com busca e paginação        | `GET /api/v1/architecture-icons`           |
| Consultar componentes com filtros e paginação | `GET /api/v1/architecture-components`      |
| Consultar um componente                       | `GET /api/v1/architecture-components/{id}` |
| Cadastrar um componente                       | `POST /api/v1/architecture-components`     |
| Editar configuração e situação                | `PUT /api/v1/architecture-components/{id}` |

As respostas devem retornar os metadados necessários à prévia do ícone. A API não precisa transportar os bytes dos SVGs nas consultas. O cadastro também não deve aceitar SVG arbitrário ou URL externa informada pelo usuário.

## Renderização no frontend

Criar `ArchitectureIcon` separado de `ProviderIcon`. O componente recebe a referência resolvida de um ícone, o tamanho de apresentação e a informação de acessibilidade. Renderiza com `<img>` e dimensões explícitas; não exige importação do SVG como componente React nem alteração na configuração do bundler.

Usar texto alternativo vazio quando o nome do componente já estiver adjacente. Na seleção do formulário, cada opção terá nome acessível e estado selecionado. Usar tamanhos adequados à lista, à prévia e ao nó do canvas, preservando a proporção.

Para um arquivo indisponível ou um modelo legado sem associação, apresentar o ícone genérico existente e uma indicação textual quando necessário. A indisponibilidade de uma imagem não deve apagar o componente ou modificar sua tarifa. Novas ativações continuam exigindo uma referência válida.

Carregar a biblioteca de seleção por busca e paginação, sem embutir todos os SVGs no JavaScript nem enviar a coleção inteira em cada resposta. O diretório versionado permite cache longo dos arquivos desde que uma versão publicada nunca seja sobrescrita.

## Integração futura com o canvas e Draw.io

Na fase 3, adicionar ao nó a referência ao componente e os dados visuais necessários à preservação do modelo, incluindo chave e versão do ícone. Tratar os novos campos de forma compatível com os modelos atuais. A API deve resolver e validar as referências; metadados visuais enviados pelo navegador não devem ser aceitos como autoridade para a publicação.

Ao criar uma instância, a tarifa selecionada deve pertencer ao serviço do componente. Ao publicar, preservar nome e referência visual usados pelo modelo. A seleção de novas instâncias usa apenas componentes ativos; a leitura de instâncias antigas preserva sua representação mesmo após desativação do cadastro.

No exportador `.drawio`, ler o SVG local correspondente à referência versionada e incorporá-lo ao arquivo, mantendo nós e conexões como elementos editáveis. Não colocar Base64 dos ícones no grafo persistido nem depender de identificadores internos das bibliotecas AWS do Draw.io. O manifesto fornece o mesmo vínculo visual para interface e exportação.

## Sequência de implementação e verificações

1. Preparar os SVGs iniciais, manifesto e registro de origem; validar os arquivos com o mecanismo existente.
2. Implementar o cadastro e os contratos de ícones e componentes, incluindo persistência e validações.
3. Implementar `ArchitectureIcon`, a listagem de gestão e a seleção visual no formulário.
4. Completar as pendências e a consulta de disponibilidade da fase 2.
5. Integrar o cadastro ao grafo, à publicação e à exportação Draw.io na fase 3, conforme o escopo de interoperabilidade definido.

Priorizar testes de validação, persistência e comportamento do cadastro. Verificar também integridade do manifesto e presença dos arquivos no artefato distribuído. No canvas, manter somente a verificação simples em desktop e tela intermediária prevista nos requisitos. Não criar uma matriz de testes mobile ou uma suíte complexa do editor.

## Entrega da fase 1

- Rota `/construtor/componentes`, com formulário, prévia, seleção de ícone por radio buttons Fluent, filtros e carregamento das próximas páginas de componentes e serviços.
- Componente reutilizável `ArchitectureIcon`, com alternativa genérica quando faltar uma imagem e restrição a caminhos locais da biblioteca.
- Sete SVGs oficiais, manifesto versionado, registro de origem e utilitário de manutenção `scripts/import-architecture-icons.py`.
- Feature `components` no backend com controller, application service e repository JDBC. A existência do serviço é validada por contrato público de `catalog`.
- Tabelas e metadados incluídos no deploy consolidado do serviço; referências compostas impedem vincular ícones de outro provedor, inclusive no banco. A edição utiliza revisão otimista.
- Exemplos e descrições dos cinco novos endpoints no Swagger.

Verificações realizadas:

- `mvnw.cmd verify`: suíte do backend e contrato da documentação.
- `python ../pop-price-system-database/validation/portal_local.py verify-components`: cadastro HTTP em banco PostgreSQL 18.6 isolado, paginação, validações, constraint de provedor, conflito de revisão e persistência após reiniciar a API. `verify-deploy` valida o deploy consolidado com dados nas 27 tabelas, rejeição de inclusões inválidas, repetição dos seeds e rollback integral em caso de falha.
- `npm run typecheck` e `npm run build`: tipos e artefato standalone.
- `npm run check:assets`: arquivos locais, segurança estática dos SVGs, manifesto, hashes e cópias no standalone.
- `npx playwright test tests/components.spec.ts`: criação pendente, ativação com ícone por teclado, edição, desativação, busca, paginação além de vinte registros e recuperação de falha de consulta. Inclui axe e capturas em desktop e notebook.

O banco local da aplicação recebeu a migração aditiva após salvar seu schema anterior em `../pop-price-system-database/target/`. Os testes de cadastro usaram banco isolado e API de teste; não foram criados componentes fictícios no banco da aplicação.

Fluent UI React 9.75.2: componentes estáveis, tokens existentes e conteúdo em português. Resultado: CONFORME COM EXCEÇÕES; a revisão manual com leitor de tela, ampliação real do navegador e homologação completa de contraste permanecem pendentes. PostgreSQL local 18.6: mudança aditiva verificada em ambiente de desenvolvimento; testes de carga, permissões de produção, replicação e recuperação operacional não foram realizados, portanto não há declaração de prontidão para produção.

As fases 2 e 3 permanecem pendentes, incluindo a exportação Draw.io. O canvas e o cálculo financeiro não foram alterados nesta entrega.
