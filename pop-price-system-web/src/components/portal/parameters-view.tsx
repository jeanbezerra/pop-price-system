"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button, Card, Field, Input } from "@fluentui/react-components";
import { saveParameters } from "@/app/actions";
import type { ApiResult } from "@/lib/contracts";
import type { Parameters } from "@/lib/portal-contracts";
import { ApiNotice, PageHeading, usePageStyles } from "../shared";
import { failure, Feedback, type Notice, usePortalStyles } from "./shared";

export function ParametersView({
  initial,
}: {
  initial: ApiResult<Parameters>;
}) {
  const styles = usePageStyles();
  const ui = usePortalStyles();
  const first = useRef<HTMLInputElement>(null);
  const [parameters, setParameters] = useState(
    initial.ok ? initial.data : null,
  );
  const [hours, setHours] = useState(
    initial.ok ? String(initial.data.hoursPerMonth) : "",
  );
  useEffect(() => {
    if (initial.ok) {
      setParameters(initial.data);
      setHours(String(initial.data.hoursPerMonth));
    }
  }, [initial]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className={styles.page}>
      <PageHeading
        title="Parâmetros do portal"
        description="Defina as premissas técnicas usadas ao iniciar um novo modelo de arquitetura."
      />
      {!initial.ok && <ApiNotice message={initial.message} />}
      <Feedback
        notice={notice}
        onDismiss={() => setNotice(null)}
        onReview={() => first.current?.focus()}
      />
      <Card className={styles.card}>
        <h2 className={ui.title}>Horas mensais padrão</h2>
        <form
          className={ui.form}
          onSubmit={(event) => {
            event.preventDefault();
            if (!parameters) return;
            start(async () => {
              const result = await saveParameters(
                Number(hours),
                parameters.revision,
              );
              if (!result.ok) return setNotice(failure(result));
              setParameters(result.data);
              setNotice({
                intent: "success",
                message:
                  "Premissa salva para novos modelos. Os cenários existentes foram preservados.",
              });
            });
          }}
        >
          <Field
            label="Horas por mês"
            required
            hint="Informe um valor maior que zero e de até 744 horas. Essa premissa continuará editável em cada Canvas."
          >
            <Input
              ref={first}
              type="number"
              min="0.000001"
              max="744"
              step="0.000001"
              required
              value={hours}
              onChange={(_, data) => setHours(data.value)}
              disabled={pending || !parameters}
            />
          </Field>
          <div>
            <Button
              type="submit"
              appearance="primary"
              disabled={pending || !parameters}
            >
              {pending ? "Salvando…" : "Salvar parâmetros"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
