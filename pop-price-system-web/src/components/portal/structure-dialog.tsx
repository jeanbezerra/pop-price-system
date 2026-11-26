"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Button,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  Field,
  Input,
  Textarea,
  Select,
  MessageBar,
  MessageBarBody,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { AddRegular, DeleteRegular } from "@fluentui/react-icons";
import {
  duplicateArchitecture,
  loadArchitecture,
  loadRegions,
  saveArchitecture,
} from "@/app/actions";
import { StructureRegionPicker } from "./structure-region-picker";
import type { Provider } from "@/lib/contracts";
import {
  structureCategories,
  structureEnvironments,
  type Region,
  type StructureSpecification,
} from "@/lib/portal-contracts";

export type StructureSource = {
  id: string;
  name: string;
  hoursPerMonth: number;
  revision: number;
  specification: StructureSpecification | null;
  status?: string;
  archivedAt?: string | null;
};
export type StructureDialogMode =
  | { kind: "new" }
  | { kind: "duplicate" | "configure"; source: StructureSource };

const useStyles = makeStyles({
  surface: {
    width: "min(720px, calc(100vw - 32px))",
    maxWidth: "none",
    maxHeight: "calc(100dvh - 32px)",
  },
  form: {
    minWidth: 0,
    minHeight: 0,
    maxHeight: "calc(100dvh - 80px)",
    display: "grid",
    gridTemplateRows: "minmax(0,1fr)",
  },
  body: {
    minWidth: 0,
    minHeight: 0,
    gridTemplateRows: "auto minmax(0,1fr) auto",
  },
  content: {
    minWidth: 0,
    minHeight: 0,
    overflowY: "auto",
    paddingRight: tokens.spacingHorizontalS,
    scrollbarGutter: "stable",
  },
  section: {
    display: "grid",
    gap: tokens.spacingVerticalM,
    minWidth: 0,
    paddingTop: tokens.spacingVerticalL,
    paddingBottom: tokens.spacingVerticalL,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  sectionTitle: {
    margin: 0,
    fontSize: tokens.fontSizeBase300,
    lineHeight: tokens.lineHeightBase300,
    fontWeight: tokens.fontWeightSemibold,
  },
  description: {
    margin: 0,
    color: tokens.colorNeutralForeground2,
    lineHeight: tokens.lineHeightBase300,
  },
  columns: {
    display: "grid",
    gridTemplateColumns: "repeat(2,minmax(0,1fr))",
    alignItems: "start",
    gap: tokens.spacingHorizontalL,
    minWidth: 0,
    "> *": { minWidth: 0 },
    "@media (max-width:600px)": { gridTemplateColumns: "minmax(0,1fr)" },
  },
  field: { minWidth: 0 },
  control: { width: "100%", maxWidth: "100%", minWidth: 0 },
  additional: {
    display: "grid",
    gap: tokens.spacingVerticalM,
    minWidth: 0,
    padding: tokens.spacingHorizontalM,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
  },
  actions: { paddingTop: tokens.spacingVerticalM, flexWrap: "wrap" },
});

export function StructureDialog({
  mode,
  providers,
  defaultHours,
  onClose,
  onSaved,
}: {
  mode: StructureDialogMode;
  providers: Provider[];
  defaultHours: number;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const styles = useStyles();
  const source = mode.kind === "new" ? null : mode.source;
  const [name, setName] = useState(
    source
      ? `${source.name}${mode.kind === "duplicate" ? " (cópia)" : ""}`.slice(
          0,
          200,
        )
      : "",
  );
  const [hours, setHours] = useState(
    String(source?.hoursPerMonth ?? defaultHours),
  );
  const [spec, setSpec] = useState<StructureSpecification>(
    source?.specification
      ? {
          ...source.specification,
          primaryProvider: source.specification.primaryProvider || "",
        }
      : {
          description: "",
          category: "APPLICATION",
          environment: "DEVELOPMENT",
          primaryProvider: "",
          locations: [],
        },
  );
  const [regions, setRegions] = useState<Record<string, Region[]>>({});
  const [regionError, setRegionError] = useState("");
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const selectedProviders = spec.locations
    .map((l) => l.provider)
    .filter(Boolean)
    .sort()
    .join(",");
  useEffect(() => {
    let ignore = false;
    setRegionError("");
    if (!selectedProviders) {
      setRegions({});
      setLoading(false);
      return;
    }
    setLoading(true);
    void Promise.all(
      selectedProviders.split(",").map(async (provider) => ({
        provider,
        result: await loadRegions(provider),
      })),
    ).then((results) => {
      if (ignore) return;
      const available: Record<string, Region[]> = {};
      for (const { provider, result } of results) {
        if (result.ok) available[provider] = result.data;
        else setRegionError(result.message);
      }
      setRegions(available);
      setLoading(false);
    });
    return () => {
      ignore = true;
    };
  }, [selectedProviders, retry]);
  const primary = spec.locations.find(
    (l) => l.provider === spec.primaryProvider,
  );
  const additional = spec.locations
    .map((location, index) => ({ location, index }))
    .filter(
      ({ location }) =>
        !spec.primaryProvider || location.provider !== spec.primaryProvider,
    );
  const ready =
    !!spec.primaryProvider &&
    !!primary &&
    !!spec.locations.length &&
    !loading &&
    !regionError &&
    spec.locations.every(
      (l) =>
        !!l.provider &&
        regions[l.provider]?.some((r) => r.code === l.regionCode),
    );
  const title =
    mode.kind === "new"
      ? "Nova estrutura"
      : mode.kind === "duplicate"
        ? "Duplicar estrutura"
        : "Definir especificação da estrutura";

  function choosePrimary(provider: string) {
    setSpec((old) => {
      let locations = old.locations;
      if (provider && !locations.some((l) => l.provider === provider)) {
        const empty = locations.findIndex((l) => !l.provider);
        const location = { provider, regionCode: "" };
        locations =
          empty < 0
            ? [...locations, location]
            : locations.map((l, index) => (index === empty ? location : l));
      }
      return { ...old, primaryProvider: provider, locations };
    });
  }
  function setRegion(provider: string, regionCode: string) {
    setSpec((old) => ({
      ...old,
      locations: old.locations.map((l) =>
        l.provider === provider ? { ...l, regionCode } : l,
      ),
    }));
  }
  function regionHint(provider: string) {
    return !provider
      ? "Escolha o provedor para carregar suas regiões."
      : loading
        ? "Carregando regiões…"
        : !regions[provider]?.length
          ? "Nenhuma região disponível. Prepare o catálogo deste provedor."
          : undefined;
  }

  return (
    <Dialog
      open
      onOpenChange={(_, d) => {
        if (!d.open && !pending) onClose();
      }}
    >
      <DialogSurface className={styles.surface}>
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            if (!ready) return;
            start(async () => {
              setError("");
              const input = {
                name: name.trim(),
                hoursPerMonth: Number(hours),
                specification: spec,
                revision: source?.revision ?? 0,
              };
              let result;
              if (mode.kind === "duplicate")
                result = await duplicateArchitecture(mode.source.id, input);
              else if (mode.kind === "configure") {
                const current = await loadArchitecture(mode.source.id);
                if (!current.ok) {
                  setError(current.message);
                  return;
                }
                if (current.data.revision !== mode.source.revision) {
                  setError(
                    "A estrutura mudou. Atualize a lista antes de definir a especificação.",
                  );
                  return;
                }
                result = await saveArchitecture(mode.source.id, {
                  ...input,
                  graph: current.data.graph,
                });
              } else
                result = await saveArchitecture(null, {
                  ...input,
                  graph: { nodes: [], edges: [] },
                });
              if (!result.ok) {
                setError(result.message);
                return;
              }
              onSaved(result.data.id);
            });
          }}
        >
          <DialogBody className={styles.body}>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent className={styles.content}>
              <p className={styles.description}>
                Escolha o provedor principal e a região antes de montar a
                solução. O contexto será salvo com a estrutura.
              </p>
              <section
                className={styles.section}
                aria-labelledby="structure-cloud-heading"
              >
                <h3
                  id="structure-cloud-heading"
                  className={styles.sectionTitle}
                >
                  Provedor e região
                </h3>
                <div className={styles.columns}>
                  <Field
                    className={styles.field}
                    label="Provedor principal"
                    required
                    hint="Define o provedor inicial da biblioteca do canvas."
                  >
                    <Select
                      className={styles.control}
                      required
                      value={spec.primaryProvider}
                      disabled={pending}
                      onChange={(_, d) => choosePrimary(d.value)}
                    >
                      <option value="">Selecione o provedor principal</option>
                      {providers.map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <StructureRegionPicker
                    key={spec.primaryProvider}
                    provider={spec.primaryProvider}
                    label="Região principal"
                    hint={regionHint(spec.primaryProvider)}
                    regions={regions[spec.primaryProvider] || []}
                    value={primary?.regionCode || ""}
                    disabled={pending || loading || !spec.primaryProvider}
                    onChange={(code) => setRegion(spec.primaryProvider, code)}
                  />
                </div>
                {additional.map(({ location, index }, number) => (
                  <div className={styles.additional} key={index}>
                    <div className={styles.columns}>
                      <Field
                        className={styles.field}
                        label={`Provedor adicional ${number + 1}`}
                        required
                      >
                        <Select
                          className={styles.control}
                          required
                          value={location.provider}
                          disabled={pending}
                          onChange={(_, d) =>
                            setSpec((old) => ({
                              ...old,
                              locations: old.locations.map((l, i) =>
                                i === index
                                  ? { provider: d.value, regionCode: "" }
                                  : l,
                              ),
                            }))
                          }
                        >
                          <option value="">Selecione um provedor</option>
                          {providers
                            .filter(
                              (p) =>
                                p.code === location.provider ||
                                !spec.locations.some(
                                  (l) => l.provider === p.code,
                                ),
                            )
                            .map((p) => (
                              <option key={p.code} value={p.code}>
                                {p.name}
                              </option>
                            ))}
                        </Select>
                      </Field>
                      <StructureRegionPicker
                        key={location.provider}
                        provider={location.provider}
                        label={`Região adicional ${number + 1}`}
                        hint={regionHint(location.provider)}
                        regions={regions[location.provider] || []}
                        value={location.regionCode}
                        disabled={pending || loading || !location.provider}
                        onChange={(code) => setRegion(location.provider, code)}
                      />
                    </div>
                    <div>
                      <Button
                        icon={<DeleteRegular />}
                        disabled={pending}
                        onClick={() =>
                          setSpec((old) => ({
                            ...old,
                            locations: old.locations.filter(
                              (_, i) => i !== index,
                            ),
                          }))
                        }
                      >
                        Remover provedor adicional {number + 1}
                      </Button>
                    </div>
                  </div>
                ))}
                {spec.primaryProvider &&
                  spec.locations.length < providers.length && (
                    <div>
                      <Button
                        icon={<AddRegular />}
                        disabled={pending}
                        onClick={() =>
                          setSpec((old) => ({
                            ...old,
                            locations: [
                              ...old.locations,
                              { provider: "", regionCode: "" },
                            ],
                          }))
                        }
                      >
                        Adicionar outro provedor
                      </Button>
                    </div>
                  )}
                {regionError && (
                  <>
                    <MessageBar intent="error">
                      <MessageBarBody>{regionError}</MessageBarBody>
                    </MessageBar>
                    <Button onClick={() => setRetry((n) => n + 1)}>
                      Recarregar regiões
                    </Button>
                  </>
                )}
              </section>
              <section
                className={styles.section}
                aria-labelledby="structure-identity-heading"
              >
                <h3
                  id="structure-identity-heading"
                  className={styles.sectionTitle}
                >
                  Identificação da estrutura
                </h3>
                <Field
                  className={styles.field}
                  label="Nome da estrutura"
                  required
                >
                  <Input
                    className={styles.control}
                    required
                    maxLength={200}
                    value={name}
                    disabled={pending}
                    onChange={(_, d) => setName(d.value)}
                  />
                </Field>
                <Field className={styles.field} label="Descrição">
                  <Textarea
                    className={styles.control}
                    resize="vertical"
                    maxLength={2000}
                    value={spec.description}
                    disabled={pending}
                    onChange={(_, d) =>
                      setSpec({ ...spec, description: d.value })
                    }
                  />
                </Field>
                <div className={styles.columns}>
                  <Field
                    className={styles.field}
                    label="Categoria da estrutura"
                  >
                    <Select
                      className={styles.control}
                      value={spec.category}
                      disabled={pending}
                      onChange={(_, d) =>
                        setSpec({ ...spec, category: d.value })
                      }
                    >
                      {Object.entries(structureCategories).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field className={styles.field} label="Ambiente">
                    <Select
                      className={styles.control}
                      value={spec.environment}
                      disabled={pending}
                      onChange={(_, d) =>
                        setSpec({ ...spec, environment: d.value })
                      }
                    >
                      {Object.entries(structureEnvironments).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
              </section>
              <section
                className={styles.section}
                aria-labelledby="structure-usage-heading"
              >
                <h3
                  id="structure-usage-heading"
                  className={styles.sectionTitle}
                >
                  Premissas de uso
                </h3>
                <Field
                  className={styles.field}
                  label="Horas por mês"
                  required
                  hint="Base mensal usada nas estimativas desta estrutura."
                >
                  <Input
                    className={styles.control}
                    type="number"
                    required
                    min="0.000001"
                    max="744"
                    step="0.000001"
                    value={hours}
                    disabled={pending}
                    onChange={(_, d) => setHours(d.value)}
                  />
                </Field>
                {mode.kind !== "new" && (
                  <p className={styles.description}>
                    Ao usar outra região, tarifas, cobranças de rede e AZs
                    afetadas serão desvinculadas. O desenho e o consumo serão
                    preservados.
                  </p>
                )}
              </section>
              {error && (
                <MessageBar intent="error">
                  <MessageBarBody>{error}</MessageBarBody>
                </MessageBar>
              )}
            </DialogContent>
            <DialogActions className={styles.actions}>
              <Button disabled={pending} onClick={onClose}>
                Cancelar
              </Button>
              <Button
                appearance="primary"
                type="submit"
                disabled={pending || !ready || !name.trim()}
              >
                {pending
                  ? "Salvando…"
                  : mode.kind === "new"
                    ? "Criar e abrir canvas"
                    : mode.kind === "duplicate"
                      ? "Duplicar e abrir canvas"
                      : "Salvar e abrir canvas"}
              </Button>
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  );
}
