# pop-price-system-database

Scripts PostgreSQL e validadores do sistema de preços. Mantenha esta pasta ao lado de `pop-price-system-service` e `pop-price-system-web`; os validadores consultam a configuração do serviço e executam os testes Java nesse projeto.

## Estrutura

- `deploy.sql`: estrutura final das 27 tabelas, constraints, índices e carga inicial, em uma única transação.
- `seeds/`: um arquivo por provedor (`aws.sql`, `azure.sql`, `gcp.sql`).
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

## Validação local

Requer Python 3.10+, as ferramentas PostgreSQL (`psql`, `createdb`, `pg_dump`) e o projeto irmão `pop-price-system-service`. Os testes HTTP também requerem Java 25 e Maven ou o Maven Wrapper do serviço.

```sh
python -m pip install -r requirements.txt
python validation/portal_local.py inspect
python validation/portal_local.py verify-deploy
python validation/portal_local.py verify
python validation/portal_local.py verify-components
python validation/portal_local.py verify-aws-components
```

Os validadores leem `application.yml` do serviço e respeitam `DATABASE_URL`, `DATABASE_USER` e `DATABASE_PASSWORD`. O endereço deve ser local. As verificações criam bancos isolados, preservados para inspeção; `verify-deploy` testa inclusões nas 27 tabelas, 49 inclusões inválidas, repetição dos seeds e rollback integral. O relatório fica em `target/deploy-verification.json`.

`import-aws-components-local` é um comando operacional: salva um backup completo em `target/`, aplica o seed AWS no banco local configurado e confere a preservação dos cadastros. Os comandos `verify-*` usam bancos de teste.

Backups, relatórios, caches Python e configurações locais são ignorados pelo Git. Os importadores de manutenção em `pop-price-system-web/scripts/` geram os seeds nesta pasta.
