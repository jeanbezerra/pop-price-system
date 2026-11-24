"use client";

import {
  Fragment,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import NextLink from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Button,
  Divider,
  Hamburger,
  Link,
  NavDrawer,
  NavDrawerBody,
  NavDrawerHeader,
  NavItem,
  NavSectionHeader,
  makeStyles,
  mergeClasses,
  shorthands,
  tokens,
  useRestoreFocusTarget,
} from "@fluentui/react-components";
import {
  Home20Regular,
  Grid20Regular,
  Calculator20Regular,
  DismissRegular,
  ArrowUpRightRegular,
  Money20Regular,
  Settings20Regular,
  DocumentText20Regular,
  Share20Regular,
  ArrowSync20Regular,
} from "@fluentui/react-icons";

const mobileQuery = "(max-width: 640px)";
function subscribeToViewport(onChange: () => void) {
  const query = window.matchMedia(mobileQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const useStyles = makeStyles({
  root: {
    minHeight: "100vh",
    display: "grid",
    gridTemplateColumns: "260px minmax(0, 1fr)",
    gridTemplateRows: "minmax(76px, auto) 1fr",
    backgroundColor: tokens.colorNeutralBackground2,
    "@media (max-width: 640px)": { gridTemplateColumns: "minmax(0, 1fr)" },
  },
  skip: {
    position: "fixed",
    top: "-100px",
    left: tokens.spacingHorizontalL,
    zIndex: 10,
    padding: tokens.spacingHorizontalM,
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorBrandForeground1,
    ":focus": { top: tokens.spacingVerticalM },
  },
  header: {
    gridColumn: "1 / -1",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalXL,
    ...shorthands.padding(tokens.spacingVerticalL, tokens.spacingHorizontalXXL),
    ...shorthands.borderBottom(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke2,
    ),
    backgroundColor: tokens.colorNeutralBackground1,
    "@media (max-width: 640px)": {
      paddingLeft: tokens.spacingHorizontalL,
      paddingRight: tokens.spacingHorizontalL,
    },
  },
  identity: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXL,
    "@media (max-width: 640px)": { gap: tokens.spacingHorizontalM },
  },
  logo: {
    display: "block",
    width: "128px",
    height: "auto",
    "@media (max-width: 640px)": { width: "96px" },
  },
  identityText: {
    ...shorthands.borderLeft(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke2,
    ),
    paddingLeft: tokens.spacingHorizontalXL,
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXXS,
    "@media (max-width: 640px)": { borderLeftWidth: 0, paddingLeft: 0 },
  },
  productName: {
    fontSize: tokens.fontSizeBase400,
    lineHeight: tokens.lineHeightBase400,
    fontWeight: tokens.fontWeightSemibold,
    "@media (max-width: 640px)": {
      fontSize: tokens.fontSizeBase300,
      lineHeight: tokens.lineHeightBase300,
    },
  },
  subtitle: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    lineHeight: tokens.lineHeightBase200,
    "@media (max-width: 640px)": { display: "none" },
  },
  headerLabel: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    "@media (max-width: 1000px)": { display: "none" },
  },
  hamburger: {
    display: "none",
    minHeight: "44px",
    minWidth: "44px",
    "@media (max-width: 640px)": { display: "inline-flex" },
  },
  inlineDrawer: {
    height: "100%",
    "@media (max-width: 640px)": { display: "none" },
  },
  drawerHeader: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  drawerTitle: {
    margin: 0,
    fontSize: tokens.fontSizeBase400,
    lineHeight: tokens.lineHeightBase400,
    fontWeight: tokens.fontWeightSemibold,
  },
  navItem: { minHeight: "44px" },
  help: {
    display: "grid",
    gap: tokens.spacingVerticalM,
    marginTop: tokens.spacingVerticalXXXL,
  },
  helpText: {
    margin: 0,
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    lineHeight: tokens.lineHeightBase300,
  },
  main: {
    minWidth: 0,
    padding: tokens.spacingHorizontalXXXL,
    ":focus-visible": {
      outline: `${tokens.strokeWidthThick} solid ${tokens.colorStrokeFocus2}`,
      outlineOffset: "-2px",
    },
    "@media (max-width: 1100px)": { padding: tokens.spacingHorizontalXL },
    "@media (max-width: 640px)": { padding: tokens.spacingHorizontalL },
  },
  content: {
    width: "100%",
    maxWidth: "1280px",
    marginLeft: "auto",
    marginRight: "auto",
  },
  workspaceRoot: { gridTemplateColumns: "minmax(0, 1fr)" },
  workspaceMain: {
    padding: 0,
    "@media (max-width: 1100px)": { padding: 0 },
    "@media (max-width: 640px)": { padding: 0 },
  },
  workspaceContent: { maxWidth: "none" },
});

const navigation = [
  {
    persona: "Portal",
    items: [{ href: "/", label: "Visão geral", icon: Home20Regular }],
  },
  {
    persona: "Arquiteto e estimador",
    items: [
      { href: "/canvas", label: "Canvas de arquitetura", icon: Share20Regular },
      { href: "/modelos", label: "Modelos reutilizáveis", icon: Grid20Regular },
      { href: "/estimativas", label: "Estimativas", icon: Calculator20Regular },
      { href: "/contratos", label: "Contratos", icon: DocumentText20Regular },
    ],
  },
  {
    persona: "Construtor e avançado",
    items: [
      {
        href: "/construtor/sincronizacoes",
        label: "Sincronizações",
        icon: ArrowSync20Regular,
      },
      { href: "/catalogo", label: "Catálogo", icon: Grid20Regular },
      {
        href: "/construtor/componentes",
        label: "Componentes de arquitetura",
        icon: Grid20Regular,
      },
      {
        href: "/construtor/cambio",
        label: "Câmbio PTAX",
        icon: Money20Regular,
      },
      {
        href: "/construtor/parametros",
        label: "Parâmetros",
        icon: Settings20Regular,
      },
    ],
  },
];

export function AppShell({
  children,
  documentationEnabled,
  workspace = false,
}: {
  children: ReactNode;
  documentationEnabled: boolean;
  workspace?: boolean;
}) {
  const styles = useStyles();
  const pathname = usePathname();
  const navigationPath = pathname.startsWith("/catalogo/")
    ? "/catalogo"
    : pathname.startsWith("/construtor/componentes/")
      ? "/construtor/componentes"
      : pathname;
  const router = useRouter();
  const mobile = useSyncExternalStore(
    subscribeToViewport,
    () => window.matchMedia(mobileQuery).matches,
    () => false,
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const restoreFocusTarget = useRestoreFocusTarget();

  return (
    <div
      className={mergeClasses(styles.root, workspace && styles.workspaceRoot)}
    >
      <a href="#conteudo" className={styles.skip}>
        Ir para o conteúdo
      </a>
      <header className={styles.header}>
        <div className={styles.identity}>
          {!workspace && (
            <Hamburger
              {...restoreFocusTarget}
              aria-label="Expandir navegação"
              aria-expanded={mobileOpen}
              className={styles.hamburger}
              onClick={() => setMobileOpen(true)}
            />
          )}
          <NextLink href="/" aria-label="Porto — início">
            <img
              src="/brand/porto-logo.svg"
              alt="Porto"
              width={140}
              height={32}
              className={styles.logo}
            />
          </NextLink>
          <div className={styles.identityText}>
            <span className={styles.productName}>POP Price System</span>
            <span className={styles.subtitle}>Inteligência de custos</span>
          </div>
        </div>
        <span className={styles.headerLabel}>
          Planejamento de infraestrutura
        </span>
      </header>
      {!workspace && (
        <NavDrawer
          type={mobile ? "overlay" : "inline"}
          open={!mobile || mobileOpen}
          // Route registries remount this shell; keep navigation motionless on every mount.
          surfaceMotion={null}
          backdropMotion={null}
          onOpenChange={(_, data) => setMobileOpen(data.open)}
          selectedValue={navigationPath}
          density="medium"
          tabbable
          aria-label="Navegação principal"
          className={mobile ? undefined : styles.inlineDrawer}
        >
          {mobile && (
            <NavDrawerHeader className={styles.drawerHeader}>
              <h2 className={styles.drawerTitle}>Navegação</h2>
              <Button
                appearance="subtle"
                icon={<DismissRegular />}
                aria-label="Recolher navegação"
                onClick={() => setMobileOpen(false)}
              />
            </NavDrawerHeader>
          )}
          <NavDrawerBody>
            {navigation.map((group) => (
              <Fragment key={group.persona}>
                <NavSectionHeader as="div">{group.persona}</NavSectionHeader>
                {group.items.map(({ href, label, icon: Icon }) => (
                  <NavItem
                    key={href}
                    href={href}
                    value={href}
                    icon={<Icon />}
                    className={styles.navItem}
                    aria-current={
                      navigationPath === href
                        ? pathname === href
                          ? "page"
                          : "location"
                        : undefined
                    }
                    onClick={(event) => {
                      if (
                        event.button === 0 &&
                        !event.metaKey &&
                        !event.ctrlKey &&
                        !event.shiftKey &&
                        !event.altKey &&
                        !event.defaultPrevented
                      ) {
                        event.preventDefault();
                        setMobileOpen(false);
                        router.push(href);
                      }
                    }}
                  >
                    {label}
                  </NavItem>
                ))}
              </Fragment>
            ))}
            {documentationEnabled && (
              <div className={styles.help}>
                <Divider />
                <Link href="/api/documentacao" target="_blank" rel="noreferrer">
                  Consultar documentação da API{" "}
                  <ArrowUpRightRegular aria-hidden="true" />
                </Link>
                <p className={styles.helpText}>
                  Preços públicos e premissas claras para apoiar suas decisões.
                </p>
              </div>
            )}
          </NavDrawerBody>
        </NavDrawer>
      )}
      <main
        id="conteudo"
        tabIndex={-1}
        className={mergeClasses(styles.main, workspace && styles.workspaceMain)}
      >
        <div
          className={mergeClasses(
            styles.content,
            workspace && styles.workspaceContent,
          )}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
