"use client";

import { useEffect, useState } from "react";
import { Button, Card, Field, Input, Select } from "@fluentui/react-components";
import type {
  ArchitectureEdge,
  ArchitectureNode,
  CatalogRate,
  ChargeKey,
  Connectivity,
  Period,
} from "@/lib/portal-contracts";
import { usePageStyles } from "../shared";
import { money, usePortalStyles } from "./shared";

export function NodeProperties({
  node,
  rate,
  readOnly,
  onApply,
  embedded = false,
}: {
  node: ArchitectureNode;
  rate?: CatalogRate;
  readOnly: boolean;
  onApply: (node: ArchitectureNode) => void;
  embedded?: boolean;
}) {
  const styles = usePageStyles();
  const ui = usePortalStyles();
  const [draft, setDraft] = useState(node);
  useEffect(() => {
    setDraft((old) => ({
      ...old,
      rateId: node.rateId,
      serviceCode: node.serviceCode,
      provider: node.provider,
      consumptionUnit: node.consumptionUnit,
      period: node.period,
    }));
  }, [
    node.rateId,
    node.serviceCode,
    node.provider,
    node.consumptionUnit,
    node.period,
  ]);
  const Surface = embedded ? "div" : Card;
  return (
    <Surface className={embedded ? ui.form : styles.card}>
      {!embedded && <h2 className={ui.title}>Propriedades do componente</h2>}
      <p className={ui.muted}>
        {rate
          ? `${rate.serviceCode} · ${rate.regionCode} · ${money(rate.unitPrice, "USD")} por ${rate.unit}`
          : node.rateId
            ? `Tarifa vinculada: ${node.rateId}`
            : "Tarifa a definir. Configure o preço nas propriedades deste componente."}
      </p>
      <form
        className={ui.form}
        onSubmit={(event) => {
          event.preventDefault();
          onApply(draft);
        }}
      >
        <div className={ui.fields}>
          <Field label="Nome do componente" required>
            <Input
              value={draft.name}
              maxLength={200}
              required
              disabled={readOnly}
              onChange={(_, item) => setDraft({ ...draft, name: item.value })}
            />
          </Field>
          <Field label="Categoria de custo" required>
            <Input
              value={draft.category}
              maxLength={100}
              required
              disabled={readOnly}
              onChange={(_, item) =>
                setDraft({ ...draft, category: item.value })
              }
            />
          </Field>
          <Field label="Conta" required>
            <Input
              value={draft.accountCode}
              maxLength={100}
              required
              disabled={readOnly}
              onChange={(_, item) =>
                setDraft({ ...draft, accountCode: item.value })
              }
            />
          </Field>
          <Field
            label="Quantidade"
            required
            hint="Multiplicador do consumo por componente."
          >
            <Input
              type="number"
              min="0.000000000001"
              step="any"
              value={String(draft.quantity)}
              required
              disabled={readOnly}
              onChange={(_, item) =>
                setDraft({ ...draft, quantity: item.value })
              }
            />
          </Field>
          <Field label="Consumo por unidade" required>
            <Input
              type="number"
              min="0"
              step="any"
              value={String(draft.consumption)}
              required
              disabled={readOnly}
              onChange={(_, item) =>
                setDraft({ ...draft, consumption: item.value })
              }
            />
          </Field>
          <Field
            label="Unidade do consumo"
            required
            hint="Use uma unidade compatível com a tarifa, como Hrs, GB ou GiB."
          >
            <Input
              value={draft.consumptionUnit}
              maxLength={40}
              required
              disabled={readOnly}
              onChange={(_, item) =>
                setDraft({ ...draft, consumptionUnit: item.value })
              }
            />
          </Field>
          <Field label="Período do consumo">
            <Select
              value={draft.period}
              disabled={readOnly}
              onChange={(_, item) =>
                setDraft({ ...draft, period: item.value as Period })
              }
            >
              <option value="HOUR">Por hora</option>
              <option value="DAY">Por dia</option>
              <option value="MONTH">Por mês</option>
              <option value="YEAR">Por ano</option>
            </Select>
          </Field>
          <Field
            label="Retenção em dias"
            hint="Opcional. Exige consumo diário e tarifa de armazenamento."
          >
            <Input
              type="number"
              min="1"
              max="36500"
              step="1"
              value={
                draft.retentionDays == null ? "" : String(draft.retentionDays)
              }
              disabled={readOnly}
              onChange={(_, item) =>
                setDraft({
                  ...draft,
                  retentionDays: item.value ? Number(item.value) : null,
                })
              }
            />
          </Field>
          <Field
            label="AZ física"
            hint="Opcional para recursos. Ligações na mesma região exigem o identificador físico, como use1-az1."
          >
            <Input
              value={draft.availabilityZone || ""}
              maxLength={100}
              disabled={readOnly}
              onChange={(_, item) =>
                setDraft({ ...draft, availabilityZone: item.value || null })
              }
            />
          </Field>
        </div>
        {!readOnly && (
          <div>
            <Button type="submit" appearance="primary">
              Aplicar ao componente
            </Button>
          </div>
        )}
      </form>
    </Surface>
  );
}

const chargeLabels: Record<ChargeKey, string> = {
  DATA_IN: "Entrada de dados",
  DATA_OUT: "Saída de dados",
  INTER_REGION_IN: "Entrada entre regiões",
  INTER_REGION_OUT: "Saída entre regiões",
  INTER_AZ_IN: "Entrada entre AZs",
  INTER_AZ_OUT: "Saída entre AZs",
  NAT_PROCESSING: "Processamento NAT",
  TRANSIT_PROCESSING: "Processamento Transit Gateway",
  ENDPOINT_PROCESSING: "Processamento VPC Endpoint",
  PRIVATELINK_PROCESSING: "Processamento PrivateLink",
  DIRECT_CONNECT_OUT: "Saída Direct Connect",
};
const connectivityLabels: Record<Connectivity, string> = {
  DIRECT: "Direta",
  NAT_GATEWAY: "NAT Gateway",
  TRANSIT_GATEWAY: "Transit Gateway",
  VPC_ENDPOINT: "VPC Endpoint",
  PRIVATELINK: "PrivateLink",
  DIRECT_CONNECT: "Direct Connect",
};

export function EdgeProperties({
  edge,
  rates,
  readOnly,
  onApply,
  embedded = false,
}: {
  edge: ArchitectureEdge;
  rates: CatalogRate[];
  readOnly: boolean;
  onApply: (edge: ArchitectureEdge) => void;
  embedded?: boolean;
}) {
  const styles = usePageStyles();
  const ui = usePortalStyles();
  const [draft, setDraft] = useState(edge);
  const [key, setKey] = useState<ChargeKey>("DATA_OUT");
  const [rate, setRate] = useState("");
  const Surface = embedded ? "div" : Card;
  return (
    <Surface className={embedded ? ui.form : styles.card}>
      {!embedded && <h2 className={ui.title}>Consumo da ligação</h2>}
      <p className={ui.muted}>
        A ligação representa um fluxo de dados. O cálculo exige as tarifas de
        rede e as AZs compatíveis com o caminho; uma ligação desenhada não
        implica tráfego gratuito.
      </p>
      <form
        className={ui.form}
        onSubmit={(event) => {
          event.preventDefault();
          onApply(draft);
        }}
      >
        <div className={ui.fields}>
          <Field label="Tráfego mensal em GB" required>
            <Input
              type="number"
              min="0"
              step="any"
              required
              value={String(draft.monthlyGb)}
              disabled={readOnly}
              onChange={(_, item) =>
                setDraft({ ...draft, monthlyGb: item.value })
              }
            />
          </Field>
          <Field label="Direção">
            <Select
              value={draft.direction}
              disabled={readOnly}
              onChange={(_, item) =>
                setDraft({
                  ...draft,
                  direction: item.value as ArchitectureEdge["direction"],
                })
              }
            >
              <option value="INTERNAL">Entre os componentes</option>
              <option value="INTERNET_IN">Entrada da internet</option>
              <option value="INTERNET_OUT">Saída para internet</option>
            </Select>
          </Field>
          <Field label="Conectividade">
            <Select
              value={draft.connectivity}
              disabled={readOnly}
              onChange={(_, item) =>
                setDraft({ ...draft, connectivity: item.value as Connectivity })
              }
            >
              {Object.entries(connectivityLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {!readOnly && (
          <div className={ui.fields}>
            <Field label="Tipo de cobrança">
              <Select
                value={key}
                onChange={(_, item) => setKey(item.value as ChargeKey)}
              >
                {Object.entries(chargeLabels).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Tarifa de rede sincronizada"
              hint="Busque o serviço e a região de rede na biblioteca para carregar outras tarifas."
            >
              <Select value={rate} onChange={(_, item) => setRate(item.value)}>
                <option value="">Selecione uma tarifa</option>
                {rates
                  .filter((r) =>
                    /byte|transfer|network|nat|transit|endpoint|connect/i.test(
                      `${r.family} ${r.usageType} ${r.serviceCode}`,
                    ),
                  )
                  .map((r) => (
                    <option value={r.id} key={r.id}>
                      {r.serviceCode} · {r.regionCode} · {r.usageType} ·{" "}
                      {r.unit}
                    </option>
                  ))}
              </Select>
            </Field>
            <Button
              disabled={
                !rate ||
                draft.charges.some((c) => c.key === key) ||
                draft.charges.length >= 8
              }
              onClick={() => {
                setDraft({
                  ...draft,
                  charges: [...draft.charges, { key, rateId: Number(rate) }],
                });
                setRate("");
              }}
            >
              Adicionar cobrança
            </Button>
          </div>
        )}
        {draft.charges.length > 0 && (
          <ul>
            {draft.charges.map((charge) => (
              <li key={charge.key}>
                <div className={ui.row}>
                  <span>
                    {chargeLabels[charge.key]} · tarifa {charge.rateId}
                  </span>
                  {!readOnly && (
                    <Button
                      size="small"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          charges: draft.charges.filter(
                            (item) => item.key !== charge.key,
                          ),
                        })
                      }
                    >
                      Remover cobrança
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {!readOnly && (
          <div>
            <Button appearance="primary" type="submit">
              Aplicar à ligação
            </Button>
          </div>
        )}
      </form>
    </Surface>
  );
}
