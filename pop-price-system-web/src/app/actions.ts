"use server";

import { revalidatePath } from "next/cache";

import { apiRequest, getSynchronizations } from "@/lib/api";
import {
  getComponentCategories,
  getArchitectureComponents,
  getArchitectureIcons,
} from "@/lib/component-api";
import type {
  ArchitectureComponent,
  ComponentFilters,
  ComponentInput,
} from "@/lib/component-contracts";
import {
  getRate,
  getRates,
  getRegions,
  getServicePage,
  getModels,
  getContracts,
  getValuations,
  getStructures,
  getModel,
} from "@/lib/portal-api";
import type {
  ArchitectureModel,
  CreateContract,
  CustomerContract,
  ExchangeQuote,
  Parameters,
  SaveModel,
  Valuation,
  StructureSpecification,
  StructureQuery,
} from "@/lib/portal-contracts";
import type {
  CatalogService,
  Synchronization,
  SynchronizationHistoryQuery,
} from "@/lib/contracts";

export async function synchronizePtax(date: string) {
  return apiRequest<ExchangeQuote>("api/v1/exchange-rates/synchronize", {
    method: "POST",
    body: { date },
    timeoutMs: 40000,
  });
}

export async function loadArchitectureComponents(
  filters: ComponentFilters = {},
) {
  return getArchitectureComponents(filters);
}

export async function loadArchitectureIcons(
  provider: string,
  query = "",
  after = "",
  category = "",
) {
  return getArchitectureIcons(provider, query, after, category);
}

export async function loadComponentCategories(provider: string) {
  return getComponentCategories(provider);
}

export async function saveArchitectureComponent(
  id: string | null,
  input: ComponentInput,
) {
  const result = await apiRequest<ArchitectureComponent>(
    `api/v1/architecture-components${id ? `/${encodeURIComponent(id)}` : ""}`,
    { method: id ? "PUT" : "POST", body: input },
  );
  if (result.ok) revalidatePath("/construtor/componentes");
  return result;
}

export async function deleteArchitectureComponent(
  id: string,
  revision: number,
) {
  const result = await apiRequest<void>(
    `api/v1/architecture-components/${encodeURIComponent(id)}?revision=${encodeURIComponent(revision)}`,
    { method: "DELETE" },
  );
  if (result.ok) revalidatePath(`/construtor/componentes/${id}`);
  return result;
}
export async function discoverProvider(provider: string, service?: string) {
  return apiRequest<{
    services: Pick<CatalogService, "code" | "name" | "attributes">[];
    regions: string[];
  }>(
    `api/v1/providers/${encodeURIComponent(provider)}/discovery${service ? `?service=${encodeURIComponent(service)}` : ""}`,
    { method: "POST", timeoutMs: 180000 },
  );
}
export async function synchronizePrices(
  scope: { provider: string; serviceCode: string; regionCode: string },
  idempotencyKey: string,
) {
  return apiRequest<Synchronization>("api/v1/synchronizations", {
    method: "POST",
    body: scope,
    idempotencyKey,
    timeoutMs: 180000,
  });
}
export async function saveParameters(hoursPerMonth: number, revision: number) {
  return apiRequest<Parameters>("api/v1/parameters", {
    method: "PUT",
    body: { hoursPerMonth, revision },
  });
}
export async function searchRates(filters: {
  provider?: string;
  service?: string;
  region?: string;
  afterId?: number;
}) {
  return getRates(filters);
}
export async function loadRate(id: number) {
  return getRate(id);
}
export async function loadRegions(provider: string) {
  return getRegions(provider);
}
export async function loadServices(provider: string, after = "") {
  return getServicePage(provider, after);
}
export async function loadSynchronizationHistory(
  query: SynchronizationHistoryQuery,
) {
  return getSynchronizations(query);
}
export async function loadModels(status: string, offset: number) {
  return getModels(status, offset);
}
export async function loadStructures(query: StructureQuery = {}) {
  return getStructures(query);
}
export async function changeStructureLifecycle(
  id: string,
  revision: number,
  action: "archive" | "unarchive" | "delete",
) {
  const result = await apiRequest<ArchitectureModel | null>(
    `api/v1/architecture-models/${encodeURIComponent(id)}${action === "delete" ? `?revision=${revision}` : `/${action}`}`,
    action === "delete"
      ? { method: "DELETE" }
      : { method: "POST", body: { revision } },
  );
  if (result.ok) revalidatePath("/estruturas");
  return result;
}
export async function loadContracts(offset: number) {
  return getContracts(offset);
}
export async function loadValuations(offset: number) {
  return getValuations(offset);
}
export async function saveArchitecture(id: string | null, input: SaveModel) {
  return apiRequest<ArchitectureModel>(
    `api/v1/architecture-models${id ? `/${encodeURIComponent(id)}` : ""}`,
    { method: id ? "PUT" : "POST", body: input },
  );
}
export async function publishArchitecture(id: string, revision: number) {
  return apiRequest<ArchitectureModel>(
    `api/v1/architecture-models/${encodeURIComponent(id)}/publish`,
    { method: "POST", body: { revision } },
  );
}
export async function loadArchitecture(id: string) {
  return getModel(id);
}
export async function duplicateArchitecture(
  id: string,
  input?: {
    name: string;
    hoursPerMonth: number;
    specification: StructureSpecification;
    revision: number;
  },
) {
  return apiRequest<ArchitectureModel>(
    `api/v1/architecture-models/${encodeURIComponent(id)}/duplicate`,
    { method: "POST", ...(input ? { body: input } : {}) },
  );
}
export async function estimateArchitecture(
  id: string,
  revision: number,
  name: string,
  quoteId: string,
) {
  return apiRequest<Valuation>(
    `api/v1/architecture-models/${encodeURIComponent(id)}/estimates`,
    { method: "POST", body: { revision, name, quoteId }, timeoutMs: 30000 },
  );
}
export async function convertEstimate(id: string, quoteId: string) {
  return apiRequest<Valuation>(
    `api/v1/estimates/${encodeURIComponent(id)}/valuations`,
    { method: "POST", body: { quoteId }, timeoutMs: 30000 },
  );
}
export async function createContract(input: CreateContract) {
  return apiRequest<CustomerContract>("api/v1/contracts", {
    method: "POST",
    body: input,
  });
}
