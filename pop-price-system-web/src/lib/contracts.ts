export interface Provider {
  code: string;
  name: string;
}
export interface CatalogService {
  provider: string;
  code: string;
  name: string;
  attributes: unknown;
  lastSynchronizedAt: string | null;
}
export interface ServicePage {
  items: CatalogService[];
  size: number;
  hasMore: boolean;
  nextAfter: string | null;
}
export interface EstimateSummary {
  id: string;
  name: string;
  hoursPerMonth: number;
  currency: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  items: unknown[];
  lastCalculation: unknown | null;
}
export interface Synchronization {
  id: string;
  scope: { provider: string; serviceCode: string; regionCode: string };
  status: "RUNNING" | "COMPLETED" | "FAILED";
  attempt: number;
  startedAt: string;
  finishedAt: string | null;
  processed: number;
  inserted: number;
  updated: number;
}
export interface OffsetPage<T> {
  items: T[];
  size: number;
  offset: number;
  hasMore: boolean;
}
export type SynchronizationSort =
  "startedAt" | "serviceCode" | "regionCode" | "status" | "processed";
export interface SynchronizationHistoryQuery {
  size: number;
  offset: number;
  sortBy: SynchronizationSort;
  direction: "asc" | "desc";
}
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; status?: number; correlationId?: string };
export interface OverviewData {
  providers: ApiResult<Provider[]>;
  services: ApiResult<ServicePage>;
  estimates: ApiResult<OffsetPage<EstimateSummary>>;
  synchronizations: ApiResult<OffsetPage<Synchronization>>;
  checkedAt: string;
}
