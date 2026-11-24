# Decisões de design — Fluent 2

## Referências e implementação

O projeto segue o [layout Fluent 2](https://fluent2.microsoft.design/layout), a orientação de uso dos componentes e os contratos públicos instalados do Fluent UI React v9. O escopo é uma aplicação de consulta em português, tema claro e densidade média.

| Função                  | Composição e orientação                                                                                                                                                                                                                                                                                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Navegação principal     | [Nav](https://fluent2.microsoft.design/components/web/react/core/nav/usage/): `NavDrawer`, `NavDrawerBody`, `NavItem`, `NavSectionHeader`; rótulos curtos, ícone e seleção correspondente à rota. Gaveta inline padrão de 260 px; overlay em até 640 px, com `Hamburger`, fechamento por Escape e restauração de foco via `useRestoreFocusTarget`.                |
| Organização de conteúdo | [Card](https://fluent2.microsoft.design/components/web/react/core/card/usage/): superfícies não interativas, com `CardHeader` e `CardFooter` quando há título/ação; ações em botões separados, sem transformar o cartão inteiro em link.                                                                                                                          |
| Ações                   | [Button](https://fluent2.microsoft.design/components/web/react/core/button/usage/): aparência primária para explorar o catálogo; ações de atualização e navegação secundária com menor ênfase. Âncoras preservadas nas ações que navegam.                                                                                                                         |
| Consulta e filtros      | [Field](https://fluent2.microsoft.design/components/web/react/core/field/usage/) + [Input](https://fluent2.microsoft.design/components/web/react/core/input/usage/) e [Select](https://fluent2.microsoft.design/components/web/react/core/select/usage/), com rótulos persistentes e associação acessível. Select nativo mantém operação por teclado e por toque. |
| Dados tabulares         | `Table`, `TableHeader`, `TableRow`, `TableHeaderCell`, `TableBody`, `TableCell`; semântica nativa de tabela para consulta sem seleção/edição. Composição conferida nos tipos locais e no [exemplo oficial](https://github.com/microsoft/fluentui/blob/master/packages/react-components/react-table/stories/src/Table/Default.stories.tsx).                        |
| Estado da API           | [Badge](https://fluent2.microsoft.design/components/web/react/core/badge/usage/) com texto explícito. Cor acompanha o significado e não é a única indicação.                                                                                                                                                                                                      |
| Falha recuperável       | [Message bar](https://fluent2.microsoft.design/components/web/react/core/messagebar/usage/): aviso abaixo do título da página, corpo com contexto, `MessageBarActions` com tentativa de recuperação e fechamento.                                                                                                                                                 |

As APIs foram conferidas nas exportações estáveis de `@fluentui/react-components@9.75.2`. A navegação foi comparada com o [exemplo oficial do Storybook](https://github.com/microsoft/fluentui/blob/master/packages/react-components/react-nav/stories/src/Nav/Basic.stories.tsx). A composição do aviso segue o [exemplo de ações](https://github.com/microsoft/fluentui/blob/master/packages/react-components/react-message-bar/stories/src/MessageBar/Actions.stories.tsx). Não há importações da aplicação para `/unstable`, bibliotecas Fluent v8 ou seletores de classes internas.

## Fundamentos e marca

- `webLightTheme` oficial define cores, estados, bordas, raios e elevação. Não foi criada uma paleta Porto sem referência aprovada.
- A marca Porto aparece no SVG oficial, preservado e servido localmente. Ela não substitui as cores semânticas dos controles Fluent.
- `makeStyles`, `shorthands` e tokens de alias controlam superfícies, hierarquia tipográfica, espaçamento, foco e status. A composição usa Grid e Flexbox com a escala Fluent.
- Títulos nativos `h1`/`h2`/`h3` utilizam `typographyStyles` ou tokens da escala. Rótulos e mensagens usam português e capitalização de frase.
- Segoe UI é prioritária; Inter local é a alternativa multiplataforma. Essa extensão tipográfica evita downloads de fontes e preserva escala/pesos/alturas do Fluent.
- Valores geométricos próprios ficam restritos a grades, breakpoints, largura de leitura, escala proporcional do logo e alvos de navegação de 44 px. Os controles mantêm seus tamanhos e estados oficiais.
- Sem animações decorativas; a preferência por movimento reduzido é respeitada no deslocamento da página e pelos componentes Fluent.
- A navegação abre e fecha instantaneamente: `surfaceMotion={null}` e `backdropMotion={null}` desativam os efeitos pelas APIs públicas do `NavDrawer`. A troca de rota não repete a animação de entrada da barra lateral. No celular, a gaveta continua abrindo apenas pelo botão, com Escape e restauração de foco preservados.

## SSR e hidratação

Cada página aguarda as consultas no servidor antes de montar `PageFrame`. Toda a subárvore estilizada abaixo do registry é síncrona, de modo que a primeira coleta contém as regras da rota inteira.

`FluentRegistry` cria um renderizador por instância/requisição, compõe `RendererProvider`, `SSRProvider` e `FluentProvider` e injeta `renderToStyleElements` com `useServerInsertedHTML`. A coleta ocorre uma vez para evitar estilos duplicados no corpo. A chave da rota recria o registry nas mudanças de página.

Não adicione filhos assíncronos ou limites Suspense abaixo desse registry sem reavaliar a coleta de estilos em streaming e os testes sem JavaScript. A estratégia segue a integração [Griffel SSR](https://griffel.js.org/react/guides/ssr-usage/) e as orientações [Next.js CSS-in-JS](https://nextjs.org/docs/app/guides/css-in-js).

A consulta da largura da tela usa `useSyncExternalStore` com estado inicial idêntico no servidor e na hidratação. O CSS oculta a gaveta inline em telas pequenas até a gaveta modal estar disponível. As operações interativas, incluindo a abertura da navegação móvel, exigem JavaScript; o conteúdo da página é renderizado no servidor.

## Validação e limites

| Área                        | Verificação                                                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Composição                  | Componentes estáveis, tipos e exemplos oficiais; sem reprodução manual dos estados internos.                           |
| Estados                     | Conteúdo, vazio, filtros sem resultado, seleção de rota, atualização pendente, indisponibilidade e recuperação da API. |
| SSR                         | Conteúdo e estilos no HTML inicial com JavaScript desativado; logo local disponível; estilos coletados no head.        |
| Hidratação                  | Navegação e filtros operantes; captura de erros de JavaScript nas rotas.                                               |
| Estáticos                   | Bloqueio de origens externas durante a navegação; conferência dos assets copiados ao standalone.                       |
| Acessibilidade automatizada | axe com regras WCAG 2 A/AA e 2.1 AA na composição de catálogo; não constitui certificação WCAG.                        |
| Teclado                     | Link para pular ao conteúdo, foco na região principal, navegação, abertura da gaveta móvel, Escape e retorno de foco.  |
| Responsividade              | Desktop, larguras intermediárias, 390 px e 320 px; tabelas com largura mínima legível e região de rolagem por teclado. |
| Cores forçadas              | Controles e navegação operantes com `forced-colors: active`.                                                           |

Exceções da instrumentação de testes:

- Os sentinelas de foco criados internamente pelo Tabster (`[data-tabster-dummy][aria-hidden="true"][role="none"]`) são excluídos exclusivamente da análise axe. Eles redirecionam foco como parte do comportamento Fluent; os controles da aplicação continuam analisados. O fluxo real de teclado é testado separadamente. Nenhuma regra axe inteira é desabilitada.
- No ambiente Windows desta implementação, o software de segurança injeta um script de `me.kis.v2.scr.kaspersky-labs.com`. Esse endereço continua bloqueado no teste de rede e é separado da contagem de dependências da aplicação. A aplicação não declara nem carrega esse recurso por iniciativa própria.

Ainda é necessária uma avaliação manual com leitor de tela nos fluxos de consulta. Ampliação real do navegador a 200%/400%, ajuste de espaçamento de texto e uma revisão humana completa dos estados de contraste também devem integrar a homologação de acessibilidade. Não foi solicitado tema escuro nem suporte a idiomas RTL.

Resultado do escopo: **CONFORME COM EXCEÇÕES** quanto à validação de acessibilidade manual pendente. O registro final dos comandos e resultados fica no README e na entrega.

## Registro da execução — 18/11/2026

- Node 24.19.0, npm 12.0.2 e Microsoft Edge no Windows.
- `npm run build`, `npm run typecheck`, `npm run format:check` e `npm run check:assets`: aprovados.
- `npm run test:e2e`: 5 testes aprovados, com API isolada, inclusive refluxo a 320 px, espaçamento de texto aumentado, rolagem por teclado e larguras intermediárias de 641/768/1024 px.
- Inspeção adicional nas três páginas com a API local: HTTP 200, conteúdo real, fonte local carregada e ausência de erros de hidratação. A análise axe das três composições não encontrou violações no escopo configurado, com a exclusão dos sentinelas Tabster descrita acima.
- Inspeção visual em desktop, 390 px, gaveta móvel, cores forçadas e 320 px com espaçamento ampliado. A largura mínima das tabelas evita sobreposição de células, mantendo a rolagem dentro da região de dados.
- Servidor de desenvolvimento: resposta HTTP 200 com conteúdo e estilos Griffel no HTML inicial.
