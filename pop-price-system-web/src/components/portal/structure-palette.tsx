"use client";

import { useState, useTransition, type DragEvent } from "react";
import {
  Button,
  Field,
  Input,
  Select,
  Text,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { SearchRegular } from "@fluentui/react-icons";
import { loadArchitectureComponents } from "@/app/actions";
import type { ApiResult } from "@/lib/contracts";
import type {
  ArchitectureComponent,
  ComponentPage,
} from "@/lib/component-contracts";
import { ArchitectureIcon } from "../architecture-icon";
import { usePortalStyles } from "./shared";

const useStyles = makeStyles({
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(2,minmax(0,1fr))",
    gridAutoRows: "max-content",
    alignContent: "start",
    gap: tokens.spacingHorizontalS,
    maxHeight: "320px",
    overflowY: "auto",
    padding: tokens.spacingHorizontalXS,
  },
  tile: {
    height: "auto",
    minHeight: "100px",
    padding: tokens.spacingHorizontalS,
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    whiteSpace: "normal",
    overflowWrap: "anywhere",
    cursor: "grab",
  },
});
export function StructurePalette({
  initial,
  locked,
  onAdd,
  onDrag,
  showTitle = true,
  locations,
  primaryProvider,
}: {
  initial: ApiResult<ComponentPage<ArchitectureComponent>>;
  locked: boolean;
  onAdd: (component: ArchitectureComponent) => void;
  onDrag: (event: DragEvent, component: ArchitectureComponent) => void;
  showTitle?: boolean;
  locations: { provider: string; regionCode: string }[];
  primaryProvider: string;
}) {
  const styles = useStyles();
  const ui = usePortalStyles();
  const [data, setData] = useState(
    initial.ok
      ? initial.data
      : { items: [], hasMore: false, nextAfter: null, size: 20 },
  );
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState(primaryProvider);
  const [error, setError] = useState(initial.ok ? "" : initial.message);
  const [pending, start] = useTransition();
  function search(append = false) {
    start(async () => {
      const result = await loadArchitectureComponents({
        query,
        provider,
        after: append ? data.nextAfter || "" : "",
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setError("");
      setData((old) => ({
        ...result.data,
        items: append
          ? [...old.items, ...result.data.items]
          : result.data.items,
      }));
    });
  }
  return (
    <>
      {showTitle && <h2 className={ui.title}>Recursos da solução</h2>}
      <p className={ui.muted}>
        Arraste um ícone para o desenho ou selecione para adicionar. A tarifa
        pode ser vinculada depois.
      </p>
      <form
        className={ui.form}
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
      >
        <Field label="Buscar componentes">
          <Input
            value={query}
            onChange={(_, d) => setQuery(d.value)}
            contentBefore={<SearchRegular />}
          />
        </Field>
        <Field label="Cloud da biblioteca">
          <Select value={provider} onChange={(_, d) => setProvider(d.value)}>
            {locations.map((l) => (
              <option key={l.provider} value={l.provider}>
                {l.provider} · {l.regionCode}
              </option>
            ))}
            <option value="GENERIC">Genéricos</option>
          </Select>
        </Field>
        <Button type="submit" disabled={pending}>
          Buscar recursos
        </Button>
      </form>
      {error && <p role="alert">{error}</p>}
      <div
        className={styles.grid}
        role="region"
        aria-label="Componentes disponíveis"
        aria-busy={pending}
        tabIndex={0}
      >
        {data.items
          .filter((c) => c.status !== "INACTIVE")
          .map((c) => (
            <Button
              key={c.id}
              className={styles.tile}
              disabled={locked || pending}
              draggable={!locked && !pending}
              onDragStart={(e) => onDrag(e, c)}
              onClick={() => onAdd(c)}
              aria-label={`Adicionar ${c.name}`}
            >
              <ArchitectureIcon icon={c.icon} size={40} />
              <span>{c.name}</span>
              <Text size={100}>{c.provider}</Text>
            </Button>
          ))}
      </div>
      {!data.items.length && !error && (
        <p>
          Nenhum recurso encontrado. Cadastre componentes ou revise a busca.
        </p>
      )}
      {data.hasMore && (
        <Button disabled={pending} onClick={() => search(true)}>
          Carregar mais recursos
        </Button>
      )}
    </>
  );
}
