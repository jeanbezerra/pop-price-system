"use client";

import { useRef, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Combobox,
  Field,
  Link,
  Option,
  Select,
  Spinner,
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
  AddRegular,
  ArrowClockwiseRegular,
  ArrowSyncRegular,
  DeleteRegular,
} from "@fluentui/react-icons";
import {
  discoverProvider,
  loadServices,
  loadSynchronizationHistory,
  synchronizePrices,
} from "@/app/actions";
import type {
  ApiResult,
  OffsetPage,
  Provider,
  ServicePage,
  Synchronization,
  SynchronizationHistoryQuery,
  SynchronizationSort,
} from "@/lib/contracts";
import type { Region } from "@/lib/portal-contracts";
import { ApiNotice, PageHeading, TableRegion, usePageStyles } from "../shared";
import { failure, Feedback, type Notice, usePortalStyles } from "./shared";

const useStyles = makeStyles({
  page: { gridTemplateColumns: "minmax(0, 1fr)" },
  card: { minWidth: 0 },
  badge: { justifySelf: "start" },
  pageSize: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: tokens.spacingHorizontalM,
  },
  pageSizeLabel: { whiteSpace: "nowrap" },
  fields: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    alignItems: "start",
    gap: tokens.spacingHorizontalL,
    "@media (max-width: 1000px)": { gridTemplateColumns: "1fr" },
  },
  field: { display: "grid", gap: tokens.spacingVerticalS, minWidth: 0 },
  control: { width: "100%", minWidth: 0 },
  secondary: { justifySelf: "start" },
  stack: { display: "grid", gap: tokens.spacingVerticalXS },
  section: { display: "grid", gap: tokens.spacingVerticalL, minWidth: 0 },
  context: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: tokens.spacingHorizontalL,
    paddingTop: tokens.spacingVerticalL,
    borderTop: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  result: { maxWidth: "360px", overflowWrap: "anywhere" },
});
type JobState =
  "Pendente" | "Sincronizando" | "Concluída" | "Falhou" | "Em execução";
interface Job {
  id: string;
  provider: string;
  serviceCode: string;
  serviceName: string;
  regionCode: string;
  state: JobState;
  message?: string;
  auditId?: string;
}
const statusLabel = (status: Synchronization["status"]) =>
  status === "COMPLETED"
    ? "Concluída"
    : status === "FAILED"
      ? "Falhou"
      : "Em execução";
const statusColor = (state: JobState) =>
  state === "Concluída"
    ? "success"
    : state === "Falhou"
      ? "danger"
      : "informative";
const dateTime = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
const historyColumns: { key: SynchronizationSort; label: string }[] = [
  { key: "startedAt", label: "Início" },
  { key: "serviceCode", label: "Serviço" },
  { key: "regionCode", label: "Região" },
  { key: "status", label: "Situação" },
  { key: "processed", label: "Tarifas processadas" },
];

export function SynchronizationView({
  providers,
  services,
  regions,
  history,
}: {
  providers: ApiResult<Provider[]>;
  services: ApiResult<ServicePage>;
  regions: ApiResult<Region[]>;
  history: ApiResult<OffsetPage<Synchronization>>;
}) {
  const styles = usePageStyles();
  const ui = usePortalStyles();
  const local = useStyles();
  const first = useRef<HTMLInputElement>(null);
  const [provider, setProvider] = useState(
    providers.ok ? providers.data[0]?.code || "" : "",
  );
  const [service, setService] = useState("");
  const [serviceText, setServiceText] = useState("");
  const [serviceOpen, setServiceOpen] = useState(false);
  const [region, setRegion] = useState("");
  const [regionText, setRegionText] = useState("");
  const [regionOpen, setRegionOpen] = useState(false);
  const [available, setAvailable] = useState(
    services.ok ? services.data.items : [],
  );
  const [nextAfter, setNextAfter] = useState(
    services.ok && services.data.hasMore ? services.data.nextAfter : null,
  );
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);
  const [regionError, setRegionError] = useState<string>();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [audits, setAudits] = useState(history.ok ? history.data.items : []);
  const [hasMoreHistory, setHasMoreHistory] = useState(
    history.ok && history.data.hasMore,
  );
  const [historyQuery, setHistoryQuery] = useState<SynchronizationHistoryQuery>(
    {
      size: history.ok ? history.data.size : 10,
      offset: history.ok ? history.data.offset : 0,
      sortBy: "startedAt",
      direction: "desc",
    },
  );
  const [historyError, setHistoryError] = useState(
    history.ok ? "" : history.message,
  );
  const [notice, setNotice] = useState<Notice | null>(null);
  const [metadata, setMetadata] = useState<
    "provider" | "services" | "regions" | "more" | null
  >(null);
  const [running, setRunning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [progress, setProgress] = useState("");
  const busy = running || metadata !== null;
  const pendingJobs = jobs.filter((job) => job.state === "Pendente");
  const selectedService = available.find(
    (item) => item.provider === provider && item.code === service,
  );
  const serviceOptions = available.filter(
    (item) =>
      item.provider === provider &&
      `${item.name} ${item.code}`
        .toLocaleLowerCase()
        .includes(serviceText.toLocaleLowerCase()),
  );
  const regionName = (code: string) => {
    const known = regions.ok
      ? regions.data.find(
          (item) => item.provider === provider && item.code === code,
        )
      : undefined;
    return known && known.name !== code ? `${known.name} · ${code}` : code;
  };
  const regionOptions = availableRegions.filter((code) =>
    regionName(code)
      .toLocaleLowerCase()
      .includes(regionText.toLocaleLowerCase()),
  );

  function clearRegion() {
    setRegionOpen(false);
    setRegion("");
    setRegionText("");
    setAvailableRegions([]);
    setRegionError(undefined);
  }
  async function selectProvider(code: string) {
    setProvider(code);
    setService("");
    setServiceText("");
    clearRegion();
    setAvailable([]);
    setNextAfter(null);
    setNotice(null);
    setMetadata("provider");
    try {
      const result = await loadServices(code);
      if (!result.ok) return setNotice(failure(result));
      setAvailable(result.data.items);
      setNextAfter(result.data.hasMore ? result.data.nextAfter : null);
    } finally {
      setMetadata(null);
    }
  }
  async function refreshServices() {
    setNotice(null);
    setMetadata("services");
    try {
      const result = await discoverProvider(provider);
      if (!result.ok) return setNotice(failure(result));
      const list = await loadServices(provider);
      if (!list.ok) return setNotice(failure(list));
      setAvailable(list.data.items);
      setNextAfter(list.data.hasMore ? list.data.nextAfter : null);
      setService("");
      setServiceText("");
      clearRegion();
      setNotice({
        intent: "success",
        message:
          "Lista de serviços atualizada. Selecione um serviço para consultar suas regiões.",
      });
    } finally {
      setMetadata(null);
    }
  }
  async function moreServices() {
    if (!nextAfter) return;
    setMetadata("more");
    try {
      const result = await loadServices(provider, nextAfter);
      if (!result.ok) return setNotice(failure(result));
      setAvailable((old) => [
        ...old,
        ...result.data.items.filter(
          (item) =>
            !old.some(
              (known) =>
                known.provider === item.provider && known.code === item.code,
            ),
        ),
      ]);
      setNextAfter(result.data.hasMore ? result.data.nextAfter : null);
    } finally {
      setMetadata(null);
    }
  }
  async function findRegions(code: string) {
    clearRegion();
    if (!code) return;
    setMetadata("regions");
    setNotice(null);
    try {
      const result = await discoverProvider(provider, code);
      if (!result.ok) return setRegionError(failure(result).message);
      setAvailableRegions(result.data.regions);
    } finally {
      setMetadata(null);
    }
  }
  function queue() {
    if (!selectedService || !region || busy) return;
    const existing = jobs.find(
      (job) =>
        job.provider === provider &&
        job.serviceCode === service &&
        job.regionCode === region,
    );
    if (existing && existing.state !== "Concluída") {
      setNotice({
        intent: "warning",
        message:
          "Esse serviço e região já estão na lista. Confira a importação abaixo.",
      });
      return;
    }
    const job: Job = {
      id: existing?.id || crypto.randomUUID(),
      provider,
      serviceCode: service,
      serviceName: selectedService.name,
      regionCode: region,
      state: "Pendente",
    };
    setJobs((old) =>
      existing
        ? old.map((item) => (item.id === existing.id ? job : item))
        : [...old, job],
    );
    setNotice({
      intent: "success",
      message: `${service} em ${region} adicionado à lista. Inicie a sincronização quando terminar de escolher.`,
    });
  }
  async function refreshHistory(query = historyQuery) {
    setRefreshing(true);
    try {
      const result = await loadSynchronizationHistory(query);
      if (!result.ok) {
        setHistoryError(result.message);
        return;
      }
      setAudits(result.data.items);
      setHasMoreHistory(result.data.hasMore);
      setHistoryQuery(query);
      setHistoryError("");
      setJobs((old) =>
        old.map((job) => {
          const audit = result.data.items.find(
            (item) => item.id === job.auditId,
          );
          if (
            job.state !== "Em execução" ||
            !audit ||
            audit.status === "RUNNING"
          )
            return job;
          return {
            ...job,
            state: statusLabel(audit.status),
            message:
              audit.status === "COMPLETED"
                ? `${audit.processed.toLocaleString("pt-BR")} tarifas processadas`
                : "A importação falhou. Prepare uma nova tentativa para repetir.",
          };
        }),
      );
    } finally {
      setRefreshing(false);
    }
  }
  async function execute() {
    if (busy || !pendingJobs.length) return;
    setRunning(true);
    setNotice(null);
    let failed = 0,
      unfinished = 0;
    try {
      for (const [index, job] of pendingJobs.entries()) {
        setProgress(
          `Importando ${index + 1} de ${pendingJobs.length}: ${job.serviceCode} em ${job.regionCode}`,
        );
        setJobs((old) =>
          old.map((item) =>
            item.id === job.id
              ? { ...item, state: "Sincronizando", message: undefined }
              : item,
          ),
        );
        const result = await synchronizePrices(
          {
            provider: job.provider,
            serviceCode: job.serviceCode,
            regionCode: job.regionCode,
          },
          crypto.randomUUID(),
        );
        let state: JobState, message: string;
        if (result.ok) {
          state = statusLabel(result.data.status);
          message =
            result.data.status === "COMPLETED"
              ? `${result.data.processed.toLocaleString("pt-BR")} tarifas processadas`
              : result.data.status === "RUNNING"
                ? "Atualize o histórico para acompanhar esta execução."
                : "A importação falhou. Confira o histórico antes de tentar novamente.";
        } else {
          state = "Falhou";
          message = `${failure(result).message} Atualize o histórico antes de tentar novamente.`;
        }
        if (state === "Falhou") failed++;
        if (state === "Em execução") unfinished++;
        setJobs((old) =>
          old.map((item) =>
            item.id === job.id
              ? {
                  ...item,
                  state,
                  message,
                  auditId: result.ok ? result.data.id : undefined,
                }
              : item,
          ),
        );
      }
      setNotice({
        intent: failed || unfinished ? "warning" : "success",
        message:
          failed || unfinished
            ? `Importações enviadas: ${pendingJobs.length - failed - unfinished} concluídas, ${failed} com falha e ${unfinished} em execução. Confira os resultados abaixo.`
            : `${pendingJobs.length === 1 ? "Importação concluída" : "Importações concluídas"}. Os preços estão disponíveis no catálogo e no Canvas.`,
      });
      await refreshHistory({ ...historyQuery, offset: 0 });
    } finally {
      setRunning(false);
      setProgress("");
    }
  }

  return (
    <div className={mergeClasses(styles.page, local.page)}>
      <PageHeading
        title="Sincronização de provedores"
        description="Importe os preços dos serviços cloud para usar nas suas arquiteturas."
        showRefresh={false}
      />
      {!providers.ok && <ApiNotice message={providers.message} />}
      <Feedback
        notice={notice}
        onDismiss={() => setNotice(null)}
        onReview={() => first.current?.focus()}
      />
      <Card className={mergeClasses(styles.card, local.card)}>
        <div className={local.section}>
          <div className={local.stack}>
            <h2 className={ui.title}>1. Escolha o que importar</h2>
            <p className={ui.muted}>
              Selecione o provedor, o serviço e a região. Você pode adicionar
              várias combinações à lista antes de iniciar.
            </p>
          </div>
          <div className={local.fields}>
            <div className={local.field}>
              <Field label="Provedor" required>
                <Select
                  value={provider}
                  disabled={busy || !providers.ok || !providers.data.length}
                  onChange={(_, item) => void selectProvider(item.value)}
                >
                  <option value="" disabled>
                    Selecione um provedor
                  </option>
                  {providers.ok &&
                    providers.data.map((item) => (
                      <option value={item.code} key={item.code}>
                        {item.name}
                      </option>
                    ))}
                </Select>
              </Field>
              <Button
                className={local.secondary}
                appearance="subtle"
                icon={<ArrowClockwiseRegular />}
                disabled={busy || !provider}
                onClick={() => void refreshServices()}
              >
                {available.length ? "Atualizar serviços" : "Buscar serviços"}
              </Button>
            </div>
            <div className={local.field}>
              <Field
                label="Serviço"
                required
                hint={
                  available.length
                    ? "Pesquise pelo nome ou código e selecione uma opção."
                    : "Busque os serviços do provedor para começar."
                }
              >
                <Combobox
                  ref={first}
                  className={local.control}
                  inlinePopup
                  open={serviceOpen}
                  onOpenChange={(_, data) => setServiceOpen(data.open)}
                  expandIcon={{ "aria-label": "Exibir serviços" }}
                  placeholder="Pesquisar serviço"
                  value={serviceText}
                  selectedOptions={service ? [service] : []}
                  disabled={busy || !available.length}
                  onChange={(event) => {
                    setServiceText(event.target.value);
                    setServiceOpen(true);
                    if (service) {
                      setService("");
                      clearRegion();
                    }
                  }}
                  onOptionSelect={(_, item) => {
                    const code = item.optionValue;
                    if (!code) return;
                    setServiceOpen(false);
                    setService(code);
                    setServiceText(code);
                    void findRegions(code);
                  }}
                >
                  {serviceOptions.map((item) => (
                    <Option key={item.code} value={item.code} text={item.code}>
                      {item.name} · {item.code}
                    </Option>
                  ))}
                  {!serviceOptions.length && (
                    <Option disabled>Nenhum serviço encontrado</Option>
                  )}
                </Combobox>
              </Field>
              {nextAfter && (
                <Button
                  className={local.secondary}
                  appearance="subtle"
                  disabled={busy}
                  onClick={() => void moreServices()}
                >
                  Carregar mais serviços
                </Button>
              )}
            </div>
            <div className={local.field}>
              <Field
                label="Região"
                required
                validationState={regionError ? "error" : "none"}
                validationMessage={regionError}
                hint={
                  !service
                    ? "Selecione um serviço para consultar as regiões disponíveis."
                    : metadata === "regions"
                      ? "Consultando as regiões deste serviço…"
                      : availableRegions.length
                        ? `${availableRegions.length} ${availableRegions.length === 1 ? "região disponível" : "regiões disponíveis"} para ${service}.`
                        : !regionError
                          ? "Nenhuma região encontrada para este serviço. Tente atualizar as regiões."
                          : undefined
                }
              >
                <Combobox
                  className={local.control}
                  inlinePopup
                  open={regionOpen}
                  onOpenChange={(_, data) => setRegionOpen(data.open)}
                  expandIcon={{ "aria-label": "Exibir regiões" }}
                  placeholder="Pesquisar região"
                  value={regionText}
                  selectedOptions={region ? [region] : []}
                  disabled={busy || !availableRegions.length}
                  onChange={(event) => {
                    setRegionText(event.target.value);
                    setRegionOpen(true);
                    setRegion("");
                  }}
                  onOptionSelect={(_, item) => {
                    if (!item.optionValue) return;
                    setRegionOpen(false);
                    setRegion(item.optionValue);
                    setRegionText(regionName(item.optionValue));
                  }}
                >
                  {regionOptions.map((code) => (
                    <Option key={code} value={code} text={regionName(code)}>
                      {regionName(code)}
                    </Option>
                  ))}
                  {!regionOptions.length && (
                    <Option disabled>Nenhuma região encontrada</Option>
                  )}
                </Combobox>
              </Field>
              {service && (
                <Button
                  className={local.secondary}
                  appearance="subtle"
                  disabled={busy}
                  icon={<ArrowClockwiseRegular />}
                  onClick={() => void findRegions(service)}
                >
                  {regionError
                    ? "Buscar regiões novamente"
                    : "Atualizar regiões"}
                </Button>
              )}
            </div>
          </div>
          {metadata && (
            <Spinner
              size="tiny"
              label={
                metadata === "regions"
                  ? "Buscando regiões…"
                  : metadata === "provider"
                    ? "Carregando provedor…"
                    : "Buscando serviços…"
              }
            />
          )}
          {!services.ok && !available.length && (
            <p className={ui.muted}>
              {services.message} Use Buscar serviços para tentar novamente.
            </p>
          )}
          {providers.ok && !providers.data.length && (
            <p>
              Nenhum provedor disponível. Verifique a configuração da
              integração.
            </p>
          )}
          <div className={local.context}>
            <p className={ui.muted}>
              {selectedService && region
                ? `${provider} · ${selectedService.name} · ${region}`
                : "Os preços serão importados somente ao iniciar a sincronização."}
            </p>
            <Button
              appearance="secondary"
              icon={<AddRegular />}
              disabled={busy || !selectedService || !region}
              onClick={queue}
            >
              Adicionar à lista
            </Button>
          </div>
        </div>
      </Card>
      <Card className={mergeClasses(styles.card, local.card)}>
        <div className={local.section}>
          <div className={ui.actions}>
            <div className={local.stack}>
              <h2 className={ui.title}>2. Revise e sincronize</h2>
              <p className={ui.muted}>
                {pendingJobs.length
                  ? `${pendingJobs.length} ${pendingJobs.length === 1 ? "importação pronta" : "importações prontas"} para iniciar.`
                  : jobs.length
                    ? "Confira os resultados das importações abaixo."
                    : "Sua lista está vazia. Adicione um serviço e uma região na etapa anterior."}
              </p>
            </div>
            <Button
              appearance="primary"
              icon={<ArrowSyncRegular />}
              disabled={busy || !pendingJobs.length}
              onClick={() => void execute()}
            >
              {running
                ? "Sincronizando…"
                : `Sincronizar${pendingJobs.length ? ` ${pendingJobs.length === 1 ? "1 importação" : `${pendingJobs.length} importações`}` : " preços"}`}
            </Button>
          </div>
          {running && <Spinner size="tiny" label={progress} />}
          {jobs.length > 0 && (
            <TableRegion label="Lista de importações">
              <Table className={ui.table} aria-label="Importações de preços">
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>Serviço</TableHeaderCell>
                    <TableHeaderCell>Região</TableHeaderCell>
                    <TableHeaderCell>Situação</TableHeaderCell>
                    <TableHeaderCell>Ações</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>
                        <div className={local.stack}>
                          <strong>{job.serviceName}</strong>
                          <span className={ui.muted}>
                            {job.provider} · {job.serviceCode}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{job.regionCode}</TableCell>
                      <TableCell>
                        <div className={local.stack}>
                          <Badge
                            className={local.badge}
                            appearance="tint"
                            color={statusColor(job.state)}
                          >
                            {job.state}
                          </Badge>
                          {job.message && (
                            <span className={local.result}>{job.message}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className={ui.row}>
                          {job.state === "Falhou" && (
                            <Button
                              size="small"
                              disabled={busy}
                              onClick={() =>
                                setJobs((old) =>
                                  old.map((item) =>
                                    item.id === job.id
                                      ? {
                                          ...item,
                                          state: "Pendente",
                                          message: undefined,
                                        }
                                      : item,
                                  ),
                                )
                              }
                            >
                              Preparar nova tentativa
                            </Button>
                          )}
                          <Button
                            appearance="subtle"
                            size="small"
                            icon={<DeleteRegular />}
                            aria-label={`Remover ${job.serviceCode} em ${job.regionCode}`}
                            disabled={busy}
                            onClick={() =>
                              setJobs((old) =>
                                old.filter((item) => item.id !== job.id),
                              )
                            }
                          >
                            Remover
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableRegion>
          )}
          <p className={ui.muted}>
            Cada serviço e região é importado por vez. Mantenha esta página
            aberta até o término. Uma falha não impede as próximas importações.
          </p>
        </div>
      </Card>
      <Card className={mergeClasses(styles.card, local.card)}>
        <div className={local.section}>
          <div className={ui.actions}>
            <div className={local.stack}>
              <h2 className={ui.title}>Histórico de sincronizações</h2>
              <p className={ui.muted}>
                Consulte as execuções e ordene pelas colunas, incluindo
                tentativas com falha.
              </p>
            </div>
            <Button
              icon={<ArrowClockwiseRegular />}
              disabled={refreshing || running}
              onClick={() => void refreshHistory()}
            >
              {refreshing ? "Atualizando histórico…" : "Atualizar histórico"}
            </Button>
          </div>
          {historyError && (
            <p role="alert">
              Não foi possível atualizar o histórico. {historyError}
            </p>
          )}
          <div className={ui.actions}>
            <Field
              className={local.pageSize}
              label={{
                children: "Linhas por página",
                className: local.pageSizeLabel,
              }}
              orientation="horizontal"
            >
              <Select
                value={String(historyQuery.size)}
                disabled={refreshing || running}
                onChange={(_, data) =>
                  void refreshHistory({
                    ...historyQuery,
                    size: Number(data.value),
                    offset: 0,
                  })
                }
              >
                {[10, 25, 50, 100].map((size) => (
                  <option value={size} key={size}>
                    {size}
                  </option>
                ))}
              </Select>
            </Field>
            <p className={ui.muted} role="status">
              {refreshing
                ? "Carregando histórico…"
                : audits.length
                  ? `Registros ${historyQuery.offset + 1}–${historyQuery.offset + audits.length} · Página ${Math.floor(historyQuery.offset / historyQuery.size) + 1}`
                  : "Nenhum registro nesta página"}
            </p>
          </div>
          {audits.length ? (
            <TableRegion label="Histórico de importações">
              <Table
                className={ui.table}
                aria-label="Histórico de sincronizações"
                aria-busy={refreshing}
              >
                <TableHeader>
                  <TableRow>
                    {historyColumns.map((column) => {
                      const nextDirection =
                        historyQuery.sortBy === column.key &&
                        historyQuery.direction === "asc"
                          ? "desc"
                          : "asc";
                      return (
                        <TableHeaderCell
                          key={column.key}
                          sortable
                          sortDirection={
                            historyQuery.sortBy === column.key
                              ? historyQuery.direction === "asc"
                                ? "ascending"
                                : "descending"
                              : undefined
                          }
                          button={{
                            disabled: refreshing || running,
                            "aria-label": `${column.label}: ordenar ${nextDirection === "asc" ? "crescente" : "decrescente"}`,
                          }}
                          onClick={() =>
                            void refreshHistory({
                              ...historyQuery,
                              sortBy: column.key,
                              direction: nextDirection,
                              offset: 0,
                            })
                          }
                        >
                          {column.label}
                        </TableHeaderCell>
                      );
                    })}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audits.map((audit) => (
                    <TableRow key={audit.id}>
                      <TableCell>{dateTime(audit.startedAt)}</TableCell>
                      <TableCell>
                        <div className={local.stack}>
                          {audit.scope.serviceCode}
                          <span className={ui.muted}>
                            {audit.scope.provider}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{audit.scope.regionCode}</TableCell>
                      <TableCell>
                        <Badge
                          appearance="tint"
                          color={statusColor(statusLabel(audit.status))}
                        >
                          {statusLabel(audit.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {audit.processed.toLocaleString("pt-BR")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableRegion>
          ) : (
            !historyError && (
              <p className={ui.muted}>
                Nenhuma sincronização registrada. As execuções aparecerão aqui
                quando você importar os primeiros preços.
              </p>
            )
          )}
          <nav className={ui.actions} aria-label="Paginação do histórico">
            <p className={ui.muted}>
              Selecione uma coluna para alternar entre ordem crescente e
              decrescente.
            </p>
            <div className={ui.row}>
              <Button
                disabled={refreshing || running || historyQuery.offset === 0}
                onClick={() =>
                  void refreshHistory({ ...historyQuery, offset: 0 })
                }
              >
                Primeira página
              </Button>
              <Button
                disabled={refreshing || running || historyQuery.offset === 0}
                onClick={() =>
                  void refreshHistory({
                    ...historyQuery,
                    offset: Math.max(
                      0,
                      historyQuery.offset - historyQuery.size,
                    ),
                  })
                }
              >
                Anterior
              </Button>
              <Button
                disabled={
                  refreshing ||
                  running ||
                  !hasMoreHistory ||
                  historyQuery.offset + historyQuery.size > 10000
                }
                onClick={() =>
                  void refreshHistory({
                    ...historyQuery,
                    offset: historyQuery.offset + historyQuery.size,
                  })
                }
              >
                Próxima
              </Button>
            </div>
          </nav>
        </div>
      </Card>
      <div className={ui.row}>
        <Link href="/catalogo">Consultar catálogo</Link>
        <Link href="/construtor/cambio">Preparar câmbio PTAX</Link>
        <Link href="/canvas">Abrir Canvas de arquitetura</Link>
      </div>
    </div>
  );
}
