"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  Button,
  Card,
  Field,
  Input,
  Select,
  Table,
  TableHeader,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
} from "@fluentui/react-components";
import { DocumentTextRegular } from "@fluentui/react-icons";
import { createContract, loadContracts, loadValuations } from "@/app/actions";
import type { ApiResult, OffsetPage } from "@/lib/contracts";
import type { CustomerContract, Valuation } from "@/lib/portal-contracts";
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
  money,
  type Notice,
  usePortalStyles,
} from "./shared";

export function ContractsView({
  initial,
  valuations,
  selectedId,
  today,
}: {
  initial: ApiResult<OffsetPage<CustomerContract>>;
  valuations: ApiResult<OffsetPage<Valuation>>;
  selectedId: string;
  today: string;
}) {
  const styles = usePageStyles();
  const ui = usePortalStyles();
  const referenceInput = useRef<HTMLInputElement>(null);
  const [data, setData] = useState(
    initial.ok
      ? initial.data
      : { items: [], size: 20, offset: 0, hasMore: false },
  );
  const [choices, setChoices] = useState(
    valuations.ok
      ? valuations.data
      : { items: [], size: 20, offset: 0, hasMore: false },
  );
  const [selected, setSelected] = useState(selectedId);
  useEffect(() => {
    if (initial.ok) setData(initial.data);
  }, [initial]);
  useEffect(() => {
    if (valuations.ok) setChoices(valuations.data);
  }, [valuations]);
  const [reference, setReference] = useState("");
  const [name, setName] = useState("");
  const [customer, setCustomer] = useState("");
  const [startsOn, setStartsOn] = useState(today);
  const [months, setMonths] = useState("12");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pending, start] = useTransition();
  const [detail, setDetail] = useState<CustomerContract | null>(null);
  const choice = choices.items.find((item) => item.id === selected);
  function submit(event: React.FormEvent) {
    event.preventDefault();
    start(async () => {
      const result = await createContract({
        reference,
        name,
        customerName: customer,
        valuationId: selected,
        startsOn,
        months: Number(months),
      });
      if (!result.ok) return setNotice(failure(result));
      setData((old) => ({ ...old, items: [result.data, ...old.items] }));
      setDetail(result.data);
      setNotice({
        intent: "success",
        message: `Contrato ${result.data.reference} cadastrado com a cotação da estimativa preservada.`,
      });
      setReference("");
      setName("");
      setCustomer("");
    });
  }
  return (
    <div className={styles.page}>
      <PageHeading
        title="Contratos"
        description="Vincule o cadastro comercial a uma estimativa completa e preserve seus valores em reais."
      />
      {(!initial.ok || !valuations.ok) && <ApiNotice />}
      <Feedback
        notice={notice}
        onDismiss={() => setNotice(null)}
        onReview={() => referenceInput.current?.focus()}
      />
      <Card className={styles.card}>
        <h2 className={ui.title}>Novo contrato</h2>
        <form className={ui.form} onSubmit={submit}>
          <Field
            label="Estimativa calculada"
            required
            hint="Somente estimativas com todos os custos calculados podem gerar contratos."
          >
            <Select
              value={selected}
              required
              disabled={pending}
              onChange={(_, item) => setSelected(item.value)}
            >
              <option value="">Selecione uma estimativa</option>
              {choices.items
                .filter((v) => v.usd.complete)
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.usd.name} · {money(v.brl.monthlyCost)}/mês · PTAX{" "}
                    {dateLabel(v.exchangeQuote.quotationDate)}
                  </option>
                ))}
            </Select>
          </Field>
          {choices.hasMore && (
            <div>
              <Button
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const result = await loadValuations(
                      choices.offset + choices.size,
                    );
                    if (!result.ok) return setNotice(failure(result));
                    setChoices({
                      ...result.data,
                      items: [...choices.items, ...result.data.items],
                    });
                  })
                }
              >
                Carregar mais estimativas
              </Button>
            </div>
          )}
          {choice && (
            <p className={ui.muted}>
              Mensal: {money(choice.brl.monthlyCost)} · Origem:{" "}
              {money(choice.usd.monthlyCost, "USD")} · PTAX venda de{" "}
              {dateLabel(choice.exchangeQuote.quotationDate)}. A cotação será
              mantida no contrato.
            </p>
          )}
          <div className={ui.fields}>
            <Field label="Referência do contrato" required>
              <Input
                ref={referenceInput}
                value={reference}
                onChange={(_, item) => setReference(item.value)}
                maxLength={100}
                required
                disabled={pending}
              />
            </Field>
            <Field label="Nome do contrato" required>
              <Input
                value={name}
                onChange={(_, item) => setName(item.value)}
                maxLength={200}
                required
                disabled={pending}
              />
            </Field>
            <Field label="Cliente ou área contratante" required>
              <Input
                value={customer}
                onChange={(_, item) => setCustomer(item.value)}
                maxLength={200}
                required
                disabled={pending}
              />
            </Field>
            <Field label="Início da vigência" required>
              <Input
                type="date"
                value={startsOn}
                onChange={(_, item) => setStartsOn(item.value)}
                required
                disabled={pending}
              />
            </Field>
            <Field
              label="Prazo em meses"
              required
              hint="De 1 a 120 meses. O total usa o valor mensal em reais multiplicado pelo prazo."
            >
              <Input
                type="number"
                value={months}
                onChange={(_, item) => setMonths(item.value)}
                min={1}
                max={120}
                step={1}
                required
                disabled={pending}
              />
            </Field>
          </div>
          <div>
            <Button
              appearance="primary"
              type="submit"
              disabled={pending || !choice?.usd.complete}
            >
              {pending ? "Cadastrando…" : "Cadastrar contrato"}
            </Button>
          </div>
        </form>
        {!choices.items.some((v) => v.usd.complete) && (
          <p>
            Gere uma estimativa completa no{" "}
            <a href="/canvas">Canvas de arquitetura</a> para habilitar o
            cadastro.
          </p>
        )}
      </Card>
      {detail && (
        <Card className={styles.card} aria-label="Contrato cadastrado">
          <div className={ui.actions}>
            <h2 className={ui.title}>
              {detail.reference} · {detail.name}
            </h2>
            <Button onClick={() => setDetail(null)}>Fechar detalhes</Button>
          </div>
          <p>
            {detail.customerName} · {detail.months} meses a partir de{" "}
            {dateLabel(detail.startsOn)}
          </p>
          <div className={ui.fields}>
            <div>
              <p className={ui.muted}>Mensal em reais</p>
              <p className={ui.amount}>{money(detail.monthlyBrl)}</p>
            </div>
            <div>
              <p className={ui.muted}>Total do contrato</p>
              <p className={ui.amount}>{money(detail.totalBrl)}</p>
            </div>
          </div>
          <p className={ui.muted}>
            Estimativa: {detail.valuation.usd.name} · PTAX venda:{" "}
            {dateLabel(detail.valuation.exchangeQuote.quotationDate)} · Cotação{" "}
            {detail.valuation.exchangeQuote.sellRate}. Sem impostos ou margens
            adicionais.
          </p>
        </Card>
      )}
      <Card className={styles.card}>
        <h2 className={ui.title}>Contratos cadastrados</h2>
        {data.items.length ? (
          <TableRegion label="Cadastros comerciais">
            <Table className={ui.table} aria-label="Contratos cadastrados">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Referência</TableHeaderCell>
                  <TableHeaderCell>Cliente</TableHeaderCell>
                  <TableHeaderCell>Mensal em BRL</TableHeaderCell>
                  <TableHeaderCell>Total em BRL</TableHeaderCell>
                  <TableHeaderCell>Ações</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.reference}</TableCell>
                    <TableCell>{c.customerName}</TableCell>
                    <TableCell>{money(c.monthlyBrl)}</TableCell>
                    <TableCell>{money(c.totalBrl)}</TableCell>
                    <TableCell>
                      <Button size="small" onClick={() => setDetail(c)}>
                        Ver detalhes
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableRegion>
        ) : (
          <EmptyState
            icon={<DocumentTextRegular />}
            title="Nenhum contrato cadastrado"
            description="Os contratos vinculados às suas estimativas aparecerão aqui, com a PTAX e os valores preservados."
          />
        )}
        {data.hasMore && (
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const result = await loadContracts(data.offset + data.size);
                if (!result.ok) return setNotice(failure(result));
                setData({
                  ...result.data,
                  items: [...data.items, ...result.data.items],
                });
              })
            }
          >
            Carregar mais contratos
          </Button>
        )}
      </Card>
    </div>
  );
}
