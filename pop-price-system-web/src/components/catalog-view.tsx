"use client";

import { useMemo, useState } from "react";
import {
  Button,
  Card,
  Field,
  Input,
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
  ArrowRightRegular,
  GridRegular,
  SearchRegular,
} from "@fluentui/react-icons";
import { loadServices } from "@/app/actions";
import { ProviderIcon } from "./provider-icon";
import type { ApiResult, Provider, ServicePage } from "@/lib/contracts";
import {
  ApiNotice,
  EmptyState,
  PageHeading,
  TableRegion,
  usePageStyles,
} from "./shared";

const useStyles = makeStyles({
  page: { gridTemplateColumns: "minmax(0, 1fr)" },
  card: { minWidth: 0 },
  filters: {
    display: "grid",
    gridTemplateColumns: "220px minmax(180px, 1fr) auto",
    gap: tokens.spacingHorizontalL,
    alignItems: "end",
    "@media (max-width: 1000px)": { gridTemplateColumns: "minmax(0, 1fr)" },
  },
  results: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    margin: 0,
  },
  table: { minWidth: "700px", overflowWrap: "anywhere" },
  provider: { width: "100px" },
  error: { color: tokens.colorPaletteRedForeground1 },
});
const synchronizationDate = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  dateStyle: "short",
  timeStyle: "short",
});

export function CatalogView({
  providers,
  services,
  documentationEnabled,
}: {
  providers: ApiResult<Provider[]>;
  services: ApiResult<ServicePage>;
  documentationEnabled: boolean;
}) {
  const shared = usePageStyles();
  const styles = useStyles();
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState("");
  const [catalog, setCatalog] = useState(
    services.ok ? services.data.items : [],
  );
  const [nextAfter, setNextAfter] = useState(
    services.ok && services.data.hasMore ? services.data.nextAfter : null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(services.ok ? "" : services.message);
  async function load(providerCode: string, after = "") {
    setLoading(true);
    setError("");
    try {
      const result = await loadServices(providerCode, after);
      if (!result.ok) return setError(result.message);
      setCatalog((old) =>
        after
          ? [
              ...old,
              ...result.data.items.filter(
                (item) =>
                  !old.some(
                    (known) =>
                      known.provider === item.provider &&
                      known.code === item.code,
                  ),
              ),
            ]
          : result.data.items,
      );
      setNextAfter(result.data.hasMore ? result.data.nextAfter : null);
      setProvider(providerCode);
    } finally {
      setLoading(false);
    }
  }
  const items = useMemo(
    () =>
      catalog.filter(
        (service) =>
          (!provider || service.provider === provider) &&
          `${service.name} ${service.code}`
            .toLocaleLowerCase("pt-BR")
            .includes(query.toLocaleLowerCase("pt-BR")),
      ),
    [catalog, query, provider],
  );
  return (
    <div className={mergeClasses(shared.page, styles.page)}>
      <PageHeading
        title="Catálogo de serviços"
        description="Encontre um serviço por provedor e consulte os custos disponíveis no catálogo."
        showRefresh={false}
      />
      {!providers.ok && <ApiNotice />}
      <Card className={mergeClasses(shared.card, styles.card)}>
        <div className={styles.filters}>
          <Field label="Provedor">
            <Select
              value={provider}
              disabled={loading}
              onChange={(_, data) => void load(data.value)}
            >
              <option value="">Todos os provedores</option>
              {providers.ok &&
                providers.data.map((item) => (
                  <option value={item.code} key={item.code}>
                    {item.name}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Buscar serviço">
            <Input
              contentBefore={<SearchRegular aria-hidden="true" />}
              placeholder="Nome ou código do serviço"
              value={query}
              onChange={(_, data) => setQuery(data.value)}
            />
          </Field>
          <Button
            icon={<ArrowClockwiseRegular />}
            disabled={loading}
            onClick={() => void load(provider)}
          >
            {loading ? "Atualizando catálogo…" : "Atualizar catálogo"}
          </Button>
        </div>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <p className={styles.results} role="status">
          {items.length}{" "}
          {items.length === 1
            ? "serviço nesta página"
            : "serviços nesta página"}
          {nextAfter ? " · Carregue mais serviços para ampliar a busca" : ""}
        </p>
        {items.length ? (
          <TableRegion label="Lista de serviços">
            <Table aria-label="Serviços do catálogo" className={styles.table}>
              <TableHeader>
                <TableRow>
                  <TableHeaderCell className={styles.provider}>
                    Provedor
                  </TableHeaderCell>
                  <TableHeaderCell>Código</TableHeaderCell>
                  <TableHeaderCell>Serviço</TableHeaderCell>
                  <TableHeaderCell>Última sincronização</TableHeaderCell>
                  <TableHeaderCell>Custos</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={`${item.provider}/${item.code}`}>
                    <TableCell>
                      <ProviderIcon provider={item.provider} />
                    </TableCell>
                    <TableCell>{item.code}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>
                      {item.lastSynchronizedAt ? (
                        <time dateTime={item.lastSynchronizedAt}>
                          {synchronizationDate.format(
                            new Date(item.lastSynchronizedAt),
                          )}
                        </time>
                      ) : (
                        <span className={styles.results}>Não sincronizado</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        as="a"
                        href={`/catalogo/${encodeURIComponent(item.provider)}/${encodeURIComponent(item.code)}`}
                        icon={<ArrowRightRegular />}
                        iconPosition="after"
                        aria-label={`Ver custos de ${item.name} (${item.provider})`}
                      >
                        Ver custos
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableRegion>
        ) : (
          <EmptyState
            icon={<GridRegular />}
            title={
              error
                ? "Catálogo indisponível"
                : query || provider
                  ? "Nenhum serviço corresponde aos filtros"
                  : "Seu catálogo começa aqui"
            }
            description={
              error
                ? "A API não pôde ser consultada. Tente atualizar os dados em instantes."
                : query || provider
                  ? "Revise o nome ou o provedor selecionado para encontrar outros serviços."
                  : "Os serviços descobertos no provedor aparecerão nesta lista. Consulte a documentação para iniciar a descoberta."
            }
            action={
              documentationEnabled && !query && !provider
                ? { href: "/api/documentacao", label: "Consultar documentação" }
                : undefined
            }
          />
        )}
        {nextAfter && (
          <div>
            <Button
              disabled={loading}
              onClick={() => void load(provider, nextAfter)}
            >
              {loading ? "Carregando serviços…" : "Carregar mais serviços"}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
