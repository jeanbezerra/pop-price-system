# pop-price-system-web

Aplicação React com Next.js App Router e SSR para consulta do catálogo de preços e das estimativas do `pop-price-system-service`. O layout utiliza Fluent UI React v9 e as orientações oficiais do Fluent 2.

## Planejamento de componentes de arquitetura

Os [requisitos de gestão de componentes e entrega por fases](../pop-price-system-service/docs/REQUISITOS_COMPONENTES_ARQUITETURA.md) orientam a tela de cadastro, a biblioteca de ícones, a gestão de pendências e a integração com o canvas. O cadastro está implementado em `/construtor/componentes`, no menu **Construtor e avançado**. A integração visual com estruturas está descrita abaixo; o documento de requisitos mantém o escopo das demais entregas.

A listagem oferece busca, filtros e paginação. Criar e editar abre uma página dedicada com barra lateral de etapas e prévia, utilizando toda a largura disponível. Escolha Genérico, AWS, Azure ou GCP, preencha identificação e características técnicas e depois vincule um serviço cloud. Pendentes podem ser salvos sem serviço ou ícone; Genérico usa representação padrão sem vínculo cloud. A biblioteca AWS contém 810 SVGs oficiais locais e versionados. A API deve estar atualizada e o banco preparado pelo deploy consolidado em `../pop-price-system-database/deploy.sql`, que inclui `../pop-price-system-database/seeds/aws.sql`.

O [registro técnico da iconografia](docs/ICONOGRAFIA_ARQUITETURA.md) descreve os arquivos, os contratos e as verificações. Para validar o cadastro no navegador, execute `npx playwright test tests/components.spec.ts` após o build. Para preparar novamente o pacote fixado e o seed do backend, use `python scripts/import-architecture-icons.py`; esta operação é exclusiva da manutenção e não é executada no build.

## Gestão de estruturas

O grupo **Estruturas** começa em **Gestão de estruturas** (`/estruturas`). **Nova estrutura** abre um modal com nome, descrição, categoria, ambiente, horas mensais, provedor principal obrigatório e uma região por cloud utilizada. Nenhum provedor vem selecionado; as regiões são carregadas após a escolha. O modal adapta as colunas à largura disponível, com rolagem vertical e ações sempre visíveis. A especificação e o documento vazio são persistidos antes da navegação para `/canvas?model=<id>`. Abrir `/canvas` sem ID redireciona para a criação; falhas de salvamento mantêm o modal aberto. Estruturas históricas sem especificação ou sem provedor principal precisam defini-los antes de entrar no editor. A biblioteca do canvas inicia no provedor principal salvo.

O seletor de regiões permite busca por nome ou código, sem duplicar códigos na apresentação. Regiões AWS conhecidas recebem nomes em português; códigos novos permanecem disponíveis pelo catálogo. Zonas locais e outras localidades são opcionais e ficam separadas das regiões. Uma localidade já salva é exibida e preservada ao reabrir ou duplicar a estrutura. Texto livre sem escolha da lista não pode ser salvo como região.

A grid usa a largura disponível, com o logo do provedor na primeira coluna e dados distribuídos em colunas próprias. Apresenta categoria, ambiente, status, regiões, componentes, custo mensal em USD e datas no horário de São Paulo. Cabeçalhos permitem ordenação crescente ou decrescente, aplicada pelo servidor antes da paginação, com desempate pelo ID e custos desconhecidos ao final. A grade de filtros reúne busca por nome ou provedor, provedor, categoria, ambiente, status e situação, com ações de aplicar e limpar. O rodapé mostra o intervalo e total filtrado, tamanho de página (10, 20, 50 ou 100) e navegação para primeira, anterior, próxima e última página. Alterar filtros, ordenação ou tamanho retorna à primeira página; remover o último item de uma página leva à última página válida. Sem cálculo completo, o custo apresenta “A calcular”; uma previsão de revisão anterior recebe indicação explícita.

O canvas ocupa a área de trabalho até as bordas. A barra de comandos abaixo do cabeçalho separa navegação, organização, visualização, exclusão da seleção e salvamento; ações excedentes ficam em “Mais ações”. **Organizar componentes** distribui os recursos em colunas conforme suas ligações, trata ciclos e separa os componentes isolados sem sobreposição. A operação preserva propriedades e conexões, enquadra o desenho e exige salvar para persistir as posições. Estruturas publicadas ou arquivadas permitem somente visualização. A sidebar à direita reúne seções recolhíveis de propriedades, recursos da solução, componentes e ligações, dados da estrutura e, ao final, geração de estimativas. Fechar uma seção preserva os campos em edição. Em telas estreitas, a central passa para baixo do desenho.

Os componentes são adicionados por ícone ou arraste. A biblioteca oferece as clouds da especificação e recursos genéricos. O preço é configurado nas propriedades do próprio componente, sempre pelo serviço e pela região salva. Um único resultado ativo em USD é associado automaticamente; múltiplas configurações exigem escolha explícita. Componentes ainda sem vínculo de serviço podem defini-lo na própria estrutura. Posições, ícones e conexões ficam salvos no documento. Para estimar, todos os componentes precisam de tarifa e de uma PTAX sincronizada.

**Duplicar estrutura** abre o mesmo planejamento com os dados de origem. Novas regiões desvinculam tarifas, cobranças de rede e AZs afetadas, preservando desenho e consumo; a origem permanece intacta. A API rejeita tarifas de outra região, cloud ou serviço e não permite trocar as regiões de uma versão já especificada por uma atualização comum.

Promover publica uma versão reutilizável; alterações posteriores exigem uma cópia pelo catálogo de modelos. Arquivar preserva a versão e bloqueia edição e novas estimativas; desarquivar retoma a situação anterior. Excluir usa exclusão lógica e preserva desenhos, estimativas e contratos históricos. As operações verificam a revisão para detectar edições concorrentes.

Em bancos existentes com o schema `ratecard`, aplique primeiro `../pop-price-system-database/migrations/20261126_rename_application_schema.sql`, seguindo o procedimento de backup e parada do serviço descrito no projeto de banco. Depois, aplique `../pop-price-system-database/migrations/20261124_structure_lifecycle.sql` e `../pop-price-system-database/migrations/20261125_structure_specification.sql`, se pendentes. O schema padrão passa a ser `pop_price_system_service`. Novas instalações usam o deploy consolidado. Após o build, `npx playwright test tests/structure-dialog.spec.ts tests/structure-specification.spec.ts tests/structures.spec.ts tests/portal.spec.ts tests/canvas-layout.spec.ts` verifica os fluxos de planejamento, desenho, duplicação e precificação.

## Ambiente

Categoria de arquitetura utiliza uma lista pesquisável por provedor, com classificação oficial AWS, Azure e GCP e opções neutras para Genérico. A escolha filtra os ícones inicialmente; categorias anteriores são preservadas até sua revisão. O deploy consolidado carrega as categorias neutras e os seeds Azure, GCP e AWS. Consulte o registro técnico da iconografia para as origens dos metadados e os scripts de manutenção.

| Tecnologia        | Versão fixada                                             |
| ----------------- | --------------------------------------------------------- |
| Node.js           | 24 LTS; recomendada 24.22.3 em `.nvmrc` e `.node-version` |
| Next.js           | 16.4.6                                                    |
| React / React DOM | 19.3.1                                                    |
| Fluent UI React   | 9.75.2                                                    |
| Ícones Fluent     | 2.0.346                                                   |
| Griffel React     | 1.7.8                                                     |
| TypeScript        | 7.0.2                                                     |

Compatibilidade validada também com Node 24.19.0 e npm 12.0.2. `package-lock.json` fixa a árvore de dependências; utilize `npm ci` nas próximas instalações.

## Executar

Na pasta `pop-price-system-web`, com Node 24 LTS:

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Acesse `http://127.0.0.1:3000`. A instalação inicial requer acesso ao registro npm ou um cache interno previamente abastecido.

Para executar o SSR de produção:

```powershell
npm run build
npm start
```

Outra porta: `npm start -- --port 3001`. Para acesso pela rede, adicione `--hostname 0.0.0.0`.

O build gera `.next/standalone` **com** `public` e `.next/static`. Essa pasta contém o servidor e os estáticos necessários para distribuição. `npm start` carrega a configuração de ambiente da raiz e inicia esse servidor. Ao distribuir apenas o standalone, forneça as variáveis no ambiente do processo e execute `node server.js` na pasta distribuída. O `Dockerfile` prepara esse mesmo artefato com Node 24.

## Integração com o serviço

```dotenv
API_BASE_URL=http://127.0.0.1:8080/pop-price-system-service
API_TIMEOUT_MS=2000
API_DOCS_ENABLED=true
NEXT_TELEMETRY_DISABLED=1
```

`API_BASE_URL` é a URL base, incluindo o context do Spring Boot e sem `/api/v1`. As consultas acontecem no servidor Next.js com `server-only`, timeout e `cache: no-store`. Não é necessário expor a URL em `NEXT_PUBLIC_*` nem habilitar CORS para essas consultas. Em contêineres, use o DNS/endereço do backend acessível pelo contêiner web.

| Página         | Consultas GET                                            |
| -------------- | -------------------------------------------------------- |
| `/`            | Provedores, serviços, estimativas e sincronizações       |
| `/catalogo`    | `/api/v1/providers` e `/api/v1/catalog/services?size=50` |
| `/estimativas` | `/api/v1/estimates?size=50&offset=0`                     |

Esta inicialização oferece consulta e filtros locais na primeira página de até 50 registros. Indicadores com `+` sinalizam que existem outros registros; não representam o total do banco. A aplicação não executa descoberta, importações, criação, edição ou cálculo de estimativas. Essas operações continuam na API. Não há dados de demonstração nas páginas de produção.

O link de documentação direciona ao Swagger do backend configurado quando `API_DOCS_ENABLED=true`. Habilite-o apenas com backend em `dev` ou `hml`; em `prd`, mantenha `API_DOCS_ENABLED=false`. Sem a variável, os links ficam ocultos e a rota web de documentação retorna 404. O Swagger continua desabilitado pelo próprio serviço em `prd`.

Falhas da API apresentam um aviso com opção de tentar novamente e estados vazios específicos. O conteúdo já não depende de uma requisição do navegador para aparecer.

## Estáticos sem internet

- Logo oficial Porto em `public/brand`, com [registro de origem](public/brand/ASSET-SOURCES.md).
- Segoe UI do sistema, com Inter variável local como alternativa em `public/fonts`; licença OFL incluída.
- Ícones importados de `@fluentui/react-icons` e incorporados ao pacote JavaScript.
- CSS, JavaScript, SVG e fonte servidos pela própria aplicação. Sem CDN, Google Fonts ou `next/font/google`.
- Estilos Griffel incluídos no HTML inicial, antes da hidratação. Strict Mode permanece habilitado.

O modo offline se refere à independência de serviços externos para **estáticos**. O processo Node precisa continuar acessível; os dados exigem conexão entre o servidor web e a API. Não é uma PWA com cache de páginas para uso sem servidor. Instalação e atualização de dependências são etapas separadas do funcionamento offline dos estáticos.

## Verificações

```powershell
npm run format:check
npm run typecheck
npm run build
npm run check:assets
npm run test:e2e
```

Os testes utilizam uma API isolada nas portas 3100/3101, sem alterar o PostgreSQL. No Windows usam o Microsoft Edge instalado; em outros sistemas, instale o Chromium do Playwright com `npx playwright install chromium`.

A suíte verifica SSR com JavaScript desativado, hidratação, recursos locais com origens externas bloqueadas, filtros, navegação, teclado, gaveta móvel, refluxo e falha da API. Veja [decisões de design e limites da validação](docs/DESIGN.md).

Para formatar: `npm run format`.

## Estrutura

- `src/app`: rotas e obtenção de dados no servidor.
- `src/components`: composição Fluent, navegação, estados e tema.
- `src/lib`: contratos e cliente HTTP exclusivo do servidor.
- `public`: arquivos estáticos distribuídos com o projeto.
- `scripts`: desenvolvimento, build, servidor standalone e verificação de estáticos.
- `tests`: API de teste e verificações de comportamento no navegador.
