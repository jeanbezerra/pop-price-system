import type { OffsetPage } from "./contracts";

export type StructureSort =
  | "provider"
  | "name"
  | "category"
  | "environment"
  | "status"
  | "region"
  | "componentCount"
  | "predictedMonthlyCost"
  | "createdAt"
  | "updatedAt";
export interface StructureQuery {
  q?: string;
  lifecycle?: string;
  provider?: string;
  category?: string;
  environment?: string;
  status?: string;
  sort?: StructureSort;
  direction?: "ASC" | "DESC";
  size?: number;
  offset?: number;
}
export type StructurePage = OffsetPage<StructureSummary> & { total: number };

export interface CursorPage<T> {
  items: T[];
  size: number;
  hasMore: boolean;
  nextAfterId: number | null;
}
export interface CatalogRate {
  id: number;
  versionId: number;
  provider: string;
  serviceCode: string;
  regionCode: string;
  sku: string;
  family: string;
  attributes: Record<string, unknown>;
  usageType: string;
  operation: string;
  modality: string;
  unit: string;
  currency: string;
  unitPrice: number;
  rangeBegin: number;
  rangeEnd: number | null;
  effectiveAt: string;
  sourceVersion: string;
  sourceUrl: string;
  active: boolean;
  description?: string;
}
export interface Region {
  provider: string;
  code: string;
  name: string;
}
export interface ExchangeQuote {
  id: string;
  quotationDate: string;
  quotationAt: string;
  buyRate: number;
  sellRate: number;
  source: "BCB_PTAX";
  bulletin: "Fechamento";
  sourceUrl: string;
  synchronizedAt: string;
}
export type Period = "HOUR" | "DAY" | "MONTH" | "YEAR";
export type Connectivity =
  | "DIRECT"
  | "NAT_GATEWAY"
  | "TRANSIT_GATEWAY"
  | "VPC_ENDPOINT"
  | "PRIVATELINK"
  | "DIRECT_CONNECT";
export type ChargeKey =
  | "DATA_IN"
  | "DATA_OUT"
  | "INTER_REGION_IN"
  | "INTER_REGION_OUT"
  | "INTER_AZ_IN"
  | "INTER_AZ_OUT"
  | "NAT_PROCESSING"
  | "TRANSIT_PROCESSING"
  | "ENDPOINT_PROCESSING"
  | "PRIVATELINK_PROCESSING"
  | "DIRECT_CONNECT_OUT";
export type DecimalValue = number | string;
export interface ArchitectureNode {
  id: string;
  name: string;
  x: number;
  y: number;
  rateId: number | null;
  provider?: string;
  serviceCode?: string | null;
  iconKey?: string | null;
  iconRelease?: string | null;
  iconAssetPath?: string | null;
  category: string;
  accountCode: string;
  quantity: DecimalValue;
  consumption: DecimalValue;
  consumptionUnit: string;
  period: Period;
  retentionDays: number | null;
  availabilityZone: string | null;
}
export interface ArchitectureEdge {
  id: string;
  source: string;
  target: string;
  monthlyGb: DecimalValue;
  direction: "INTERNAL" | "INTERNET_IN" | "INTERNET_OUT";
  connectivity: Connectivity;
  charges: { key: ChargeKey; rateId: number }[];
}
export interface ArchitectureGraph {
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
}
export interface ModelSummary {
  specification?: StructureSpecification | null;
  id: string;
  name: string;
  hoursPerMonth: number;
  status: "DRAFT" | "PUBLISHED";
  revision: number;
  updatedAt: string;
  publishedAt: string | null;
}
export interface ArchitectureModel extends ModelSummary {
  graph: ArchitectureGraph;
  createdAt: string;
  archivedAt: string | null;
  specification: StructureSpecification | null;
}
export interface StructureSummary extends ModelSummary {
  createdAt: string;
  archivedAt: string | null;
  clouds: string[];
  componentCount: number;
  predictedMonthlyCost: number | null;
  costRevision: number | null;
  specification: StructureSpecification | null;
}
export interface StructureSpecification {
  primaryProvider: string;
  description: string;
  category: string;
  environment: string;
  locations: { provider: string; regionCode: string }[];
}
export const structureCategories: Record<string, string> = {
  APPLICATION: "Aplicação",
  PLATFORM: "Plataforma",
  DATA: "Dados e analytics",
  NETWORK: "Rede",
  SECURITY: "Segurança",
  OTHER: "Outra",
};
export const structureEnvironments: Record<string, string> = {
  DEVELOPMENT: "Desenvolvimento",
  TEST: "Teste",
  HOMOLOGATION: "Homologação",
  PRODUCTION: "Produção",
};
export interface SaveModel {
  name: string;
  hoursPerMonth: number;
  graph: ArchitectureGraph;
  revision: number;
  specification?: StructureSpecification;
}
export interface Parameters {
  hoursPerMonth: number;
  revision: number;
  updatedAt: string;
}
export interface Calculation {
  calculationId: string;
  estimateId: string;
  name: string;
  revision: number;
  complete: boolean;
  currency: "USD";
  hoursPerMonth: number;
  hourlyCost: number | null;
  monthlyCost: number | null;
  annualCost: number | null;
  knownMonthlySubtotal: number;
  networkMonthlySubtotal: number;
  items: {
    component: { id: string; name: string; category: string };
    status: string;
    monthlyCost: number | null;
    warning: string | null;
  }[];
  warnings: string[];
}
export interface Valuation {
  id: string;
  estimateId: string;
  modelId: string | null;
  modelRevision: number;
  usd: Calculation;
  exchangeQuote: ExchangeQuote;
  brl: {
    currency: "BRL";
    hourlyCost: number | null;
    monthlyCost: number | null;
    annualCost: number | null;
    knownMonthlySubtotal: number;
    rounding: string;
  };
  createdAt: string;
}
export interface CustomerContract {
  id: string;
  reference: string;
  name: string;
  customerName: string;
  valuationId: string;
  estimateId: string;
  startsOn: string;
  months: number;
  monthlyUsd: number;
  monthlyBrl: number;
  totalBrl: number;
  valuation: Valuation;
  createdAt: string;
}
export interface CreateContract {
  reference: string;
  name: string;
  customerName: string;
  valuationId: string;
  startsOn: string;
  months: number;
}
