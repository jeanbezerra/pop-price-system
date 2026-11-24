"""Import category metadata from pinned Azure and GCP icon packages; no SVG assets are installed."""
import hashlib
import io
import json
from pathlib import Path
import re
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parent.parent
SOURCES = [
    ("AZURE", "https://arch-center.azureedge.net/icons/Azure_Public_Service_Icons_V25.zip", "f293d99252b3638557dd08ccbff9f2529083473d39b373fb2af29a7200351339", "v25"),
    ("GCP", "https://services.google.com/fh/files/misc/category-icons.zip", "e5bc3abd3527dc2500e9bff7f15870783e2c764129c49b7cd4c1b4e105345002", "e5bc3abd3527"),
]
LABELS = {
    "ai-machine-learning":"IA e aprendizado de máquina", "analytics":"Análise de dados", "data-analytics":"Análise de dados",
    "app-services":"Serviços de aplicações", "azure-ecosystem":"Ecossistema Azure", "compute":"Computação",
    "containers":"Contêineres", "databases":"Bancos de dados", "developer-tools":"Ferramentas de desenvolvimento",
    "devops":"DevOps", "general":"Geral", "hybrid-multicloud":"Híbrido e multicloud", "identity":"Identidade",
    "integration":"Integração", "integration-services":"Serviços de integração", "iot":"Internet das coisas",
    "management-governance":"Gerenciamento e governança", "management-tools":"Ferramentas de gerenciamento",
    "menu":"Menu", "migrate":"Migrar", "migration":"Migração", "mixed-reality":"Realidade mista",
    "mobile":"Dispositivos móveis", "monitor":"Monitoramento", "networking":"Redes", "new-icons":"Novos ícones",
    "other":"Outros", "security":"Segurança", "storage":"Armazenamento", "web":"Web", "web-mobile":"Web e dispositivos móveis",
    "operations":"Operações", "collaboration":"Colaboração", "observability":"Observabilidade", "media-services":"Serviços de mídia",
}

def literal(value):
    return "'" + value.replace("'", "''") + "'"

for provider, url, expected_hash, release in SOURCES:
    with urllib.request.urlopen(url, timeout=60) as response:
        package = response.read()
    if hashlib.sha256(package).hexdigest() != expected_hash:
        raise SystemExit(f"O pacote {provider} mudou. Revise a origem antes de atualizar.")
    with zipfile.ZipFile(io.BytesIO(package)) as archive:
        paths = [p for p in archive.namelist() if p.lower().endswith('.svg') and '__MACOSX' not in p]
        groups = sorted({p.split('/')[2 if provider == 'AZURE' else 1] for p in paths})
    categories = []
    for original in groups:
        code = re.sub(r'[^a-z0-9]+', '-', original.lower()).strip('-')
        categories.append(dict(provider=provider, code=code, name=LABELS.get(code,original), originalName=original,
                               sourceUrl=url, release=release, origin="PROVIDER"))
    if len({entry['code'] for entry in categories}) != len(categories):
        raise SystemExit(f"Identidades de categorias ambíguas em {provider}.")
    directory = ROOT / 'public/architecture-icons/categories'
    directory.mkdir(parents=True,exist_ok=True)
    (directory / (provider.lower()+'.json')).write_text(json.dumps(dict(provider=provider,release=release,sourceUrl=url,packageSha256=expected_hash,categories=categories),ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    statements = ["-- Generated from official package categories by scripts/import-provider-categories.py."]
    for entry in categories:
        values = [entry[key] for key in ('provider','code','name','originalName','sourceUrl','release','origin')]
        statements.append("INSERT INTO ratecard.architecture_component_category(provider,code,name,original_name,source_url,release,origin) VALUES (" + ','.join(map(literal,values)) + ") ON CONFLICT (provider,code) DO NOTHING;")
    seed = ROOT.parent / ('pop-price-system-database/seeds/'+provider.lower()+'.sql')
    seed.parent.mkdir(parents=True, exist_ok=True)
    seed.write_text('\n'.join(statements)+'\n',encoding='utf-8',newline='\n')
    print(f"{provider}: {len(categories)} categorias oficiais registradas.")
