import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

const architectureManifest = JSON.parse(
  readFileSync(
    new URL(
      "../../public/architecture-icons/aws/2026-07-31/manifest.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const architectureIcons = architectureManifest.icons;
let unavailableCategoryProvider = "";
const externalCategories = Object.fromEntries(
  ["AZURE", "GCP"].map((provider) => [
    provider,
    JSON.parse(
      readFileSync(
        new URL(
          `../../public/architecture-icons/categories/${provider.toLowerCase()}.json`,
          import.meta.url,
        ),
        "utf8",
      ),
    ).categories,
  ]),
);
const componentCategories = (provider) =>
  provider === unavailableCategoryProvider
    ? []
    : provider === "AWS"
      ? architectureManifest.categories
      : provider === "GENERIC"
        ? [
            ["application", "Aplicações"],
            ["compute", "Computação"],
            ["storage", "Armazenamento"],
            ["database", "Banco de dados"],
            ["network", "Rede"],
            ["integration", "Integração"],
            ["observability", "Observabilidade"],
            ["security", "Segurança"],
          ].map(([code, name]) => ({
            provider,
            code,
            name,
            originalName: name,
            sourceUrl: null,
            origin: "PORTAL",
          }))
        : externalCategories[provider] || [];
let architectureComponents = [];

// TEST ONLY: deterministic API state. Never connects to the real database or cloud.
const services = [
  {
    provider: "AWS",
    code: "AmazonEC2",
    name: "Amazon Elastic Compute Cloud",
    attributes: [],
  },
  {
    provider: "AWS",
    code: "AmazonEKS",
    name: "Amazon Elastic Kubernetes Service",
    attributes: [],
  },
  {
    provider: "AWS",
    code: "AmazonS3",
    name: "Amazon Simple Storage Service",
    attributes: [],
  },
];
const rates = services.map((s, index) => ({
  id: 123 + index,
  versionId: 1,
  provider: "AWS",
  serviceCode: s.code,
  regionCode: "us-east-1",
  sku: `TEST-${s.code}`,
  family: "Compute Instance",
  attributes: {},
  usageType: "BoxUsage",
  operation: "RunInstances",
  modality: "OnDemand",
  unit: index === 2 ? "GB-Mo" : "Hrs",
  currency: "USD",
  unitPrice: 0.1,
  rangeBegin: 0,
  rangeEnd: null,
  effectiveAt: "2025-01-01T00:00:00Z",
  sourceVersion: "test",
  sourceUrl: "https://example.invalid/test-only",
  active: true,
}));
let available = true,
  priceReady = true,
  quotes = [],
  models = [],
  valuations = [],
  contracts = [],
  synchronizations = [],
  estimateRows = [],
  requests = [],
  failService = null,
  servicesReady = true,
  paginateServices = false,
  multiCloud = false,
  ratePages = false;
let parameters = {
  hoursPerMonth: 720,
  revision: 0,
  updatedAt: new Date().toISOString(),
};
const offsetPage = (items, url) => {
  const size = Number(url.searchParams.get("size") || 20),
    offset = Number(url.searchParams.get("offset") || 0);
  return {
    items: items.slice(offset, offset + size),
    size,
    offset,
    hasMore: items.length > offset + size,
  };
};
const server = createServer(async (request, response) => {
  const url = new URL(request.url, "http://127.0.0.1:3101");
  response.setHeader("Content-Type", "application/json");
  const send = (value, status = 200) => {
    response.statusCode = status;
    response.end(JSON.stringify(value));
  };
  const error = (detail, status = 400) =>
    send({ status, detail, correlationId: "test-correlation" }, status);
  if (url.pathname === "/health") return send({ status: "UP" });
  if (url.pathname === "/test/availability" && request.method === "POST") {
    available = url.searchParams.get("enabled") !== "false";
    return send({ available });
  }
  if (url.pathname === "/test/reset") {
    unavailableCategoryProvider = url.searchParams.get("noCategories") || "";
    architectureComponents = Array.from(
      { length: Number(url.searchParams.get("components") || 0) },
      (_, index) => ({
        id: `11111111-1111-4111-8111-${String(index).padStart(12, "0")}`,
        provider: "AWS",
        serviceCode:
          index < Number(url.searchParams.get("unlinked") || 0)
            ? null
            : "AmazonEC2",
        serviceName:
          index < Number(url.searchParams.get("unlinked") || 0)
            ? null
            : "Amazon Elastic Compute Cloud",
        name: `Componente ${String(index + 1).padStart(2, "0")}`,
        category: "Computação",
        description: "",
        status:
          index < Number(url.searchParams.get("unlinked") || 0)
            ? "PENDING"
            : "ACTIVE",
        icon: architectureIcons.find((i) => i.key === "aws.ec2"),
        revision: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    );
    available = true;
    priceReady = url.searchParams.get("prices") !== "false";
    quotes = [];
    models = [];
    valuations = [];
    contracts = [];
    synchronizations = [];
    for (
      let index = 0;
      index < Number(url.searchParams.get("history") || 0);
      index++
    ) {
      synchronizations.push({
        id: `history-${String(index).padStart(3, "0")}`,
        scope: {
          provider: "AWS",
          serviceCode: `History-${String(index + 1).padStart(2, "0")}`,
          regionCode: index % 2 ? "us-east-1" : "ca-central-1",
        },
        status: ["COMPLETED", "RUNNING", "FAILED"][index % 3],
        attempt: 1,
        startedAt: new Date(Date.UTC(2025, 0, index + 1)).toISOString(),
        finishedAt: null,
        processed: (index * 17) % 23,
        inserted: 0,
        updated: 0,
      });
    }
    estimateRows = [];
    requests = [];
    failService = url.searchParams.get("failService");
    servicesReady = url.searchParams.get("services") !== "false";
    paginateServices = url.searchParams.get("paginate") === "true";
    multiCloud = url.searchParams.get("multicloud") === "true";
    ratePages = url.searchParams.get("ratePages") === "true";
    parameters = {
      hoursPerMonth: 720,
      revision: 0,
      updatedAt: new Date().toISOString(),
    };
    return send({ reset: true });
  }
  if (url.pathname === "/test/requests") return send(requests);
  if (!available) return error("API indisponível", 503);
  let input = {};
  if (request.method !== "GET") {
    let body = "";
    for await (const chunk of request) body += chunk;
    try {
      input = body ? JSON.parse(body) : {};
    } catch {
      return error("JSON inválido");
    }
  }
  const path = url.pathname.replace("/pop-price-system-service/api/v1", "");
  requests.push({
    method: request.method,
    path,
    body: input,
    query: Object.fromEntries(url.searchParams),
  });
  if (path === "/architecture-component-providers")
    return send([
      { code: "GENERIC", name: "Genérico" },
      { code: "AWS", name: "Amazon Web Services" },
      { code: "AZURE", name: "Microsoft Azure" },
      { code: "GCP", name: "Google Cloud" },
    ]);
  if (path === "/architecture-component-categories")
    return send(componentCategories(url.searchParams.get("provider")));
  if (path === "/architecture-icons") {
    const provider = url.searchParams.get("provider"),
      query = (url.searchParams.get("query") || "").toLowerCase();
    const cursor = (i) => `${i.provider}/${i.key}/${i.release}`;
    const all = architectureIcons
      .filter(
        (i) =>
          (!provider || i.provider === provider) &&
          (!url.searchParams.get("category") ||
            i.category === url.searchParams.get("category")) &&
          `${i.name} ${i.tags}`.toLowerCase().includes(query) &&
          cursor(i) > (url.searchParams.get("after") || ""),
      )
      .sort((a, b) => cursor(a).localeCompare(cursor(b)));
    const size = Number(url.searchParams.get("size") || 24),
      items = all.slice(0, size);
    return send({
      items,
      size,
      hasMore: all.length > size,
      nextAfter: all.length > size ? cursor(items.at(-1)) : null,
    });
  }
  if (
    path === "/architecture-components" ||
    path.startsWith("/architecture-components/")
  ) {
    const id = path.split("/")[2];
    const current = architectureComponents.find(
      (c) => c.id === id && !c.deletedAt,
    );
    if (request.method === "GET") {
      if (id) return current ? send(current) : error("Componente ausente", 404);
      const all = architectureComponents
        .filter((c) => !c.deletedAt)
        .filter(
          (c) =>
            ["provider", "category", "status"].every(
              (key) =>
                !url.searchParams.get(key) ||
                c[key] === url.searchParams.get(key),
            ) &&
            (!url.searchParams.get("service") ||
              c.serviceCode === url.searchParams.get("service")) &&
            (!url.searchParams.has("linked") ||
              Boolean(c.serviceCode) ===
                (url.searchParams.get("linked") === "true")) &&
            c.name
              .toLowerCase()
              .includes((url.searchParams.get("query") || "").toLowerCase()) &&
            c.id > (url.searchParams.get("after") || ""),
        )
        .sort((a, b) => a.id.localeCompare(b.id));
      const size = Number(url.searchParams.get("size") || 20),
        items = all.slice(0, size);
      return send({
        items,
        size,
        hasMore: all.length > size,
        nextAfter: all.length > size ? items.at(-1).id : null,
      });
    }
    if (request.method === "DELETE") {
      if (!current) return error("Componente ausente", 404);
      const revision = Number(url.searchParams.get("revision"));
      if (
        !url.searchParams.has("revision") ||
        !Number.isInteger(revision) ||
        revision < 0
      )
        return error("Informe uma revisão válida.");
      if (current.revision !== revision)
        return error(
          "O componente foi alterado por outra sessão. Atualize a listagem antes de excluir.",
          409,
        );
      current.deletedAt = new Date().toISOString();
      current.updatedAt = current.deletedAt;
      current.revision++;
      response.writeHead(204);
      return response.end();
    }
    if (
      ![input.provider, input.name, input.category].every(
        (v) => typeof v === "string" && v.trim(),
      )
    )
      return error("Preencha os campos obrigatórios.");
    const icon =
      architectureIcons.find(
        (i) =>
          i.provider === input.provider &&
          i.key === input.iconKey &&
          i.release === input.iconRelease,
      ) || null;
    if (
      (input.iconKey && !icon) ||
      (input.status === "ACTIVE" &&
        input.provider !== "GENERIC" &&
        (!icon || !input.serviceCode))
    )
      return error("Selecione um ícone do mesmo provedor.", 422);
    if (id && !current) return error("Componente ausente", 404);
    if (id && current.revision !== input.revision)
      return error(
        "O componente foi alterado por outra sessão. Reabra o cadastro antes de salvar.",
        409,
      );
    const component = {
      ...input,
      serviceCode: input.serviceCode || null,
      characteristics: input.characteristics || [],
      id: id || randomUUID(),
      name: input.name.trim(),
      category: input.category.trim(),
      categoryName:
        componentCategories(input.provider).find(
          (c) => c.code === input.category,
        )?.name || input.category,
      icon,
      serviceName:
        services.find((s) => s.code === input.serviceCode)?.name ||
        input.serviceCode,
      revision: id ? current.revision + 1 : 0,
      createdAt: current?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (
      !componentCategories(input.provider).some(
        (c) => c.code === input.category,
      ) &&
      !(
        current &&
        current.provider === input.provider &&
        current.category === input.category
      )
    )
      return error("Selecione uma categoria da lista do provedor.", 422);
    architectureComponents = [
      ...architectureComponents.filter((c) => c.id !== component.id),
      component,
    ];
    return send(component);
  }
  if (path === "/providers")
    return send([
      { code: "AWS", name: "Amazon Web Services" },
      ...(multiCloud
        ? [
            { code: "AZURE", name: "Microsoft Azure" },
            { code: "GCP", name: "Google Cloud" },
          ]
        : []),
    ]);
  if (path === "/providers/AWS/regions")
    return send([
      { provider: "AWS", code: "us-east-1", name: "US East (N. Virginia)" },
    ]);
  if (path === "/providers/AWS/discovery") {
    servicesReady = true;
    return send({
      services,
      regions: url.searchParams.has("service") ? ["us-east-1"] : [],
    });
  }
  if (path === "/catalog/services") {
    const all = [
      ...services,
      ...(multiCloud
        ? [
            {
              provider: "AZURE",
              code: "VirtualMachines",
              name: "Azure Virtual Machines",
              attributes: [],
            },
            {
              provider: "GCP",
              code: "ComputeEngine",
              name: "Google Compute Engine",
              attributes: [],
            },
          ]
        : []),
    ]
      .map((item) => ({
        ...item,
        lastSynchronizedAt:
          synchronizations
            .filter(
              (audit) =>
                audit.scope.provider === item.provider &&
                audit.scope.serviceCode === item.code &&
                audit.status === "COMPLETED" &&
                audit.finishedAt,
            )
            .map((audit) => audit.finishedAt)
            .sort()
            .at(-1) || null,
      }))
      .filter(
        (item) =>
          !url.searchParams.get("provider") ||
          item.provider === url.searchParams.get("provider"),
      );
    return send({
      items: !servicesReady
        ? []
        : !paginateServices
          ? all
          : url.searchParams.get("after")
            ? all.slice(2)
            : all.slice(0, 2),
      size: 200,
      hasMore:
        servicesReady && paginateServices && !url.searchParams.get("after"),
      nextAfter:
        servicesReady && paginateServices && !url.searchParams.get("after")
          ? "AWS/AmazonEKS"
          : null,
    });
  }
  if (path === "/catalog/rates") {
    const allRates = [
      ...rates,
      ...(ratePages
        ? Array.from({ length: 55 }, (_, index) => ({
            ...rates[1],
            id: 1000 + index,
            regionCode: "ca-central-1",
            usageType: `Cost tier ${index}`,
            unitPrice: 0.000000123456,
            rangeBegin: 10,
            rangeEnd: 100,
            attributes: { instanceType: "test-instance" },
          }))
        : []),
    ];
    const selected = priceReady
      ? allRates.filter(
          (r) =>
            (!url.searchParams.get("provider") ||
              r.provider === url.searchParams.get("provider")) &&
            (!url.searchParams.get("service") ||
              r.serviceCode === url.searchParams.get("service")) &&
            (!url.searchParams.get("region") ||
              r.regionCode === url.searchParams.get("region")) &&
            r.id > Number(url.searchParams.get("afterId") || 0),
        )
      : [];
    const size = Number(url.searchParams.get("size") || 50);
    const items = selected.slice(0, size);
    return send({
      items,
      size,
      hasMore: selected.length > size,
      nextAfterId: selected.length > size ? items.at(-1).id : null,
    });
  }
  if (path.startsWith("/catalog/rates/"))
    return send(
      rates.find((r) => r.id === Number(path.split("/").pop())) || {},
      200,
    );
  if (path === "/synchronizations" && request.method === "POST") {
    const failed = input.serviceCode === failService;
    if (failed) failService = null;
    else priceReady = true;
    const audit = {
      id: randomUUID(),
      scope: input,
      status: failed ? "FAILED" : "COMPLETED",
      attempt: 1,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      processed: failed ? 0 : 3,
      inserted: failed ? 0 : 3,
      updated: 0,
    };
    synchronizations.unshift(audit);
    return send(audit);
  }
  if (path === "/synchronizations") {
    const key = url.searchParams.get("sortBy") || "startedAt";
    const multiplier = url.searchParams.get("direction") === "asc" ? 1 : -1;
    const value = (item) =>
      key === "serviceCode" || key === "regionCode"
        ? item.scope[key]
        : key === "status"
          ? { COMPLETED: 0, RUNNING: 1, FAILED: 2 }[item.status]
          : key === "processed"
            ? item.processed
            : item.startedAt;
    const ordered = [...synchronizations].sort((a, b) => {
      const left = value(a),
        right = value(b);
      return (
        (left < right ? -1 : left > right ? 1 : 0) * multiplier ||
        b.startedAt.localeCompare(a.startedAt) ||
        a.id.localeCompare(b.id)
      );
    });
    return send(offsetPage(ordered, url));
  }
  if (path === "/exchange-rates/synchronize") {
    const quote = {
      id: randomUUID(),
      quotationDate: "2025-01-10",
      quotationAt: "2025-01-10T16:00:00Z",
      buyRate: 5.4311,
      sellRate: 5.4321,
      source: "BCB_PTAX",
      bulletin: "Fechamento",
      sourceUrl:
        "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/",
      synchronizedAt: new Date().toISOString(),
    };
    quotes.unshift(quote);
    return send(quote);
  }
  if (path === "/exchange-rates") return send(quotes);
  if (path === "/parameters") {
    if (request.method === "PUT") {
      if (input.revision !== parameters.revision)
        return error("Parâmetros alterados por outra sessão.", 409);
      parameters = {
        ...input,
        revision: parameters.revision + 1,
        updatedAt: new Date().toISOString(),
      };
    }
    return send(parameters);
  }
  if (path === "/architecture-models" && request.method === "POST") {
    const now = new Date().toISOString();
    const model = {
      ...input,
      id: randomUUID(),
      status: "DRAFT",
      revision: 0,
      createdAt: now,
      updatedAt: now,
      publishedAt: null,
    };
    models.unshift(model);
    return send(model);
  }
  if (path === "/architecture-models") {
    const status = url.searchParams.get("status");
    return send(
      offsetPage(
        models.filter((m) => !status || m.status === status),
        url,
      ),
    );
  }
  if (path.startsWith("/architecture-models/")) {
    const [, , id, operation] = path.split("/");
    const model = models.find((m) => m.id === id);
    if (!model) return error("Modelo inexistente.", 404);
    if (request.method === "GET") return send(model);
    if (operation === "duplicate") {
      const copy = {
        ...structuredClone(model),
        id: randomUUID(),
        name: model.name + " (cópia)",
        status: "DRAFT",
        revision: 0,
        publishedAt: null,
      };
      models.unshift(copy);
      return send(copy);
    }
    if (request.method === "PUT") {
      if (model.status !== "DRAFT" || model.revision !== input.revision)
        return error("O modelo mudou ou está publicado.", 409);
      Object.assign(model, input, {
        revision: model.revision + 1,
        updatedAt: new Date().toISOString(),
      });
      return send(model);
    }
    if (operation === "publish") {
      if (!model.graph.nodes.length) return error("Adicione componentes.", 422);
      if (model.status !== "DRAFT" || model.revision !== input.revision)
        return error("Modelo desatualizado.", 409);
      Object.assign(model, {
        status: "PUBLISHED",
        revision: model.revision + 1,
        publishedAt: new Date().toISOString(),
      });
      return send(model);
    }
    if (operation === "estimates") {
      const quote = quotes.find((q) => q.id === input.quoteId);
      if (!quote) return error("Cotação inexistente.", 404);
      const estimateId = randomUUID();
      const monthly = model.graph.nodes.reduce(
        (sum, node) =>
          sum +
          Number(node.quantity) *
            Number(node.consumption) *
            0.1 *
            model.hoursPerMonth,
        0,
      );
      const complete = model.graph.edges.every((e) => {
        const a = model.graph.nodes.find((n) => n.id === e.source),
          b = model.graph.nodes.find((n) => n.id === e.target);
        return a.availabilityZone && a.availabilityZone === b.availabilityZone;
      });
      const usd = {
        calculationId: randomUUID(),
        estimateId,
        name: input.name,
        revision: model.revision,
        complete,
        currency: "USD",
        hoursPerMonth: model.hoursPerMonth,
        hourlyCost: complete ? monthly / model.hoursPerMonth : null,
        monthlyCost: complete ? monthly : null,
        annualCost: complete ? monthly * 12 : null,
        knownMonthlySubtotal: monthly,
        networkMonthlySubtotal: 0,
        items: model.graph.nodes.map((n) => ({
          component: { id: randomUUID(), name: n.name, category: n.category },
          status: "PRICED",
          monthlyCost:
            Number(n.quantity) *
            Number(n.consumption) *
            0.1 *
            model.hoursPerMonth,
          warning: null,
        })),
        warnings: complete ? [] : ["Revise as AZs e tarifas de rede"],
      };
      const value = {
        id: randomUUID(),
        estimateId,
        modelId: model.id,
        modelRevision: model.revision,
        usd,
        exchangeQuote: quote,
        brl: {
          currency: "BRL",
          hourlyCost: complete
            ? Number((usd.hourlyCost * quote.sellRate).toFixed(2))
            : null,
          monthlyCost: complete
            ? Number((monthly * quote.sellRate).toFixed(2))
            : null,
          annualCost: complete
            ? Number((monthly * 12 * quote.sellRate).toFixed(2))
            : null,
          knownMonthlySubtotal: Number((monthly * quote.sellRate).toFixed(2)),
          rounding: "HALF_UP",
        },
        createdAt: new Date().toISOString(),
      };
      valuations.unshift(value);
      estimateRows.unshift({
        id: estimateId,
        name: input.name,
        hoursPerMonth: model.hoursPerMonth,
        currency: "USD",
        revision: 0,
      });
      return send(value);
    }
  }
  if (path === "/valuations") return send(offsetPage(valuations, url));
  if (path.startsWith("/valuations/")) {
    const value = valuations.find((v) => v.id === path.split("/").pop());
    return value ? send(value) : error("Conversão inexistente", 404);
  }
  if (path === "/estimates") return send(offsetPage(estimateRows, url));
  if (path === "/contracts" && request.method === "POST") {
    const value = valuations.find((v) => v.id === input.valuationId);
    if (!value?.usd.complete)
      return error("A estimativa tem custos pendentes.", 422);
    if (contracts.some((c) => c.reference === input.reference))
      return error("Referência duplicada.", 409);
    const contract = {
      ...input,
      id: randomUUID(),
      estimateId: value.estimateId,
      valuation: value,
      monthlyUsd: value.usd.monthlyCost,
      monthlyBrl: value.brl.monthlyCost,
      totalBrl: Number((value.brl.monthlyCost * input.months).toFixed(2)),
      createdAt: new Date().toISOString(),
    };
    contracts.unshift(contract);
    return send(contract);
  }
  if (path === "/contracts") return send(offsetPage(contracts, url));
  return error("Endpoint de teste não encontrado: " + path, 404);
});
server.listen(3101, "127.0.0.1");
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.close(() => process.exit(0)));
