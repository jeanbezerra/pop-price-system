import "server-only";
import { apiRequest } from "./api";
import type { Provider } from "./contracts";
import type {
  ArchitectureComponent,
  ArchitectureIconDefinition,
  ComponentFilters,
  ComponentPage,
  ComponentCategory,
} from "./component-contracts";

export const getComponentProviders = () =>
  apiRequest<Provider[]>("api/v1/architecture-component-providers");

export const getComponentCategories = (provider: string) =>
  apiRequest<ComponentCategory[]>(
    `api/v1/architecture-component-categories?provider=${encodeURIComponent(provider)}`,
  );

export const getArchitectureComponent = (id: string) =>
  apiRequest<ArchitectureComponent>(
    `api/v1/architecture-components/${encodeURIComponent(id)}`,
  );

export function getArchitectureComponents(filters: ComponentFilters = {}) {
  const query = new URLSearchParams({ size: "20" });
  for (const [key, value] of Object.entries(filters))
    if (value) query.set(key, value);
  return apiRequest<ComponentPage<ArchitectureComponent>>(
    `api/v1/architecture-components?${query}`,
  );
}

export function getArchitectureIcons(
  provider: string,
  query = "",
  after = "",
  category = "",
) {
  const filters = new URLSearchParams({
    provider,
    query,
    after,
    category,
    size: "24",
  });
  return apiRequest<ComponentPage<ArchitectureIconDefinition>>(
    `api/v1/architecture-icons?${filters}`,
  );
}
