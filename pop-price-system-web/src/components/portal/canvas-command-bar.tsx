"use client";

import {
  Toolbar,
  ToolbarButton,
  ToolbarGroup,
  ToolbarDivider,
  Tooltip,
  Overflow,
  OverflowItem,
  useOverflowMenu,
  useIsOverflowItemVisible,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  MenuDivider,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import {
  AddRegular,
  SubtractRegular,
  ArrowLeftRegular,
  SaveRegular,
  ArrowMaximizeRegular,
  OrganizationRegular,
  DeleteRegular,
  MoreHorizontalRegular,
} from "@fluentui/react-icons";

type Commands = {
  readOnly: boolean;
  pending: boolean;
  canOrganize: boolean;
  canDelete: boolean;
  canSave: boolean;
  onOrganize: () => void;
  onDelete: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onSave: () => void;
};
const useStyles = makeStyles({
  bar: {
    minWidth: 0,
    padding: tokens.spacingHorizontalS,
    gap: tokens.spacingHorizontalS,
    backgroundColor: tokens.colorNeutralBackground1,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    overflow: "hidden",
    "> [data-overflow-item]": { flexShrink: 0 },
    "> [data-overflowing]": { display: "none" },
  },
  group: { gap: tokens.spacingHorizontalXS, flexShrink: 0 },
  title: {
    margin: 0,
    paddingRight: tokens.spacingHorizontalM,
    fontSize: tokens.fontSizeBase300,
    lineHeight: tokens.lineHeightBase300,
    fontWeight: tokens.fontWeightSemibold,
    whiteSpace: "nowrap",
    "@media (max-width:700px)": { display: "none" },
  },
  save: { marginLeft: "auto", flexShrink: 0 },
});

function MoreCommands(props: Commands) {
  const { ref, isOverflowing } = useOverflowMenu<HTMLButtonElement>();
  const organizeVisible = useIsOverflowItemVisible("organize");
  const viewVisible = useIsOverflowItemVisible("view");
  const deleteVisible = useIsOverflowItemVisible("delete");
  if (!isOverflowing) return null;
  return (
    <Menu>
      <MenuTrigger disableButtonEnhancement>
        <ToolbarButton
          ref={ref}
          icon={<MoreHorizontalRegular />}
          aria-label="Mais ações"
        />
      </MenuTrigger>
      <MenuPopover>
        <MenuList>
          {!organizeVisible && (
            <MenuItem
              icon={<OrganizationRegular />}
              disabled={!props.canOrganize}
              onClick={props.onOrganize}
            >
              Organizar componentes
            </MenuItem>
          )}
          {!viewVisible && (
            <>
              <MenuItem icon={<AddRegular />} onClick={props.onZoomIn}>
                Ampliar Canvas
              </MenuItem>
              <MenuItem icon={<SubtractRegular />} onClick={props.onZoomOut}>
                Reduzir Canvas
              </MenuItem>
              <MenuItem icon={<ArrowMaximizeRegular />} onClick={props.onFit}>
                Enquadrar componentes
              </MenuItem>
            </>
          )}
          {!deleteVisible && (
            <>
              {(!organizeVisible || !viewVisible) && <MenuDivider />}
              <MenuItem
                icon={<DeleteRegular />}
                disabled={!props.canDelete}
                onClick={props.onDelete}
              >
                Excluir seleção
              </MenuItem>
            </>
          )}
        </MenuList>
      </MenuPopover>
    </Menu>
  );
}

export function CanvasCommandBar(props: Commands) {
  const styles = useStyles();
  return (
    <Overflow padding={40}>
      <Toolbar className={styles.bar} aria-label="Comandos da estrutura">
        <OverflowItem id="navigation" pinned>
          <ToolbarGroup
            className={styles.group}
            role="group"
            aria-label="Navegação"
          >
            <Tooltip content="Gestão de estruturas" relationship="label">
              <ToolbarButton
                as="a"
                href="/estruturas"
                icon={<ArrowLeftRegular />}
                aria-label="Gestão de estruturas"
              />
            </Tooltip>
            <h1 className={styles.title}>Editor de estruturas</h1>
          </ToolbarGroup>
        </OverflowItem>
        <OverflowItem id="organize" priority={3}>
          <ToolbarGroup
            className={styles.group}
            role="group"
            aria-label="Organização"
          >
            <ToolbarDivider />
            <ToolbarButton
              icon={<OrganizationRegular />}
              disabled={!props.canOrganize}
              onClick={props.onOrganize}
            >
              Organizar componentes
            </ToolbarButton>
          </ToolbarGroup>
        </OverflowItem>
        <OverflowItem id="view" priority={2}>
          <ToolbarGroup
            className={styles.group}
            role="group"
            aria-label="Visualização"
          >
            <ToolbarDivider />
            <Tooltip content="Ampliar Canvas" relationship="label">
              <ToolbarButton
                icon={<AddRegular />}
                aria-label="Ampliar Canvas"
                onClick={props.onZoomIn}
              />
            </Tooltip>
            <Tooltip content="Reduzir Canvas" relationship="label">
              <ToolbarButton
                icon={<SubtractRegular />}
                aria-label="Reduzir Canvas"
                onClick={props.onZoomOut}
              />
            </Tooltip>
            <Tooltip content="Enquadrar componentes" relationship="label">
              <ToolbarButton
                icon={<ArrowMaximizeRegular />}
                aria-label="Enquadrar componentes"
                onClick={props.onFit}
              />
            </Tooltip>
          </ToolbarGroup>
        </OverflowItem>
        <OverflowItem id="delete" priority={1}>
          <ToolbarGroup
            className={styles.group}
            role="group"
            aria-label="Exclusão"
          >
            <ToolbarDivider />
            <Tooltip content="Excluir seleção" relationship="label">
              <ToolbarButton
                icon={<DeleteRegular />}
                aria-label="Excluir seleção"
                disabled={!props.canDelete}
                onClick={props.onDelete}
              />
            </Tooltip>
          </ToolbarGroup>
        </OverflowItem>
        <MoreCommands {...props} />
        {!props.readOnly && (
          <OverflowItem id="save" pinned>
            <ToolbarGroup
              className={styles.save}
              role="group"
              aria-label="Salvamento"
            >
              <ToolbarButton
                appearance="primary"
                icon={<SaveRegular />}
                disabled={!props.canSave}
                onClick={props.onSave}
              >
                {props.pending ? "Aguarde…" : "Salvar estrutura"}
              </ToolbarButton>
            </ToolbarGroup>
          </OverflowItem>
        )}
      </Toolbar>
    </Overflow>
  );
}
