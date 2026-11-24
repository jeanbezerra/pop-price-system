# Requisitos de gestão de componentes de arquitetura e entrega por fases

Data de referência: 20/11/2026.

Situação em 20/11/2026: fase 1 implementada; fases 2 e 3 pendentes. A biblioteca AWS contém 810 ícones oficiais, 27 categorias e 769 componentes distintos do pacote de 31/07/2026. A carga preserva cadastros e personalizações existentes e pode ser repetida sem duplicá-los.

O cadastro em lote cria 303 componentes de serviço e 466 de recurso, inicialmente pendentes para revisão. Categoria e agrupamento permanecem como símbolos da biblioteca. Os 137 mapeamentos explícitos de serviços só produzem vínculo quando o código já existe no catálogo; os demais componentes ficam sem vínculo. Recursos não herdam automaticamente o serviço de preço por semelhança de nome. A cobertura é a do pacote oficial fixado, sem garantia de que todo produto AWS possua símbolo ou tarifa disponível. O deploy consolidado `../pop-price-system-database/deploy.sql` inclui a carga aditiva de `../pop-price-system-database/seeds/aws.sql`; a integração com o canvas continua na fase 3. Procedimento e critérios: [importação da biblioteca AWS](../../pop-price-system-web/docs/IMPORTACAO_COMPONENTES_AWS.md).

A gestão de componentes deve associar os serviços do catálogo cloud à iconografia de arquitetura do respectivo provedor. Esse cadastro prepara a biblioteca que será utilizada no canvas, permitindo escolher um componente reconhecível e depois configurar região, tarifa e consumo.

O fluxo de cadastro será: escolher provedor ou Genérico → definir identificação e características → configurar representação → vincular serviço cloud quando aplicável → revisar e salvar. O componente pode ser salvo antes da descoberta ou sincronização de serviços. A escolha futura de tarifas depende do vínculo e dos preços disponíveis para o serviço e a região.

O cadastro e a edição abrem páginas dedicadas, com barra lateral de etapas, prévia do componente e uso de toda a largura disponível. As opções iniciais são Genérico, Amazon Web Services, Microsoft Azure e Google Cloud, independentemente das integrações de preço instaladas.

## Objetivo e escopo

Entregar uma área de cadastro e manutenção de componentes antes de avançar na evolução do canvas. O cadastro conecta a identidade técnica do catálogo, a representação visual e a configuração das instâncias usadas nas arquiteturas.

O primeiro provedor atendido será a AWS, acompanhando a integração de catálogo existente. O modelo deve comportar outros provedores, como Azure e GCP; a implementação de novas integrações de sincronização não faz parte desta entrega.

## Conceitos e relacionamentos

| Elemento | Responsabilidade | Relacionamento |
| --- | --- | --- |
| Provedor | Identificar a origem do serviço e da iconografia | Possui serviços e ícones |
| Serviço do catálogo | Manter código, nome e metadados provenientes da descoberta | Pode possuir vários componentes |
| Ícone de arquitetura | Manter a representação visual, origem e versão do recurso | Pertence a um provedor e pode ser reutilizado em componentes |
| Componente cadastrado | Definir provedor, nome, categoria, descrição, características e representação | Pode receber um serviço do mesmo provedor posteriormente; Genérico não possui vínculo cloud |
| Instância no canvas | Representar um recurso concreto da arquitetura | Referencia o componente e mantém região, tarifa e consumo próprios |

Cada componente cloud pode ter até um serviço associado nesta entrega. A mesma associação de provedor e serviço pode originar componentes distintos quando houver representações de arquitetura diferentes. Componentes genéricos são independentes do catálogo cloud e usam representação padrão. A categoria de arquitetura é independente da família de produto usada pelo catálogo de preços.

## Requisitos funcionais

| Identificador | Requisito | Fase |
| --- | --- | --- |
| RF01 | Disponibilizar a entrada **Componentes de arquitetura** no grupo **Construtor e avançado** | 1 |
| RF02 | Listar ícone, nome do componente, provedor, código e nome do serviço, categoria e situação do cadastro, com menu kebab de Editar, Desativar e Excluir componente; exclusão exige confirmação e preserva os dados no banco | 1 |
| RF03 | Cadastrar e editar provedor, nome, categoria, descrição, características técnicas, representação e vínculo cloud em página dedicada com barra lateral de etapas | 1 |
| RF04 | Permitir vincular posteriormente um serviço entre os registros descobertos do provedor, preservando sua identidade técnica | 1 |
| RF05 | Oferecer biblioteca de ícones com busca, prévia e seleção restrita ao provedor do serviço | 1 |
| RF06 | Registrar para cada ícone um identificador estável, provedor, nome, arquivo, origem e versão do conjunto | 1 |
| RF07 | Permitir ativar componentes completos e desativá-los sem remover referências existentes; excluir logicamente oculta o cadastro da listagem e edição, preserva dados e referências e exige a revisão atual para evitar conflitos | 1 |
| RF08 | Oferecer busca por nome e filtros por provedor, serviço, categoria, situação e presença de vínculo com serviço (Todos, Com vínculo, Sem vínculo), combináveis e preservados na paginação; Sem vínculo inclui Genérico | 1 |
| RF09 | Identificar serviços descobertos sem componente configurado e oferecer acesso à configuração a partir dessa pendência | 2 |
| RF10 | Exibir disponibilidade de tarifas e permitir consultar sua disponibilidade por região, separadamente da situação do cadastro | 2 |
| RF11 | Preservar cadastros e associações durante novas descobertas e sincronizações | 2 |
| RF12 | Alimentar a biblioteca do canvas com os componentes ativos e completos do cadastro | 3 |
| RF13 | Criar instâncias com nome e ícone do componente, permitindo escolher região, tarifa elegível, quantidade e consumo | 3 |
| RF14 | Manter a identidade visual e as referências de arquiteturas existentes após alterações no cadastro, preservando a representação dos modelos publicados | 3 |

## Tela de gestão e formulário

A listagem deve permitir localizar componentes existentes e acessar o formulário de cadastro. Na fase 2, também deve permitir consultar os serviços sem componente configurado, evitando exigir que o gestor conheça previamente todos os códigos descobertos.

| Campo do formulário | Regra |
| --- | --- |
| Provedor | Delimita os serviços e ícones disponíveis |
| Serviço | Opcional enquanto pendente; selecionado no catálogo do provedor. Não se aplica a Genérico |
| Nome de apresentação | Obrigatório e utilizado na biblioteca e no canvas |
| Categoria de arquitetura | Obrigatória, escolhida em lista pesquisável de categorias oficiais do provedor selecionado; sem texto livre |
| Ícone | Obrigatório para ativar componente cloud e pertencente ao mesmo provedor; Genérico usa representação padrão |
| Descrição | Opcional, com orientação breve de uso |
| Características técnicas | Até 30 pares de nome e valor, com nomes distintos. Nome até 100 caracteres e valor até 1000 |
| Situação do cadastro | Pendente, ativo ou inativo |

O formulário permite salvar como pendente sem serviço ou ícone. Nome e categoria são obrigatórios. Para ativar um componente cloud, serviço e ícone precisam estar configurados; componentes genéricos podem ser ativados sem ambos. Trocar de provedor limpa os vínculos incompatíveis e preserva identificação e características. Os limites de validação devem ser consistentes na interface e na API.

O campo Categoria de arquitetura utiliza uma lista pesquisável baseada na classificação oficial das bibliotecas do provedor. A lista depende do provedor e alimenta o filtro inicial da etapa Iconografia, que pode ser ampliado para todas as categorias. A identificação e o nome originais são preservados, com tradução de apresentação sem criar outra taxonomia. Foram importadas 27 categorias AWS, 29 categorias de pastas do Azure e 26 categorias do GCP. Genérico possui oito categorias neutras mantidas pelo portal. Ao trocar de provedor, a categoria anterior é limpa se não pertencer à nova lista. A migração preserva as categorias livres já cadastradas até sua revisão, sem conversão automática por semelhança de nomes. O frontend sinaliza esses valores como categoria anterior; a API permite mantê-los apenas no mesmo cadastro e provedor.

## Situações e disponibilidade

| Situação | Significado | Uso em novas inclusões no canvas |
| --- | --- | --- |
| Pendente | Componente em configuração ou ainda não ativado | Indisponível |
| Ativo | Componente completo e habilitado pelo gestor | Disponível para seleção |
| Inativo | Componente retirado da biblioteca pelo gestor | Indisponível, preservando instâncias existentes |

Um serviço sem componente configurado é uma pendência de cobertura do catálogo, não um componente criado automaticamente. A descoberta não deve inventar nomes de apresentação nem escolher ícones sem configuração do gestor.

A disponibilidade de tarifas é uma informação independente. Um componente ativo pode estar sem preços para determinada região. Nesse caso, o canvas deve informar a ausência de tarifas elegíveis e impedir a conclusão da configuração de uma nova instância precificável naquela região.

## Regras de integridade e preservação

- RN01: usar identificadores estáveis para componentes e ícones e a identidade de provedor e código para serviços. Nomes e caminhos de arquivos não devem ser usados como chave de associação.
- RN02: validar a compatibilidade do provedor entre serviço e ícone também na API.
- RN03: separar os metadados gerenciados pelo portal dos metadados recebidos do provedor. A sincronização não pode sobrescrever nome de apresentação, categoria, descrição, ícone ou situação do componente.
- RN04: permitir até um serviço por componente cloud e vários componentes para o mesmo serviço. O vínculo pode ser preenchido depois; componentes genéricos não possuem serviço cloud.
- RN05: selecionar tarifas a partir do serviço associado e da região da instância. O cadastro visual não deve fixar uma tarifa para todas as utilizações do componente.
- RN06: desativar mantém o cadastro visível como Inativo. Excluir usa `deleted_at`, preserva os dados e referências existentes e oculta o cadastro da autoria, com confirmação e controle de revisão. Reimportações não restauram registros excluídos.
- RN07: preservar a representação usada na publicação de um modelo, incluindo a versão do ícone. Atualizações na biblioteca não devem modificar silenciosamente modelos publicados.
- RN08: manter o comportamento financeiro existente. A associação visual não altera preços públicos, unidades, regras de consumo ou snapshots de cálculos.
- RN09: preservar a leitura de modelos anteriores ao cadastro de componentes. A ausência da nova associação não pode tornar esses modelos inacessíveis.

## Requisitos de interface e operação

- Seguir o design system existente com Fluent UI React v9, tokens e componentes utilizados pelo portal.
- Projetar o canvas para desktop e notebooks, adaptando painéis e área de trabalho a telas intermediárias e janelas um pouco menores. Otimização para smartphones, gestos de toque e uma experiência específica de canvas mobile ficam fora do escopo. Essa restrição se aplica ao canvas; os cadastros mantêm o padrão responsivo do portal.
- Manter rótulos em português, operação por teclado, foco visível e situações identificadas por texto, sem depender apenas de cor ou ícone.
- Oferecer estados de carregamento, lista vazia, filtros sem resultado, erro de consulta e erro de gravação com recuperação.
- Distribuir os arquivos de iconografia com a aplicação, sem dependência de CDN para exibição, preservando os avisos de origem e licença aplicáveis.
- Manter paginação e filtros adequados ao volume de serviços e componentes, sem restringir a gestão à primeira página do catálogo.
- Persistir o cadastro na API e no banco. Uma associação salva deve permanecer disponível após recarregar a tela e reiniciar a aplicação.
- Respeitar as convenções atuais do backend, incluindo Spring JDBC e atualização explícita do banco por scripts, sem introduzir Flyway ou processamento agendado para esta funcionalidade.

## Estratégia de validação e economia de esforço

Concentrar os testes automatizados de maior profundidade nos cadastros: campos obrigatórios, compatibilidade entre serviço e ícone, persistência, edição, ativação, desativação, busca e filtros. Reutilizar a infraestrutura existente e selecionar verificações que protejam regras de negócio reais.

No canvas, realizar apenas uma verificação simples do fluxo principal em desktop e tela intermediária: selecionar componente, conferir ícone, configurar tarifa, salvar e reabrir. Os critérios funcionais da fase 3 continuam válidos, mas não exigem uma suíte complexa de testes do editor.

Não criar testes complexos de arrastar e soltar, gestos, combinações extensas de nós e conexões, regressão visual abrangente ou matriz de dispositivos mobile para o canvas. Manter as verificações existentes das regras financeiras e de integridade no backend, executando as pertinentes às alterações.

Para economizar tokens e tempo, usar leituras direcionadas, atualizações curtas e verificações proporcionais à mudança. Não repetir testes já aprovados sem alterações relevantes ou indícios de falha.

## Fase 1 Biblioteca de ícones e cadastro de componentes

Objetivo: permitir cadastrar, associar, visualizar, editar e ativar componentes de arquitetura.

Entregas: persistência e contratos da API para componentes e ícones; conjunto inicial de ícones AWS com origem e versão registradas; tela de gestão; formulário; seleção de serviço e ícone; busca e filtros dos componentes cadastrados.

Critérios de aceite:

- [x] A nova tela está acessível pelo menu e permite cadastrar um componente a partir de um serviço real do catálogo.
- [x] O seletor apresenta prévia dos ícones e permite localizar um ícone do provedor selecionado.
- [x] Uma associação entre serviço e ícone de provedores diferentes é rejeitada pela API.
- [x] É possível salvar um cadastro pendente sem serviço ou ícone; a ativação de componentes cloud exige serviço e ícone válidos, e Genérico utiliza representação padrão.
- [x] Dois componentes distintos podem referenciar o mesmo serviço.
- [x] Cadastro, edição, ativação e desativação persistem após nova consulta e reinício da aplicação.
- [x] Busca, filtros, paginação e estados de erro permitem gerir os registros além da primeira página.
- [x] Os ícones são servidos localmente e os controles principais funcionam por teclado.

## Fase 2 Pendências e integração com sincronizações

Dependência: fase 1 concluída.

Objetivo: tornar visível a cobertura do catálogo por componentes e a disponibilidade de preços.

Entregas: visão de serviços sem componente configurado; acesso direto à configuração; informação de tarifas por serviço e região; verificação da preservação dos metadados do gestor nas operações de descoberta e sincronização.

Critérios de aceite:

- [ ] Um serviço recém-descoberto sem componente aparece na visão de pendências e pode iniciar um cadastro com o vínculo preenchido.
- [ ] A visão distingue serviço sem componente de componente pendente ou inativo.
- [ ] A interface diferencia situação do cadastro e disponibilidade de tarifas, inclusive por região.
- [ ] Uma nova descoberta ou sincronização não altera os campos gerenciados pelo portal.
- [ ] A existência de múltiplos componentes para um serviço não duplica o serviço na visão de pendências.
- [ ] Consultas de disponibilidade usam os dados reais do catálogo, sem gerar tarifas fictícias.

## Fase 3 Integração com o canvas

Dependência: fases 1 e 2 concluídas.

Objetivo: iniciar a montagem da arquitetura pela escolha do componente cadastrado e configurar a precificação na instância.

Entregas: biblioteca do canvas baseada no cadastro; representação com ícone e nome do componente; seleção de região e tarifa; referência persistida ao componente; preservação visual dos modelos publicados e compatibilidade com modelos anteriores.

Critérios de aceite:

- [ ] Apenas componentes ativos e completos aparecem para novas inclusões no canvas.
- [ ] Uma nova instância utiliza o ícone e o nome do componente escolhido.
- [ ] A seleção de tarifas respeita o provedor, o serviço e a região da instância.
- [ ] Sem tarifa elegível, a interface informa a pendência e impede concluir a configuração da nova instância precificável.
- [ ] Duas instâncias do mesmo componente podem usar regiões, tarifas e consumos diferentes.
- [ ] Salvar e reabrir uma arquitetura preserva os vínculos e a configuração de suas instâncias.
- [ ] Desativar um componente impede novas inclusões e mantém as instâncias já existentes.
- [ ] Alterar nome ou ícone no cadastro não modifica silenciosamente a representação de um modelo publicado.
- [ ] Modelos criados antes desta funcionalidade continuam acessíveis.
- [ ] O cálculo utiliza as tarifas e o consumo da instância e preserva os resultados históricos existentes.
- [ ] O canvas permanece utilizável em desktop e telas intermediárias, com validação simples do fluxo principal conforme a estratégia acima.

## Avaliação dos ícones AWS e da compatibilidade com Draw.io

Pesquisa realizada em 20/11/2026. As opções abaixo orientam o detalhamento técnico; a interoperabilidade ainda não foi implementada.

### Iconografia oficial da AWS

A AWS disponibiliza o conjunto [AWS Architecture Icons](https://aws.amazon.com/architecture/icons/) para diagramas, com ícones de serviços, recursos e agrupamentos. O pacote oficial vinculado na data da pesquisa é identificado como `Icon-package_07312026`; a inspeção do ZIP confirmou arquivos SVG e PNG, incluindo representações relacionadas a EC2, S3, EKS e CloudWatch. A AWS permite o uso dos recursos por clientes e parceiros em diagramas de arquitetura e alerta que bibliotecas de terceiros podem conter versões antigas.

Para a fase 1, utilizar SVGs desse pacote, servidos localmente, com origem e versão registradas. Selecionar o conjunto necessário aos serviços atendidos e ampliar a biblioteca conforme a demanda. A associação com os códigos do catálogo de preços continuará explícita no cadastro; nomes de arquivos não devem determinar o vínculo automaticamente.

### Opções de interoperabilidade

O [formato documentado pelo Draw.io](https://github.com/jgraph/drawio/wiki/File-Format) permite representar blocos, conexões, posições e atributos personalizados em arquivos `.drawio` XML. O Draw.io também possui [bibliotecas AWS](https://www.drawio.com/docs/diagram-types/aws-diagrams/) e aceita [bibliotecas personalizadas de formas](https://www.drawio.com/docs/reference/format-custom-shape-library/).

| Opção | Avaliação para o projeto |
| --- | --- |
| Exportar o canvas para `.drawio` editável | Recomendada como primeiro nível de compatibilidade; exige um conversor do grafo atual |
| Reimportar arquivos exportados pelo portal | Viável como evolução delimitada, preservando identificadores e metadados próprios |
| Importar diagramas Draw.io arbitrários | Maior esforço por diferenças de formas, agrupamentos, páginas e ausência de vínculos com tarifas |
| Incorporar o editor Draw.io | Alternativa possível, com integração de edição, persistência e configuração; exige reavaliar o canvas atual |

O [modo de incorporação oficial](https://www.drawio.com/docs/reference/embed-mode/) usa iframe e mensagens `postMessage`. A adoção desse editor aumentaria a integração necessária nesta entrega. A recomendação é manter o canvas atual em React Flow e adicionar conversão de arquivos.

### Escopo recomendado para a fase 3

Começar pela exportação de uma página `.drawio`, com blocos e conectores editáveis, nomes, posições e ícones SVG incorporados ao arquivo. Isso evita depender das versões das bibliotecas AWS instaladas no editor externo. Exportar uma imagem única do diagrama não atende a esse objetivo.

Definir metadados versionados para componente, provedor, serviço, versão do ícone, região, referência de tarifa, quantidade e consumo. A reimportação poderá aproveitar esses dados, mas deverá validar as referências no catálogo local e as regras financeiras do backend. Identificadores de tarifas não são necessariamente portáveis entre instalações.

O grafo atual exige uma tarifa em cada nó. Portanto, uma forma importada sem vínculo com o catálogo não pode se tornar automaticamente um componente precificável. A importação ampla exigiria um fluxo adicional de associação e tratamento de pendências, que fica como evolução.

A verificação inicial de interoperabilidade será pequena: exportar um diagrama representativo com dois componentes e uma conexão, abrir no Draw.io e conferir ícones, nomes, posições e edição dos elementos. Caso seja implementada a reimportação, conferir também a preservação dos metadados nesse mesmo exemplo, sem criar uma suíte complexa do canvas.

## Evoluções fora das três fases

O refinamento de tarifas elegíveis por família e atributos do produto poderá ser acrescentado quando um serviço exigir componentes com seleções de preço diferentes. Essa evolução depende da definição dos critérios e de sua validação na API.

Também ficam fora deste escopo a associação de um componente a vários serviços, novos conectores cloud, upload livre de ícones pelo usuário e mudanças no mecanismo de cálculo financeiro.

A otimização do canvas para mobile e a criação de testes complexos do editor também ficam fora das três fases.

## Controle da entrega

| Fase | Situação | Evidência para conclusão |
| --- | --- | --- |
| 1 | Implementada | Cadastro e reinício testados em PostgreSQL 18.6 isolado; fluxo web, teclado, axe, build e integridade dos SVGs verificados |
| 2 | Pendente | Pendências e disponibilidade consultáveis, com associações preservadas após sincronização |
| 3 | Pendente | Verificação simples do canvas em desktop e tela intermediária, com modelos preservados e verificações pertinentes do cálculo |

A cada fase, atualizar a situação e registrar os critérios atendidos, as verificações realizadas e eventuais pendências. Os critérios marcados indicam a conclusão funcional verificada; os demais continuam como requisitos das próximas entregas.

A implementação da fase 1 e os comandos de validação estão registrados no plano técnico vinculado abaixo. A revisão manual com leitor de tela e a homologação em ambiente de produção permanecem pendentes; a conclusão funcional desta fase não representa certificação de acessibilidade ou prontidão de produção.

## Referências do projeto

- [Planejamento da seleção de ícones em grandes bibliotecas](../../pop-price-system-web/docs/SELECAO_ICONES.md)
- [Plano técnico de integração dos ícones AWS](../../pop-price-system-web/docs/ICONOGRAFIA_ARQUITETURA.md)
- [Operação e restrições atuais do backend](../README.md)
- [Arquitetura do backend](ARCHITECTURE.md)
- [Regras de precificação](PRICING.md)
- [Aplicação web](../../pop-price-system-web/README.md)
- [Decisões de interface](../../pop-price-system-web/docs/DESIGN.md)
