"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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
  Accordion,
  AccordionItem,
  AccordionHeader,
  AccordionPanel,
  type AccordionPanelProps,
} from "@fluentui/react-components";
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
  NodeChangeset,
  EdgeChangeset,
  type Node,
  type Edge,
  type NodeProps,
  type Connection,
} from "@xyflow/react";
import {
  estimateArchitecture,
  publishArchitecture,
  saveArchitecture,
} from "@/app/actions";
import type { ApiResult } from "@/lib/contracts";
import type {
  ArchitectureGraph,
  ArchitectureModel,
  ArchitectureNode,
  ArchitectureEdge,
  CatalogRate,
  ExchangeQuote,
  Parameters,
  Valuation,
} from "@/lib/portal-contracts";
import { ApiNotice } from "../shared";
import {
  dateLabel,
  failure,
  Feedback,
  money,
  type Notice,
  usePortalStyles,
} from "./shared";
import { ArchitectureIcon } from "../architecture-icon";
import { ComponentPricing } from "./component-pricing";
import {
  structureCategories,
  structureEnvironments,
} from "@/lib/portal-contracts";
import { StructurePalette } from "./structure-palette";
import type {
  ArchitectureComponent,
  ComponentPage,
} from "@/lib/component-contracts";
import { NodeProperties, EdgeProperties } from "./canvas-forms";
import { ValuationResult } from "./valuation-result";
import { CanvasCommandBar } from "./canvas-command-bar";
import { organizeComponents } from "./canvas-layout";

type ResourceNode = Node<
  { component: ArchitectureNode; rate?: CatalogRate },
  "resource"
>;
type ResourceEdge = Edge<{ connection: ArchitectureEdge }>;
// Keep form drafts and library filters when a section closes; native hidden handles visibility.
const persistentPanel: NonNullable<AccordionPanelProps["collapseMotion"]> = {
  children: (_, props) => <>{props.children}</>,
};
const useStyles = makeStyles({
  // AppShell reserves 76px for the product header; the drawing fills the remainder.
  editor: {
    height: "calc(100dvh - 76px)",
    minWidth: 0,
    minHeight: 0,
    display: "grid",
    gridTemplateRows: "auto minmax(0,1fr)",
  },
  workspace: {
    display: "grid",
    minWidth: 0,
    minHeight: 0,
    gridTemplateColumns: "minmax(0,1fr) 380px",
    "@media (max-width:760px)": {
      gridTemplateColumns: "minmax(0,1fr)",
      gridTemplateRows: "minmax(240px,1fr) minmax(0,1fr)",
    },
  },
  drawing: { position: "relative", minWidth: 0, minHeight: 0 },
  canvas: {
    width: "100%",
    height: "100%",
    backgroundColor: tokens.colorNeutralBackground2,
  },
  sidebar: {
    minWidth: 0,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    backgroundColor: tokens.colorNeutralBackground1,
    borderLeft: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    "@media (max-width:760px)": {
      borderLeftWidth: 0,
      borderTop: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    },
  },
  sidebarHeader: {
    display: "grid",
    gap: tokens.spacingVerticalXS,
    padding: tokens.spacingHorizontalL,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  sidebarBody: {
    overflowY: "auto",
    minHeight: 0,
    flexGrow: 1,
    scrollbarGutter: "stable",
    ":focus-visible": {
      outline: `${tokens.strokeWidthThick} solid ${tokens.colorStrokeFocus2}`,
    },
  },
  section: {
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  sectionContent: {
    margin: 0,
    padding: tokens.spacingHorizontalL,
    paddingTop: tokens.spacingVerticalS,
    display: "grid",
    gap: tokens.spacingVerticalL,
    minWidth: 0,
    "> *": { minWidth: 0 },
    "&[hidden]": { display: "none" },
  },
  resourceContent: {
    display: "grid",
    gap: tokens.spacingVerticalL,
    minWidth: 0,
    "> *": { minWidth: 0 },
    "&[hidden]": { display: "none" },
  },
  palette: { display: "grid", gap: tokens.spacingVerticalM, minWidth: 0 },
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
          <ArchitectureIcon
            icon={
              data.component.iconAssetPath
                ? { assetPath: data.component.iconAssetPath }
                : null
            }
            size={40}
          />
          <Text weight="semibold" truncate className={styles.nodeName}>
            {data.component.name}
          </Text>
        </div>
        <Text size={200}>
          {data.rate
            ? `${data.rate.serviceCode} · ${data.rate.regionCode}`
            : data.component.rateId
              ? `Tarifa ${data.component.rateId}`
              : `${data.component.provider} · Tarifa a definir`}
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
    labelStyle: {
      fill: tokens.colorNeutralForeground1,
      fontSize: tokens.fontSizeBase200,
    },
    labelBgStyle: { fill: tokens.colorNeutralBackground1 },
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
  quotes: ApiResult<ExchangeQuote[]>;
  parameters: ApiResult<Parameters>;
  resolvedRates: CatalogRate[];
  components: ApiResult<ComponentPage<ArchitectureComponent>>;
}
export function CanvasView({ data }: { data: CanvasData }) {
  const model = data.model?.ok ? data.model.data : null;
  const rates = data.resolvedRates;
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
  const styles = useStyles();
  const ui = usePortalStyles();
  const first = useRef<HTMLInputElement>(null);
  const [sections, setSections] = useState<string[]>(["resources"]);
  function openSection(section: string) {
    setSections((old) => (old.includes(section) ? old : [...old, section]));
  }
  const flow = useReactFlow<ResourceNode, ResourceEdge>();
  const drawing = useRef<HTMLDivElement>(null);
  const initial = data.model?.ok ? data.model.data : null;
  const initialRates = data.resolvedRates;
  const [model, setModel] = useState(initial);
  const [name, setName] = useState(initial?.name || "Nova estrutura");
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
  const [known, setKnown] = useState(initialRates);
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
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const archived = !!model?.archivedAt;
  const readOnly = model?.status === "PUBLISHED" || archived;
  const dragged = useRef<ArchitectureComponent | null>(null);
  const locked = readOnly || pending || !mounted;
  const graph = documentOf(nodes, edges);
  const dirty =
    saved !== JSON.stringify({ name, hoursPerMonth: Number(hours), graph });
  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (dirty && !readOnly) event.preventDefault();
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty, readOnly]);
  const selectedNode = nodes.find((n) => n.id === selection.node);
  const selectedEdge = edges.find((e) => e.id === selection.edge);
  useEffect(() => {
    if (selection.node || selection.edge) openSection("properties");
  }, [selection.node, selection.edge]);
  function addResource(
    template: ArchitectureComponent,
    position?: { x: number; y: number },
  ) {
    if (locked) return;
    if (
      template.provider !== "GENERIC" &&
      !model?.specification?.locations.some(
        (l) => l.provider === template.provider,
      )
    ) {
      setNotice({
        intent: "warning",
        message: "O recurso usa uma cloud fora da especificação da estrutura.",
      });
      return;
    }
    if (nodes.length + edges.length >= 100) {
      setNotice({
        intent: "warning",
        message: "A estrutura aceita até 100 componentes e ligações.",
      });
      return;
    }
    const bounds = drawing.current?.getBoundingClientRect();
    const center = flow.screenToFlowPosition({
      x: (bounds?.x ?? 0) + (bounds?.width ?? window.innerWidth) / 2 - 120,
      y: (bounds?.y ?? 0) + (bounds?.height ?? window.innerHeight) / 2 - 64,
    });
    const node: ArchitectureNode = {
      id: crypto.randomUUID(),
      name: template.name,
      x: position?.x ?? center.x,
      y: position?.y ?? center.y,
      rateId: null,
      provider: template.provider,
      serviceCode: template.serviceCode,
      iconKey: template.icon?.key,
      iconRelease: template.icon?.release,
      iconAssetPath: template.icon?.assetPath,
      category: template.category,
      accountCode: "principal",
      quantity: "1",
      consumption: "1",
      consumptionUnit: "Hrs",
      period: "HOUR",
      retentionDays: null,
      availabilityZone: null,
    };
    setNodes((old) => [...old, nodeFrom(node, known)]);
    setSelection({ node: node.id });
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
        message: "A estrutura aceita até 100 componentes e ligações.",
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
          "Informe o nome da estrutura e de 0 a 744 horas mensais, com valor maior que zero.",
      });
      openSection("structure");
      requestAnimationFrame(() => first.current?.focus());
      return null;
    }
    if (!model?.specification) return null;
    if (!dirty) return model;
    const response = await saveArchitecture(model.id, {
      specification: model.specification,
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
  const ready = data.parameters.ok && (!data.model || data.model.ok);
  return (
    <div className={styles.editor}>
      <CanvasCommandBar
        readOnly={readOnly}
        pending={pending}
        canOrganize={!locked && nodes.length > 1}
        canDelete={
          !locked &&
          !!(
            selectedNode ||
            selectedEdge ||
            nodes.some((n) => n.selected) ||
            edges.some((e) => e.selected)
          )
        }
        canSave={!locked && ready}
        onOrganize={() => {
          if (locked) return;
          setNodes((old) => organizeComponents(old, edges));
          setNotice({
            intent: "success",
            message:
              "Componentes organizados. Salve a estrutura para manter o desenho.",
          });
          requestAnimationFrame(
            () => void flow.fitView({ duration: 0, padding: 0.2 }),
          );
        }}
        onDelete={() => {
          if (locked) return;
          void flow.deleteElements({
            nodes: nodes
              .filter((n) => n.selected || n.id === selection.node)
              .map((n) => ({ id: n.id })),
            edges: edges
              .filter((e) => e.selected || e.id === selection.edge)
              .map((e) => ({ id: e.id })),
          });
          setSelection({});
        }}
        onZoomIn={() => void flow.zoomIn({ duration: 0 })}
        onZoomOut={() => void flow.zoomOut({ duration: 0 })}
        onFit={() => void flow.fitView({ duration: 0, padding: 0.2 })}
        onSave={() =>
          start(async () => {
            if (await persist())
              setNotice({ intent: "success", message: "Estrutura salva." });
          })
        }
      />
      <div className={styles.workspace}>
        <div className={styles.drawing}>
          <div
            className={styles.canvas}
            ref={drawing}
            role="region"
            aria-label="Editor visual de arquitetura"
            onDragOver={(event) => {
              if (!locked) {
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (locked) return;
              const position = flow.screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
              });
              const componentId = event.dataTransfer.getData(
                "application/x-structure-component",
              );
              if (dragged.current?.id === componentId) {
                addResource(dragged.current, position);
                dragged.current = null;
                return;
              }
            }}
          >
            <ReactFlow<ResourceNode, ResourceEdge>
              nodes={nodes}
              edges={edges}
              fitView
              fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
              nodeTypes={nodeTypes}
              onNodesChange={(changes) =>
                onNodesChange(
                  locked
                    ? new NodeChangeset(
                        changes
                          .toArray()
                          .filter(
                            (c) =>
                              c.type === "select" || c.type === "dimensions",
                          ),
                      )
                    : changes,
                )
              }
              onEdgesChange={(changes) =>
                onEdgesChange(
                  locked
                    ? new EdgeChangeset(
                        changes.toArray().filter((c) => c.type === "select"),
                      )
                    : changes,
                )
              }
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
                  "Selecione o componente para consultar suas propriedades na central de recursos.",
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
                  "Use as setas para mover o componente; Delete para remover. As propriedades também estão disponíveis na central de recursos.",
                "edge.a11yDescription.default":
                  "Use Delete para remover a ligação. As propriedades também estão disponíveis na central de recursos.",
              }}
            >
              <Background gap={20} color={tokens.colorNeutralStroke2} />
            </ReactFlow>
          </div>
        </div>
        <aside className={styles.sidebar} aria-label="Central de recursos">
          <header className={styles.sidebarHeader}>
            <h2 className={ui.title}>Central de recursos</h2>
            <Text size={200}>
              {nodes.length} componentes · {edges.length} ligações
              {dirty && !readOnly ? " · Alterações não salvas" : ""}
            </Text>
          </header>
          <div className={styles.sidebarBody}>
            {!ready && (
              <ApiNotice message="Não foi possível preparar todos os dados do Canvas. Confira a API e a preparação das bases antes de continuar." />
            )}
            <Feedback
              notice={notice}
              onDismiss={() => setNotice(null)}
              onReview={() => {
                openSection("structure");
                first.current?.focus();
              }}
            />
            <Accordion
              multiple
              collapsible
              openItems={sections}
              onToggle={(_, item) => setSections(item.openItems.map(String))}
            >
              <AccordionItem value="properties" className={styles.section}>
                <AccordionHeader as="h2" expandIconPosition="end">
                  {selectedEdge
                    ? "Propriedades da ligação"
                    : "Propriedades do componente"}
                </AccordionHeader>
                <AccordionPanel
                  className={styles.sectionContent}
                  collapseMotion={persistentPanel}
                  hidden={!sections.includes("properties")}
                >
                  {!selectedNode && !selectedEdge && (
                    <div className={ui.form}>
                      <p>
                        Selecione um componente ou uma ligação para configurar a
                        solução.
                      </p>
                      <p className={ui.muted}>
                        Conecte os pontos laterais ou use os controles de
                        ligação na seção Componentes e ligações.
                      </p>
                    </div>
                  )}
                  {selectedNode && (
                    <>
                      <NodeProperties
                        embedded
                        key={`${selectedNode.id}/${model?.revision || 0}`}
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
                              "Propriedades aplicadas. Salve a estrutura para preservá-las.",
                          });
                        }}
                      />
                      <ComponentPricing
                        node={selectedNode.data.component}
                        specification={model!.specification!}
                        readOnly={locked}
                        onKnown={(rates) =>
                          setKnown((old) => [
                            ...old,
                            ...rates.filter(
                              (r) => !old.some((k) => k.id === r.id),
                            ),
                          ])
                        }
                        onService={(serviceCode) =>
                          setNodes((old) =>
                            old.map((n) =>
                              n.id === selectedNode.id
                                ? {
                                    ...n,
                                    data: {
                                      ...n.data,
                                      rate: undefined,
                                      component: {
                                        ...n.data.component,
                                        serviceCode: serviceCode || null,
                                        rateId: null,
                                      },
                                    },
                                  }
                                : n,
                            ),
                          )
                        }
                        onRate={(rate) => {
                          setKnown((old) =>
                            old.some((r) => r.id === rate.id)
                              ? old
                              : [...old, rate],
                          );
                          setNodes((old) =>
                            old.map((n) =>
                              n.id === selectedNode.id
                                ? {
                                    ...n,
                                    data: {
                                      ...n.data,
                                      rate,
                                      component: {
                                        ...n.data.component,
                                        rateId: rate.id,
                                        ...consumptionDefaults(rate),
                                      },
                                    },
                                  }
                                : n,
                            ),
                          );
                        }}
                      />
                    </>
                  )}

                  {selectedEdge && (
                    <EdgeProperties
                      embedded
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
                            "Ligação configurada. Salve a estrutura para preservar as alterações.",
                        });
                      }}
                    />
                  )}
                </AccordionPanel>
              </AccordionItem>

              <AccordionItem value="resources" className={styles.section}>
                <AccordionHeader as="h2" expandIconPosition="end">
                  Recursos da solução
                </AccordionHeader>
                <AccordionPanel
                  className={styles.sectionContent}
                  collapseMotion={persistentPanel}
                  hidden={!sections.includes("resources")}
                >
                  <StructurePalette
                    showTitle={false}
                    locations={model!.specification!.locations}
                    primaryProvider={model!.specification!.primaryProvider}
                    initial={data.components}
                    locked={locked || !ready}
                    onAdd={addResource}
                    onDrag={(event, component) => {
                      dragged.current = component;
                      event.dataTransfer.setData(
                        "application/x-structure-component",
                        component.id,
                      );
                      event.dataTransfer.effectAllowed = "copy";
                    }}
                  />
                </AccordionPanel>
              </AccordionItem>

              <AccordionItem value="connections" className={styles.section}>
                <AccordionHeader as="h2" expandIconPosition="end">
                  Componentes e ligações
                </AccordionHeader>
                <AccordionPanel
                  className={styles.sectionContent}
                  collapseMotion={persistentPanel}
                  hidden={!sections.includes("connections")}
                >
                  <div className={ui.form}>
                    {!nodes.length ? (
                      <p>Adicione um componente da biblioteca para começar.</p>
                    ) : (
                      <>
                        <div className={styles.rows}>
                          {nodes.map((node) => (
                            <div className={styles.line} key={node.id}>
                              <span>{node.data.component.name}</span>
                              <div className={ui.row}>
                                <Button
                                  onClick={() =>
                                    setSelection({ node: node.id })
                                  }
                                >
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
                                            e.source !== node.id &&
                                            e.target !== node.id,
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
                              disabled={
                                pending ||
                                !source ||
                                !target ||
                                source === target
                              }
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
                                  nodes.find((n) => n.id === edge.source)?.data
                                    .component.name
                                }{" "}
                                →{" "}
                                {
                                  nodes.find((n) => n.id === edge.target)?.data
                                    .component.name
                                }
                              </span>
                              <div className={ui.row}>
                                <Button
                                  onClick={() =>
                                    setSelection({ edge: edge.id })
                                  }
                                >
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
                  </div>
                </AccordionPanel>
              </AccordionItem>

              <AccordionItem value="structure" className={styles.section}>
                <AccordionHeader as="h2" expandIconPosition="end">
                  Dados da estrutura
                </AccordionHeader>
                <AccordionPanel
                  className={styles.sectionContent}
                  collapseMotion={persistentPanel}
                  hidden={!sections.includes("structure")}
                >
                  <div className={ui.form}>
                    {model?.specification && (
                      <div className={ui.form}>
                        <Text weight="semibold">
                          Provedor principal:{" "}
                          {model.specification.primaryProvider}
                        </Text>
                        <Text>
                          {structureCategories[model.specification.category]} ·{" "}
                          {
                            structureEnvironments[
                              model.specification.environment
                            ]
                          }
                        </Text>
                        {model.specification.description && (
                          <Text>{model.specification.description}</Text>
                        )}
                        {model.specification.locations.map((l) => (
                          <Text key={l.provider}>
                            {l.provider} · {l.regionCode}
                          </Text>
                        ))}
                        <Text size={200}>
                          As regiões pertencem à estrutura. Para comparar outro
                          local, use Duplicar estrutura na gestão.
                        </Text>
                      </div>
                    )}
                    <div className={ui.fields}>
                      <Field label="Nome da estrutura" required>
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
                          {archived
                            ? "Estrutura arquivada"
                            : readOnly
                              ? "Estrutura promovida"
                              : "Em elaboração"}
                        </Badge>
                      </div>
                      <div className={ui.row}>
                        {!readOnly && (
                          <>
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
                                  if (!result.ok)
                                    return setNotice(failure(result));
                                  accept(result.data);
                                  setNotice({
                                    intent: "success",
                                    message:
                                      "Estrutura promovida. A versão pode ser reutilizada nas próximas estimativas.",
                                  });
                                })
                              }
                            >
                              Promover estrutura
                            </Button>
                          </>
                        )}
                        <Button as="a" href="/estruturas">
                          Ver estruturas
                        </Button>
                      </div>
                    </div>
                    {readOnly && (
                      <p className={ui.muted}>
                        {archived
                          ? "Desarquive esta estrutura na gestão para continuar trabalhando."
                          : "Esta versão foi promovida. Para alterar o desenho, crie uma cópia em Modelos reutilizáveis."}
                      </p>
                    )}
                  </div>
                </AccordionPanel>
              </AccordionItem>

              <AccordionItem value="estimate" className={styles.section}>
                <AccordionHeader as="h2" expandIconPosition="end">
                  Gerar estimativa
                </AccordionHeader>
                <AccordionPanel
                  className={styles.sectionContent}
                  collapseMotion={persistentPanel}
                  hidden={!sections.includes("estimate")}
                >
                  <div className={ui.form}>
                    {nodes.some((n) => !n.data.component.rateId) && (
                      <p>
                        Vincule uma tarifa a cada componente pela biblioteca de
                        precificação antes de calcular o custo.
                      </p>
                    )}
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
                                {dateLabel(q.quotationDate)} · {q.sellRate}{" "}
                                BRL/USD
                              </option>
                            ))}
                        </Select>
                      </Field>
                    </div>
                    {!quoteId && (
                      <p>
                        Salve a estrutura e sincronize a PTAX no{" "}
                        <a href="/construtor/cambio">fluxo do Construtor</a>{" "}
                        antes de converter o cenário em reais.
                      </p>
                    )}
                    <div>
                      <Button
                        appearance="primary"
                        disabled={
                          pending ||
                          !ready ||
                          archived ||
                          nodes.some((n) => !n.data.component.rateId) ||
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
                              intent: result.data.usd.complete
                                ? "success"
                                : "warning",
                              message: result.data.usd.complete
                                ? "Estimativa calculada em USD e BRL, com a PTAX preservada."
                                : "A estimativa foi salva com custos pendentes. Revise as propriedades e tarifas dos componentes indicados.",
                            });
                          })
                        }
                      >
                        {pending
                          ? "Calculando…"
                          : "Calcular e salvar estimativa"}
                      </Button>
                    </div>
                    {value && <ValuationResult value={value} />}
                  </div>
                </AccordionPanel>
              </AccordionItem>
            </Accordion>
          </div>
        </aside>
      </div>
    </div>
  );
}
