"use client";

import {
  Button,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  makeStyles,
  tokens,
  typographyStyles,
} from "@fluentui/react-components";
import { DismissRegular } from "@fluentui/react-icons";
import type { ApiResult } from "@/lib/contracts";

export interface Notice {
  intent: "success" | "error" | "warning";
  message: string;
}
export function failure(
  result: Extract<ApiResult<unknown>, { ok: false }>,
): Notice {
  return {
    intent: "error",
    message:
      result.message +
      (result.correlationId ? ` Protocolo: ${result.correlationId}` : ""),
  };
}
export function Feedback({
  notice,
  onDismiss,
  onReview,
}: {
  notice: Notice | null;
  onDismiss: () => void;
  onReview: () => void;
}) {
  if (!notice) return null;
  return (
    <MessageBar intent={notice.intent}>
      <MessageBarBody>{notice.message}</MessageBarBody>
      <MessageBarActions
        containerAction={
          <Button
            appearance="transparent"
            icon={<DismissRegular />}
            aria-label="Fechar mensagem"
            onClick={onDismiss}
          />
        }
      >
        {notice.intent !== "success" && (
          <Button onClick={onReview}>Revisar dados</Button>
        )}
      </MessageBarActions>
    </MessageBar>
  );
}
export const money = (value: number | null | undefined, currency = "BRL") =>
  value == null
    ? "Pendente"
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(
        value,
      );
export const dateLabel = (value: string) =>
  value.slice(0, 10).split("-").reverse().join("/");
export const usePortalStyles = makeStyles({
  row: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalM,
  },
  form: { display: "grid", gap: tokens.spacingVerticalL },
  fields: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
    gap: tokens.spacingHorizontalL,
    alignItems: "end",
  },
  title: { ...typographyStyles.subtitle1, margin: 0 },
  muted: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    lineHeight: tokens.lineHeightBase300,
    margin: 0,
  },
  table: { minWidth: "700px", overflowWrap: "anywhere" },
  list: { display: "grid", gap: tokens.spacingVerticalL },
  amount: {
    ...typographyStyles.title2,
    margin: 0,
    fontVariantNumeric: "tabular-nums",
  },
});
