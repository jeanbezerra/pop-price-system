# pop-price-system-web

Aplicação React com Next.js App Router e SSR para consulta do catálogo de preços e das estimativas do `pop-price-system-service`. O layout utiliza Fluent UI React v9 e as orientações oficiais do Fluent 2.

## Planejamento de componentes de arquitetura

Os [requisitos de gestão de componentes e entrega por fases](../pop-price-system-service/docs/REQUISITOS_COMPONENTES_ARQUITETURA.md) orientam a tela de cadastro, a biblioteca de ícones, a gestão de pendências e a integração com o canvas. A fase 1 está implementada em `/construtor/componentes`, no menu **Construtor e avançado**. As fases 2 e 3 permanecem pendentes.

A listagem oferece busca, filtros e paginação. Criar e editar abre uma página dedicada com barra lateral de etapas e prévia, utilizando toda a largura disponível. Escolha Genérico, AWS, Azure ou GCP, preencha identificação e características técnicas e depois vincule um serviço cloud. Pendentes podem ser salvos sem serviço ou ícone; Genérico usa representação padrão sem vínculo cloud. A biblioteca AWS contém 810 SVGs oficiais locais e versionados. A API deve estar atualizada e o banco preparado pelo deploy consolidado em `../pop-price-system-database/deploy.sql`, que inclui `../pop-price-system-database/seeds/aws.sql`.

O [registro técnico da iconografia](docs/ICONOGRAFIA_ARQUITETURA.md) descreve os arquivos, os contratos e as verificações. Para validar o cadastro no navegador, execute `npx playwright test tests/components.spec.ts` após o build. Para preparar novamente o pacote fixado e o seed do backend, use `python scripts/import-architecture-icons.py`; esta operação é exclusiva da manutenção e não é executada no build.

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
