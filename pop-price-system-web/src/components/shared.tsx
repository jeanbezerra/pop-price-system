"use client";

import type { ReactNode } from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  makeStyles,
  shorthands,
  tokens,
  typographyStyles,
} from "@fluentui/react-components";
import {
  ArrowClockwiseRegular,
  ArrowRightRegular,
  DismissRegular,
} from "@fluentui/react-icons";

export const usePageStyles = makeStyles({
  page: { display: "grid", gap: tokens.spacingVerticalXXL },
  heading: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: tokens.spacingVerticalL,
  },
  title: {
    ...typographyStyles.title1,
    margin: 0,
    color: tokens.colorNeutralForeground1,
  },
  description: {
    margin: 0,
    marginTop: tokens.spacingVerticalS,
    color: tokens.colorNeutralForeground2,
    lineHeight: tokens.lineHeightBase400,
    maxWidth: "720px",
  },
  sectionTitle: { ...typographyStyles.subtitle1, margin: 0 },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalM,
    flexWrap: "wrap",
  },
  section: { display: "grid", gap: tokens.spacingVerticalL },
  subtle: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    lineHeight: tokens.lineHeightBase300,
  },
  card: {
    ...shorthands.padding(tokens.spacingVerticalXL, tokens.spacingHorizontalXL),
    boxShadow: tokens.shadow2,
  },
  empty: {
    display: "grid",
    justifyItems: "center",
    textAlign: "center",
    gap: tokens.spacingVerticalM,
    ...shorthands.padding(
      tokens.spacingVerticalXXXL,
      tokens.spacingHorizontalXL,
    ),
  },
  emptyIcon: {
    color: tokens.colorBrandForeground1,
    backgroundColor: tokens.colorBrandBackground2,
    fontSize: "28px",
    padding: tokens.spacingHorizontalL,
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
  },
  emptyText: {
    margin: 0,
    color: tokens.colorNeutralForeground2,
    lineHeight: tokens.lineHeightBase400,
    maxWidth: "440px",
  },
  scroll: {
    minWidth: 0,
    overflowX: "auto",
    ":focus-visible": {
      outline: `${tokens.strokeWidthThick} solid ${tokens.colorStrokeFocus2}`,
      outlineOffset: "2px",
    },
  },
});

export function TableRegion({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  const styles = usePageStyles();
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className={styles.scroll}
    >
      {children}
    </div>
  );
}

export function RefreshButton({
  label = "Atualizar dados",
}: {
  label?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      icon={<ArrowClockwiseRegular />}
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      {pending ? "Atualizando…" : label}
    </Button>
  );
}

export function PageHeading({
  title,
  description,
  showRefresh = true,
}: {
  title: string;
  description: string;
  showRefresh?: boolean;
}) {
  const styles = usePageStyles();
  return (
    <div className={styles.heading}>
      <div>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.description}>{description}</p>
      </div>
      {showRefresh && <RefreshButton />}
    </div>
  );
}

export function ApiNotice({
  message = "Não foi possível atualizar todos os dados. Confira a disponibilidade da API e tente novamente.",
}: {
  message?: string;
}) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <MessageBar intent="warning">
      <MessageBarBody>{message}</MessageBarBody>
      <MessageBarActions
        containerAction={
          <Button
            appearance="transparent"
            icon={<DismissRegular />}
            aria-label="Fechar aviso"
            onClick={() => setDismissed(true)}
          />
        }
      >
        <RefreshButton label="Tentar novamente" />
      </MessageBarActions>
    </MessageBar>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: { href: string; label: string; appearance?: "primary" | "outline" };
}) {
  const styles = usePageStyles();
  return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon} aria-hidden="true">
        {icon}
      </span>
      <h2 className={styles.sectionTitle}>{title}</h2>
      <p className={styles.emptyText}>{description}</p>
      {action && (
        <Button
          as="a"
          href={action.href}
          appearance={action.appearance ?? "outline"}
          icon={<ArrowRightRegular />}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}

export function EmptyPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const styles = usePageStyles();
  return (
    <div className={styles.page}>
      <PageHeading title={title} description={description} />
      <Card className={styles.card}>
        <Button as="a" href="/">
          Voltar ao início
        </Button>
      </Card>
    </div>
  );
}
