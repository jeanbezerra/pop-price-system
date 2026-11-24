"use client";

import {
  Badge,
  Button,
  Card,
  Table,
  TableHeader,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
} from "@fluentui/react-components";
import type { Valuation } from "@/lib/portal-contracts";
import { TableRegion, usePageStyles } from "../shared";
import { dateLabel, money, usePortalStyles } from "./shared";

export function ValuationResult({ value }: { value: Valuation }) {
  const styles = usePageStyles();
  const ui = usePortalStyles();
  return (
    <Card className={styles.card} aria-label="Resultado da estimativa">
      <div className={ui.actions}>
        <h2 className={ui.title}>{value.usd.name}</h2>
        <Badge
          appearance="tint"
          color={value.usd.complete ? "success" : "warning"}
        >
          {value.usd.complete ? "Cálculo completo" : "Há custos pendentes"}
        </Badge>
      </div>
      <div className={ui.fields}>
        <div>
          <p className={ui.muted}>Mensal em dólar</p>
          <p className={ui.amount}>{money(value.usd.monthlyCost, "USD")}</p>
        </div>
        <div>
          <p className={ui.muted}>Mensal em reais</p>
          <p className={ui.amount}>{money(value.brl.monthlyCost)}</p>
        </div>
        <div>
          <p className={ui.muted}>Anual em reais</p>
          <p className={ui.amount}>{money(value.brl.annualCost)}</p>
        </div>
      </div>
      <p className={ui.muted}>
        PTAX de venda de {dateLabel(value.exchangeQuote.quotationDate)}:{" "}
        {new Intl.NumberFormat("pt-BR", {
          minimumFractionDigits: 4,
          maximumFractionDigits: 10,
        }).format(value.exchangeQuote.sellRate)}{" "}
        BRL por USD. Valores sem impostos ou descontos negociados.
      </p>
      {!value.usd.complete && (
        <p>
          O subtotal conhecido é {money(value.brl.knownMonthlySubtotal)}. Revise
          as tarifas e as premissas dos componentes pendentes antes de cadastrar
          um contrato.
        </p>
      )}
      <TableRegion label="Componentes calculados">
        <Table className={ui.table} aria-label="Custos por componente">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Componente</TableHeaderCell>
              <TableHeaderCell>Estado</TableHeaderCell>
              <TableHeaderCell>Mensal em USD</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {value.usd.items.map((item) => (
              <TableRow key={item.component.id}>
                <TableCell>{item.component.name}</TableCell>
                <TableCell>
                  {item.status === "UNPRICEABLE"
                    ? "Revisar preço ou premissas"
                    : "Precificado"}
                </TableCell>
                <TableCell>{money(item.monthlyCost, "USD")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableRegion>
      {value.usd.warnings.length > 0 && (
        <details>
          <summary>Detalhes das pendências</summary>
          <ul>
            {value.usd.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </details>
      )}
      {value.usd.complete && (
        <div>
          <Button
            as="a"
            href={`/contratos?valuation=${value.id}`}
            appearance="primary"
          >
            Criar contrato desta estimativa
          </Button>
        </div>
      )}
    </Card>
  );
}
