"""Data and constraint checks for the consolidated deploy; isolated databases only."""
from pathlib import Path
import datetime
import json
import re
import subprocess
import tempfile
import uuid


def verify_deploy(root, env, run_pg, executable):
    maintenance = env["PGDATABASE"]
    suffix = datetime.datetime.now().strftime("%Y%m%d_%H%M%S_") + uuid.uuid4().hex[:6]

    def create_database(label):
        env["PGDATABASE"] = maintenance
        name = "pop_deploy_" + label + "_" + suffix
        run_pg("createdb", "--maintenance-db", maintenance, name)
        env["PGDATABASE"] = name
        return name

    def query(sql):
        return run_pg("psql", "-X", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql, capture=True).strip()

    def apply(path):
        run_pg("psql", "-X", "-q", "-v", "ON_ERROR_STOP=1", "-f", str(path))

    def expect_error(label, sqlstate, *args):
        result = subprocess.run(
            [executable("psql"), "-X", "-q", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose", *args],
            env=env, cwd=root, capture_output=True, text=True, encoding="utf-8")
        if result.returncode == 0 or not re.search(r":\s+" + sqlstate + r":", result.stderr):
            raise AssertionError(f"{label}: expected SQLSTATE {sqlstate}, exit={result.returncode}\n{result.stderr}")

    database = create_database("data")
    print("Validando deploy no banco isolado: " + database, flush=True)
    apply(root / "deploy.sql")
    tables = query("SELECT tablename FROM pg_tables WHERE schemaname='ratecard' ORDER BY tablename").splitlines()
    assert len(tables) == 27, f"Unexpected tables: {tables}"

    def snapshot():
        return {table: json.loads(query(
            f"SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]') FROM ratecard.{table} r"))
            for table in tables}

    seeded = snapshot()
    assert len(seeded["architecture_icon"]) == 810
    assert len(seeded["architecture_component"]) == 769
    assert all(row["provider"] == "AWS" and row["status"] == "PENDING" and row["service_code"] is None
               for row in seeded["architecture_component"])
    categories = {provider: sum(row["provider"] == provider for row in seeded["architecture_component_category"])
                  for provider in ("AWS", "AZURE", "GCP", "GENERIC")}
    assert categories == {"AWS": 27, "AZURE": 29, "GCP": 26, "GENERIC": 8}, categories
    assert len(seeded["architecture_component_provider"]) == 4
    assert len(seeded["cloud_provider"]) == 1 and not seeded["cloud_service"]
    assert seeded["portal_parameters"][0]["hours_per_month"] == 720

    apply(Path(__file__).resolve().parent / "sql/deploy_structure.sql")
    populated = snapshot()
    assert all(populated.values()), "At least one table has no valid inserted data"
    assert query("""SELECT count(*) FROM ratecard.customer_contract c
        JOIN ratecard.estimate_valuation v ON v.id=c.valuation_id
        JOIN ratecard.architecture_estimate_calculation x ON x.id=v.calculation_id AND x.estimate_id=v.estimate_id
        JOIN ratecard.architecture_estimate e ON e.id=v.estimate_id
        JOIN ratecard.architecture_model m ON m.id=v.model_id
        JOIN ratecard.exchange_quote q ON q.id=v.quote_id
        WHERE c.reference='DEPLOY-TEST-CONTRACT' AND q.sell_rate=5.11
          AND (v.snapshot->>'totalBrl')::numeric=735.84""") == "1"
    assert query("""SELECT count(*) FROM ratecard.architecture_estimate_item i
        JOIN ratecard.architecture_data_flow f ON f.item_id=i.id
        JOIN ratecard.architecture_flow_charge c ON c.item_id=f.item_id
        JOIN ratecard.architecture_flow_hop h ON h.item_id=f.item_id
        JOIN ratecard.price_dimension d ON d.id=c.rate_id AND d.id=i.rate_id
        JOIN ratecard.price_term t ON t.id=d.term_id
        JOIN ratecard.cloud_product p ON p.id=t.product_id
        WHERE p.sku='PORTAL-TEST-SKU'""") == "1"

    def literal(value):
        if value is None:
            return "NULL"
        if isinstance(value, bool):
            return "true" if value else "false"
        if isinstance(value, (int, float)):
            return str(value)
        if isinstance(value, (dict, list)):
            value = json.dumps(value)
        return "'" + value.replace("'", "''") + "'"

    def insert(table, row):
        return f"INSERT INTO ratecard.{table}({','.join(row)}) VALUES ({','.join(literal(v) for v in row.values())})"

    cases = []

    def reject(label, table, row, sqlstate="23514"):
        cases.append((label, sqlstate, insert(table, row)))

    component = dict(id=str(uuid.uuid4()), provider="AWS", service_code=None, name="Invalid test component",
                     category="Compute", status="PENDING", icon_key=None, icon_release=None, revision=0,
                     characteristics=[])
    for label, changes, code in [
        ("unknown authoring provider", dict(provider="MISSING"), "23503"),
        ("unknown service", dict(service_code="MISSING"), "23503"),
        ("icon from another provider", dict(icon_key="test.azure", icon_release="test-v1"), "23503"),
        ("icon without release", dict(icon_key="aws.ec2"), "23514"),
        ("active cloud without service", dict(status="ACTIVE", icon_key="aws.ec2", icon_release="2026-07-31"), "23514"),
        ("active cloud without icon", dict(status="ACTIVE", service_code="AmazonEC2"), "23514"),
        ("generic with cloud link", dict(provider="GENERIC", service_code="AmazonEC2"), "23514"),
        ("invalid component status", dict(status="UNKNOWN"), "23514"),
        ("blank component name", dict(name=" "), "23514"),
        ("blank component category", dict(category=" "), "23514"),
        ("negative component revision", dict(revision=-1), "23514"),
        ("characteristics object", dict(characteristics={}), "23514"),
        ("too many characteristics", dict(characteristics=[{"name":"Test","value":"Test"}]*31), "23514"),
        ("null component name", dict(name=None), "23502"),
        ("duplicate component", dict(id="40000000-0000-4000-8000-000000000002"), "23505"),
    ]:
        reject(label, "architecture_component", component | changes, code)

    estimate = dict(id=str(uuid.uuid4()), name="Invalid estimate", hours_per_month=720, currency="USD")
    reject("zero hours", "architecture_estimate", estimate | dict(hours_per_month=0))
    reject("too many hours", "architecture_estimate", estimate | dict(hours_per_month=745))
    reject("non-USD estimate", "architecture_estimate", estimate | dict(currency="BRL"))
    reject("duplicate parameters singleton", "portal_parameters", dict(singleton=True, hours_per_month=720), "23505")
    reject("false parameters singleton", "portal_parameters", dict(singleton=False, hours_per_month=720))
    reject("invalid parameters hours", "portal_parameters", dict(singleton=True, hours_per_month=0))

    synchronization = dict(id=str(uuid.uuid4()), provider="AWS", service_code="AmazonEC2", region_code="us-east-1", status="COMPLETED")
    reject("duplicate running scope", "catalog_synchronization", synchronization | dict(status="RUNNING"), "23505")
    reject("invalid sync status", "catalog_synchronization", synchronization | dict(status="UNKNOWN"))
    reject("invalid sync attempt", "catalog_synchronization", synchronization | dict(attempt=0))
    reject("duplicate idempotency key", "catalog_synchronization", synchronization | dict(idempotency_key="deploy-test-completed"), "23505")
    reject("unknown pricing provider", "cloud_service", dict(provider="MISSING", code="test", name="Test"), "23503")
    reject("duplicate cloud service", "cloud_service", dict(provider="AWS", code="AmazonEC2", name="Test"), "23505")

    rate = populated["price_dimension"][0]
    dimension = {k: rate[k] for k in ("term_id", "currency", "unit", "description", "range_begin", "range_end", "unit_price", "effective_at", "content_hash")}
    dimension["rate_code"] = "invalid-rate"
    reject("negative price", "price_dimension", dimension | dict(unit_price=-1))
    reject("negative range", "price_dimension", dimension | dict(range_begin=-1))
    reject("inverted range", "price_dimension", dimension | dict(range_begin=10, range_end=5))
    reject("unknown price term", "price_dimension", dimension | dict(term_id=999999999), "23503")
    version = populated["price_version"][0]
    reject("duplicate current price version", "price_version", {k: version[k] for k in ("dimension_id", "source_version", "source_url", "content_hash", "snapshot", "valid_from")}, "23505")

    item = {k: populated["architecture_estimate_item"][0][k] for k in ("estimate_id", "name", "category", "account_code", "rate_id", "quantity", "consumption", "consumption_unit", "consumption_period")}
    item["id"] = str(uuid.uuid4())
    reject("zero quantity", "architecture_estimate_item", item | dict(quantity=0))
    reject("negative consumption", "architecture_estimate_item", item | dict(consumption=-1))
    reject("invalid consumption period", "architecture_estimate_item", item | dict(consumption_period="WEEK"))
    reject("unknown estimate", "architecture_estimate_item", item | dict(estimate_id=str(uuid.uuid4())), "23503")

    quote = {k: populated["exchange_quote"][0][k] for k in ("quotation_at", "quotation_date", "buy_rate", "sell_rate", "source", "bulletin", "source_url", "payload")}
    quote["id"] = str(uuid.uuid4())
    reject("invalid buy rate", "exchange_quote", quote | dict(buy_rate=0))
    reject("invalid sell rate", "exchange_quote", quote | dict(sell_rate=-1))
    reject("invalid quote source", "exchange_quote", quote | dict(source="UNKNOWN"))
    reject("invalid bulletin", "exchange_quote", quote | dict(bulletin="UNKNOWN"))
    reject("duplicate exchange quote", "exchange_quote", quote, "23505")

    model = dict(id=str(uuid.uuid4()), name="Invalid model", hours_per_month=720, graph={}, status="DRAFT")
    reject("graph array", "architecture_model", model | dict(graph=[]))
    reject("published without timestamp", "architecture_model", model | dict(status="PUBLISHED"))
    reject("draft with publication timestamp", "architecture_model", model | dict(published_at="2026-01-02T16:00:00Z"))
    reject("invalid model status", "architecture_model", model | dict(status="UNKNOWN"))
    contract = dict(id=str(uuid.uuid4()), reference="INVALID-TEST", name="Test", customer_name="Test",
                    valuation_id="30000000-0000-4000-8000-000000000003", starts_on="2026-01-02", months=12, snapshot={})
    reject("zero contract months", "customer_contract", contract | dict(months=0))
    reject("too many contract months", "customer_contract", contract | dict(months=121))
    reject("unknown valuation", "customer_contract", contract | dict(valuation_id=str(uuid.uuid4())), "23503")
    reject("duplicate contract reference", "customer_contract", contract | dict(reference="DEPLOY-TEST-CONTRACT"), "23505")

    for label, sqlstate, sql in cases:
        expect_error(label, sqlstate, "-c", sql)
    assert populated == snapshot(), "Rejected insertions changed data"
    for _ in range(2):
        for provider in ("azure", "gcp", "aws"):
            run_pg("psql", "-X", "-q", "-1", "-v", "ON_ERROR_STOP=1", "-f", f"seeds/{provider}.sql")
        assert populated == snapshot(), "Repeated seed changed existing data"
    expect_error("deploy on installed database", "42P06", "-f", str(root / "deploy.sql"))
    assert populated == snapshot(), "Repeated deploy changed existing data"

    failed_database = create_database("rollback")
    with tempfile.TemporaryDirectory(prefix="pop-deploy-rollback-") as temporary:
        failed_deploy = Path(temporary) / "deploy.sql"
        sql = (root / "deploy.sql").read_text(encoding="utf-8")
        for provider in ("azure", "gcp", "aws"):
            sql = sql.replace(f"\\ir seeds/{provider}.sql", "\\ir '" + (root / f"seeds/{provider}.sql").as_posix() + "'")
        failed_deploy.write_text(sql.replace("COMMIT;", "SELECT 1/0;\nCOMMIT;"), encoding="utf-8")
        expect_error("atomic deployment rollback", "22012", "-f", str(failed_deploy))
    assert query("SELECT count(*) FROM pg_namespace WHERE nspname='ratecard'") == "0", "Partial schema survived failed deployment"

    env["PGDATABASE"] = database
    report = dict(database=database, rollback_database=failed_database,
                  server_version=query("SELECT version()"), tables=len(tables),
                  valid_rows={table: len(rows) for table, rows in populated.items()},
                  rejected_insertions=len(cases), categories=categories, seeded_icons=810, seeded_components=769,
                  seed_repetitions=2, atomic_rollback=True, existing_database_preserved=True)
    destination = root / "target/deploy-verification.json"
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Deploy validado: {len(tables)} tabelas com dados, {len(cases)} inclusoes invalidas rejeitadas, seeds repetiveis e rollback integral.", flush=True)
    print("Relatorio: " + str(destination) + "; bancos isolados preservados para inspecao.", flush=True)
