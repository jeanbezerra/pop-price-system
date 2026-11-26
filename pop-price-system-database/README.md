# pop-price-system-database

Scripts PostgreSQL e validadores do sistema de preços. Mantenha esta pasta ao lado de `pop-price-system-service` e `pop-price-system-web`; os validadores consultam a configuração do serviço e executam os testes Java nesse projeto.

## Estrutura

- `deploy.sql`: estrutura final das 27 tabelas, constraints, índices e carga inicial, em uma única transação.
- `migrations/20261126_rename_application_schema.sql`: renomeia `ratecard` para `pop_price_system_service`, preservando dados, IDs dos objetos, sequências, referências, proprietários e permissões. Define o `search_path` padrão do banco; aceita reaplicação e rejeita a coexistência dos dois schemas. Usa timeout de lock de 5 segundos e de execução de 30 segundos.
- `seeds/`: um arquivo por provedor (`aws.sql`, `azure.sql`, `gcp.sql`).
- `migrations/20261124_structure_lifecycle.sql`: expansão aditiva para arquivamento e exclusão lógica de estruturas em instalações existentes. Execute antes de atualizar o serviço; mantém os documentos e as referências históricas. Usa transação com timeout de lock de 5 segundos e timeout de execução de 30 segundos; em contenção, pode ser reaplicado depois, sem remover dados. A reversão da aplicação pode manter as duas colunas opcionais.
- `migrations/20261125_structure_specification.sql`: adiciona a especificação regional em JSONB, com constraint de objeto. Registros anteriores mantêm `NULL` até a definição do contexto. A migração é repetível e preserva IDs e desenhos; usa os mesmos timeouts e permite reverter a aplicação mantendo a coluna opcional.
- `validation/`: validadores Python e testes de estrutura.
- `validation/sql/`: dados sintéticos usados exclusivamente em bancos isolados.

## Implantação

Requer PostgreSQL e `psql`. A estrutura foi validada no PostgreSQL 18.6. Execute a partir desta pasta, exclusivamente em um banco vazio:

```sh
psql "$DATABASE_URL_PSQL" -X -v ON_ERROR_STOP=1 -f deploy.sql
```

O script inclui os três seeds. Não cria serviços ou preços fictícios no catálogo. Para reaplicar apenas a biblioteca AWS em uma instalação com a estrutura atual:

```sh
psql "$DATABASE_URL_PSQL" -X -1 -v ON_ERROR_STOP=1 -f seeds/aws.sql
```

O schema padrão é **`pop_price_system_service`**, tanto no deploy quanto nas conexões Hikari do serviço. O nome do banco, usuário e nomes dos recursos Kubernetes são independentes do schema.

Em bancos existentes com `ratecard`, pare as instâncias da aplicação, faça backup e execute **primeiro** `migrations/20261126_rename_application_schema.sql`. Depois, se ainda necessárias, aplique as migrações de ciclo de vida e especificação de estruturas no novo schema. Reinicie com a versão atualizada do serviço. Não execute o deploy consolidado no banco existente. Para o banco local configurado, o comando abaixo salva backup completo em `target/`, aplica a renomeação e compara contagens, conteúdo, identificadores de objetos e permissões antes e depois:

```sh
python validation/portal_local.py migrate-schema-local
```

O relatório fica em `target/schema-migration-verification.json`. Para reverter apenas o nome, pare o serviço, renomeie o schema para `ratecard`, restaure o `search_path` anterior e reinicie a versão anterior da aplicação. Não é necessário copiar ou excluir tabelas.

## Validação local

Requer Python 3.10+, as ferramentas PostgreSQL (`psql`, `createdb`, `pg_dump`) e o projeto irmão `pop-price-system-service`. Os testes HTTP também requerem Java 25 e Maven ou o Maven Wrapper do serviço.

```sh
python validation/portal_local.py inspect
python validation/portal_local.py verify-deploy
python validation/portal_local.py verify
python validation/portal_local.py verify-components
python validation/portal_local.py verify-aws-components
```

Os validadores usam somente a biblioteca padrão do Python, leem o documento base de `application.properties` do serviço e respeitam `DATABASE_URL`, `DATABASE_USER` e `DATABASE_PASSWORD`. O endereço deve ser local. As verificações criam bancos isolados, preservados para inspeção; `verify-deploy` testa inclusões nas 27 tabelas, 49 inclusões inválidas, repetição dos seeds, rollback integral, migração repetida do schema e rejeição de conflitos, além do schema padrão. O relatório fica em `target/deploy-verification.json`.

`import-aws-components-local` é um comando operacional: salva um backup completo em `target/`, aplica o seed AWS no banco local configurado e confere a preservação dos cadastros. Os comandos `verify-*` usam bancos de teste.

Backups, relatórios, caches Python e configurações locais são ignorados pelo Git. Os importadores de manutenção em `pop-price-system-web/scripts/` geram os seeds nesta pasta.
