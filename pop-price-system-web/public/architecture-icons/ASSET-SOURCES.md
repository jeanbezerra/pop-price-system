# Ícones de arquitetura AWS

Origem: [AWS Architecture Icons](https://aws.amazon.com/architecture/icons/).

Pacote oficial: `Icon-package_07312026`, obtido em 20/11/2026. O manifesto em `aws/2026-07-31/manifest.json` registra URL, SHA256 do pacote, caminhos originais e hashes dos SVGs distribuídos. Os desenhos são preservados sem alterações e servidos localmente.

Os ícones e nomes dos produtos pertencem à Amazon Web Services. A página oficial permite a clientes e parceiros usar os recursos em diagramas de arquitetura. As condições e orientações de uso permanecem as publicadas pela AWS; estes arquivos não são relicenciados sob MIT ou pela licença do Devicon.

Para preparar novamente a mesma versão, execute `python scripts/import-architecture-icons.py`. A operação de manutenção também gera o seed SQL do backend; não participa do build nem da execução da aplicação. A biblioteca completa possui 810 SVGs e 769 componentes; 137 mapeamentos revisados apenas vinculam serviços presentes no catálogo. Consulte [cobertura e procedimento](../../docs/IMPORTACAO_COMPONENTES_AWS.md).

## Categorias por provedor

As 27 categorias AWS combinam as 24 pastas de `Architecture-Service-Icons/Arch_*` com as categorias adicionais de `Category-Icons` do pacote acima. A identidade e o nome originais são preservados no manifesto; os nomes em português são traduções de apresentação mantidas pelo portal.

Metadados das 29 categorias de pastas do Azure e das 26 categorias do GCP foram extraídos dos pacotes vinculados nas páginas oficiais [Azure Architecture Icons](https://learn.microsoft.com/en-us/azure/architecture/icons/) e [Google Cloud Icons](https://cloud.google.com/icons). Os arquivos `categories/azure.json` e `categories/gcp.json` registram URLs, versões, nomes originais e hashes dos pacotes. A preparação é reproduzível por `python scripts/import-provider-categories.py`, com hashes fixados. Essa importação inclui somente metadados; não distribui SVGs Azure ou GCP.

As categorias de Genérico pertencem ao portal e não são apresentadas como classificação de um provedor cloud.
