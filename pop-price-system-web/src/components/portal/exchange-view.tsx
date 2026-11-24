"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  Link,
  Table,
  TableHeader,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
} from "@fluentui/react-components";
import { ArrowSyncRegular, MoneyRegular } from "@fluentui/react-icons";
import { synchronizePtax } from "@/app/actions";
import type { ApiResult } from "@/lib/contracts";
import type { ExchangeQuote } from "@/lib/portal-contracts";
import {
  ApiNotice,
  EmptyState,
  PageHeading,
  TableRegion,
  usePageStyles,
} from "../shared";
import {
  dateLabel,
  failure,
  Feedback,
  type Notice,
  usePortalStyles,
} from "./shared";

export function ExchangeView({
  initial,
  today,
}: {
  initial: ApiResult<ExchangeQuote[]>;
  today: string;
}) {
  const styles = usePageStyles();
  const ui = usePortalStyles();
  const [quotes, setQuotes] = useState(initial.ok ? initial.data : []);
  useEffect(() => {
    if (initial.ok) setQuotes(initial.data);
  }, [initial]);
  const [date, setDate] = useState(today);
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState<Notice | null>(null);
  const dateInput = useRef<HTMLInputElement>(null);
  function submit(event: React.FormEvent) {
    event.preventDefault();
    start(async () => {
      const response = await synchronizePtax(date);
      if (!response.ok) return setNotice(failure(response));
      setQuotes((previous) =>
        [
          response.data,
          ...previous.filter((item) => item.id !== response.data.id),
        ].sort((a, b) => b.quotationAt.localeCompare(a.quotationAt)),
      );
      setNotice({
        intent: "success",
        message: `Fechamento de ${dateLabel(response.data.quotationDate)} sincronizado. A cotação de venda está disponível para novas estimativas.`,
      });
    });
  }
  return (
    <div className={styles.page}>
      <PageHeading
        title="Câmbio PTAX"
        description="Prepare a cotação de venda do dólar para estimar e contratar em reais."
      />
      {!initial.ok && <ApiNotice message={initial.message} />}
      <Feedback
        notice={notice}
        onDismiss={() => setNotice(null)}
        onReview={() => dateInput.current?.focus()}
      />
      <Card className={styles.card}>
        <h2 className={ui.title}>Sincronizar fechamento do BCB</h2>
        <form className={ui.form} onSubmit={submit}>
          <div className={ui.fields}>
            <Field
              label="Data de referência"
              required
              hint="Em dias sem boletim, será usado o último fechamento anterior, em uma janela de 14 dias."
            >
              <Input
                ref={dateInput}
                type="date"
                min="1992-01-01"
                max={today}
                required
                value={date}
                onChange={(_, data) => setDate(data.value)}
                disabled={pending}
              />
            </Field>
          </div>
          <div className={ui.row}>
            <Button
              type="submit"
              appearance="primary"
              icon={<ArrowSyncRegular />}
              disabled={pending || !date}
            >
              {pending ? "Consultando BCB…" : "Sincronizar PTAX"}
            </Button>
            <Link
              href="https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/swagger"
              target="_blank"
              rel="noreferrer"
            >
              Consultar fonte oficial
            </Link>
          </div>
        </form>
        <p className={ui.muted}>
          Será preservado o boletim de fechamento, com cotação de compra, venda,
          data e origem. Novas sincronizações não alteram os valores de
          contratos já cadastrados.
        </p>
      </Card>
      <Card className={styles.card}>
        <h2 className={ui.title}>Histórico de cotações</h2>
        {quotes.length ? (
          <TableRegion label="Cotações sincronizadas">
            <Table className={ui.table} aria-label="Histórico PTAX">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Fechamento</TableHeaderCell>
                  <TableHeaderCell>Venda · BRL por USD</TableHeaderCell>
                  <TableHeaderCell>Compra · BRL por USD</TableHeaderCell>
                  <TableHeaderCell>Fonte</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell>{dateLabel(q.quotationDate)}</TableCell>
                    <TableCell>
                      {new Intl.NumberFormat("pt-BR", {
                        minimumFractionDigits: 4,
                        maximumFractionDigits: 10,
                      }).format(q.sellRate)}
                    </TableCell>
                    <TableCell>
                      {new Intl.NumberFormat("pt-BR", {
                        minimumFractionDigits: 4,
                        maximumFractionDigits: 10,
                      }).format(q.buyRate)}
                    </TableCell>
                    <TableCell>
                      <Badge appearance="tint" color="informative">
                        BCB · Fechamento
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableRegion>
        ) : (
          <EmptyState
            icon={<MoneyRegular />}
            title="Sincronize a primeira cotação"
            description="Escolha uma data para consultar o fechamento oficial. A conversão ficará disponível após a sincronização."
          />
        )}
      </Card>
    </div>
  );
}
