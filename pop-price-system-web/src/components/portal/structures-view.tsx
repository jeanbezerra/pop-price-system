"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  Select,
  Text,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  MenuDivider,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import {
  AddRegular,
  MoreVerticalRegular,
  EditRegular,
  ArchiveRegular,
  ArchiveArrowBackRegular,
  DeleteRegular,
  ArrowUploadRegular,
  SearchRegular,
  ShareRegular,
  ArrowClockwiseRegular,
  CopyRegular,
  WarningRegular,
  FilterRegular,
  ChevronLeftRegular,
  ChevronRightRegular,
  PreviousRegular,
  NextRegular,
} from "@fluentui/react-icons";
import { useRouter } from "next/navigation";
import {
  changeStructureLifecycle,
  loadStructures,
  publishArchitecture,
} from "@/app/actions";
import type { ApiResult, Provider } from "@/lib/contracts";
import {
  structureCategories,
  structureEnvironments,
} from "@/lib/portal-contracts";
import {
  StructureDialog,
  type StructureDialogMode,
  type StructureSource,
} from "./structure-dialog";
import type {
  StructureSummary,
  StructurePage,
  StructureQuery,
  StructureSort,
} from "@/lib/portal-contracts";
import {
  ApiNotice,
  EmptyState,
  PageHeading,
  TableRegion,
  usePageStyles,
} from "../shared";
import { failure, Feedback, money, type Notice } from "./shared";
import { ProviderIcon } from "../provider-icon";

const useStyles = makeStyles({
  root: {
    minWidth: 0,
    gridTemplateColumns: "minmax(0,1fr)",
    gap: tokens.spacingVerticalXL,
  },
  heading: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "start",
    gap: tokens.spacingHorizontalL,
    flexWrap: "wrap",
  },
  filterCard: { padding: tokens.spacingHorizontalL },
  filters: { display: "grid", gap: tokens.spacingVerticalL, minWidth: 0 },
  filterFields: {
    display: "grid",
    gridTemplateColumns: "repeat(6,minmax(0,1fr))",
    gap: tokens.spacingHorizontalL,
    alignItems: "start",
    "> *": { minWidth: 0 },
    "@media (min-width:761px) and (max-width:1400px)": {
      gridTemplateColumns: "repeat(3,minmax(0,1fr))",
    },
    "@media (min-width:501px) and (max-width:760px)": {
      gridTemplateColumns: "repeat(2,minmax(0,1fr))",
    },
    "@media (max-width:500px)": { gridTemplateColumns: "minmax(0,1fr)" },
  },
  control: { width: "100%", minWidth: 0, maxWidth: "100%" },
  filterActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalM,
    flexWrap: "wrap",
  },
  pagination: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalL,
    flexWrap: "wrap",
    padding: tokens.spacingHorizontalL,
    borderTop: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  pageControls: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    flexWrap: "wrap",
  },
  name: { overflowWrap: "anywhere" },
  clouds: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    minHeight: "32px",
    whiteSpace: "nowrap",
  },
  cloudList: { display: "grid", gap: tokens.spacingVerticalXS },
  table: { minWidth: "1480px", tableLayout: "fixed" },
  pageLinks: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    flexWrap: "nowrap",
  },
  pageSize: {
    gridTemplateColumns: "auto 80px",
    columnGap: tokens.spacingHorizontalS,
    alignItems: "center",
    whiteSpace: "nowrap",
  },
  cell: {
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
  },
  singleLine: { whiteSpace: "nowrap" },
  number: {
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
  },
  numberHeader: { justifyContent: "flex-end" },
  cost: {
    display: "inline-flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
  },
  list: { padding: 0, gap: 0, boxShadow: tokens.shadow2 },
  listHeading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalM,
    padding: tokens.spacingHorizontalL,
  },
  tableHeader: { backgroundColor: tokens.colorNeutralBackground2 },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
    flexWrap: "nowrap",
  },
});
const defaultFilters = {
  q: "",
  provider: "",
  category: "",
  environment: "",
  status: "",
  lifecycle: "ACTIVE",
};
const sortKeys: StructureSort[] = [
  "provider",
  "name",
  "category",
  "environment",
  "status",
  "region",
  "componentCount",
  "predictedMonthlyCost",
  "createdAt",
  "updatedAt",
];
function cloudsOf(model: StructureSummary) {
  return [...model.clouds].sort((a, b) =>
    a === model.specification?.primaryProvider
      ? -1
      : b === model.specification?.primaryProvider
        ? 1
        : a.localeCompare(b),
  );
}
type Action = "archive" | "unarchive" | "delete" | "promote";
const timestamp = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));

export function StructuresView({
  initial,
  providers,
  defaultHours,
  initialNew = false,
  initialDuplicate = false,
  configure = null,
}: {
  initial: ApiResult<StructurePage>;
  providers: ApiResult<Provider[]>;
  defaultHours: number;
  initialNew?: boolean;
  initialDuplicate?: boolean;
  configure?: StructureSource | null;
}) {
  const page = usePageStyles();
  const styles = useStyles();
  const router = useRouter();
  const [dialog, setDialog] = useState<StructureDialogMode | null>(null);
  // URL-driven dialogs open after hydration, when the portal and focus target exist.
  useEffect(() => {
    if (configure)
      setDialog({
        kind:
          initialDuplicate ||
          configure.status === "PUBLISHED" ||
          configure.archivedAt
            ? "duplicate"
            : "configure",
        source: configure,
      });
    else if (initialNew) setDialog({ kind: "new" });
  }, [initialNew, initialDuplicate, configure?.id]);
  const [data, setData] = useState(
    initial.ok
      ? initial.data
      : { items: [], size: 20, offset: 0, hasMore: false, total: 0 },
  );
  const [listQuery, setListQuery] = useState<StructureQuery>({
    ...defaultFilters,
    sort: "updatedAt",
    direction: "DESC",
    size: 20,
    offset: 0,
  });
  const [draft, setDraft] = useState(defaultFilters);
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirmation, setConfirmation] = useState<{
    model: StructureSummary;
    action: "delete" | "promote";
  } | null>(null);
  async function refresh(next = listQuery) {
    let result = await loadStructures(next);
    if (
      result.ok &&
      result.data.offset > 0 &&
      result.data.offset >= result.data.total
    ) {
      next = {
        ...next,
        offset:
          Math.max(0, Math.ceil(result.data.total / result.data.size) - 1) *
          result.data.size,
      };
      result = await loadStructures(next);
    }
    if (!result.ok) {
      setNotice(failure(result));
      return;
    }
    setData(result.data);
    setListQuery(next);
  }
  function sortBy(sort: StructureSort) {
    start(() =>
      refresh({
        ...listQuery,
        sort,
        direction:
          listQuery.sort === sort && listQuery.direction === "ASC"
            ? "DESC"
            : "ASC",
        offset: 0,
      }),
    );
  }
  function act(model: StructureSummary, action: Action) {
    start(async () => {
      const result =
        action === "promote"
          ? await publishArchitecture(model.id, model.revision)
          : await changeStructureLifecycle(model.id, model.revision, action);
      if (!result.ok) {
        setNotice(failure(result));
        setConfirmation(null);
        return;
      }
      setConfirmation(null);
      setNotice({
        intent: "success",
        message:
          action === "delete"
            ? "Estrutura excluída logicamente. O histórico foi preservado."
            : action === "promote"
              ? "Estrutura promovida. A versão pode ser reutilizada nas próximas estimativas."
              : action === "archive"
                ? "Estrutura arquivada."
                : "Estrutura desarquivada.",
      });
      await refresh();
    });
  }
  const visible = data.items;
  const hasFilters = !!(
    listQuery.q ||
    listQuery.provider ||
    listQuery.category ||
    listQuery.environment ||
    listQuery.status
  );
  const pageCount = Math.max(1, Math.ceil(data.total / data.size));
  const currentPage = Math.floor(data.offset / data.size) + 1;
  const changedFilters = Object.keys(defaultFilters).some(
    (key) =>
      draft[key as keyof typeof draft] !==
      listQuery[key as keyof StructureQuery],
  );
  return (
    <div className={mergeClasses(page.page, styles.root)}>
      <div className={styles.heading}>
        <PageHeading
          title="Gestão de estruturas"
          showRefresh={false}
          description="Organize as soluções em desenho e transforme suas estruturas na base das próximas etapas de precificação."
        />
        <div className={styles.actions}>
          <Button
            disabled={pending}
            icon={<ArrowClockwiseRegular />}
            onClick={() => start(() => refresh())}
          >
            Atualizar estruturas
          </Button>
          <Button
            appearance="primary"
            onClick={() => setDialog({ kind: "new" })}
            disabled={!providers.ok || !providers.data.length}
            icon={<AddRegular />}
          >
            Nova estrutura
          </Button>
        </div>
      </div>
      {!initial.ok && <ApiNotice message={initial.message} />}
      {!providers.ok && <ApiNotice message={providers.message} />}
      <Feedback
        notice={notice}
        onDismiss={() => setNotice(null)}
        onReview={() => start(() => refresh())}
      />
      <Card className={styles.filterCard}>
        <form
          className={styles.filters}
          role="search"
          aria-label="Filtros de estruturas"
          onSubmit={(event) => {
            event.preventDefault();
            start(() => refresh({ ...listQuery, ...draft, offset: 0 }));
          }}
        >
          <div className={styles.filterFields}>
            <Field label="Buscar estruturas">
              <Input
                className={styles.control}
                disabled={pending}
                contentBefore={<SearchRegular />}
                value={draft.q}
                onChange={(_, d) => setDraft((old) => ({ ...old, q: d.value }))}
                placeholder="Nome ou provedor"
                maxLength={200}
              />
            </Field>
            <Field label="Provedor">
              <Select
                className={styles.control}
                disabled={pending}
                value={draft.provider}
                onChange={(_, d) =>
                  setDraft((old) => ({ ...old, provider: d.value }))
                }
              >
                <option value="">Todos</option>
                {providers.ok &&
                  providers.data.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Categoria">
              <Select
                className={styles.control}
                disabled={pending}
                value={draft.category}
                onChange={(_, d) =>
                  setDraft((old) => ({ ...old, category: d.value }))
                }
              >
                <option value="">Todas</option>
                {Object.entries(structureCategories).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Ambiente">
              <Select
                className={styles.control}
                disabled={pending}
                value={draft.environment}
                onChange={(_, d) =>
                  setDraft((old) => ({ ...old, environment: d.value }))
                }
              >
                <option value="">Todos</option>
                {Object.entries(structureEnvironments).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Status">
              <Select
                className={styles.control}
                disabled={pending}
                value={draft.status}
                onChange={(_, d) =>
                  setDraft((old) => ({ ...old, status: d.value }))
                }
              >
                <option value="">Todos</option>
                <option value="DRAFT">Em elaboração</option>
                <option value="PUBLISHED">Promovida</option>
              </Select>
            </Field>
            <Field label="Situação">
              <Select
                className={styles.control}
                disabled={pending}
                value={draft.lifecycle}
                onChange={(_, d) =>
                  setDraft((old) => ({ ...old, lifecycle: d.value }))
                }
              >
                <option value="ACTIVE">Ativas</option>
                <option value="ARCHIVED">Arquivadas</option>
                <option value="ALL">Todas</option>
              </Select>
            </Field>
          </div>
          <div className={styles.filterActions}>
            <Text size={200}>
              {changedFilters
                ? "Aplique os filtros para atualizar os resultados."
                : "Busque e filtre todas as estruturas cadastradas."}
            </Text>
            <div className={styles.actions}>
              <Button
                disabled={pending}
                onClick={() => {
                  setDraft(defaultFilters);
                  start(() =>
                    refresh({ ...listQuery, ...defaultFilters, offset: 0 }),
                  );
                }}
              >
                Limpar filtros
              </Button>
              <Button type="submit" disabled={pending} icon={<FilterRegular />}>
                Aplicar filtros
              </Button>
            </div>
          </div>
        </form>
      </Card>
      <Card className={styles.list} aria-busy={pending}>
        <div className={styles.listHeading}>
          <Text weight="semibold">Estruturas da solução</Text>
          <Text size={200}>{data.total} estrutura(s)</Text>
        </div>
        {visible.length ? (
          <TableRegion label="Estruturas cadastradas">
            <Table className={styles.table} aria-label="Gestão de estruturas">
              <colgroup>
                <col style={{ width: 88 }} />
                <col />
                {[96, 145, 128, 140, 110, 150, 142, 142, 72].map(
                  (width, index) => (
                    <col key={index} style={{ width }} />
                  ),
                )}
              </colgroup>
              <TableHeader className={styles.tableHeader}>
                <TableRow>
                  {[
                    "Provedor",
                    "Estrutura",
                    "Categoria",
                    "Ambiente",
                    "Status",
                    "Regiões",
                    "Componentes",
                    "Custo / mês (USD)",
                    "Criação",
                    "Última alteração",
                    "Ações",
                  ].map((heading, index) => (
                    <TableHeaderCell
                      key={heading}
                      sortable={index < 10}
                      sortDirection={
                        sortKeys[index] === listQuery.sort
                          ? listQuery.direction === "ASC"
                            ? "ascending"
                            : "descending"
                          : undefined
                      }
                      onClick={
                        index < 10
                          ? () => {
                              if (!pending) sortBy(sortKeys[index]);
                            }
                          : undefined
                      }
                      button={
                        index === 6 || index === 7
                          ? {
                              className: styles.numberHeader,
                              disabled: pending,
                            }
                          : { disabled: pending }
                      }
                      className={
                        index === 6 || index === 7 ? styles.number : undefined
                      }
                    >
                      {heading}
                    </TableHeaderCell>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((model) => (
                  <TableRow key={model.id}>
                    <TableCell className={styles.cell}>
                      <div className={styles.cloudList}>
                        {cloudsOf(model).length
                          ? cloudsOf(model).map((cloud) => (
                              <Tooltip
                                key={cloud}
                                content={
                                  cloud === model.specification?.primaryProvider
                                    ? "Provedor principal"
                                    : "Provedor adicional"
                                }
                                relationship="description"
                              >
                                <span className={styles.clouds} tabIndex={0}>
                                  <ProviderIcon provider={cloud} />
                                </span>
                              </Tooltip>
                            ))
                          : "A definir"}
                      </div>
                    </TableCell>
                    <TableCell className={styles.cell}>
                      <Text weight="semibold" className={styles.name}>
                        {model.name}
                      </Text>
                    </TableCell>
                    <TableCell className={styles.cell}>
                      {model.specification
                        ? structureCategories[model.specification.category]
                        : "A definir"}
                    </TableCell>
                    <TableCell className={styles.cell}>
                      {model.specification
                        ? structureEnvironments[model.specification.environment]
                        : "A definir"}
                    </TableCell>
                    <TableCell className={styles.cell}>
                      <Badge
                        appearance="tint"
                        color={
                          model.archivedAt
                            ? "subtle"
                            : model.status === "PUBLISHED"
                              ? "success"
                              : "informative"
                        }
                      >
                        {model.archivedAt
                          ? "Arquivada"
                          : model.status === "PUBLISHED"
                            ? "Promovida"
                            : "Em elaboração"}
                      </Badge>
                    </TableCell>
                    <TableCell className={styles.cell}>
                      <div className={styles.cloudList}>
                        {cloudsOf(model).length
                          ? cloudsOf(model).map((cloud) => (
                              <span className={styles.clouds} key={cloud}>
                                {model.specification?.locations.find(
                                  (location) => location.provider === cloud,
                                )?.regionCode || "A definir"}
                              </span>
                            ))
                          : "A definir"}
                      </div>
                    </TableCell>
                    <TableCell
                      className={mergeClasses(styles.cell, styles.number)}
                    >
                      {model.componentCount}
                    </TableCell>
                    <TableCell
                      className={mergeClasses(styles.cell, styles.number)}
                    >
                      {model.predictedMonthlyCost === null ? (
                        "A calcular"
                      ) : model.costRevision !== model.revision ? (
                        <Tooltip
                          content="Previsão de revisão anterior"
                          relationship="description"
                        >
                          <span tabIndex={0} className={styles.cost}>
                            {money(model.predictedMonthlyCost, "USD")}
                            <WarningRegular aria-label="Previsão de revisão anterior" />
                          </span>
                        </Tooltip>
                      ) : (
                        money(model.predictedMonthlyCost, "USD")
                      )}
                    </TableCell>
                    <TableCell
                      className={mergeClasses(styles.cell, styles.singleLine)}
                    >
                      {timestamp(model.createdAt)}
                    </TableCell>
                    <TableCell
                      className={mergeClasses(styles.cell, styles.singleLine)}
                    >
                      {timestamp(model.updatedAt)}
                    </TableCell>
                    <TableCell className={styles.cell}>
                      <div className={styles.actions}>
                        <Menu>
                          <MenuTrigger disableButtonEnhancement>
                            <Button
                              size="small"
                              appearance="subtle"
                              disabled={pending}
                              icon={<MoreVerticalRegular />}
                              aria-label={`Ações de ${model.name}`}
                            />
                          </MenuTrigger>
                          <MenuPopover>
                            <MenuList>
                              <MenuItem
                                icon={<EditRegular />}
                                onClick={() =>
                                  router.push(`/canvas?model=${model.id}`)
                                }
                              >
                                {model.archivedAt ||
                                model.status === "PUBLISHED"
                                  ? "Abrir estrutura"
                                  : "Editar"}
                              </MenuItem>
                              <MenuItem
                                icon={<CopyRegular />}
                                disabled={!providers.ok}
                                onClick={() =>
                                  setDialog({
                                    kind: "duplicate",
                                    source: model,
                                  })
                                }
                              >
                                Duplicar estrutura
                              </MenuItem>
                              {!model.specification &&
                                model.status === "DRAFT" &&
                                !model.archivedAt && (
                                  <MenuItem
                                    onClick={() =>
                                      setDialog({
                                        kind: "configure",
                                        source: model,
                                      })
                                    }
                                  >
                                    Definir especificação
                                  </MenuItem>
                                )}
                              <MenuItem
                                icon={
                                  model.archivedAt ? (
                                    <ArchiveArrowBackRegular />
                                  ) : (
                                    <ArchiveRegular />
                                  )
                                }
                                onClick={() =>
                                  act(
                                    model,
                                    model.archivedAt ? "unarchive" : "archive",
                                  )
                                }
                              >
                                {model.archivedAt ? "Desarquivar" : "Arquivar"}
                              </MenuItem>
                              <MenuItem
                                icon={<ArrowUploadRegular />}
                                disabled={
                                  !!model.archivedAt ||
                                  model.status === "PUBLISHED" ||
                                  !model.componentCount
                                }
                                onClick={() =>
                                  setConfirmation({ model, action: "promote" })
                                }
                              >
                                Promover
                              </MenuItem>
                              <MenuDivider />
                              <MenuItem
                                icon={<DeleteRegular />}
                                onClick={() =>
                                  setConfirmation({ model, action: "delete" })
                                }
                              >
                                Excluir
                              </MenuItem>
                            </MenuList>
                          </MenuPopover>
                        </Menu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableRegion>
        ) : (
          <EmptyState
            icon={<ShareRegular />}
            title={
              hasFilters
                ? "Nenhuma estrutura encontrada"
                : listQuery.lifecycle === "ARCHIVED"
                  ? "Nenhuma estrutura arquivada"
                  : "Comece a desenhar sua solução"
            }
            description={
              hasFilters
                ? "Revise a busca ou limpe os filtros."
                : "Componha recursos de diferentes clouds e conecte os componentes no editor visual."
            }
            action={
              hasFilters
                ? undefined
                : { href: "/estruturas?new=1", label: "Criar estrutura" }
            }
          />
        )}
        <nav className={styles.pagination} aria-label="Paginação de estruturas">
          <Text size={200} aria-live="polite">
            {data.total
              ? `${data.offset + 1}–${data.offset + visible.length} de ${data.total} estruturas`
              : "Nenhuma estrutura"}
          </Text>
          <div className={styles.pageControls}>
            <Field
              className={styles.pageSize}
              label="Por página"
              orientation="horizontal"
            >
              <Select
                disabled={pending}
                value={String(data.size)}
                onChange={(_, d) =>
                  start(() =>
                    refresh({ ...listQuery, size: Number(d.value), offset: 0 }),
                  )
                }
              >
                {[10, 20, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </Select>
            </Field>
            <div className={styles.pageLinks}>
              <Tooltip content="Primeira página" relationship="label">
                <Button
                  icon={<PreviousRegular />}
                  aria-label="Primeira página"
                  disabled={pending || data.offset === 0}
                  onClick={() =>
                    start(() => refresh({ ...listQuery, offset: 0 }))
                  }
                />
              </Tooltip>
              <Tooltip content="Página anterior" relationship="label">
                <Button
                  icon={<ChevronLeftRegular />}
                  aria-label="Página anterior"
                  disabled={pending || data.offset === 0}
                  onClick={() =>
                    start(() =>
                      refresh({
                        ...listQuery,
                        offset: Math.max(0, data.offset - data.size),
                      }),
                    )
                  }
                />
              </Tooltip>
              <Text>
                Página {currentPage} de {pageCount}
              </Text>
              <Tooltip content="Próxima página" relationship="label">
                <Button
                  icon={<ChevronRightRegular />}
                  aria-label="Próxima página"
                  disabled={pending || !data.hasMore}
                  onClick={() =>
                    start(() =>
                      refresh({
                        ...listQuery,
                        offset: data.offset + data.size,
                      }),
                    )
                  }
                />
              </Tooltip>
              <Tooltip content="Última página" relationship="label">
                <Button
                  icon={<NextRegular />}
                  aria-label="Última página"
                  disabled={pending || !data.hasMore}
                  onClick={() =>
                    start(() =>
                      refresh({
                        ...listQuery,
                        offset: (pageCount - 1) * data.size,
                      }),
                    )
                  }
                />
              </Tooltip>
            </div>
          </div>
        </nav>
      </Card>
      {dialog && providers.ok && (
        <StructureDialog
          mode={dialog}
          providers={providers.data}
          defaultHours={defaultHours}
          onClose={() => {
            setDialog(null);
            if (initialNew || configure) router.replace("/estruturas");
          }}
          onSaved={(id) => {
            setDialog(null);
            router.push(`/canvas?model=${id}`);
          }}
        />
      )}
      <Dialog
        open={!!confirmation}
        onOpenChange={(_, d) => {
          if (!d.open && !pending) setConfirmation(null);
        }}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>
              {confirmation?.action === "delete"
                ? "Excluir estrutura?"
                : "Promover estrutura?"}
            </DialogTitle>
            <DialogContent>
              {confirmation?.action === "delete"
                ? `“${confirmation.model.name}” deixará de aparecer na gestão. O desenho e os registros de precificação serão preservados por exclusão lógica.`
                : `“${confirmation?.model.name}” será publicada como uma versão reutilizável. Para alterar essa versão depois, crie uma cópia em Modelos reutilizáveis.`}
            </DialogContent>
            <DialogActions>
              <Button disabled={pending} onClick={() => setConfirmation(null)}>
                Cancelar
              </Button>
              <Button
                disabled={pending}
                appearance="primary"
                onClick={() =>
                  confirmation && act(confirmation.model, confirmation.action)
                }
              >
                {pending
                  ? "Aguarde…"
                  : confirmation?.action === "delete"
                    ? "Excluir estrutura"
                    : "Promover estrutura"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
