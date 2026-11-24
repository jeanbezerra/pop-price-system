"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
  Menu,
  MenuDivider,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  MessageBar,
  MessageBarBody,
} from "@fluentui/react-components";
import {
  DeleteRegular,
  DismissCircleRegular,
  EditRegular,
  MoreVerticalRegular,
} from "@fluentui/react-icons";
import { deleteArchitectureComponent } from "@/app/actions";
import type { ArchitectureComponent } from "@/lib/component-contracts";

export function ComponentActions({
  component,
  disabled,
  onEdit,
  onDeactivate,
  onDeleted,
}: {
  component: ArchitectureComponent;
  disabled: boolean;
  onEdit: () => void;
  onDeactivate: () => void;
  onDeleted: () => Promise<void>;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => {
    if (wasOpen.current && !open) trigger.current?.focus();
    wasOpen.current = open;
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(_, data) => {
        if (pending) return;
        if (data.open) setError(null);
        setOpen(data.open);
      }}
    >
      <Menu>
        <MenuTrigger disableButtonEnhancement>
          <Button
            ref={trigger}
            appearance="subtle"
            icon={<MoreVerticalRegular />}
            aria-label={`Ações de ${component.name}`}
            disabled={disabled || pending}
          />
        </MenuTrigger>
        <MenuPopover>
          <MenuList>
            <MenuItem icon={<EditRegular />} onClick={onEdit}>
              Editar
            </MenuItem>
            {component.status !== "INACTIVE" && (
              <MenuItem icon={<DismissCircleRegular />} onClick={onDeactivate}>
                Desativar
              </MenuItem>
            )}
            <MenuDivider />
            <DialogTrigger disableButtonEnhancement>
              <MenuItem icon={<DeleteRegular />}>Excluir componente</MenuItem>
            </DialogTrigger>
          </MenuList>
        </MenuPopover>
      </Menu>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Excluir componente?</DialogTitle>
          <DialogContent>
            <p>
              O componente <strong>{component.name}</strong> deixará de aparecer
              na listagem e não poderá ser editado. Os dados cadastrados serão
              preservados.
            </p>
            {error && (
              <MessageBar intent="error">
                <MessageBarBody>{error}</MessageBarBody>
              </MessageBar>
            )}
          </DialogContent>
          <DialogActions>
            <DialogTrigger action="close" disableButtonEnhancement>
              <Button disabled={pending}>Cancelar</Button>
            </DialogTrigger>
            <Button
              appearance="primary"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const result = await deleteArchitectureComponent(
                    component.id,
                    component.revision,
                  );
                  if (!result.ok) {
                    setError(result.message);
                    return;
                  }
                  setOpen(false);
                  await onDeleted();
                })
              }
            >
              {pending ? "Excluindo…" : "Excluir"}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
