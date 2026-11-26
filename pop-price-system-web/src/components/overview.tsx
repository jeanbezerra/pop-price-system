"use client";

import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardFooter,
  Table,
  TableHeader,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
  makeStyles,
  shorthands,
  tokens,
  typographyStyles,
} from "@fluentui/react-components";
import {
  CloudRegular,
  GridRegular,
  CalculatorRegular,
  ArrowSyncRegular,
  ArrowRightRegular,
  BookOpenRegular,
  CheckmarkCircleRegular,
} from "@fluentui/react-icons";
import type { OverviewData } from "@/lib/contracts";
import {
  ApiNotice,
  EmptyState,
  PageHeading,
  TableRegion,
  usePageStyles,
} from "./shared";

const useStyles = makeStyles({
  metrics: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: tokens.spacingHorizontalL,
    "@media (max-width: 1100px)": {
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    },
    "@media (max-width: 360px)": { gridTemplateColumns: "minmax(0, 1fr)" },
  },
  metric: {
    ...shorthands.padding(tokens.spacingVerticalL, tokens.spacingHorizontalL),
    boxShadow: "none",
    gap: tokens.spacingVerticalM,
  },
  metricTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalS,
  },
  metricLabel: {
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase300,
  },
  metricIcon: { color: tokens.colorBrandForeground1, fontSize: "20px" },
  metricValue: {
    fontSize: tokens.fontSizeHero800,
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: tokens.lineHeightHero800,
    fontVariantNumeric: "tabular-nums",
  },
  metricHint: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase100,
  },
  twoColumns: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.75fr) minmax(240px, 1fr)",
    gap: tokens.spacingHorizontalL,
    "@media (max-width: 1100px)": { gridTemplateColumns: "minmax(0, 1fr)" },
  },
  sectionTitle: { margin: 0, ...typographyStyles.subtitle2 },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalM,
  },
  cardBody: {
    display: "grid",
    gap: tokens.spacingVerticalL,
    paddingTop: tokens.spacingVerticalM,
  },
  step: { display: "flex", gap: tokens.spacingHorizontalM },
  stepNumber: {
    flexShrink: 0,
    color: tokens.colorBrandForeground1,
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    paddingTop: tokens.spacingVerticalXXS,
  },
  stepTitle: {
    margin: 0,
    fontSize: tokens.fontSizeBase300,
    lineHeight: tokens.lineHeightBase300,
    fontWeight: tokens.fontWeightSemibold,
  },
  stepDescription: {
    marginTop: tokens.spacingVerticalXS,
    marginBottom: 0,
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    lineHeight: tokens.lineHeightBase300,
  },
  table: { minWidth: "480px", overflowWrap: "anywhere" },
  serviceCode: { fontWeight: tokens.fontWeightSemibold },
  footer: {
    display: "flex",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalM,
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase100,
    paddingBottom: tokens.spacingVerticalL,
  },
});

function count(
  result:
    | { ok: boolean; data?: { items: unknown[]; hasMore: boolean } }
    | { ok: boolean; data?: unknown[] },
) {
  if (!result.ok || !result.data) return "—";
  if (Array.isArray(result.data)) return String(result.data.length);
  return `${result.data.items.length}${result.data.hasMore ? "+" : ""}`;
}

export function Overview({ data }: { data: OverviewData }) {
  const shared = usePageStyles();
  const styles = useStyles();
  const healthy =
    data.providers.ok &&
    data.services.ok &&
    data.estimates.ok &&
    data.synchronizations.ok;
  const metrics = [
    {
      label: "Provedores",
      value: count(data.providers),
      hint: "Disponíveis no catálogo",
      Icon: CloudRegular,
    },
    {
      label: "Serviços",
      value: count(data.services),
      hint: "Descobertos no provedor",
      Icon: GridRegular,
    },
    {
      label: "Estimativas",
      value: count(data.estimates),
      hint: "Composições de arquitetura",
      Icon: CalculatorRegular,
    },
    {
      label: "Sincronizações",
      value: count(data.synchronizations),
      hint: "Importações registradas",
      Icon: ArrowSyncRegular,
    },
  ];
  const recent = data.synchronizations.ok
    ? data.synchronizations.data.items.slice(0, 5)
    : [];
  const checkedAt = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(data.checkedAt));
  return (
    <div className={shared.page}>
      <PageHeading
        title="Visão geral"
        description="Consulte o catálogo, as estimativas e as importações de preços do seu ambiente."
      />
      {!healthy && <ApiNotice />}
      <Card className={shared.card} aria-labelledby="planning-title">
        <CardHeader
          image={
            <GridRegular className={styles.metricIcon} aria-hidden="true" />
          }
          header={
            <h2 id="planning-title" className={styles.sectionTitle}>
              Planeje o próximo cenário
            </h2>
          }
          description="Comece pelos serviços disponíveis e organize as premissas da sua arquitetura."
        />
        <CardFooter>
          <Button
            as="a"
            href="/estruturas"
            appearance="primary"
            icon={<ArrowRightRegular />}
          >
            Gerir estruturas
          </Button>
          <Button as="a" href="/construtor/sincronizacoes">
            Preparar bases
          </Button>
        </CardFooter>
      </Card>
      <section aria-label="Resumo do ambiente" className={styles.metrics}>
        {metrics.map(({ label, value, hint, Icon }) => (
          <Card key={label} className={styles.metric}>
            <div className={styles.metricTop}>
              <span className={styles.metricLabel}>{label}</span>
              <Icon aria-hidden="true" className={styles.metricIcon} />
            </div>
            <strong className={styles.metricValue}>{value}</strong>
            <span className={styles.metricHint}>{hint}</span>
          </Card>
        ))}
      </section>
      <div className={styles.twoColumns}>
        <Card className={shared.card}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Atividade recente</h2>
            <Badge
              appearance="tint"
              color={healthy ? "success" : "warning"}
              icon={healthy ? <CheckmarkCircleRegular /> : undefined}
            >
              {healthy ? "API conectada" : "API indisponível"}
            </Badge>
          </div>
          {recent.length === 0 ? (
            <EmptyState
              icon={<ArrowSyncRegular />}
              title={
                data.synchronizations.ok
                  ? "Nenhuma sincronização registrada"
                  : "Atividade indisponível"
              }
              description={
                data.synchronizations.ok
                  ? "As importações de preços aparecerão aqui com o estado e o escopo de cada execução."
                  : "Atualize os dados quando a conexão com a API for restabelecida."
              }
            />
          ) : (
            <TableRegion label="Atividade do ambiente">
              <Table
                aria-label="Sincronizações recentes"
                className={styles.table}
              >
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>Serviço</TableHeaderCell>
                    <TableHeaderCell>Região</TableHeaderCell>
                    <TableHeaderCell>Estado</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((sync) => (
                    <TableRow key={sync.id}>
                      <TableCell className={styles.serviceCode}>
                        {sync.scope.serviceCode}
                      </TableCell>
                      <TableCell>{sync.scope.regionCode}</TableCell>
                      <TableCell>
                        <Badge
                          appearance="tint"
                          color={
                            sync.status === "COMPLETED"
                              ? "success"
                              : sync.status === "FAILED"
                                ? "danger"
                                : "informative"
                          }
                        >
                          {sync.status === "COMPLETED"
                            ? "Concluída"
                            : sync.status === "FAILED"
                              ? "Falhou"
                              : "Em execução"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableRegion>
          )}
        </Card>
        <Card className={shared.card}>
          <CardHeader
            image={
              <BookOpenRegular
                aria-hidden="true"
                className={styles.metricIcon}
              />
            }
            header={<h2 className={styles.sectionTitle}>Seu próximo passo</h2>}
          />
          <div className={styles.cardBody}>
            {[
              {
                title: "Explore o catálogo",
                text: "Encontre serviços pelo nome, código ou provedor.",
              },
              {
                title: "Consulte as estimativas",
                text: "Veja as composições e as premissas dos cenários cadastrados.",
              },
              {
                title: "Confira a origem dos dados",
                text: "Acompanhe as importações e consulte as operações na documentação da API.",
              },
            ].map((step, index) => (
              <div className={styles.step} key={step.title}>
                <span className={styles.stepNumber}>0{index + 1}</span>
                <div>
                  <h3 className={styles.stepTitle}>{step.title}</h3>
                  <p className={styles.stepDescription}>{step.text}</p>
                </div>
              </div>
            ))}
          </div>
          <Button
            as="a"
            href="/estimativas"
            appearance="transparent"
            icon={<ArrowRightRegular />}
          >
            Ver estimativas
          </Button>
        </Card>
      </div>
      <footer className={styles.footer}>
        <span>
          Preços públicos em USD · Conversão em reais pela PTAX de venda
        </span>
        <span>Última consulta às {checkedAt} · Horário de Brasília</span>
      </footer>
    </div>
  );
}
