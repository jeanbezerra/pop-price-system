"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import {
  Badge,
  Card,
  Button,
  Field,
  Select,
  Table,
  TableHeader,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
  makeStyles,
} from "@fluentui/react-components";
import { CalculatorRegular } from "@fluentui/react-icons";
import type { ApiResult, EstimateSummary, OffsetPage } from "@/lib/contracts";
import type { ExchangeQuote, Valuation } from "@/lib/portal-contracts";
import { convertEstimate, loadValuations } from "@/app/actions";
import {
  dateLabel,
  failure,
  Feedback,
  money,
  type Notice,
  usePortalStyles,
} from "./portal/shared";
import { ValuationResult } from "./portal/valuation-result";
import {
  ApiNotice,
  EmptyState,
  PageHeading,
  TableRegion,
  usePageStyles,
} from "./shared";

const useStyles = makeStyles({
  table: { minWidth: "560px", overflowWrap: "anywhere" },
});

export function EstimatesView({
  estimates,
  documentationEnabled,
  valuations,
  quotes,
}: {
  estimates: ApiResult<OffsetPage<EstimateSummary>>;
  documentationEnabled: boolean;
  valuations: ApiResult<OffsetPage<Valuation>>;
  quotes: ApiResult<ExchangeQuote[]>;
}) {
  const shared = usePageStyles();
  const styles = useStyles();
  const items = estimates.ok ? estimates.data.items : [];
  const ui = usePortalStyles();
  const first = useRef<HTMLSelectElement>(null);
  const [converted, setConverted] = useState(
    valuations.ok
      ? valuations.data
      : { items: [], size: 20, offset: 0, hasMore: false },
  );
  const [selected, setSelected] = useState<Valuation | null>(null);
  useEffect(() => {
    if (valuations.ok) setConverted(valuations.data);
  }, [valuations]);
  const [estimateId, setEstimateId] = useState("");
  const [quoteId, setQuoteId] = useState(
    quotes.ok ? quotes.data[0]?.id || "" : "",
  );
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className={shared.page}>
      <PageHeading
        title="Estimativas de arquitetura"
        description="Acompanhe as composições e as premissas dos seus cenários de infraestrutura."
      />
      {!estimates.ok && <ApiNotice />}
      <Feedback
        notice={notice}
        onDismiss={() => setNotice(null)}
        onReview={() => first.current?.focus()}
      />
      <div className={ui.row}>
        <Button as="a" href="/canvas" appearance="primary">
          Nova estimativa no Canvas
        </Button>
        <Button as="a" href="/modelos">
          Reutilizar modelo
        </Button>
      </div>
      {(!valuations.ok || !quotes.ok) && (
        <ApiNotice message="Não foi possível consultar as conversões ou cotações. Confira a API e atualize os dados." />
      )}
      <Card className={shared.card}>
        <h2 className={ui.title}>Estimativas em reais</h2>
        {converted.items.length ? (
          <TableRegion label="Estimativas convertidas">
            <Table className={ui.table} aria-label="Estimativas em USD e BRL">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Estimativa</TableHeaderCell>
                  <TableHeaderCell>Mensal em USD</TableHeaderCell>
                  <TableHeaderCell>Mensal em BRL</TableHeaderCell>
                  <TableHeaderCell>PTAX de venda</TableHeaderCell>
                  <TableHeaderCell>Ações</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {converted.items.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>
                      {v.usd.name}
                      {!v.usd.complete && (
                        <Badge appearance="tint" color="warning">
                          Custos pendentes
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{money(v.usd.monthlyCost, "USD")}</TableCell>
                    <TableCell>{money(v.brl.monthlyCost)}</TableCell>
                    <TableCell>
                      {dateLabel(v.exchangeQuote.quotationDate)}
                    </TableCell>
                    <TableCell>
                      <div className={ui.row}>
                        <Button size="small" onClick={() => setSelected(v)}>
                          Ver cálculo
                        </Button>
                        {v.usd.complete && (
                          <Button
                            as="a"
                            href={`/contratos?valuation=${v.id}`}
                            size="small"
                          >
                            Criar contrato
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableRegion>
        ) : (
          <p>
            As estimativas geradas pelo Canvas aparecerão aqui, com a cotação
            usada em cada cálculo.
          </p>
        )}
        {converted.hasMore && (
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const result = await loadValuations(
                  converted.offset + converted.size,
                );
                if (!result.ok) return setNotice(failure(result));
                setConverted({
                  ...result.data,
                  items: [...converted.items, ...result.data.items],
                });
              })
            }
          >
            Carregar mais cálculos
          </Button>
        )}
      </Card>
      {selected && <ValuationResult value={selected} />}
      {items.length > 0 && (
        <Card className={shared.card}>
          <h2 className={ui.title}>
            Calcular uma estimativa existente com PTAX
          </h2>
          <form
            className={ui.form}
            onSubmit={(event) => {
              event.preventDefault();
              start(async () => {
                const result = await convertEstimate(estimateId, quoteId);
                if (!result.ok) return setNotice(failure(result));
                setConverted((old) => ({
                  ...old,
                  items: [result.data, ...old.items],
                }));
                setSelected(result.data);
                setNotice({
                  intent: result.data.usd.complete ? "success" : "warning",
                  message: result.data.usd.complete
                    ? "Cálculo em reais salvo com a cotação preservada."
                    : "Cálculo salvo com pendências. Revise os componentes antes de cadastrar um contrato.",
                });
              });
            }}
          >
            <div className={ui.fields}>
              <Field label="Estimativa de origem" required>
                <Select
                  ref={first}
                  value={estimateId}
                  required
                  disabled={pending}
                  onChange={(_, item) => setEstimateId(item.value)}
                >
                  <option value="">Selecione uma estimativa</option>
                  {items.map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Fechamento PTAX" required>
                <Select
                  value={quoteId}
                  required
                  disabled={pending}
                  onChange={(_, item) => setQuoteId(item.value)}
                >
                  <option value="">Selecione a cotação</option>
                  {quotes.ok &&
                    quotes.data.map((q) => (
                      <option key={q.id} value={q.id}>
                        {dateLabel(q.quotationDate)} · {q.sellRate} BRL/USD
                      </option>
                    ))}
                </Select>
              </Field>
            </div>
            <div>
              <Button
                type="submit"
                disabled={pending || !estimateId || !quoteId}
              >
                Calcular em reais
              </Button>
            </div>
          </form>
        </Card>
      )}
      <Card className={shared.card}>
        <h2 className={ui.title}>Composições cadastradas</h2>
        {items.length ? (
          <TableRegion label="Lista de estimativas">
            <Table
              aria-label="Estimativas de arquitetura"
              className={styles.table}
            >
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Nome</TableHeaderCell>
                  <TableHeaderCell>Horas por mês</TableHeaderCell>
                  <TableHeaderCell>Moeda</TableHeaderCell>
                  <TableHeaderCell>Revisão</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>
                      {new Intl.NumberFormat("pt-BR").format(
                        item.hoursPerMonth,
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge appearance="tint" color="brand">
                        {item.currency}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.revision}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableRegion>
        ) : (
          <EmptyState
            icon={<CalculatorRegular />}
            title={
              estimates.ok
                ? "Ainda não há estimativas"
                : "Estimativas indisponíveis"
            }
            description={
              estimates.ok
                ? "As composições criadas para planejar sua infraestrutura aparecerão aqui. Consulte a API para criar o primeiro cenário."
                : "Não foi possível consultar suas composições. Tente atualizar os dados em instantes."
            }
            action={
              documentationEnabled
                ? {
                    href: "/api/documentacao",
                    label: "Consultar API de estimativas",
                  }
                : undefined
            }
          />
        )}
      </Card>
    </div>
  );
}
