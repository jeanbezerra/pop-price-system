"use client";

import { Fragment, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  Link,
  Radio,
  RadioGroup,
  Select,
  Textarea,
  makeStyles,
  mergeClasses,
  shorthands,
  tokens,
  typographyStyles,
} from "@fluentui/react-components";
import {
  AddRegular,
  ArrowLeftRegular,
  ArrowRightRegular,
  CloudRegular,
  DeleteRegular,
  SaveRegular,
} from "@fluentui/react-icons";
import {
  loadArchitectureIcons,
  loadComponentCategories,
  loadServices,
  saveArchitectureComponent,
} from "@/app/actions";
import type { Provider, ServicePage } from "@/lib/contracts";
import type {
  ArchitectureComponent,
  ArchitectureIconDefinition,
  ComponentCharacteristic,
  ComponentPage,
  ComponentStatus,
  ComponentCategory,
} from "@/lib/component-contracts";
import { componentStatusLabels } from "@/lib/component-contracts";
import { ArchitectureIcon } from "../architecture-icon";
import { ProviderIcon } from "../provider-icon";
import { ComponentCategoryPicker } from "./component-category-picker";
import { failure, Feedback, type Notice, usePortalStyles } from "./shared";

const steps = [
  { title: "Provedor", description: "Origem do componente" },
  { title: "Características", description: "Identificação e propriedades" },
  { title: "Iconografia", description: "Representação de arquitetura" },
  { title: "Serviço cloud", description: "Vínculo com o catálogo" },
  { title: "Revisão", description: "Situação e conferência" },
];
const useStyles = makeStyles({
  workspace: {
    display: "grid",
    gridTemplateColumns: "228px minmax(0,1fr)",
    minHeight: "calc(100vh - 76px)",
    "@media (max-width: 900px)": { gridTemplateColumns: "196px minmax(0,1fr)" },
    "@media (max-width: 640px)": { gridTemplateColumns: "minmax(0,1fr)" },
  },
  sidebar: {
    padding: tokens.spacingHorizontalXL,
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXXL,
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderRight(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke2,
    ),
  },
  sideNav: { display: "grid", gap: tokens.spacingVerticalS },
  sideButton: {
    justifyContent: "flex-start",
    textAlign: "left",
    width: "100%",
    minHeight: "64px",
    padding: tokens.spacingHorizontalM,
  },
  selected: {
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
    ":hover": { backgroundColor: tokens.colorBrandBackground2Hover },
    ":active": { backgroundColor: tokens.colorBrandBackground2Pressed },
  },
  sideText: { display: "grid", gap: tokens.spacingVerticalXS },
  sideHint: {
    ...typographyStyles.caption1,
    color: tokens.colorNeutralForeground3,
    fontWeight: tokens.fontWeightRegular,
  },
  sideFooter: {
    marginTop: "auto",
    display: "grid",
    gap: tokens.spacingVerticalS,
  },
  main: {
    minWidth: 0,
    padding: tokens.spacingHorizontalXXL,
    display: "grid",
    gap: tokens.spacingVerticalXL,
    alignContent: "start",
    "@media (max-width: 900px)": { padding: tokens.spacingHorizontalL },
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalL,
  },
  title: { ...typographyStyles.title1, margin: 0 },
  subtitle: {
    color: tokens.colorNeutralForeground2,
    marginTop: tokens.spacingVerticalS,
    marginBottom: 0,
  },
  body: {
    display: "grid",
    gridTemplateColumns: "minmax(0,1fr) 280px",
    gap: tokens.spacingHorizontalXL,
    alignItems: "start",
    "@media (max-width: 1150px)": { gridTemplateColumns: "minmax(0,1fr)" },
  },
  card: {
    padding: tokens.spacingHorizontalXL,
    minWidth: 0,
    display: "grid",
    gap: tokens.spacingVerticalL,
  },
  sectionTitle: { ...typographyStyles.subtitle1, margin: 0 },
  definitionFields: { alignItems: "start" },
  providers: {
    display: "grid",
    gridTemplateColumns: "repeat(2,minmax(0,1fr))",
    gap: tokens.spacingHorizontalM,
    "@media (max-width: 640px)": { gridTemplateColumns: "minmax(0,1fr)" },
  },
  provider: {
    ...shorthands.border(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke2,
    ),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    minHeight: "100px",
    padding: tokens.spacingHorizontalM,
    alignItems: "center",
  },
  providerLabel: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
    minHeight: "48px",
  },
  icons: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,200px),1fr))",
    gap: tokens.spacingHorizontalM,
  },
  iconLabel: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    minHeight: "48px",
  },
  preview: {
    display: "flex",
    gap: tokens.spacingHorizontalL,
    alignItems: "center",
  },
  properties: { display: "grid", gap: tokens.spacingVerticalM },
  property: {
    display: "grid",
    gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr) auto",
    gap: tokens.spacingHorizontalM,
    alignItems: "end",
    "@media (max-width: 640px)": { gridTemplateColumns: "minmax(0,1fr)" },
  },
  summary: {
    display: "grid",
    gridTemplateColumns: "minmax(100px,1fr) minmax(0,1.5fr)",
    gap: tokens.spacingHorizontalM,
    margin: 0,
    overflowWrap: "anywhere",
    "& dt": { color: tokens.colorNeutralForeground3 },
    "& dd": { margin: 0 },
  },
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalM,
    ...shorthands.borderTop(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke2,
    ),
    paddingTop: tokens.spacingVerticalL,
  },
});

export interface EditorData {
  component: ArchitectureComponent | null;
  provider: string;
  services: ServicePage;
  icons: ComponentPage<ArchitectureIconDefinition>;
  categories: ComponentCategory[];
  iconCategory: string;
  loadError?: string;
}
const iconValue = (icon: ArchitectureIconDefinition) =>
  `${icon.key}@${icon.release}`;

export function ComponentEditor({
  initial,
  providers,
}: {
  initial: EditorData;
  providers: Provider[];
}) {
  const styles = useStyles();
  const ui = usePortalStyles();
  const router = useRouter();
  const heading = useRef<HTMLHeadingElement>(null);
  const existing = initial.component;
  const [step, setStep] = useState(0);
  const [provider, setProvider] = useState(initial.provider);
  const [services, setServices] = useState(initial.services);
  const [service, setService] = useState(existing?.serviceCode || "");
  const [name, setName] = useState(existing?.name || "");
  const [category, setCategory] = useState(existing?.category || "");
  const [categories, setCategories] = useState(initial.categories);
  const [iconCategory, setIconCategory] = useState(initial.iconCategory);
  const [description, setDescription] = useState(existing?.description || "");
  const [characteristics, setCharacteristics] = useState<
    (ComponentCharacteristic & { rowId: string })[]
  >(
    (existing?.characteristics || []).map((value, index) => ({
      ...value,
      rowId: `initial-${index}`,
    })),
  );
  const [status, setStatus] = useState<ComponentStatus>(
    existing?.status || "PENDING",
  );
  const [icon, setIcon] = useState(existing?.icon || null);
  const [icons, setIcons] = useState(initial.icons);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [notice, setNotice] = useState<Notice | null>(
    initial.loadError
      ? { intent: "warning", message: initial.loadError }
      : null,
  );
  const [attempted, setAttempted] = useState(false);
  const [pending, start] = useTransition();
  const generic = provider === "GENERIC";
  const providerName =
    providers.find((p) => p.code === provider)?.name || provider;
  const categoryName =
    categories.find((c) => c.code === category)?.name || category;
  const linkedService = services.items.find((s) => s.code === service);
  const serviceName =
    linkedService?.name ||
    (existing?.provider === provider && existing.serviceCode === service
      ? existing.serviceName
      : null);

  function changeProvider(value: string) {
    if (provider === value) return;
    setProvider(value);
    setService("");
    setIcon(null);
    setQuery("");
    setAppliedQuery("");
    setNotice(null);
    setCategory("");
    setCategories([]);
    setIconCategory("");
    setServices({ items: [], size: 200, hasMore: false, nextAfter: null });
    setIcons({ items: [], size: 24, hasMore: false, nextAfter: null });
    start(async () => {
      const [s, c] = await Promise.all([
        value === "GENERIC" ? null : loadServices(value),
        loadComponentCategories(value),
      ]);
      if (s?.ok) setServices(s.data);
      else if (s) setNotice(failure(s));
      const nextCategory =
        c.ok && c.data.some((item) => item.code === category) ? category : "";
      if (c.ok) {
        setCategories(c.data);
        setCategory(nextCategory);
        setIconCategory(nextCategory);
      } else setNotice(failure(c));
      if (value === "GENERIC") return;
      const i = await loadArchitectureIcons(value, "", "", nextCategory);
      if (i.ok) setIcons(i.data);
      else setNotice(failure(i));
    });
  }

  function searchIcons(append = false, categoryFilter = iconCategory) {
    const search = append ? appliedQuery : query;
    start(async () => {
      const result = await loadArchitectureIcons(
        provider,
        search,
        append ? icons.nextAfter || "" : "",
        categoryFilter,
      );
      if (!result.ok) return setNotice(failure(result));
      setIcons({
        ...result.data,
        items: append
          ? [...icons.items, ...result.data.items]
          : result.data.items,
      });
      setAppliedQuery(search);
    });
  }

  function changeCategory(code: string) {
    setCategory(code);
    setIconCategory(code);
    setNotice(null);
    if (!generic) searchIcons(false, code);
  }

  function refreshCategories() {
    start(async () => {
      const result = await loadComponentCategories(provider);
      if (!result.ok) return setNotice(failure(result));
      setCategories(result.data);
    });
  }

  function loadCloudServices(append = false) {
    start(async () => {
      const result = await loadServices(
        provider,
        append ? services.nextAfter || "" : "",
      );
      if (!result.ok) return setNotice(failure(result));
      setServices({
        ...result.data,
        items: append
          ? [...services.items, ...result.data.items]
          : result.data.items,
      });
    });
  }

  function updateCharacteristic(
    index: number,
    key: "name" | "value",
    value: string,
  ) {
    setCharacteristics((old) =>
      old.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
    );
  }

  function save() {
    setAttempted(true);
    const properties = characteristics
      .filter((c) => c.name.trim() || c.value.trim())
      .map(({ name, value }) => ({ name, value }));
    let message = "";
    let destination = 1;
    if (!name.trim() || !category.trim())
      message = "Informe o nome e a categoria do componente.";
    else if (properties.some((c) => !c.name.trim() || !c.value.trim()))
      message = "Preencha o nome e o valor de cada característica.";
    else if (
      new Set(properties.map((c) => c.name.trim().toLocaleLowerCase())).size !==
      properties.length
    )
      message = "Use nomes diferentes para as características.";
    else if (status === "ACTIVE" && !generic && !icon) {
      message = "Selecione um ícone antes de ativar o componente.";
      destination = 2;
    } else if (status === "ACTIVE" && !generic && !service) {
      message = "Vincule um serviço cloud antes de ativar o componente.";
      destination = 3;
    }
    if (message) {
      setNotice({ intent: "error", message });
      setStep(destination);
      return;
    }
    start(async () => {
      const result = await saveArchitectureComponent(existing?.id || null, {
        provider,
        serviceCode: generic ? null : service || null,
        name,
        category,
        description,
        characteristics: properties,
        status,
        iconKey: generic ? null : icon?.key || null,
        iconRelease: generic ? null : icon?.release || null,
        revision: existing?.revision || 0,
      });
      if (!result.ok) return setNotice(failure(result));
      router.push("/construtor/componentes");
    });
  }

  return (
    <form
      noValidate
      className={styles.workspace}
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <aside className={styles.sidebar} aria-label="Etapas do cadastro">
        <Link href="/construtor/componentes">
          <ArrowLeftRegular aria-hidden="true" /> Voltar aos componentes
        </Link>
        <div>
          <h2 className={styles.sectionTitle}>Cadastro de componente</h2>
          <p className={ui.muted}>
            Defina o componente, depois conecte ao catálogo.
          </p>
        </div>
        <nav className={styles.sideNav} aria-label="Seções do componente">
          {steps.map((item, index) => (
            <Button
              key={item.title}
              type="button"
              appearance="subtle"
              disabled={pending}
              aria-current={step === index ? "step" : undefined}
              className={mergeClasses(
                styles.sideButton,
                step === index && styles.selected,
              )}
              onClick={() => setStep(index)}
            >
              <span className={styles.sideText}>
                <span>
                  {index + 1}. {item.title}
                </span>
                <span className={styles.sideHint}>{item.description}</span>
              </span>
            </Button>
          ))}
        </nav>
        <div className={styles.sideFooter}>
          <Badge
            appearance="tint"
            color={status === "ACTIVE" ? "success" : "informative"}
          >
            {componentStatusLabels[status]}
          </Badge>
          <p className={ui.muted}>
            Você pode salvar como pendente e completar o vínculo cloud depois.
          </p>
        </div>
      </aside>
      <div className={styles.main}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>
              {existing ? "Editar componente" : "Novo componente"}
            </h1>
            <p className={styles.subtitle}>
              Provedor, características e representação em um cadastro
              independente.
            </p>
          </div>
          <Button
            type="submit"
            appearance="primary"
            icon={<SaveRegular />}
            disabled={pending}
          >
            {pending ? "Aguarde…" : "Salvar componente"}
          </Button>
        </header>
        <Feedback
          notice={notice}
          onDismiss={() => setNotice(null)}
          onReview={() => heading.current?.focus()}
        />
        <div className={styles.body}>
          <Card
            className={styles.card}
            aria-labelledby="component-section-title"
            aria-busy={pending}
          >
            <div>
              <p className={ui.muted}>
                Etapa {step + 1} de {steps.length}
              </p>
              <h2
                id="component-section-title"
                ref={heading}
                tabIndex={-1}
                className={styles.sectionTitle}
              >
                {steps[step].title}
              </h2>
            </div>
            {step === 0 && (
              <>
                <p className={ui.muted}>
                  Escolha a origem. Use Genérico para componentes independentes
                  de cloud, como aplicações e serviços internos.
                </p>
                <Field label="Provedor do componente" required>
                  <RadioGroup
                    value={provider}
                    disabled={pending}
                    className={styles.providers}
                    onChange={(_, data) => changeProvider(data.value)}
                  >
                    {providers.map((p) => (
                      <Radio
                        key={p.code}
                        value={p.code}
                        className={mergeClasses(
                          styles.provider,
                          p.code === provider && styles.selected,
                        )}
                        label={
                          <span className={styles.providerLabel}>
                            {p.code === "GENERIC" ? (
                              <CloudRegular fontSize={32} aria-hidden="true" />
                            ) : (
                              <ProviderIcon provider={p.code} decorative />
                            )}
                            <span>{p.name}</span>
                          </span>
                        }
                      />
                    ))}
                  </RadioGroup>
                </Field>
                <p className={ui.muted}>
                  A escolha do provedor não cria uma sincronização. Você poderá
                  definir as características antes de escolher um serviço.
                </p>
              </>
            )}
            {step === 1 && (
              <>
                <div
                  className={mergeClasses(ui.fields, styles.definitionFields)}
                >
                  <Field
                    label="Nome do componente"
                    required
                    validationState={
                      attempted && !name.trim() ? "error" : "none"
                    }
                    validationMessage={
                      attempted && !name.trim() ? "Informe o nome." : undefined
                    }
                  >
                    <Input
                      required
                      maxLength={200}
                      value={name}
                      disabled={pending}
                      onChange={(_, data) => setName(data.value)}
                    />
                  </Field>
                  <ComponentCategoryPicker
                    key={provider}
                    categories={categories}
                    value={category}
                    legacyValue={
                      existing?.provider === provider
                        ? existing.category
                        : undefined
                    }
                    generic={generic}
                    disabled={pending}
                    invalid={attempted && !category}
                    onChange={changeCategory}
                  />
                </div>
                {!categories.length && (
                  <div>
                    <Button
                      type="button"
                      disabled={pending}
                      onClick={refreshCategories}
                    >
                      Atualizar categorias
                    </Button>
                  </div>
                )}
                <Field
                  label="Descrição"
                  hint="Explique a finalidade do componente."
                >
                  <Textarea
                    maxLength={2000}
                    resize="vertical"
                    value={description}
                    disabled={pending}
                    onChange={(_, data) => setDescription(data.value)}
                  />
                </Field>
                <h3 className={styles.sectionTitle}>
                  Características técnicas
                </h3>
                <p className={ui.muted}>
                  Adicione propriedades como memória, capacidade, tecnologia ou
                  função. Essas informações descrevem o componente e não alteram
                  o cálculo de custos.
                </p>
                <div className={styles.properties}>
                  {characteristics.map((item, index) => (
                    <div className={styles.property} key={item.rowId}>
                      <Field label={`Característica ${index + 1}`}>
                        <Input
                          maxLength={100}
                          value={item.name}
                          disabled={pending}
                          onChange={(_, d) =>
                            updateCharacteristic(index, "name", d.value)
                          }
                        />
                      </Field>
                      <Field label={`Valor ${index + 1}`}>
                        <Input
                          maxLength={1000}
                          value={item.value}
                          disabled={pending}
                          onChange={(_, d) =>
                            updateCharacteristic(index, "value", d.value)
                          }
                        />
                      </Field>
                      <Button
                        type="button"
                        icon={<DeleteRegular />}
                        aria-label={`Remover característica ${index + 1}`}
                        disabled={pending}
                        onClick={() =>
                          setCharacteristics((old) =>
                            old.filter((_, i) => i !== index),
                          )
                        }
                      />
                    </div>
                  ))}
                </div>
                <div>
                  <Button
                    type="button"
                    icon={<AddRegular />}
                    disabled={pending || characteristics.length >= 30}
                    onClick={() =>
                      setCharacteristics((old) => [
                        ...old,
                        { rowId: crypto.randomUUID(), name: "", value: "" },
                      ])
                    }
                  >
                    Adicionar característica
                  </Button>
                </div>
              </>
            )}
            {step === 2 &&
              (generic ? (
                <div className={styles.preview}>
                  <ArchitectureIcon icon={null} size={64} />
                  <div>
                    <strong>Representação genérica</strong>
                    <p className={ui.muted}>
                      O componente usa o ícone padrão, sem associação a um
                      provedor cloud.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className={styles.preview}>
                    <ArchitectureIcon icon={icon} size={64} />
                    <div>
                      <strong>
                        {icon?.name || "Nenhum ícone selecionado"}
                      </strong>
                      {icon && (
                        <p className={ui.muted}>Versão {icon.release}</p>
                      )}
                    </div>
                    {icon && (
                      <Button
                        type="button"
                        disabled={pending}
                        onClick={() => setIcon(null)}
                      >
                        Remover seleção
                      </Button>
                    )}
                  </div>
                  <div className={ui.fields}>
                    <Field
                      label="Filtrar ícones por categoria"
                      hint="A categoria do componente é o filtro inicial. Amplie a busca quando necessário."
                    >
                      <Select
                        value={iconCategory}
                        disabled={pending}
                        onChange={(_, data) => {
                          setIconCategory(data.value);
                          searchIcons(false, data.value);
                        }}
                      >
                        <option value="">Todas as categorias</option>
                        {categories.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field
                      label="Buscar ícone"
                      hint="Pesquise pelo nome ou por termos como EC2 e Kubernetes."
                    >
                      <Input
                        maxLength={200}
                        disabled={pending}
                        value={query}
                        onChange={(_, data) => setQuery(data.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            searchIcons();
                          }
                        }}
                      />
                    </Field>
                    <div>
                      <Button
                        type="button"
                        disabled={pending}
                        onClick={() => searchIcons()}
                      >
                        Buscar ícones
                      </Button>
                    </div>
                  </div>
                  <Field label="Ícones disponíveis">
                    <RadioGroup
                      disabled={pending}
                      className={styles.icons}
                      value={icon ? iconValue(icon) : ""}
                      onChange={(_, data) => {
                        const selected = icons.items.find(
                          (i) => iconValue(i) === data.value,
                        );
                        if (selected) {
                          setIcon(selected);
                          setNotice(null);
                        }
                      }}
                    >
                      {icons.items.map((i) => (
                        <Radio
                          key={iconValue(i)}
                          value={iconValue(i)}
                          label={
                            <span className={styles.iconLabel}>
                              <ArchitectureIcon icon={i} />
                              <span>{i.name}</span>
                            </span>
                          }
                        />
                      ))}
                    </RadioGroup>
                  </Field>
                  {!icons.items.length && (
                    <p className={ui.muted}>
                      Nenhum ícone disponível para esta busca e provedor. Salve
                      como pendente para completar depois.
                    </p>
                  )}
                  {icons.hasMore && (
                    <div>
                      <Button
                        type="button"
                        disabled={pending}
                        onClick={() => searchIcons(true)}
                      >
                        Carregar mais ícones
                      </Button>
                    </div>
                  )}
                </>
              ))}
            {step === 3 &&
              (generic ? (
                <p>
                  Componentes genéricos não precisam de serviço cloud. Para
                  criar esse vínculo, escolha um provedor cloud na primeira
                  etapa.
                </p>
              ) : (
                <>
                  <p className={ui.muted}>
                    O vínculo é opcional enquanto o componente estiver pendente.
                    Selecione um serviço descoberto de {providerName} para
                    conectar ao catálogo.
                  </p>
                  <Field
                    label="Serviço cloud vinculado"
                    hint="Apenas serviços descobertos do provedor escolhido são apresentados."
                  >
                    <Select
                      value={service}
                      disabled={pending}
                      onChange={(_, data) => setService(data.value)}
                    >
                      <option value="">Vincular depois</option>
                      {service &&
                        !services.items.some((s) => s.code === service) && (
                          <option value={service}>
                            {serviceName} · {service}
                          </option>
                        )}
                      {services.items.map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.name} · {s.code}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  {!services.items.length && (
                    <p className={ui.muted}>
                      Nenhum serviço disponível. Você pode salvar o componente e
                      fazer a descoberta em Sincronizações quando houver uma
                      integração instalada.
                    </p>
                  )}
                  <div className={ui.row}>
                    <Button
                      type="button"
                      disabled={pending}
                      onClick={() => loadCloudServices()}
                    >
                      Atualizar serviços
                    </Button>
                    {services.hasMore && (
                      <Button
                        type="button"
                        disabled={pending}
                        onClick={() => loadCloudServices(true)}
                      >
                        Carregar mais serviços
                      </Button>
                    )}
                  </div>
                </>
              ))}
            {step === 4 && (
              <>
                <Field
                  label="Situação do componente"
                  hint={
                    generic
                      ? "O componente genérico pode ser ativado sem vínculo cloud."
                      : "Ativar exige um ícone e um serviço cloud. Salve como pendente para completar depois."
                  }
                >
                  <Select
                    value={status}
                    disabled={pending}
                    onChange={(_, data) =>
                      setStatus(data.value as ComponentStatus)
                    }
                  >
                    {Object.entries(componentStatusLabels).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ),
                    )}
                  </Select>
                </Field>
                <dl className={styles.summary}>
                  <dt>Provedor</dt>
                  <dd>{providerName}</dd>
                  <dt>Nome</dt>
                  <dd>{name || "Não informado"}</dd>
                  <dt>Categoria</dt>
                  <dd>{categoryName || "Não informada"}</dd>
                  <dt>Descrição</dt>
                  <dd>{description || "Não informada"}</dd>
                  <dt>Serviço cloud</dt>
                  <dd>
                    {generic
                      ? "Não se aplica"
                      : serviceName || "Vincular depois"}
                  </dd>
                </dl>
                {characteristics.filter((c) => c.name.trim()).length > 0 && (
                  <>
                    <h3 className={styles.sectionTitle}>Características</h3>
                    <dl className={styles.summary}>
                      {characteristics
                        .filter((c) => c.name.trim())
                        .map((c) => (
                          <Fragment key={c.rowId}>
                            <dt>{c.name}</dt>
                            <dd>{c.value || "Valor pendente"}</dd>
                          </Fragment>
                        ))}
                    </dl>
                  </>
                )}
              </>
            )}
            <div className={styles.footer}>
              <span className={ui.muted}>{steps[step].description}</span>
              <div className={ui.row}>
                {step > 0 && (
                  <Button
                    type="button"
                    disabled={pending}
                    icon={<ArrowLeftRegular />}
                    onClick={() => setStep(step - 1)}
                  >
                    Anterior
                  </Button>
                )}
                {step < steps.length - 1 && (
                  <Button
                    type="button"
                    disabled={pending}
                    icon={<ArrowRightRegular />}
                    onClick={() => setStep(step + 1)}
                  >
                    Próxima etapa
                  </Button>
                )}
              </div>
            </div>
          </Card>
          <aside aria-label="Prévia do componente">
            <Card className={styles.card}>
              <h2 className={styles.sectionTitle}>Prévia do componente</h2>
              <div className={styles.preview}>
                <ArchitectureIcon icon={icon} size={64} />
                <strong>{name || "Seu componente"}</strong>
              </div>
              <Badge appearance="tint">{providerName}</Badge>
              <dl className={styles.summary}>
                <dt>Categoria</dt>
                <dd>{categoryName || "A definir"}</dd>
                <dt>Serviço</dt>
                <dd>
                  {generic
                    ? "Independente de cloud"
                    : serviceName || "Vincular depois"}
                </dd>
                <dt>Propriedades</dt>
                <dd>
                  {
                    characteristics.filter(
                      (c) => c.name.trim() || c.value.trim(),
                    ).length
                  }
                </dd>
              </dl>
              <p className={ui.muted}>
                {generic
                  ? "Representa um componente da arquitetura sem depender do catálogo de preços."
                  : "O serviço vinculado será usado para selecionar tarifas na configuração de cada instância."}
              </p>
            </Card>
          </aside>
        </div>
      </div>
    </form>
  );
}
