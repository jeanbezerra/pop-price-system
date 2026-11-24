import "server-only";
import type {
  ApiResult,
  EstimateSummary,
  OffsetPage,
  OverviewData,
  Provider,
  ServicePage,
  Synchronization,
  SynchronizationHistoryQuery,
} from "./contracts";

export const apiDocumentationEnabled = () =>
  process.env.API_DOCS_ENABLED === "true";

export function apiBaseUrl(): URL {
  const value =
    process.env.API_BASE_URL ||
    "http://127.0.0.1:8080/pop-price-system-service";
  const base = new URL(value.endsWith("/") ? value : `${value}/`);
  if (
    !["http:", "https:"].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  ) {
    throw new Error(
      "API_BASE_URL must be an HTTP(S) base URL without credentials, query or fragment.",
    );
  }
  return base;
}

export async function apiRequest<T>(
  path: string,
  options?: {
    method: "POST" | "PUT" | "DELETE";
    body?: unknown;
    idempotencyKey?: string;
    timeoutMs?: number;
  },
): Promise<ApiResult<T>> {
  try {
    const requestedTimeout = Number(process.env.API_TIMEOUT_MS || 2000);
    const timeout = Number.isFinite(requestedTimeout)
      ? Math.max(100, Math.min(requestedTimeout, 10000))
      : 2000;
    const response = await fetch(new URL(path, apiBaseUrl()), {
      method: options?.method ?? "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(options?.body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
        ...(options?.idempotencyKey
          ? { "Idempotency-Key": options.idempotencyKey }
          : {}),
      },
      body:
        options?.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(
        options?.timeoutMs ?? (options ? 15000 : timeout),
      ),
    });
    if (!response.ok) {
      const problem = (await response.json().catch(() => null)) as {
        detail?: string;
        correlationId?: string;
      } | null;
      return {
        ok: false,
        message:
          (problem?.detail === "Invalid parameters or payload"
            ? "Revise os campos obrigatórios e os formatos informados."
            : problem?.detail?.slice(0, 2000)) ||
          "A operação não pôde ser concluída. Tente atualizar os dados.",
        status: response.status,
        correlationId: problem?.correlationId,
      };
    }
    return {
      ok: true,
      data:
        response.status === 204
          ? (undefined as T)
          : ((await response.json()) as T),
    };
  } catch {
    return {
      ok: false,
      message:
        "A API está indisponível no momento. Tente novamente em instantes.",
    };
  }
}

const get = apiRequest;

export const getProviders = () => get<Provider[]>("api/v1/providers");
export const getServices = () =>
  get<ServicePage>("api/v1/catalog/services?size=50");
export const getEstimates = () =>
  get<OffsetPage<EstimateSummary>>("api/v1/estimates?size=50&offset=0");
export const getSynchronizations = (
  query: Partial<SynchronizationHistoryQuery> = {},
) => {
  const params = new URLSearchParams({
    size: String(query.size ?? 50),
    offset: String(query.offset ?? 0),
    sortBy: query.sortBy ?? "startedAt",
    direction: query.direction ?? "desc",
  });
  return get<OffsetPage<Synchronization>>(`api/v1/synchronizations?${params}`);
};

export async function getOverview(): Promise<OverviewData> {
  const [providers, services, estimates, synchronizations] = await Promise.all([
    getProviders(),
    getServices(),
    getEstimates(),
    getSynchronizations(),
  ]);
  return {
    providers,
    services,
    estimates,
    synchronizations,
    checkedAt: new Date().toISOString(),
  };
}
