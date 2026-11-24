export type ComponentStatus = "PENDING" | "ACTIVE" | "INACTIVE";

export interface ComponentCategory {
  provider: string;
  code: string;
  name: string;
  originalName: string;
  sourceUrl: string | null;
  origin: "PROVIDER" | "PORTAL";
}

export interface ArchitectureIconDefinition {
  provider: string;
  key: string;
  release: string;
  name: string;
  kind: "SERVICE" | "RESOURCE" | "CATEGORY" | "GROUP";
  category: string;
  tags: string;
  assetPath: string;
  sha256: string;
  sourceUrl: string;
}

export interface ArchitectureComponent {
  id: string;
  provider: string;
  serviceCode: string | null;
  serviceName: string | null;
  name: string;
  category: string;
  description: string;
  categoryName: string;
  status: ComponentStatus;
  icon: ArchitectureIconDefinition | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
  characteristics: ComponentCharacteristic[];
}

export interface ComponentCharacteristic {
  name: string;
  value: string;
}

export interface ComponentInput {
  provider: string;
  serviceCode: string | null;
  name: string;
  category: string;
  description: string;
  status: ComponentStatus;
  iconKey: string | null;
  iconRelease: string | null;
  revision: number;
  characteristics: ComponentCharacteristic[];
}

export interface ComponentPage<T> {
  items: T[];
  size: number;
  hasMore: boolean;
  nextAfter: string | null;
}

export interface ComponentFilters {
  provider?: string;
  service?: string;
  category?: string;
  status?: string;
  linked?: string;
  query?: string;
  after?: string;
}

export const componentStatusLabels: Record<ComponentStatus, string> = {
  PENDING: "Pendente",
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
};
