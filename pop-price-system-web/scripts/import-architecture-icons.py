"""Prepare a pinned official AWS release. Maintenance only; no runtime download."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import re
import urllib.request
import uuid
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parent.parent
RELEASE = "2026-07-31"
URL = "https://d1.awsstatic.com/onedam/marketing-channels/website/public/shared/architecture-icon-release/Icon-package_07312026.5846e92413caa21490223536cc97f1269e44fa92.zip"
PACKAGE_HASH = "d2d166c453526471749d520e0db022c459abef759d2946cf2dd1d1c992dc6526"
SELECTION = [
    ("ec2", "Amazon EC2", "Arch_Amazon-EC2_64.svg", "AmazonEC2 compute servidor"),
    ("s3", "Amazon S3", "Arch_Amazon-Simple-Storage-Service_64.svg", "AmazonS3 storage objetos bucket"),
    ("eks", "Amazon EKS", "Arch_Amazon-Elastic-Kubernetes-Service_64.svg", "AmazonEKS containers kubernetes"),
    ("cloudwatch", "Amazon CloudWatch", "Arch_Amazon-CloudWatch_64.svg", "AmazonCloudWatch logs metricas alarmes"),
    ("lambda", "AWS Lambda", "Arch_AWS-Lambda_64.svg", "AWSLambda serverless funcoes"),
    ("rds", "Amazon RDS", "Arch_Amazon-RDS_64.svg", "AmazonRDS database relacional"),
    ("vpc", "Amazon VPC", "Arch_Amazon-Virtual-Private-Cloud_64.svg", "AmazonVPC networking rede"),
]
CATEGORY_LABELS = {
    "Analytics": "Análise de dados", "Application-Integration": "Integração de aplicações",
    "Artificial-Intelligence": "Inteligência artificial", "Blockchain": "Blockchain",
    "Business-Applications": "Aplicações de negócio", "Cloud-Financial-Management": "Gestão financeira cloud",
    "Compute": "Computação", "Containers": "Contêineres", "Customer-Enablement": "Habilitação de clientes",
    "Databases": "Bancos de dados", "Developer-Tools": "Ferramentas de desenvolvimento",
    "End-User-Computing": "Computação para usuário final", "Front-End-Web-Mobile": "Front-end, web e dispositivos móveis",
    "Games": "Jogos", "General-Icons": "Ícones gerais", "Internet-of-Things": "Internet das coisas",
    "Management-Tools": "Ferramentas de gerenciamento", "Media-Services": "Serviços de mídia",
    "Migration-Modernization": "Migração e modernização", "Networking-Content-Delivery": "Redes e entrega de conteúdo",
    "Quantum-Technologies": "Tecnologias quânticas", "Satellite": "Satélite",
    "Security-Identity": "Segurança e identidade", "Storage": "Armazenamento",
    "Customer-Experience": "Experiência do cliente", "Multicloud-and-Hybrid": "Multicloud e híbrido",
    "Serverless": "Sem servidor",
}

RESOURCE_CATEGORIES = {"IoT": "Internet-of-Things", "Management-Governance": "Management-Tools"}
SERVICE_CANONICAL_CATEGORIES = {"AWS-Compute-Optimizer": "Compute", "Amazon-Kinesis-Video-Streams": "Analytics"}


def canonical_sources(paths):
    """One original SVG per symbol: 64px services/categories, 48px resources, light variants."""
    selected = {}
    for source in sorted(paths):
        filename = source.rsplit("/", 1)[-1]
        if source.startswith("Architecture-Service-Icons_") and filename.endswith("_64.svg"):
            kind, stem = "SERVICE", filename.removeprefix("Arch_").removesuffix("_64.svg")
            category = source.split("/")[1].removeprefix("Arch_")
        elif source.startswith("Resource-Icons_") and re.search(r"_48(?:_Light)?\.svg$", filename):
            kind, stem = "RESOURCE", re.sub(r"_48(?:_Light)?\.svg$", "", filename.removeprefix("Res_"))
            folder = source.split("/")[1].removeprefix("Res_")
            category = RESOURCE_CATEGORIES.get(folder, folder)
        elif source.startswith("Category-Icons_") and filename.endswith("_64.svg"):
            kind, stem = "CATEGORY", filename.removeprefix("Arch-Category_").removesuffix("_64.svg")
            category = stem
        elif source.startswith("Architecture-Group-Icons_") and filename.endswith("_32.svg"):
            kind, stem = "GROUP", filename.removesuffix("_32.svg")
            category = "General-Icons"
        else:
            continue
        identity = (kind, stem, category)
        if identity in selected:
            raise SystemExit(f"Símbolo canônico duplicado: {identity}")
        selected[identity] = (source, category)
    return selected

def literal(value):
    return "'" + value.replace("'", "''") + "'"

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--zip", type=Path, help="Use an already downloaded official ZIP")
    parser.add_argument("--seed-output", type=Path, default=ROOT.parent / "pop-price-system-database/seeds/aws.sql", help="Consolidated AWS categories, icons and components seed")
    args = parser.parse_args()
    if args.zip:
        package = args.zip.read_bytes()
    else:
        with urllib.request.urlopen(URL, timeout=60) as response:
            package = response.read()
    if hashlib.sha256(package).hexdigest() != PACKAGE_HASH:
        raise SystemExit("O pacote não corresponde à versão fixada. Revise a origem antes de atualizar.")
    prepared = []
    with zipfile.ZipFile(io.BytesIO(package)) as archive:
        sources = canonical_sources(archive.namelist())
        category_codes = sorted({category for _, category in sources.values()})
        categories = [dict(provider="AWS", code=code, name=CATEGORY_LABELS.get(code, code), originalName=code,
                           sourceUrl=URL, release=RELEASE, origin="PROVIDER") for code in category_codes]
        legacy = {filename: (key, name, tags) for key, name, filename, tags in SELECTION}
        mappings = json.loads((ROOT / "scripts/aws-service-mappings.json").read_text(encoding="utf-8"))
        source_filenames = {source.rsplit("/", 1)[-1] for source, _ in sources.values()}
        if set(mappings) - source_filenames:
            raise SystemExit("Mapeamento referencia ícone ausente no pacote fixado.")
        keys = set()
        for (kind, stem, category), (source, _) in sorted(sources.items()):
            filename = source.rsplit("/", 1)[-1]
            if filename in legacy:
                key, name, tags = legacy[filename]
            else:
                key = kind.lower() + "-" + re.sub(r"[^a-z0-9]+", "-", stem.lower()).strip("-")
                if kind == "SERVICE" and stem in SERVICE_CANONICAL_CATEGORIES:
                    key += "-" + category.lower()
                name = stem.replace("_", " · ").replace("-", " ")
                tags = f"{stem} {kind.lower()} {category} {CATEGORY_LABELS[category]}"
            if key in keys or not 1 <= len(name) <= 200:
                raise SystemExit(f"Identidade duplicada ou nome inválido: {source}")
            keys.add(key)
            service_code = mappings.get(filename) if kind == "SERVICE" else None
            tags += " " + (service_code or "")
            data = archive.read(source)
            svg = data.decode("utf-8-sig")
            if not ET.fromstring(svg).tag.endswith("svg") or re.search(r'<(?:script|foreignObject)\b|\bon\w+=|(?:href|src)=[\"\x27](?:https?:)?//', svg, re.I):
                raise SystemExit(f"SVG requer revisão: {source}")
            relative = f"/architecture-icons/aws/{RELEASE}/{key}.svg"
            target = ROOT / "public" / relative.lstrip("/")
            if target.exists() and target.read_bytes() != data:
                raise SystemExit(f"Uma versão publicada não pode ser sobrescrita: {target}")
            register_component = kind in ("SERVICE", "RESOURCE") and (kind != "SERVICE" or category == SERVICE_CANONICAL_CATEGORIES.get(stem, category))
            prepared.append((target, data, dict(provider="AWS", key="aws." + key, release=RELEASE, name=name, kind=kind, category=category, tags=tags.strip(), assetPath=relative, sourcePath=source, sha256=hashlib.sha256(data).hexdigest(), serviceCode=service_code, registerComponent=register_component)))
    manifest = dict(schemaVersion=1, provider="AWS", release=RELEASE, sourceUrl=URL, packageSha256=PACKAGE_HASH, categories=categories, icons=[entry for _, _, entry in prepared])
    for target, data, _ in prepared:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    manifest_path = ROOT / f"public/architecture-icons/aws/{RELEASE}/manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    statements = ["-- Generated from the pinned AWS manifest by scripts/import-architecture-icons.py."]
    for _, _, icon in prepared:
        values = [icon[k] for k in ("provider", "key", "release", "name", "kind", "category", "tags", "assetPath", "sourcePath", "sha256")] + [URL, PACKAGE_HASH]
        statements.append("INSERT INTO pop_price_system_service.architecture_icon(provider,icon_key,release,name,kind,category,tags,asset_path,source_path,sha256,source_url,package_sha256) VALUES (" + ",".join(map(literal, values)) + ") ON CONFLICT (provider,icon_key,release) DO NOTHING;")
    category_statements = ["-- Generated from official AWS service directories and category symbols; labels are portal translations."]
    for entry in categories:
        values = [entry[k] for k in ("provider","code","name","originalName","sourceUrl","release","origin")]
        category_statements.append("INSERT INTO pop_price_system_service.architecture_component_category(provider,code,name,original_name,source_url,release,origin) VALUES (" + ",".join(map(literal, values)) + ") ON CONFLICT (provider,code) DO NOTHING;")
    component_values = []
    for _, _, icon in prepared:
        if not icon["registerComponent"]:
            continue
        component_id = str(uuid.uuid5(uuid.NAMESPACE_URL, "urn:pop-price-system:architecture-component:AWS:" + icon["key"]))
        service = literal(icon["serviceCode"]) if icon["serviceCode"] else "NULL"
        component_values.append("(" + ",".join([literal(component_id), literal(icon["key"]), service]) + ")")
    components_sql = """-- Generated official definitions. Stable UUIDs exclude release, name and editable icon reference.
-- Never overwrite user edits. A price-service link requires an explicit mapping AND an existing catalog row.
INSERT INTO pop_price_system_service.architecture_component(id,provider,service_code,name,category,status,icon_key,icon_release)
SELECT CAST(v.id AS uuid),i.provider,s.code,i.name,i.category,'PENDING',i.icon_key,i.release
FROM (VALUES
""" + ",\n".join(component_values) + "\n) AS v(id,icon_key,service_code)\nJOIN pop_price_system_service.architecture_icon i ON i.provider='AWS' AND i.icon_key=v.icon_key AND i.release=" + literal(RELEASE) + "\nLEFT JOIN pop_price_system_service.cloud_service s ON s.provider=i.provider AND s.code=v.service_code\nON CONFLICT (id) DO NOTHING;\n"
    normalize_categories_sql = """-- Correct sample icon labels to the category identity from the official source directory.
UPDATE pop_price_system_service.architecture_icon i SET category=c.code
  FROM pop_price_system_service.architecture_component_category c
 WHERE c.provider=i.provider AND c.provider='AWS' AND c.origin='PROVIDER'
   AND c.original_name=replace(split_part(i.source_path,'/',2),'Arch_','')
   AND i.category IS DISTINCT FROM c.code;
"""
    args.seed_output.parent.mkdir(parents=True, exist_ok=True)
    args.seed_output.write_text("\n".join(category_statements) + "\n\n" + "\n".join(statements) + "\n\n" + normalize_categories_sql + "\n" + components_sql, encoding="utf-8", newline="\n")
    print(f"{len(prepared)} ícones, {len(categories)} categorias e {len(component_values)} componentes preparados; manifesto e seed AWS consolidado gerados.")

if __name__ == "__main__":
    main()
