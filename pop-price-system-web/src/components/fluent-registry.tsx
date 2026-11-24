"use client";

import { useRef, useState, type ReactNode } from "react";
import { useServerInsertedHTML } from "next/navigation";
import {
  createDOMRenderer,
  renderToStyleElements,
  RendererProvider,
} from "@griffel/react";
import { FluentProvider, SSRProvider } from "@fluentui/react-components";
import { appTheme } from "./theme";

export function FluentRegistry({ children }: { children: ReactNode }) {
  const [renderer] = useState(() => createDOMRenderer());
  const flushed = useRef(false);

  useServerInsertedHTML(() => {
    if (flushed.current) return null;
    flushed.current = true;
    return <>{renderToStyleElements(renderer)}</>;
  });

  return (
    <RendererProvider renderer={renderer}>
      <SSRProvider>
        <FluentProvider theme={appTheme} className="app-provider">
          {children}
        </FluentProvider>
      </SSRProvider>
    </RendererProvider>
  );
}
