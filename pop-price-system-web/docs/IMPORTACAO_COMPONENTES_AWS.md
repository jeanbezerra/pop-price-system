# Importação dos componentes AWS

Implementado em 20/11/2026, como ampliação da fase 1. A cobertura corresponde ao [pacote oficial AWS de 31/07/2026](https://aws.amazon.com/architecture/icons/), sem afirmar que todo produto comercial AWS tem símbolo ou tarifa disponível. A integração com o canvas e com Draw.io continua prevista para as próximas fases.

## Cobertura

| Tipo        | Ícones distribuídos | Componentes cadastrados |
| ----------- | ------------------: | ----------------------: |
| Serviço     |                 305 |                     303 |
| Recurso     |                 466 |                     466 |
| Categoria   |                  26 |                       0 |
| Agrupamento |                  13 |                       0 |
| Total       |                 810 |                     769 |

Compute Optimizer e Kinesis Video Streams têm duas representações em categorias diferentes no pacote. Os ícones são preservados, mas cada serviço recebe apenas um componente, nas categorias Compute e Analytics, respectivamente. Categoria e agrupamento continuam disponíveis como ícones sem virar serviços tarifáveis.

São utilizados SVGs originais de 64 px para serviço/categoria, 48 px para recursos e 32 px para agrupamentos. Variantes claras são selecionadas quando há temas. Arquivos auxiliares macOS, PNGs, resoluções repetidas e variantes escuras não geram duplicatas. O conteúdo dos SVGs é preservado e validado antes da distribuição.

As 27 categorias combinam as 24 pastas de serviços com Customer Experience, Multicloud and Hybrid e Serverless do diretório de categorias. IoT e Management Governance dos recursos correspondem a Internet of Things e Management Tools. Agrupamentos usam General Icons. Nomes originais são preservados; as traduções de apresentação pertencem ao portal.

## Vínculos e preservação

`scripts/aws-service-mappings.json` contém 137 correspondências explícitas revisadas entre nomes oficiais e códigos de serviço. A importação exige que o código já esteja no catálogo local. Não executa descoberta ou sincronização e não cria preços ou serviços fictícios. Recursos e demais símbolos sem correspondência ficam sem vínculo. Todos os componentes começam pendentes para revisão e podem ser editados normalmente na gestão.

Os IDs são UUIDv5 derivados da identidade do ícone, sem incluir a versão do pacote. `ON CONFLICT (id) DO NOTHING` preserva nomes, características, situação, categoria, ícone e vínculo já editados, inclusive quando o gestor deixou o vínculo vazio. Repetir a carga não duplica registros nem completa vínculos de registros existentes. Atualizações futuras do pacote exigem revisão explícita. As sete chaves iniciais e seus arquivos permanecem compatíveis.

A exclusão lógica, incluída no deploy consolidado, preserva o ID e registra `deleted_at`. Repetir a importação mantém esse registro excluído, sem recriá-lo ou restaurá-lo. O teste `verify-aws-components` também confere esse comportamento.

## Preparação e aplicação

No checkout web:

```sh
python scripts/import-architecture-icons.py
# Opcional: --zip caminho-do-pacote.zip para reutilizar o download oficial
npm run build
npm run check:assets
```

O importador confere o hash fixado do ZIP e gera manifesto, SVGs e o seed consolidado `../pop-price-system-database/seeds/aws.sql` na pasta irmã `pop-price-system-database`, com categorias, ícones e componentes nessa ordem. Pode-se escolher o destino pelo argumento `--seed-output`. A versão permanece nos metadados do seed. Azure e GCP utilizam, respectivamente, `azure.sql` e `gcp.sql`, gerados por `scripts/import-provider-categories.py`. Builds e execução da aplicação não dependem dessa pasta nem fazem downloads.

No checkout do serviço, para o PostgreSQL local configurado e com a estrutura atual de `../pop-price-system-database/deploy.sql`:

```sh
python ../pop-price-system-database/validation/portal_local.py verify-aws-components
python ../pop-price-system-database/validation/portal_local.py import-aws-components-local
```

O primeiro comando cria banco isolado. Verifica repetição, componente personalizado, características preservadas, vínculo válido e ausência de código no catálogo. O segundo salva backup completo do schema pop_price_system_service em formato custom PostgreSQL em `../pop-price-system-database/target/`, aplica `../pop-price-system-database/seeds/aws.sql` em transação e confere que os dados anteriores permanecem intactos. Não imprime credenciais. Novos bancos recebem a estrutura e a biblioteca por `../pop-price-system-database/deploy.sql`, em uma única transação. Em outros ambientes com a estrutura atual, reaplicar apenas o seed AWS após backup, com `psql -X -1 -v ON_ERROR_STOP=1 -f ../pop-price-system-database/seeds/aws.sql`, distribuindo o frontend da mesma versão antes da carga. O deploy completo é exclusivo para bancos vazios.

## Verificação

`check-assets.mjs` valida hashes, identidades, categorias, ausência de conteúdo ativo/referências externas e presença dos SVGs no standalone. `verify-components` testa HTTP, paginação, edição e persistência após reinício. Os testes Playwright de cadastro usam o manifesto completo e consultam os nomes necessários por busca, sem pressupor que todos os ícones caibam na primeira página. Nenhum teste complexo do canvas foi acrescentado.
