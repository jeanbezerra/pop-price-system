"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  makeStyles,
  mergeClasses,
  shorthands,
  tokens,
} from "@fluentui/react-components";
import { AddRegular } from "@fluentui/react-icons";
import {
  loadArchitectureComponents,
  saveArchitectureComponent,
} from "@/app/actions";
import type { ApiResult, Provider } from "@/lib/contracts";
import type {
  ArchitectureComponent,
  ComponentFilters,
  ComponentPage,
} from "@/lib/component-contracts";
import { componentStatusLabels } from "@/lib/component-contracts";
import { ArchitectureIcon } from "../architecture-icon";
import { ComponentActions } from "./component-actions";
import {
  ApiNotice,
  PageHeading,
  RefreshButton,
  TableRegion,
  usePageStyles,
} from "../shared";
import { failure, Feedback, type Notice, usePortalStyles } from "./shared";

const useStyles = makeStyles({
  page: { gap: tokens.spacingVerticalXL },
  header: {
    display: "grid",
    gridTemplateColumns: "minmax(0,1fr) auto",
    alignItems: "start",
    gap: tokens.spacingHorizontalXL,
    "@media (max-width:1100px)": { gridTemplateColumns: "minmax(0,1fr)" },
  },
  headerActions: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
  },
  card: { gap: tokens.spacingVerticalXL },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalM,
  },
  filters: {
    display: "grid",
    gap: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalL,
    ...shorthands.borderBottom(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke2,
    ),
  },
  primaryFilters: {
    display: "grid",
    gridTemplateColumns: "minmax(0,2fr) repeat(2,minmax(0,1fr))",
    gap: tokens.spacingHorizontalL,
    alignItems: "start",
    "@media (max-width:1100px)": {
      gridTemplateColumns: "repeat(2,minmax(0,1fr))",
    },
    "@media (max-width:640px)": { gridTemplateColumns: "minmax(0,1fr)" },
  },
  search: { "@media (max-width:1100px)": { gridColumn: "1 / -1" } },
  secondaryFilters: {
    display: "grid",
    gridTemplateColumns: "repeat(3,minmax(0,1fr)) auto",
    gap: tokens.spacingHorizontalL,
    alignItems: "end",
    "@media (max-width:1100px)": {
      gridTemplateColumns: "repeat(2,minmax(0,1fr))",
    },
    "@media (max-width:640px)": { gridTemplateColumns: "minmax(0,1fr)" },
  },
  filterActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalS,
  },
  table: {
    minWidth: "980px",
    width: "100%",
    tableLayout: "fixed",
    overflowWrap: "break-word",
    "@media (max-width:1100px)": { minWidth: "640px" },
  },
  secondaryColumn: { "@media (max-width:1100px)": { display: "none" } },
  compactMetadata: {
    display: "none",
    "@media (max-width:1100px)": { display: "block" },
  },
  providerColumn: { width: "160px" },
  serviceColumn: { width: "190px" },
  categoryColumn: { width: "150px" },
  statusColumn: { width: "100px" },
  actionsColumn: { width: "72px" },
  cell: {
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
    verticalAlign: "middle",
  },
  identity: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
    flexWrap: "nowrap",
    minWidth: 0,
  },
  icon: { display: "flex", alignItems: "center", flexShrink: 0 },
  componentText: { minWidth: 0 },
});

export function ComponentsView({
  initial,
  providers,
}: {
  initial: ApiResult<ComponentPage<ArchitectureComponent>>;
  providers: ApiResult<Provider[]>;
}) {
  const styles = usePageStyles();
  const ui = usePortalStyles();
  const local = useStyles();
  const add = useRef<HTMLButtonElement>(null);
  const [result, setResult] = useState(initial);
  const [filters, setFilters] = useState<ComponentFilters>({});
  const [applied, setApplied] = useState<ComponentFilters>({});
  const router = useRouter();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => {
    setResult(initial);
    setFilters({});
    setApplied({});
  }, [initial]);
  const choices = providers.ok ? providers.data : [];

  async function refresh(query: ComponentFilters = applied, append = false) {
    const response = await loadArchitectureComponents({
      ...query,
      after: append && result.ok ? result.data.nextAfter || "" : "",
    });
    if (!response.ok) {
      setNotice(failure(response));
      return;
    }
    setResult({
      ok: true,
      data: {
        ...response.data,
        items:
          append && result.ok
            ? [...result.data.items, ...response.data.items]
            : response.data.items,
      },
    });
    setApplied(query);
  }

  return (
    <div className={mergeClasses(styles.page, local.page)}>
      <div className={local.header}>
        <PageHeading
          title="Componentes de arquitetura"
          description="Gerencie componentes, características e vínculos com serviços cloud."
          showRefresh={false}
        />
        <div className={local.headerActions}>
          <Button
            ref={add}
            icon={<AddRegular />}
            appearance="primary"
            disabled={pending || !choices.length}
            onClick={() => router.push("/construtor/componentes/novo")}
          >
            Novo componente
          </Button>
          <RefreshButton />
        </div>
      </div>
      {!providers.ok && <ApiNotice message={providers.message} />}
      {!result.ok && <ApiNotice message={result.message} />}
      <Feedback
        notice={notice}
        onDismiss={() => setNotice(null)}
        onReview={() => add.current?.focus()}
      />
      <Card className={mergeClasses(styles.card, local.card)}>
        <div className={local.sectionHeader}>
          <h2 className={ui.title}>Componentes cadastrados</h2>
          {result.ok && (
            <p className={ui.muted}>
              {result.data.items.length}{" "}
              {result.data.items.length === 1
                ? "componente carregado"
                : "componentes carregados"}
            </p>
          )}
        </div>
        <form
          className={local.filters}
          onSubmit={(event) => {
            event.preventDefault();
            start(async () => {
              await refresh(filters);
            });
          }}
        >
          <div className={local.primaryFilters}>
            <Field label="Buscar componente" className={local.search}>
              <Input
                maxLength={200}
                value={filters.query || ""}
                disabled={pending}
                onChange={(_, d) => setFilters({ ...filters, query: d.value })}
              />
            </Field>
            <Field label="Filtrar por provedor">
              <Select
                value={filters.provider || ""}
                disabled={pending}
                onChange={(_, d) =>
                  setFilters({ ...filters, provider: d.value, service: "" })
                }
              >
                <option value="">Todos os provedores</option>
                {choices.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Filtrar por situação">
              <Select
                value={filters.status || ""}
                disabled={pending}
                onChange={(_, d) => setFilters({ ...filters, status: d.value })}
              >
                <option value="">Todas as situações</option>
                {Object.entries(componentStatusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className={local.secondaryFilters}>
            <Field label="Código do serviço">
              <Input
                maxLength={200}
                value={filters.service || ""}
                disabled={pending}
                onChange={(_, d) =>
                  setFilters({ ...filters, service: d.value })
                }
              />
            </Field>
            <Field label="Filtrar por categoria">
              <Input
                maxLength={100}
                value={filters.category || ""}
                disabled={pending}
                onChange={(_, d) =>
                  setFilters({ ...filters, category: d.value })
                }
              />
            </Field>
            <Field label="Vínculo com serviço">
              <Select
                value={filters.linked || ""}
                disabled={pending}
                onChange={(_, d) => setFilters({ ...filters, linked: d.value })}
              >
                <option value="">Todos</option>
                <option value="true">Com vínculo</option>
                <option value="false">Sem vínculo</option>
              </Select>
            </Field>
            <div className={local.filterActions}>
              <Button type="submit" disabled={pending}>
                {pending ? "Consultando…" : "Aplicar filtros"}
              </Button>
              <Button
                appearance="subtle"
                type="button"
                disabled={pending}
                onClick={() => {
                  setFilters({});
                  start(async () => {
                    await refresh({});
                  });
                }}
              >
                Limpar filtros
              </Button>
            </div>
          </div>
        </form>
        {result.ok && !result.data.items.length && (
          <p>
            Nenhum componente encontrado. Cadastre um componente ou ajuste os
            filtros.
          </p>
        )}
        {result.ok && result.data.items.length > 0 && (
          <TableRegion label="Lista de componentes de arquitetura">
            <Table
              aria-label="Componentes de arquitetura"
              className={local.table}
            >
              <colgroup>
                <col />
                <col
                  className={mergeClasses(
                    local.providerColumn,
                    local.secondaryColumn,
                  )}
                />
                <col className={local.serviceColumn} />
                <col
                  className={mergeClasses(
                    local.categoryColumn,
                    local.secondaryColumn,
                  )}
                />
                <col className={local.statusColumn} />
                <col className={local.actionsColumn} />
              </colgroup>
              <TableHeader>
                <TableRow>
                  {[
                    "Componente",
                    "Provedor",
                    "Serviço",
                    "Categoria",
                    "Situação",
                    "Ações",
                  ].map((label) => (
                    <TableHeaderCell
                      key={label}
                      className={
                        label === "Provedor" || label === "Categoria"
                          ? local.secondaryColumn
                          : undefined
                      }
                    >
                      {label}
                    </TableHeaderCell>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.data.items.map((component) => (
                  <TableRow key={component.id}>
                    <TableCell className={local.cell}>
                      <div className={local.identity}>
                        <span className={local.icon}>
                          <ArchitectureIcon icon={component.icon} size={32} />
                        </span>
                        <div className={local.componentText}>
                          <strong>{component.name}</strong>
                          <p
                            className={mergeClasses(
                              ui.muted,
                              local.compactMetadata,
                            )}
                          >
                            {choices.find((p) => p.code === component.provider)
                              ?.name || component.provider}{" "}
                            · {component.categoryName || component.category}
                          </p>
                          {!component.icon && (
                            <p className={ui.muted}>
                              {component.provider === "GENERIC"
                                ? "Representação genérica"
                                : "Ícone pendente"}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell
                      className={mergeClasses(
                        local.cell,
                        local.secondaryColumn,
                      )}
                    >
                      {choices.find((p) => p.code === component.provider)
                        ?.name || component.provider}
                    </TableCell>
                    <TableCell className={local.cell}>
                      {component.serviceName || "Sem vínculo cloud"}
                      {component.serviceCode &&
                        component.serviceCode !== component.serviceName && (
                          <p className={ui.muted}>{component.serviceCode}</p>
                        )}
                    </TableCell>
                    <TableCell
                      className={mergeClasses(
                        local.cell,
                        local.secondaryColumn,
                      )}
                    >
                      {component.categoryName || component.category}
                    </TableCell>
                    <TableCell className={local.cell}>
                      <Badge
                        appearance="tint"
                        color={
                          component.status === "ACTIVE"
                            ? "success"
                            : "informative"
                        }
                      >
                        {componentStatusLabels[component.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className={local.cell}>
                      <ComponentActions
                        component={component}
                        disabled={pending}
                        onEdit={() =>
                          router.push(`/construtor/componentes/${component.id}`)
                        }
                        onDeactivate={() =>
                          start(async () => {
                            const saved = await saveArchitectureComponent(
                              component.id,
                              {
                                provider: component.provider,
                                serviceCode: component.serviceCode,
                                name: component.name,
                                category: component.category,
                                description: component.description,
                                characteristics:
                                  component.characteristics || [],
                                revision: component.revision,
                                status: "INACTIVE",
                                iconKey: component.icon?.key || null,
                                iconRelease: component.icon?.release || null,
                              },
                            );
                            if (!saved.ok) return setNotice(failure(saved));
                            setNotice({
                              intent: "success",
                              message:
                                "Componente desativado. O cadastro foi preservado.",
                            });
                            await refresh();
                          })
                        }
                        onDeleted={async () => {
                          setResult((current) =>
                            current.ok
                              ? {
                                  ...current,
                                  data: {
                                    ...current.data,
                                    items: current.data.items.filter(
                                      (item) => item.id !== component.id,
                                    ),
                                  },
                                }
                              : current,
                          );
                          setNotice({
                            intent: "success",
                            message:
                              "Componente excluído. Os dados cadastrados foram preservados.",
                          });
                          await refresh();
                          add.current?.focus();
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableRegion>
        )}
        {result.ok && result.data.hasMore && (
          <div>
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await refresh(applied, true);
                })
              }
            >
              Carregar mais componentes
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
