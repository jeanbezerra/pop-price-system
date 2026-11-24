"use client";

import { useRef, useState, useTransition } from "react";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  Select,
  Text,
  makeStyles,
  mergeClasses,
  shorthands,
  tokens,
} from "@fluentui/react-components";
import {
  AddRegular,
  SubtractRegular,
  GridRegular,
  CloudRegular,
  SaveRegular,
} from "@fluentui/react-icons";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Handle,
  Position,
  MarkerType,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type NodeProps,
  type Connection,
} from "@xyflow/react";
import {
  estimateArchitecture,
  loadRegions,
  loadServices,
  publishArchitecture,
  saveArchitecture,
  searchRates,
} from "@/app/actions";
import type { ApiResult, Provider, ServicePage } from "@/lib/contracts";
import type {
  ArchitectureGraph,
  ArchitectureModel,
  ArchitectureNode,
  ArchitectureEdge,
  CatalogRate,
  CursorPage,
  ExchangeQuote,
  Parameters,
  Region,
  Valuation,
} from "@/lib/portal-contracts";
import { ApiNotice, EmptyState, PageHeading, usePageStyles } from "../shared";
import {
  dateLabel,
  failure,
  Feedback,
  money,
  type Notice,
  usePortalStyles,
} from "./shared";
import { NodeProperties, EdgeProperties } from "./canvas-forms";
import { ValuationResult } from "./valuation-result";

type ResourceNode = Node<
  { component: ArchitectureNode; rate?: CatalogRate },
  "resource"
>;
type ResourceEdge = Edge<{ connection: ArchitectureEdge }>;
const useStyles = makeStyles({
  workspace: {
    display: "grid",
    gridTemplateColumns: "280px minmax(0,1fr)",
    gap: tokens.spacingHorizontalL,
    minWidth: 0,
    "@media (max-width:1100px)": { gridTemplateColumns: "minmax(0,1fr)" },
  },
  palette: {
    display: "grid",
    gap: tokens.spacingVerticalM,
    maxHeight: "620px",
    overflowY: "auto",
    padding: tokens.spacingHorizontalXS,
    ":focus-visible": {
      outline: `${tokens.strokeWidthThick} solid ${tokens.colorStrokeFocus2}`,
    },
    "@media (max-width: 1100px)": { maxHeight: "300px" },
  },
  canvas: {
    height: "560px",
    minWidth: 0,
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.border(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke2,
    ),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
  },
  right: {
    display: "grid",
    gap: tokens.spacingVerticalL,
    minWidth: 0,
    alignContent: "start",
  },
  node: {
    width: "240px",
    height: "128px",
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalL),
    ...shorthands.border(
      tokens.strokeWidthThick,
      "solid",
      tokens.colorNeutralStroke1,
    ),
    boxShadow: tokens.shadow2,
  },
  selected: { ...shorthands.borderColor(tokens.colorBrandStroke1) },
  nodeTop: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    minWidth: 0,
  },
  nodeName: { minWidth: 0, flexGrow: 1 },
  port: {
    width: "12px",
    height: "12px",
    backgroundColor: tokens.colorBrandBackground,
    ...shorthands.border(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralBackground1,
    ),
  },
  rows: { display: "grid", gap: tokens.spacingVerticalS },
  line: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalS,
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    ...shorthands.borderBottom(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke2,
    ),
  },
});
function ResourceCard({ data, selected }: NodeProps<ResourceNode>) {
  const styles = useStyles();
  const ui = usePortalStyles();
  return (
    <>
      <Handle type="target" position={Position.Left} className={styles.port} />
      <Card className={mergeClasses(styles.node, selected && styles.selected)}>
        <div className={styles.nodeTop}>
          <CloudRegular aria-hidden="true" />
          <Text weight="semibold" truncate className={styles.nodeName}>
            {data.component.name}
          </Text>
        </div>
        <Text size={200}>
          {data.rate
            ? `${data.rate.serviceCode} · ${data.rate.regionCode}`
            : `Tarifa ${data.component.rateId}`}
        </Text>
        <p className={ui.muted}>
          {data.component.quantity} unidade(s) · {data.component.consumption}{" "}
          {data.component.consumptionUnit}
        </p>
      </Card>
      <Handle type="source" position={Position.Right} className={styles.port} />
    </>
  );
}
const nodeTypes = { resource: ResourceCard };
function nodeFrom(
  component: ArchitectureNode,
  rates: CatalogRate[],
): ResourceNode {
  return {
    id: component.id,
    type: "resource",
    position: { x: component.x, y: component.y },
    width: 240,
    height: 128,
    data: { component, rate: rates.find((r) => r.id === component.rateId) },
    ariaLabel: component.name,
  };
}
function edgeFrom(connection: ArchitectureEdge): ResourceEdge {
  return {
    id: connection.id,
    source: connection.source,
    target: connection.target,
    data: { connection },
    animated: false,
    label: `${connection.monthlyGb} GB/mês`,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: tokens.colorBrandStroke1,
    },
    style: { stroke: tokens.colorBrandStroke1, strokeWidth: 2 },
  };
}
function documentOf(
  nodes: ResourceNode[],
  edges: ResourceEdge[],
): ArchitectureGraph {
  return {
    nodes: nodes.map((n) => ({
      ...n.data.component,
      x: n.position.x,
      y: n.position.y,
    })),
    edges: edges.map((e) => ({
      ...e.data!.connection,
      source: e.source,
      target: e.target,
    })),
  };
}
function consumptionDefaults(rate: CatalogRate) {
  if (/^(hrs?|hours?)$/i.test(rate.unit))
    return { consumptionUnit: "Hrs", period: "HOUR" as const };
  if (/gb.*mo/i.test(rate.unit))
    return { consumptionUnit: "GB", period: "MONTH" as const };
  if (/gib.*mo/i.test(rate.unit))
    return { consumptionUnit: "GiB", period: "MONTH" as const };
  return { consumptionUnit: rate.unit, period: "MONTH" as const };
}

export interface CanvasData {
  model: ApiResult<ArchitectureModel> | null;
  providers: ApiResult<Provider[]>;
  services: ApiResult<ServicePage>;
  rates: ApiResult<CursorPage<CatalogRate>>;
  quotes: ApiResult<ExchangeQuote[]>;
  parameters: ApiResult<Parameters>;
  resolvedRates: CatalogRate[];
}
export function CanvasView({ data }: { data: CanvasData }) {
  const model = data.model?.ok ? data.model.data : null;
  const rates = [
    ...data.resolvedRates,
    ...(data.rates.ok ? data.rates.data.items : []),
  ];
  return (
    <ReactFlowProvider
      initialNodes={(model?.graph.nodes || []).map((node) =>
        nodeFrom(node, rates),
      )}
      initialEdges={(model?.graph.edges || []).map(edgeFrom)}
      initialWidth={800}
      initialHeight={560}
    >
      <CanvasEditor data={data} />
    </ReactFlowProvider>
  );
}
function CanvasEditor({ data }: { data: CanvasData }) {
  const shared = usePageStyles();
  const styles = useStyles();
  const ui = usePortalStyles();
  const first = useRef<HTMLInputElement>(null);
  const flow = useReactFlow<ResourceNode, ResourceEdge>();
  const initial = data.model?.ok ? data.model.data : null;
  const initialRates = [
    ...data.resolvedRates,
    ...(data.rates.ok ? data.rates.data.items : []),
  ];
  const [model, setModel] = useState(initial);
  const [name, setName] = useState(initial?.name || "Nova arquitetura");
  const [hours, setHours] = useState(
    String(
      initial?.hoursPerMonth ??
        (data.parameters.ok ? data.parameters.data.hoursPerMonth : 720),
    ),
  );
  const [nodes, setNodes, onNodesChange] = useNodesState<ResourceNode>(
    (initial?.graph.nodes || []).map((n) => nodeFrom(n, initialRates)),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<ResourceEdge>(
    (initial?.graph.edges || []).map(edgeFrom),
  );
  const [saved, setSaved] = useState(
    initial
      ? JSON.stringify({
          name: initial.name,
          hoursPerMonth: initial.hoursPerMonth,
          graph: documentOf(
            initial.graph.nodes.map((n) => nodeFrom(n, initialRates)),
            initial.graph.edges.map(edgeFrom),
          ),
        })
      : "",
  );
  const [rates, setRates] = useState(
    data.rates.ok
      ? data.rates.data
      : { items: [], size: 50, hasMore: false, nextAfterId: null },
  );
  const [known, setKnown] = useState(initialRates);
  const [services, setServices] = useState(
    data.services.ok
      ? data.services.data
      : { items: [], size: 200, hasMore: false, nextAfter: null },
  );
  const [regions, setRegions] = useState<Region[]>([]);
  const [provider, setProvider] = useState("");
  const [service, setService] = useState("");
  const [region, setRegion] = useState("");
  const [selection, setSelection] = useState<{ node?: string; edge?: string }>(
    {},
  );
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [quoteId, setQuoteId] = useState(
    data.quotes.ok ? data.quotes.data[0]?.id || "" : "",
  );
  const [estimateName, setEstimateName] = useState(
    initial ? `${initial.name.slice(0, 180)} · cenário` : "Novo cenário",
  );
  const [notice, setNotice] = useState<Notice | null>(null);
  const [value, setValue] = useState<Valuation | null>(null);
  const [pending, start] = useTransition();
  const readOnly = model?.status === "PUBLISHED";
  const locked = readOnly || pending;
  const graph = documentOf(nodes, edges);
  const dirty =
    saved !== JSON.stringify({ name, hoursPerMonth: Number(hours), graph });
  const selectedNode = nodes.find((n) => n.id === selection.node);
  const selectedEdge = edges.find((e) => e.id === selection.edge);
  function add(rate: CatalogRate) {
    if (locked) return;
    if (nodes.length + edges.length >= 100)
      return setNotice({
        intent: "warning",
        message: "O modelo aceita até 100 componentes e ligações no total.",
      });
    const component: ArchitectureNode = {
      id: crypto.randomUUID(),
      name: rate.serviceCode,
      x: 80 + (nodes.length % 3) * 300,
      y: 80 + Math.floor(nodes.length / 3) * 180,
      rateId: rate.id,
      category: rate.family || "infraestrutura",
      accountCode: "principal",
      quantity: "1",
      consumption: "1",
      ...consumptionDefaults(rate),
      retentionDays: null,
      availabilityZone: null,
    };
    setNodes((old) => [...old, nodeFrom(component, known)]);
    setSelection({ node: component.id });
  }
  function connect(connection: Connection) {
    if (
      locked ||
      !connection.source ||
      !connection.target ||
      connection.source === connection.target
    )
      return;
    if (nodes.length + edges.length >= 100)
      return setNotice({
        intent: "warning",
        message: "O modelo aceita até 100 componentes e ligações.",
      });
    if (
      edges.some(
        (e) => e.source === connection.source && e.target === connection.target,
      )
    )
      return;
    const edge: ArchitectureEdge = {
      id: crypto.randomUUID(),
      source: connection.source,
      target: connection.target,
      monthlyGb: "0",
      direction: "INTERNAL",
      connectivity: "DIRECT",
      charges: [],
    };
    setEdges((old) => [...old, edgeFrom(edge)]);
    setSelection({ edge: edge.id });
    setSource("");
    setTarget("");
  }
  function accept(result: ArchitectureModel) {
    setModel(result);
    setName(result.name);
    setHours(String(result.hoursPerMonth));
    setNodes(result.graph.nodes.map((n) => nodeFrom(n, known)));
    setEdges(result.graph.edges.map(edgeFrom));
    setSaved(
      JSON.stringify({
        name: result.name,
        hoursPerMonth: result.hoursPerMonth,
        graph: documentOf(
          result.graph.nodes.map((n) => nodeFrom(n, known)),
          result.graph.edges.map(edgeFrom),
        ),
      }),
    );
    window.history.replaceState(null, "", `/canvas?model=${result.id}`);
  }
  async function persist() {
    if (
      !name.trim() ||
      !Number.isFinite(Number(hours)) ||
      Number(hours) <= 0 ||
      Number(hours) > 744
    ) {
      setNotice({
        intent: "error",
        message:
          "Informe o nome da arquitetura e de 0 a 744 horas mensais, com valor maior que zero.",
      });
      first.current?.focus();
      return null;
    }
    if (model && !dirty) return model;
    const response = await saveArchitecture(model?.id || null, {
      name,
      hoursPerMonth: Number(hours),
      graph,
      revision: model?.revision || 0,
    });
    if (!response.ok) {
      setNotice(failure(response));
      return null;
    }
    accept(response.data);
    return response.data;
  }
  function search(append = false) {
    start(async () => {
      const response = await searchRates({
        provider,
        service,
        region,
        afterId: append ? (rates.nextAfterId ?? undefined) : undefined,
      });
      if (!response.ok) return setNotice(failure(response));
      setRates({
        ...response.data,
        items: append
          ? [...rates.items, ...response.data.items]
          : response.data.items,
      });
      setKnown((old) => [
        ...old,
        ...response.data.items.filter((r) => !old.some((k) => k.id === r.id)),
      ]);
    });
  }
  const ready =
    data.providers.ok &&
    data.rates.ok &&
    data.parameters.ok &&
    (!data.model || data.model.ok);
  return (
    <div className={shared.page}>
      <PageHeading
        title="Canvas de arquitetura"
        showRefresh={false}
        description="Monte os componentes com preços sincronizados, configure os fluxos e publique um modelo reutilizável."
      />
      {!ready && (
        <ApiNotice message="Não foi possível preparar todos os dados do Canvas. Confira a API e a preparação das bases antes de continuar." />
      )}
      <Feedback
        notice={notice}
        onDismiss={() => setNotice(null)}
        onReview={() => first.current?.focus()}
      />
      <Card className={shared.card}>
        <div className={ui.fields}>
          <Field label="Nome da arquitetura" required>
            <Input
              ref={first}
              value={name}
              maxLength={200}
              required
              disabled={locked}
              onChange={(_, item) => setName(item.value)}
            />
          </Field>
          <Field label="Horas por mês" required>
            <Input
              type="number"
              min="0.000001"
              max="744"
              step="0.000001"
              value={hours}
              required
              disabled={locked}
              onChange={(_, item) => setHours(item.value)}
            />
          </Field>
        </div>
        <div className={ui.actions}>
          <div className={ui.row}>
            <Badge
              appearance="tint"
              color={readOnly ? "success" : "informative"}
            >
              {readOnly ? "Modelo publicado" : "Rascunho"}
            </Badge>
            <span className={ui.muted}>
              {nodes.length} componentes · {edges.length} ligações
              {dirty && !readOnly ? " · Alterações não salvas" : ""}
            </span>
          </div>
          <div className={ui.row}>
            {!readOnly && (
              <>
                <Button
                  icon={<SaveRegular />}
                  disabled={pending || !ready}
                  onClick={() =>
                    start(async () => {
                      if (await persist())
                        setNotice({
                          intent: "success",
                          message: "Rascunho salvo.",
                        });
                    })
                  }
                >
                  {pending ? "Aguarde…" : "Salvar rascunho"}
                </Button>
                <Button
                  appearance="primary"
                  disabled={pending || !ready || !nodes.length}
                  onClick={() =>
                    start(async () => {
                      const savedModel = await persist();
                      if (!savedModel) return;
                      const result = await publishArchitecture(
                        savedModel.id,
                        savedModel.revision,
                      );
                      if (!result.ok) return setNotice(failure(result));
                      accept(result.data);
                      setNotice({
                        intent: "success",
                        message:
                          "Modelo publicado no catálogo final. Ele pode ser reutilizado em novas estimativas.",
                      });
                    })
                  }
                >
                  Publicar modelo
                </Button>
              </>
            )}
            <Button as="a" href="/modelos">
              Ver modelos
            </Button>
          </div>
        </div>
        {readOnly && (
          <p className={ui.muted}>
            Este modelo foi publicado. Para mudar a arquitetura, crie uma cópia
            na lista de modelos. Você pode gerar estimativas sem alterar o
            modelo.
          </p>
        )}
      </Card>
      <div className={styles.workspace}>
        <Card className={shared.card}>
          <h2 className={ui.title}>Biblioteca de componentes</h2>
          <form
            className={ui.form}
            onSubmit={(event) => {
              event.preventDefault();
              search();
            }}
          >
            <Field label="Provedor">
              <Select
                value={provider}
                disabled={pending}
                onChange={(_, item) => {
                  setProvider(item.value);
                  setService("");
                  setRegion("");
                  start(async () => {
                    const list = await loadServices(item.value);
                    if (list.ok) setServices(list.data);
                    const listRegions = item.value
                      ? await loadRegions(item.value)
                      : null;
                    setRegions(listRegions?.ok ? listRegions.data : []);
                  });
                }}
              >
                <option value="">Todos os provedores</option>
                {data.providers.ok &&
                  data.providers.data.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Serviço">
              <Select
                value={service}
                disabled={pending}
                onChange={(_, item) => setService(item.value)}
              >
                <option value="">Todos os serviços</option>
                {services.items.map((s) => (
                  <option key={`${s.provider}/${s.code}`} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            {services.hasMore && (
              <Button
                size="small"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const response = await loadServices(
                      provider,
                      services.nextAfter || "",
                    );
                    if (response.ok)
                      setServices({
                        ...response.data,
                        items: [...services.items, ...response.data.items],
                      });
                    else setNotice(failure(response));
                  })
                }
              >
                Carregar mais serviços
              </Button>
            )}
            <Field label="Região">
              <Select
                value={region}
                disabled={pending}
                onChange={(_, item) => setRegion(item.value)}
              >
                <option value="">Todas as regiões</option>
                {regions.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="submit" disabled={pending}>
              Buscar tarifas
            </Button>
          </form>
          <p className={ui.muted}>
            Preços locais On-Demand em USD. Confira a unidade e a faixa antes de
            adicionar.
          </p>
          <div
            className={styles.palette}
            role="region"
            aria-label="Tarifas disponíveis"
            tabIndex={0}
          >
            {rates.items
              .filter((r) => r.currency === "USD")
              .map((rate) => (
                <Card key={rate.id} size="small">
                  <Text weight="semibold">{rate.serviceCode}</Text>
                  <Text size={200}>
                    {rate.regionCode} · {rate.family}
                  </Text>
                  <Text size={200}>
                    {rate.sku} · {rate.unit}
                  </Text>
                  <Text>{money(rate.unitPrice, "USD")} por unidade</Text>
                  <Text size={200}>
                    Faixa: {rate.rangeBegin} a {rate.rangeEnd ?? "sem limite"}
                  </Text>
                  <Button
                    size="small"
                    icon={<AddRegular />}
                    disabled={locked || !ready}
                    onClick={() => add(rate)}
                  >
                    Adicionar componente
                  </Button>
                  {selectedNode && !locked && (
                    <Button
                      size="small"
                      onClick={() =>
                        setNodes((old) =>
                          old.map((n) =>
                            n.id === selectedNode.id
                              ? {
                                  ...n,
                                  data: {
                                    component: {
                                      ...n.data.component,
                                      rateId: rate.id,
                                      ...consumptionDefaults(rate),
                                    },
                                    rate,
                                  },
                                }
                              : n,
                          ),
                        )
                      }
                    >
                      Substituir tarifa selecionada
                    </Button>
                  )}
                </Card>
              ))}
          </div>
          {!rates.items.length && (
            <EmptyState
              icon={<GridRegular />}
              title="Nenhuma tarifa disponível"
              description="Prepare o catálogo no fluxo do Construtor ou revise os filtros para encontrar preços já sincronizados."
              action={{
                href: "/construtor/sincronizacoes",
                label: "Preparar bases",
              }}
            />
          )}
          {rates.hasMore && (
            <Button disabled={pending} onClick={() => search(true)}>
              Carregar mais tarifas
            </Button>
          )}
        </Card>
        <div className={styles.right}>
          <div className={ui.actions}>
            <h2 className={ui.title}>Desenho da arquitetura</h2>
            <div className={ui.row}>
              <Button
                icon={<AddRegular />}
                aria-label="Ampliar Canvas"
                onClick={() => void flow.zoomIn({ duration: 0 })}
              />
              <Button
                icon={<SubtractRegular />}
                aria-label="Reduzir Canvas"
                onClick={() => void flow.zoomOut({ duration: 0 })}
              />
              <Button
                onClick={() => void flow.fitView({ duration: 0, padding: 0.2 })}
              >
                Enquadrar componentes
              </Button>
            </div>
          </div>
          <div
            className={styles.canvas}
            role="region"
            aria-label="Editor visual de arquitetura"
          >
            <ReactFlow<ResourceNode, ResourceEdge>
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={connect}
              nodesDraggable={!locked}
              nodesConnectable={!locked}
              edgesReconnectable={false}
              deleteKeyCode={locked ? null : ["Backspace", "Delete"]}
              onNodesDelete={(removed) => {
                const ids = new Set(removed.map((n) => n.id));
                setEdges((old) =>
                  old.filter((e) => !ids.has(e.source) && !ids.has(e.target)),
                );
              }}
              onNodeClick={(_, node) => setSelection({ node: node.id })}
              onEdgeClick={(_, edge) => setSelection({ edge: edge.id })}
              minZoom={0.2}
              maxZoom={2}
              ariaLabelConfig={{
                "node.a11yDescription.keyboardDisabled":
                  "Selecione o componente para consultar suas propriedades na lista abaixo.",
                "node.a11yDescription.ariaLiveMessage": ({ direction, x, y }) =>
                  `Componente movido para ${direction === "left" ? "a esquerda" : direction === "right" ? "a direita" : direction === "up" ? "cima" : "baixo"}, posição ${Math.round(x)}, ${Math.round(y)}.`,
                "controls.ariaLabel": "Controles do Canvas",
                "controls.zoomIn.ariaLabel": "Ampliar",
                "controls.zoomOut.ariaLabel": "Reduzir",
                "controls.fitView.ariaLabel": "Enquadrar componentes",
                "controls.interactive.ariaLabel": "Alternar edição",
                "minimap.ariaLabel": "Visão geral da arquitetura",
                "handle.ariaLabel": "Ponto de ligação",
                "node.a11yDescription.default":
                  "Use as setas para mover o componente; Delete para remover. As propriedades também estão disponíveis na lista abaixo.",
                "edge.a11yDescription.default":
                  "Use Delete para remover a ligação. As propriedades também estão disponíveis na lista abaixo.",
              }}
            >
              <Background gap={20} color={tokens.colorNeutralStroke2} />
            </ReactFlow>
          </div>
          <p className={ui.muted}>
            Arraste os componentes e conecte os pontos laterais. Você também
            pode configurar todos os componentes e criar ligações pelos
            controles abaixo, sem arrastar.
          </p>
        </div>
      </div>
      <Card className={shared.card}>
        <h2 className={ui.title}>Componentes e ligações</h2>
        {!nodes.length ? (
          <p>Adicione um componente da biblioteca para começar.</p>
        ) : (
          <>
            <div className={styles.rows}>
              {nodes.map((node) => (
                <div className={styles.line} key={node.id}>
                  <span>{node.data.component.name}</span>
                  <div className={ui.row}>
                    <Button onClick={() => setSelection({ node: node.id })}>
                      Configurar componente
                    </Button>
                    {!locked && (
                      <Button
                        onClick={() => {
                          setNodes((old) =>
                            old.filter((n) => n.id !== node.id),
                          );
                          setEdges((old) =>
                            old.filter(
                              (e) =>
                                e.source !== node.id && e.target !== node.id,
                            ),
                          );
                          setSelection({});
                        }}
                      >
                        Remover componente
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {!readOnly && (
              <div className={ui.fields}>
                <Field label="Origem da ligação">
                  <Select
                    value={source}
                    disabled={pending}
                    onChange={(_, item) => setSource(item.value)}
                  >
                    <option value="">Selecione a origem</option>
                    {nodes.map((n) => (
                      <option value={n.id} key={n.id}>
                        {n.data.component.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Destino da ligação">
                  <Select
                    value={target}
                    disabled={pending}
                    onChange={(_, item) => setTarget(item.value)}
                  >
                    <option value="">Selecione o destino</option>
                    {nodes
                      .filter((n) => n.id !== source)
                      .map((n) => (
                        <option value={n.id} key={n.id}>
                          {n.data.component.name}
                        </option>
                      ))}
                  </Select>
                </Field>
                <Button
                  disabled={pending || !source || !target || source === target}
                  onClick={() =>
                    connect({
                      source,
                      target,
                      sourceHandle: null,
                      targetHandle: null,
                    })
                  }
                >
                  Adicionar ligação
                </Button>
              </div>
            )}
            <div className={styles.rows}>
              {edges.map((edge) => (
                <div className={styles.line} key={edge.id}>
                  <span>
                    {
                      nodes.find((n) => n.id === edge.source)?.data.component
                        .name
                    }{" "}
                    →{" "}
                    {
                      nodes.find((n) => n.id === edge.target)?.data.component
                        .name
                    }
                  </span>
                  <div className={ui.row}>
                    <Button onClick={() => setSelection({ edge: edge.id })}>
                      Configurar ligação
                    </Button>
                    {!locked && (
                      <Button
                        onClick={() => {
                          setEdges((old) =>
                            old.filter((e) => e.id !== edge.id),
                          );
                          setSelection({});
                        }}
                      >
                        Remover ligação
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
      {selectedNode && (
        <NodeProperties
          key={`${selectedNode.id}/${selectedNode.data.component.rateId}/${model?.revision || 0}`}
          node={selectedNode.data.component}
          rate={selectedNode.data.rate}
          readOnly={locked}
          onApply={(component) => {
            setNodes((old) =>
              old.map((n) =>
                n.id === component.id
                  ? { ...n, data: { ...n.data, component } }
                  : n,
              ),
            );
            setNotice({
              intent: "success",
              message:
                "Propriedades aplicadas. Salve o rascunho para preservá-las.",
            });
          }}
        />
      )}
      {selectedEdge && (
        <EdgeProperties
          key={`${selectedEdge.id}/${model?.revision || 0}`}
          edge={selectedEdge.data!.connection}
          rates={known}
          readOnly={locked}
          onApply={(connection) => {
            setEdges((old) =>
              old.map((e) =>
                e.id === connection.id ? edgeFrom(connection) : e,
              ),
            );
            setNotice({
              intent: "success",
              message:
                "Consumo e cobranças aplicados à ligação. Salve o rascunho para preservá-los.",
            });
          }}
        />
      )}
      <Card className={shared.card}>
        <h2 className={ui.title}>Gerar estimativa</h2>
        <div className={ui.fields}>
          <Field label="Nome da estimativa" required>
            <Input
              value={estimateName}
              maxLength={200}
              disabled={pending}
              onChange={(_, item) => setEstimateName(item.value)}
            />
          </Field>
          <Field label="Cotação PTAX de venda" required>
            <Select
              value={quoteId}
              disabled={pending}
              onChange={(_, item) => setQuoteId(item.value)}
            >
              <option value="">Selecione um fechamento</option>
              {data.quotes.ok &&
                data.quotes.data.map((q) => (
                  <option key={q.id} value={q.id}>
                    {dateLabel(q.quotationDate)} · {q.sellRate} BRL/USD
                  </option>
                ))}
            </Select>
          </Field>
        </div>
        {!quoteId && (
          <p>
            Salve o rascunho e sincronize a PTAX no{" "}
            <a href="/construtor/cambio">fluxo do Construtor</a> antes de
            converter o cenário em reais.
          </p>
        )}
        <div>
          <Button
            appearance="primary"
            disabled={
              pending ||
              !ready ||
              !quoteId ||
              !nodes.length ||
              !estimateName.trim()
            }
            onClick={() =>
              start(async () => {
                const savedModel = await persist();
                if (!savedModel) return;
                const result = await estimateArchitecture(
                  savedModel.id,
                  savedModel.revision,
                  estimateName,
                  quoteId,
                );
                if (!result.ok) return setNotice(failure(result));
                setValue(result.data);
                setNotice({
                  intent: result.data.usd.complete ? "success" : "warning",
                  message: result.data.usd.complete
                    ? "Estimativa calculada em USD e BRL, com a PTAX preservada."
                    : "A estimativa foi salva com custos pendentes. Revise as propriedades e tarifas dos componentes indicados.",
                });
              })
            }
          >
            {pending ? "Calculando…" : "Calcular e salvar estimativa"}
          </Button>
        </div>
      </Card>
      {value && <ValuationResult value={value} />}
    </div>
  );
}
