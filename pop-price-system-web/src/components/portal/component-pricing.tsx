"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button, Field, Select, Text } from "@fluentui/react-components";
import { loadServices, searchRates } from "@/app/actions";
import type {
  ArchitectureNode,
  CatalogRate,
  StructureSpecification,
} from "@/lib/portal-contracts";
import type { ServicePage } from "@/lib/contracts";
import { money, usePortalStyles } from "./shared";

export function ComponentPricing({
  node,
  specification,
  readOnly,
  onService,
  onRate,
  onKnown,
}: {
  node: ArchitectureNode;
  specification: StructureSpecification;
  readOnly: boolean;
  onService: (serviceCode: string) => void;
  onRate: (rate: CatalogRate) => void;
  onKnown: (rates: CatalogRate[]) => void;
}) {
  const ui = usePortalStyles();
  const region = specification.locations.find(
    (l) => l.provider === node.provider,
  )?.regionCode;
  const [services, setServices] = useState<ServicePage>({
    items: [],
    size: 200,
    hasMore: false,
    nextAfter: null,
  });
  const [rates, setRates] = useState<{
    items: CatalogRate[];
    hasMore: boolean;
    nextAfterId: number | null;
  }>({ items: [], hasMore: false, nextAfterId: null });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const [pending, start] = useTransition();
  const callbacks = useRef({ onRate, onKnown });
  callbacks.current = { onRate, onKnown };
  useEffect(() => {
    let ignore = false;
    if (!node.provider || !region) return;
    void loadServices(node.provider).then((result) => {
      if (ignore) return;
      if (result.ok) setServices(result.data);
      else setError(result.message);
    });
    return () => {
      ignore = true;
    };
  }, [node.provider, region, retry]);
  useEffect(() => {
    let ignore = false;
    setError("");
    setRates({ items: [], hasMore: false, nextAfterId: null });
    if (!node.provider || !node.serviceCode || !region) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void searchRates({
      provider: node.provider,
      service: node.serviceCode,
      region,
    }).then((result) => {
      if (ignore) return;
      setLoading(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const items = result.data.items.filter(
        (r) => r.active && r.currency === "USD",
      );
      setRates({ ...result.data, items });
      callbacks.current.onKnown(items);
      // Only an unambiguous catalog result may be linked automatically.
      if (
        !readOnly &&
        !node.rateId &&
        items.length === 1 &&
        !result.data.hasMore
      )
        callbacks.current.onRate(items[0]);
    });
    return () => {
      ignore = true;
    };
  }, [node.id, node.provider, node.serviceCode, region, retry, readOnly]);
  if (node.provider === "GENERIC")
    return (
      <p className={ui.muted}>
        Este recurso é genérico e não possui tarifa cloud.
      </p>
    );
  return (
    <div className={ui.form}>
      <Text weight="semibold">Configuração de preço do componente</Text>
      <Text size={200}>
        {node.provider} · {region || "Região não definida"}
      </Text>
      <Field
        label="Serviço do componente"
        hint={
          node.serviceCode
            ? "Tarifas filtradas pelo serviço e pela região da estrutura."
            : "O cadastro deste componente ainda não tem um serviço vinculado. Escolha o serviço para esta estrutura."
        }
      >
        <Select
          value={node.serviceCode || ""}
          disabled={readOnly || pending}
          onChange={(_, d) => onService(d.value)}
        >
          <option value="">Selecione o serviço</option>
          {node.serviceCode &&
            !services.items.some((s) => s.code === node.serviceCode) && (
              <option value={node.serviceCode}>{node.serviceCode}</option>
            )}
          {services.items.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>
      {services.hasMore && (
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await loadServices(
                node.provider!,
                services.nextAfter || "",
              );
              if (result.ok)
                setServices((old) => ({
                  ...result.data,
                  items: [...old.items, ...result.data.items],
                }));
              else setError(result.message);
            })
          }
        >
          Carregar mais serviços
        </Button>
      )}
      {node.serviceCode && (
        <Field
          label="Tarifa do componente"
          hint={
            loading
              ? "Carregando tarifas da região…"
              : !rates.items.length
                ? "Nenhuma tarifa ativa em USD para este serviço na região. Prepare o catálogo para precificar."
                : "Escolha a configuração comercial correspondente ao recurso."
          }
        >
          <Select
            disabled={readOnly || loading || pending || !rates.items.length}
            value={String(node.rateId || "")}
            onChange={(_, d) => {
              const rate = rates.items.find((r) => String(r.id) === d.value);
              if (rate) onRate(rate);
            }}
          >
            <option value="">Selecione uma configuração</option>
            {node.rateId && !rates.items.some((r) => r.id === node.rateId) && (
              <option value={node.rateId}>
                Tarifa vinculada {node.rateId}
              </option>
            )}
            {rates.items.map((r) => (
              <option key={r.id} value={r.id}>
                {r.sku} · {r.family} · {r.usageType} ·{" "}
                {money(r.unitPrice, "USD")} / {r.unit}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {rates.hasMore && (
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await searchRates({
                provider: node.provider,
                service: node.serviceCode || "",
                region,
                afterId: rates.nextAfterId ?? undefined,
              });
              if (!result.ok) {
                setError(result.message);
                return;
              }
              const items = result.data.items.filter(
                (r) => r.active && r.currency === "USD",
              );
              setRates((old) => ({
                ...result.data,
                items: [...old.items, ...items],
              }));
              callbacks.current.onKnown(items);
            })
          }
        >
          Carregar mais tarifas
        </Button>
      )}
      {error && (
        <>
          <p role="alert">{error}</p>
          <Button onClick={() => setRetry((n) => n + 1)}>
            Recarregar preço do componente
          </Button>
        </>
      )}
    </div>
  );
}
