# Requisitos de seleção de ícones em grandes bibliotecas

Planejamento de 20/11/2026 para evoluir a etapa Iconografia do cadastro de componentes. Situação: lista de categorias por provedor e filtro inicial implementados; as demais evoluções continuam planejadas. Complementa os [requisitos do cadastro](../../pop-price-system-service/docs/REQUISITOS_COMPONENTES_ARQUITETURA.md).

## Objetivo da experiência

A pessoa deve conseguir encontrar a representação adequada mesmo sem conhecer o nome oficial do serviço. A biblioteca precisa apoiar a descoberta pelo propósito do componente, esclarecer a diferença entre símbolos parecidos e permitir confirmar uma escolha sem perder os dados do cadastro.

O seletor deve atender quatro situações: quem conhece uma sigla; quem conhece apenas a função do recurso; quem precisa distinguir representações próximas; e quem volta para reutilizar uma escolha anterior. A quantidade de arquivos disponíveis não deve determinar a quantidade de elementos carregados na tela.

## Estrutura da etapa

Preservar a barra lateral de etapas do cadastro. Na etapa Iconografia, utilizar a área principal como biblioteca, com busca e filtros no topo e uma grade de resultados. O painel lateral de prévia passa a apresentar os detalhes do ícone em inspeção, mantendo uma indicação compacta do componente e da seleção aplicada. Evitar acrescentar outra barra lateral permanente de filtros.

Em telas intermediárias, os detalhes podem aparecer abaixo dos resultados ou em painel acionado pelo usuário. A busca, os filtros e a seleção atual devem permanecer preservados ao consultar os detalhes ou trocar de etapa.

Cada resultado apresenta ícone, nome oficial, categoria e tipo de representação. A grade deve priorizar reconhecimento visual e leitura dos nomes, sem transformar os resultados em fichas longas. Nome completo e descrição ficam disponíveis nos detalhes.

## Busca por nome e finalidade

- Aceitar nome oficial, siglas, nomes anteriores e termos equivalentes em português e inglês. Exemplos de consultas a atender com vocabulário cadastrado: `EC2`, `máquina virtual`, `armazenamento de objetos`, `bucket`, `Kubernetes`, `logs` e `fila`.
- Desconsiderar diferenças de maiúsculas, acentos e separadores. Combinar vários termos e oferecer ajuda para pequenas variações de escrita quando houver correspondência conhecida.
- Ordenar primeiro correspondências exatas de nome ou sigla, depois prefixos e termos equivalentes e, por último, categorias e tags relacionadas. Usar ordem alfabética como alternativa e desempate determinístico.
- Consultar após uma breve pausa na digitação e permitir confirmar com Enter. Anunciar a quantidade de resultados sem anunciar cada tecla digitada.
- Mostrar os filtros ativos e oferecer limpeza individual e geral. Em resultados vazios, explicar se o provedor ou algum filtro restringiu a busca e oferecer uma ação para ampliar a consulta.

Os exemplos de busca representam requisitos de vocabulário; não autorizam criar associações automáticas entre ícones e códigos de serviços de preços. Os termos equivalentes precisam estar registrados e revisados na biblioteca.

## Classificações úteis

| Classificação                 | Ajuda para a pessoa                                                                   | Regra                                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Provedor                      | Restringir à origem do componente                                                     | Herdado da etapa Provedor e sempre visível                                                                  |
| Categoria oficial do provedor | Explorar a biblioteca pela organização usada pelo próprio provedor                    | Mesma lista pesquisável utilizada no campo Categoria de arquitetura, preservando identidade e nome oficiais |
| Serviço ou família            | Explorar as representações relacionadas a um produto                                  | Relações curadas; o nome do arquivo não define o vínculo                                                    |
| Tipo de representação         | Distinguir serviço, recurso específico, categoria e agrupador                         | Mostrar rótulo no resultado e explicar nos detalhes                                                         |
| Finalidade e tags             | Procurar conceitos como ingestão, processamento, mensageria, retenção e conectividade | Complementar a categoria sem criar uma árvore de navegação excessiva                                        |
| Coleção e versão              | Evitar resultados duplicados de pacotes antigos                                       | Exibir a coleção atual por padrão; versões anteriores ficam em filtro avançado                              |

Apresentar inicialmente Categoria, Tipo e Serviço ou família. Finalidade e versão podem ficar em filtros adicionais. As opções e suas contagens devem refletir o catálogo e os filtros em uso; não apresentar classificações preenchidas com valores fictícios.

O campo Categoria de arquitetura deve usar essa lista oficial em vez de entrada livre. A categoria escolhida nas Características prepara o filtro inicial da biblioteca de ícones, que poderá ser ampliado durante a exploração. Para Genérico, usar uma lista neutra mantida pelo portal. A classificação oficial de AWS, Azure ou GCP não deve ser substituída por um vocabulário comum criado pela aplicação. Traduções de apresentação preservam a referência original. Se a biblioteca do provedor ainda não estiver importada, indicar que suas categorias estão indisponíveis; não preencher a lista com categorias de outro provedor.

## Apoio à decisão nos detalhes

O painel de detalhes deve responder ao que o símbolo representa, em que situação utilizá-lo e a que serviço ou família pertence. Mostrar prévia ampliada, nome oficial, descrição breve em português, tipo, categoria oficial do provedor, termos alternativos, origem oficial e versão.

Quando houver representações relacionadas, oferecer acesso a elas com diferenças descritas. Por exemplo, a pessoa precisa conseguir distinguir uma representação de serviço de uma representação de recurso, como armazenamento de objetos e um bucket. Essa relação depende dos itens existentes no pacote e da classificação curada, sem inventar variantes ausentes.

Oferecer exemplos curtos de uso no diagrama quando houver conteúdo revisado. A aparência ou a cor do símbolo não deve ser o critério de recomendação. Uma descrição ausente deve permanecer ausente até ser enriquecida, sem apresentar texto genérico como orientação oficial do provedor.

Explorar um candidato não substitui imediatamente a seleção aplicada ao componente. Usar uma ação explícita **Usar este ícone**, com nome acessível e retorno visual da escolha. Após aplicar, manter nome e ícone selecionados visíveis mesmo quando a busca mudar.

## Sugestões a partir do componente

Oferecer uma seção pequena de candidatos relacionados quando a categoria, as características ou um serviço já vinculado tiverem correspondências cadastradas. Mostrar o motivo, como `Relacionado à categoria Armazenamento` ou `Associado ao serviço vinculado`.

O vínculo de serviço confirmado tem prioridade sobre correspondências de palavras do nome do componente. Sugestões por nome ou categoria são apoio à escolha e não estabelecem equivalência técnica ou financeira. Não selecionar automaticamente nem apresentar porcentagens de confiança sem uma medida validada. Sem metadados suficientes, apresentar a navegação por categorias.

Favoritos e recentes podem ajudar quem cadastra vários componentes. Ficam para uma evolução posterior, com escopo de usuário ou navegador explicitamente definido, sem expor o histórico de outros usuários.

## Metadados e carregamento

O registro atual já contém provedor, nome, tipo, categoria, tags e versão. A evolução acrescenta descrição de uso, termos alternativos, identidade e nome oficiais da categoria e relações com famílias e ícones relacionados. Os rótulos traduzidos da amostra atual devem ser revisados contra a classificação do pacote oficial antes de alimentar a lista. Diferenciar o conteúdo fornecido pelo provedor do enriquecimento mantido pelo portal.

Preparar e revisar os metadados durante a importação das coleções. A pesquisa e os filtros serão executados no servidor, com paginação e ordenação estáveis. Carregar somente a página visível de resultados e as imagens necessárias, sem transportar todos os SVGs no JavaScript ou baixar milhares de arquivos ao abrir a etapa. Um serviço externo de busca ou IA em execução não é necessário para o primeiro incremento.

O provedor da seleção continua compatível com o componente. Uma busca sem resultados não deve trocar de provedor nem sugerir equivalência entre serviços de clouds diferentes. Modelos existentes continuam referenciando a versão escolhida, independentemente da coleção apresentada por padrão em novos cadastros.

## Entregas incrementais

1. **Encontrar e classificar:** busca ampliada, filtros de categoria, tipo e família, ordenação, contagens, paginação e grade de resultados.
2. **Entender e confirmar:** painel de detalhes, descrição de uso, relações entre representações, seleção aplicada separada do candidato e sugestões com motivo explícito.
3. **Reutilizar:** favoritos e recentes, conforme a frequência de uso e o escopo de identidade definido para o portal.

A ampliação dos pacotes oficiais deve acompanhar a preparação dos metadados. Importar mais arquivos sem classificação suficiente não conclui a melhoria de descoberta. A primeira entrega deve incluir os detalhes mínimos necessários à escolha: nome, categoria e tipo, mesmo antes do enriquecimento completo.

## Critérios de aceite

- [x] Categoria de arquitetura é uma lista pesquisável dependente do provedor, sem entrada livre, e a seleção prepara o filtro de categorias na biblioteca de ícones.
- [ ] Uma busca por nome, sigla ou termo equivalente encontra os itens relacionados cadastrados dentro do provedor escolhido.
- [ ] Categoria, tipo e família podem ser combinados; contagens e resultados correspondem à mesma consulta.
- [ ] Serviço, recurso e agrupador ficam distinguíveis sem depender da cor ou do desenho.
- [ ] A pessoa consegue inspecionar um candidato sem perder ou substituir a seleção aplicada.
- [ ] Aplicar uma escolha mantém a referência correta ao retornar às demais etapas e ao reabrir o cadastro.
- [ ] Uma ausência de resultados apresenta orientação e permite ampliar a consulta sem perder os dados do componente.
- [ ] A biblioteca permanece paginada com milhares de registros, sem carregar toda a coleção ou todos os SVGs na abertura.
- [ ] Busca, filtros, inspeção e confirmação funcionam por teclado e preservam foco e nomes acessíveis.
- [ ] Testes focados de cadastro e consultas verificam filtros, paginação, seleção e preservação; não são adicionados testes complexos do canvas.
