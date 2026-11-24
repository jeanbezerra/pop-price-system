"""Local PostgreSQL checks. Credentials stay in child-process environment, never arguments/output."""
from pathlib import Path
from urllib.parse import urlparse
import datetime
import json
import os
import re
import shutil
import subprocess
import sys
import uuid
import yaml

DATABASE_ROOT = Path(__file__).resolve().parents[1]
SERVICE_ROOT = DATABASE_ROOT.parent / "pop-price-system-service"
config = next(yaml.safe_load_all((SERVICE_ROOT / "src/main/resources/application.yml").read_text(encoding="utf-8")))
ds = config["spring"]["datasource"]

def resolve(value):
    match = re.fullmatch(r"\$\{([^:}]+)(?::(.*))?\}", str(value))
    return os.environ.get(match[1], match[2] or "") if match else str(value)

url = urlparse(resolve(ds["url"]).removeprefix("jdbc:"))
if url.hostname not in ("localhost", "127.0.0.1", "::1"):
    raise SystemExit("Este utilitário é limitado ao PostgreSQL local. Nenhum banco remoto foi alterado.")
env = dict(os.environ, PGHOST=url.hostname, PGPORT=str(url.port or 5432), PGDATABASE=url.path.lstrip("/"),
           PGUSER=resolve(ds["username"]), PGPASSWORD=resolve(ds["password"]), PGCONNECT_TIMEOUT="5")
pg_bin = Path("C:/Program Files/PostgreSQL/18/bin")

def executable(name):
    return shutil.which(name) or str(pg_bin / (name + ".exe"))

def run_pg(name, *args, capture=False):
    return subprocess.run([executable(name), *args], env=env, cwd=DATABASE_ROOT, check=True,
                          text=True, encoding="utf-8", stdout=subprocess.PIPE if capture else None).stdout

def inspect():
    statement = "SELECT json_build_object('version',version(),'version_num',current_setting('server_version_num'),'database',current_database(),'role',current_user,'tables',(SELECT count(*) FROM pg_tables WHERE schemaname='ratecard'))"
    print(run_pg("psql", "-X", "-v", "ON_ERROR_STOP=1", "-Atc", statement, capture=True).strip(), flush=True)

mode = sys.argv[1] if len(sys.argv) > 1 else "inspect"
inspect()
if mode == "verify-deploy":
    from deploy_checks import verify_deploy
    verify_deploy(DATABASE_ROOT, env, run_pg, executable)
elif mode == "verify":
    db = "pop_portal_rf_test_" + datetime.datetime.now().strftime("%Y%m%d_%H%M%S_") + uuid.uuid4().hex[:6]
    run_pg("createdb", "--maintenance-db", env["PGDATABASE"], db)
    env["PGDATABASE"] = db
    print("Banco isolado criado: " + db, flush=True)
    for script in ("deploy.sql", "validation/sql/portal_catalog.sql"):
        run_pg("psql", "-X", "-q", "-v", "ON_ERROR_STOP=1", "-f", script)
    inspect()
    env.update(PORTAL_TEST_DATABASE_URL=f"jdbc:postgresql://{url.hostname}:{url.port or 5432}/{db}",
               PORTAL_TEST_DATABASE_USER=env["PGUSER"], PORTAL_TEST_DATABASE_PASSWORD=env["PGPASSWORD"])
    subprocess.run([shutil.which("mvn") or str(SERVICE_ROOT / "mvnw.cmd"), "-q", "-Dtest=PortalWorkflowTest", "test"],
                   env=env, cwd=SERVICE_ROOT, check=True)
    print("Integração aprovada no banco isolado. O banco foi preservado para inspeção: " + db, flush=True)
elif mode == "verify-components":
    db = "pop_components_test_" + datetime.datetime.now().strftime("%Y%m%d_%H%M%S_") + uuid.uuid4().hex[:6]
    run_pg("createdb", "--maintenance-db", env["PGDATABASE"], db)
    env["PGDATABASE"] = db
    print("Banco isolado criado: " + db, flush=True)
    run_pg("psql", "-X", "-q", "-v", "ON_ERROR_STOP=1", "-f", "deploy.sql")
    env.update(COMPONENT_TEST_DATABASE_URL=f"jdbc:postgresql://{url.hostname}:{url.port or 5432}/{db}",
               COMPONENT_TEST_DATABASE_USER=env["PGUSER"], COMPONENT_TEST_DATABASE_PASSWORD=env["PGPASSWORD"])
    subprocess.run([shutil.which("mvn") or str(SERVICE_ROOT / "mvnw.cmd"), "-q", "-Dtest=ComponentServiceTest,ComponentWorkflowTest", "test"], env=env, cwd=SERVICE_ROOT, check=True)
    print("Cadastro e reinício verificados. Banco isolado preservado: " + db, flush=True)
elif mode in ("import-aws-components-local", "verify-aws-components"):
    if mode == "verify-aws-components":
        db = "pop_aws_import_test_" + datetime.datetime.now().strftime("%Y%m%d_%H%M%S_") + uuid.uuid4().hex[:6]
        run_pg("createdb", "--maintenance-db", env["PGDATABASE"], db)
        env["PGDATABASE"] = db
        run_pg("psql", "-X", "-q", "-v", "ON_ERROR_STOP=1", "-f", "deploy.sql")
        run_pg("psql", "-X", "-q", "-v", "ON_ERROR_STOP=1", "-c", "INSERT INTO ratecard.cloud_service(provider,code,name) VALUES ('AWS','AmazonS3','Amazon S3') ON CONFLICT DO NOTHING; DELETE FROM ratecard.architecture_component WHERE icon_key='aws.s3'; UPDATE ratecard.architecture_component SET name='Customized EC2',category='Legacy',revision=9,deleted_at=now() WHERE icon_key='aws.ec2'; INSERT INTO ratecard.architecture_component(id,provider,name,category,status,icon_key,icon_release,characteristics) VALUES ('00000000-0000-4000-8000-000000000001','AWS','Custom S3','Legacy','PENDING','aws.s3','2026-07-31','[{\"name\":\"Purpose\",\"value\":\"Internal\"}]');")
    else:
        backup = DATABASE_ROOT / "target" / ("components_before_aws_import_" + datetime.datetime.now().strftime("%Y%m%d_%H%M%S") + ".dump")
        backup.parent.mkdir(parents=True, exist_ok=True)
        run_pg("pg_dump", "--format=custom", "--schema=ratecard", "--no-owner", "--file", str(backup))
        print("Backup local completo: " + str(backup), flush=True)
    snapshot_query = "SELECT COALESCE(json_agg(c ORDER BY id),'[]')::text FROM ratecard.architecture_component c"
    before = json.loads(run_pg("psql", "-X", "-Atc", snapshot_query, capture=True))
    for _ in range(2):
        run_pg("psql", "-X", "-q", "-1", "-v", "ON_ERROR_STOP=1", "-f", "seeds/aws.sql")
        after = json.loads(run_pg("psql", "-X", "-Atc", snapshot_query, capture=True))
        by_id = {row["id"]: row for row in after}
        assert all(by_id.get(row["id"]) == row for row in before), "Existing components were modified"
        if _ == 0:
            imported = after
        else:
            assert imported == after, "Repeated import changed component data"
    print(run_pg("psql", "-X", "-Atc", "SELECT json_build_object('icons',(SELECT count(*) FROM ratecard.architecture_icon WHERE provider='AWS'),'categories',(SELECT count(*) FROM ratecard.architecture_component_category WHERE provider='AWS'),'components',count(*),'linked',count(service_code),'unlinked',count(*) FILTER (WHERE service_code IS NULL)) FROM ratecard.architecture_component WHERE provider='AWS'", capture=True).strip(), flush=True)
    if mode == "verify-aws-components":
        assert len(imported) == 770, "Missing or duplicated imported definitions"
        assert sum(row["name"] == "Customized EC2" and row["revision"] == 9 and row["service_code"] is None and row["deleted_at"] is not None for row in imported) == 1
        assert sum(row["icon_key"] == "aws.s3" and row["service_code"] == "AmazonS3" for row in imported) == 1
        assert sum(row["name"] == "Custom S3" and row["characteristics"] == [{"name":"Purpose","value":"Internal"}] for row in imported) == 1
        print("Importação repetida e personalização preservadas no banco isolado: " + db, flush=True)
    else:
        print("Importação concluída, repetibilidade verificada e cadastros anteriores preservados.", flush=True)
elif mode != "inspect":
    raise SystemExit("Modo inválido: inspect, verify-deploy, verify, verify-components, verify-aws-components ou import-aws-components-local. O deploy consolidado é exclusivo para bancos vazios.")
