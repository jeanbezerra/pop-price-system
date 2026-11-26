import type { ReactNode } from "react";
import { FluentRegistry } from "./fluent-registry";
import { AppShell } from "./app-shell";
import { apiDocumentationEnabled } from "@/lib/api";

// Pages await server data before mounting the registry. The complete styled subtree
// is synchronous, so Griffel's first flush includes every rule without duplicate body styles.
export function PageFrame({
  children,
  route,
  workspace = false,
  wide = false,
}: {
  children: ReactNode;
  route: string;
  workspace?: boolean;
  wide?: boolean;
}) {
  return (
    <FluentRegistry key={route}>
      <AppShell
        documentationEnabled={apiDocumentationEnabled()}
        workspace={workspace}
        wide={wide}
      >
        {children}
      </AppShell>
    </FluentRegistry>
  );
}
