import "server-only";
import { apiRequest } from "./api";
import type { OffsetPage, ServicePage } from "./contracts";
import type {
  ArchitectureModel,
  CatalogRate,
  CursorPage,
  CustomerContract,
  ExchangeQuote,
  ModelSummary,
  Parameters,
  Region,
  StructureQuery,
  StructurePage,
  Valuation,
} from "./portal-contracts";
export const getStructures = (filters: StructureQuery = {}) => {
  const params = new URLSearchParams({
    size: "20",
    offset: "0",
    lifecycle: "ACTIVE",
    sort: "updatedAt",
    direction: "DESC",
  });
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return apiRequest<StructurePage>(`api/v1/architecture-models?${params}`);
};

export const getQuotes = () =>
  apiRequest<ExchangeQuote[]>("api/v1/exchange-rates");
export const getParameters = () => apiRequest<Parameters>("api/v1/parameters");
export const getModels = (status = "", offset = 0) =>
  apiRequest<OffsetPage<ModelSummary>>(
    `api/v1/architecture-models?size=20&offset=${offset}${status ? `&status=${encodeURIComponent(status)}` : ""}`,
  );
export const getModel = (id: string) =>
  apiRequest<ArchitectureModel>(
    `api/v1/architecture-models/${encodeURIComponent(id)}`,
  );
export const getValuations = (offset = 0) =>
  apiRequest<OffsetPage<Valuation>>(
    `api/v1/valuations?size=20&offset=${offset}`,
  );
export const getContracts = (offset = 0) =>
  apiRequest<OffsetPage<CustomerContract>>(
    `api/v1/contracts?size=20&offset=${offset}`,
  );
export const getContract = (id: string) =>
  apiRequest<CustomerContract>(`api/v1/contracts/${encodeURIComponent(id)}`);
export const getRate = (id: number) =>
  apiRequest<CatalogRate>(`api/v1/catalog/rates/${id}`);
export const getRegions = (provider: string) =>
  apiRequest<Region[]>(
    `api/v1/providers/${encodeURIComponent(provider)}/regions`,
  );
export const getServicePage = (provider = "", after = "") =>
  apiRequest<ServicePage>(
    `api/v1/catalog/services?size=200${provider ? `&provider=${encodeURIComponent(provider)}` : ""}&after=${encodeURIComponent(after)}`,
  );
export function getRates(filters: {
  provider?: string;
  service?: string;
  region?: string;
  afterId?: number;
}) {
  const query = new URLSearchParams({
    size: "50",
    modality: "OnDemand",
    active: "true",
  });
  for (const [key, value] of Object.entries(filters))
    if (value !== undefined && value !== "") query.set(key, String(value));
  return apiRequest<CursorPage<CatalogRate>>(`api/v1/catalog/rates?${query}`);
}
