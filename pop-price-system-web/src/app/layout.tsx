import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "@xyflow/react/dist/base.css";

export const metadata: Metadata = {
  title: {
    default: "POP Price System | Porto",
    template: "%s | POP Price System",
  },
  description:
    "Catálogo de preços e planejamento de custos de infraestrutura da Porto.",
  icons: { icon: "/brand/porto-logo.svg" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
