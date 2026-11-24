"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Badge,
  Button,
  Card,
  Field,
  Select,
  Table,
  TableHeader,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
} from "@fluentui/react-components";
import { AddRegular, GridRegular, CopyRegular } from "@fluentui/react-icons";
import { duplicateArchitecture, loadModels } from "@/app/actions";
import type { ApiResult, OffsetPage } from "@/lib/contracts";
import type { ModelSummary } from "@/lib/portal-contracts";
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

export function ModelsView({
  initial,
}: {
  initial: ApiResult<OffsetPage<ModelSummary>>;
}) {
  const styles = usePageStyles();
  const ui = usePortalStyles();
  const [data, setData] = useState(
    initial.ok
      ? initial.data
      : { items: [], size: 20, offset: 0, hasMore: false },
  );
  const [status, setStatus] = useState("");
  useEffect(() => {
    if (initial.ok) {
      setData(initial.data);
      setStatus("");
    }
  }, [initial]);
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState<Notice | null>(null);
  function query(nextStatus: string, offset: number, append = false) {
    start(async () => {
      const result = await loadModels(nextStatus, offset);
      if (!result.ok) return setNotice(failure(result));
      setData({
        ...result.data,
        items: append
          ? [...data.items, ...result.data.items]
          : result.data.items,
      });
    });
  }
  return (
    <div className={styles.page}>
      <PageHeading
        title="Modelos de arquitetura"
        description="Retome um rascunho ou reutilize uma arquitetura publicada no catálogo final."
      />
      {!initial.ok && <ApiNotice message={initial.message} />}
      <Feedback
        notice={notice}
        onDismiss={() => setNotice(null)}
        onReview={() => query(status, 0)}
      />
      <div className={ui.actions}>
        <Field label="Estado do modelo">
          <Select
            value={status}
            disabled={pending}
            onChange={(_, item) => {
              setStatus(item.value);
              query(item.value, 0);
            }}
          >
            <option value="">Todos os modelos</option>
            <option value="DRAFT">Rascunhos</option>
            <option value="PUBLISHED">Publicados</option>
          </Select>
        </Field>
        <Button
          as="a"
          href="/canvas"
          appearance="primary"
          icon={<AddRegular />}
        >
          Novo Canvas
        </Button>
      </div>
      <Card className={styles.card}>
        {data.items.length ? (
          <TableRegion label="Catálogo de modelos">
            <Table className={ui.table} aria-label="Modelos de arquitetura">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Modelo</TableHeaderCell>
                  <TableHeaderCell>Estado</TableHeaderCell>
                  <TableHeaderCell>Atualização</TableHeaderCell>
                  <TableHeaderCell>Ações</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((model) => (
                  <TableRow key={model.id}>
                    <TableCell>{model.name}</TableCell>
                    <TableCell>
                      <Badge
                        appearance="tint"
                        color={
                          model.status === "PUBLISHED"
                            ? "success"
                            : "informative"
                        }
                      >
                        {model.status === "PUBLISHED"
                          ? "Publicado"
                          : "Rascunho"}
                      </Badge>
                    </TableCell>
                    <TableCell>{dateLabel(model.updatedAt)}</TableCell>
                    <TableCell>
                      <div className={ui.row}>
                        <Button
                          as="a"
                          href={`/canvas?model=${model.id}`}
                          size="small"
                        >
                          {model.status === "PUBLISHED"
                            ? "Consultar modelo"
                            : "Continuar edição"}
                        </Button>
                        <Button
                          icon={<CopyRegular />}
                          size="small"
                          disabled={pending}
                          onClick={() =>
                            start(async () => {
                              const result = await duplicateArchitecture(
                                model.id,
                              );
                              if (!result.ok) return setNotice(failure(result));
                              window.location.assign(
                                `/canvas?model=${result.data.id}`,
                              );
                            })
                          }
                        >
                          Criar cópia
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableRegion>
        ) : (
          <EmptyState
            icon={<GridRegular />}
            title="Seu catálogo de arquiteturas começa no Canvas"
            description="Adicione componentes, ligue os serviços e publique o modelo para reutilizar a composição em novas estimativas."
            action={{ href: "/canvas", label: "Criar arquitetura" }}
          />
        )}
        {data.hasMore && (
          <Button
            disabled={pending}
            onClick={() => query(status, data.offset + data.size, true)}
          >
            Carregar mais modelos
          </Button>
        )}
      </Card>
    </div>
  );
}
