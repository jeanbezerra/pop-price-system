"use client";

import { useRef, useState } from "react";
import {
  Button,
  Card,
  Field,
  Link,
  Select,
  Table,
  TableHeader,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import {
  ArrowClockwiseRegular,
  ArrowLeftRegular,
  MoneyRegular,
} from "@fluentui/react-icons";
import { searchRates } from "@/app/actions";
import type { ApiResult } from "@/lib/contracts";
import type { CatalogRate, CursorPage, Region } from "@/lib/portal-contracts";
import { EmptyState, TableRegion, usePageStyles } from "./shared";
import { ProviderIcon } from "./provider-icon";
import {
  failure,
  Feedback,
  type Notice,
  usePortalStyles,
} from "./portal/shared";

const useStyles = makeStyles({
  page: { gridTemplateColumns: "minmax(0, 1fr)" },
  card: { minWidth: 0 },
  identity: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalL,
  },
  provider: { flexShrink: 0 },
  title: { minWidth: 0, overflowWrap: "anywhere" },
  filters: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "end",
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalL,
  },
  region: { minWidth: "min(100%, 280px)" },
  table: { minWidth: "900px", overflowWrap: "anywhere" },
  product: { display: "grid", gap: tokens.spacingVerticalS },
  price: {
    whiteSpace: "nowrap",
    fontVariantNumeric: "tabular-nums",
    fontWeight: tokens.fontWeightSemibold,
  },
  details: { marginTop: tokens.spacingVerticalS },
  attributes: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: tokens.spacingVerticalS,
    margin: 0,
  },
  value: {
    margin: 0,
    color: tokens.colorNeutralForeground2,
    overflowWrap: "anywhere",
  },
});
const quantity = (value: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 12 }).format(value);
const price = (rate: CatalogRate) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: rate.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 12,
  }).format(rate.unitPrice);
const safeSource = (url: string) => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.href
      : undefined;
  } catch {
    return undefined;
  }
};

export function ServiceCostsView({
  provider,
  service,
  initial,
  regions,
}: {
  provider: string;
  service: string;
  initial: ApiResult<CursorPage<CatalogRate>>;
  regions: ApiResult<Region[]>;
}) {
  const shared = usePageStyles();
  const ui = usePortalStyles();
  const styles = useStyles();
  const regionInput = useRef<HTMLSelectElement>(null);
  const [page, setPage] = useState(initial.ok ? initial.data : null);
  const [region, setRegion] = useState("");
  const [cursors, setCursors] = useState<(number | undefined)[]>([undefined]);
  const [loading, setLoading] = useState(false);
  const hasRates = !!page?.items.length;
  const [notice, setNotice] = useState<Notice | null>(
    initial.ok ? null : failure(initial),
  );
  const [regionOptions] = useState(() => {
    const values = new Map<string, string>();
    if (regions.ok)
      regions.data.forEach((item) => values.set(item.code, item.name));
    if (initial.ok)
      initial.data.items.forEach((item) => {
        if (!values.has(item.regionCode))
          values.set(item.regionCode, item.regionCode);
      });
    return [...values].sort(([a], [b]) => a.localeCompare(b));
  });
  async function load(
    selectedRegion: string,
    selectedCursors: (number | undefined)[],
  ) {
    setLoading(true);
    setNotice(null);
    try {
      const result = await searchRates({
        provider,
        service,
        region: selectedRegion,
        afterId: selectedCursors.at(-1),
      });
      if (!result.ok) return setNotice(failure(result));
      setPage(result.data);
      setRegion(selectedRegion);
      setCursors(selectedCursors);
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className={mergeClasses(shared.page, styles.page)}>
      <div>
        <Button
          as="a"
          href="/catalogo"
          appearance="subtle"
          icon={<ArrowLeftRegular />}
        >
          Voltar ao catálogo
        </Button>
      </div>
      <header>
        <div className={styles.identity}>
          <span className={styles.provider}>
            <ProviderIcon provider={provider} />
          </span>
          <h1 className={mergeClasses(shared.title, styles.title)}>
            Custos de {service}
          </h1>
        </div>
        <p className={shared.description}>
          Consulte as tarifas sob demanda (OnDemand) já importadas. O custo
          depende do produto, da região, da unidade e do consumo.
        </p>
      </header>
      <Feedback
        notice={notice}
        onDismiss={() => setNotice(null)}
        onReview={() => regionInput.current?.focus()}
      />
      <Card className={mergeClasses(shared.card, styles.card)}>
        <div className={styles.filters}>
          <Field label="Região dos custos" className={styles.region}>
            <Select
              ref={regionInput}
              value={region}
              disabled={loading}
              onChange={(_, data) => void load(data.value, [undefined])}
            >
              <option value="">Todas as regiões</option>
              {regionOptions.map(([code, name]) => (
                <option key={code} value={code}>
                  {name === code ? code : `${name} · ${code}`}
                </option>
              ))}
            </Select>
          </Field>
          <Button
            appearance={hasRates || !page ? "primary" : "secondary"}
            disabled={loading}
            icon={<ArrowClockwiseRegular />}
            onClick={() => void load(region, cursors)}
          >
            {loading ? "Consultando custos…" : "Atualizar custos"}
          </Button>
        </div>
        {hasRates && (
          <div className={ui.actions}>
            <h2 className={ui.title}>Preços por unidade</h2>
            <p role="status" className={ui.muted}>
              {page
                ? `${page.items.length} ${page.items.length === 1 ? "tarifa" : "tarifas"}${page.hasMore || cursors.length > 1 ? ` · Página ${cursors.length}` : ""}`
                : "Custos indisponíveis"}
            </p>
          </div>
        )}
        {page && page.items.length > 0 ? (
          <TableRegion label="Detalhamento de custos">
            <Table
              className={styles.table}
              aria-label="Custos do serviço"
              aria-busy={loading}
            >
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Produto e cobrança</TableHeaderCell>
                  <TableHeaderCell>Preço unitário</TableHeaderCell>
                  <TableHeaderCell>Unidade</TableHeaderCell>
                  <TableHeaderCell>Região</TableHeaderCell>
                  <TableHeaderCell>Faixa de consumo</TableHeaderCell>
                  <TableHeaderCell>Vigência e fonte</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {page.items.map((rate) => (
                  <TableRow key={rate.id}>
                    <TableCell>
                      <div className={styles.product}>
                        <strong>{rate.family}</strong>
                        <span>
                          {rate.description || rate.usageType || rate.sku}
                        </span>
                        <details className={styles.details}>
                          <summary>Detalhes da tarifa</summary>
                          <dl className={styles.attributes}>
                            <div>
                              <dt>SKU</dt>
                              <dd className={styles.value}>{rate.sku}</dd>
                            </div>
                            <div>
                              <dt>Versão da fonte</dt>
                              <dd className={styles.value}>
                                {rate.sourceVersion}
                              </dd>
                            </div>
                            {Object.entries(rate.attributes).map(
                              ([key, value]) => (
                                <div key={key}>
                                  <dt>{key}</dt>
                                  <dd className={styles.value}>
                                    {typeof value === "string"
                                      ? value
                                      : JSON.stringify(value)}
                                  </dd>
                                </div>
                              ),
                            )}
                          </dl>
                        </details>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={styles.price}>{price(rate)}</span>
                    </TableCell>
                    <TableCell>{rate.unit}</TableCell>
                    <TableCell>{rate.regionCode}</TableCell>
                    <TableCell>
                      {quantity(rate.rangeBegin)} a{" "}
                      {rate.rangeEnd === null
                        ? "sem limite"
                        : quantity(rate.rangeEnd)}
                    </TableCell>
                    <TableCell>
                      <div className={styles.product}>
                        <time dateTime={rate.effectiveAt}>
                          {rate.effectiveAt
                            .slice(0, 10)
                            .split("-")
                            .reverse()
                            .join("/")}
                        </time>
                        {safeSource(rate.sourceUrl) && (
                          <Link
                            href={safeSource(rate.sourceUrl)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Fonte do preço
                          </Link>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableRegion>
        ) : (
          page && (
            <EmptyState
              icon={<MoneyRegular />}
              title="Nenhum custo sincronizado"
              description="Ainda não há tarifas importadas deste serviço para a região selecionada. Sincronize os preços para consultar os custos."
              action={{
                href: "/construtor/sincronizacoes",
                label: "Sincronizar preços",
                appearance: "primary",
              }}
            />
          )
        )}
        {hasRates && (
          <details>
            <summary>Como interpretar os preços</summary>
            <p className={ui.muted}>
              Os preços seguem a moeda e a unidade de cada tarifa. Valores de
              unidades ou faixas diferentes não devem ser somados como um custo
              mensal.
            </p>
          </details>
        )}
        {hasRates && (page?.hasMore || cursors.length > 1) && (
          <nav aria-label="Paginação dos custos" className={ui.actions}>
            <p className={ui.muted}>
              {!page
                ? "Consulte os custos para ver as tarifas disponíveis."
                : page.hasMore
                  ? "Há mais tarifas disponíveis para este serviço."
                  : "Última página de tarifas."}
            </p>
            <div className={ui.row}>
              <Button
                disabled={loading || cursors.length === 1}
                onClick={() => void load(region, cursors.slice(0, -1))}
              >
                Anterior
              </Button>
              <Button
                disabled={
                  loading || !page?.hasMore || page.nextAfterId === null
                }
                onClick={() => {
                  if (page?.nextAfterId != null)
                    void load(region, [...cursors, page.nextAfterId]);
                }}
              >
                Próxima
              </Button>
            </div>
          </nav>
        )}
      </Card>
    </div>
  );
}
