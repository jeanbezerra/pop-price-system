import type { Metadata } from "next";
import { PageFrame } from "@/components/page-frame";
import { CatalogView } from "@/components/catalog-view";
import { apiDocumentationEnabled, getProviders } from "@/lib/api";
import { getServicePage } from "@/lib/portal-api";

export const metadata: Metadata = { title: "Catálogo" };
export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const [providers, services] = await Promise.all([
    getProviders(),
    getServicePage(),
  ]);
  return (
    <PageFrame route="/catalogo">
      <CatalogView
        providers={providers}
        services={services}
        documentationEnabled={apiDocumentationEnabled()}
      />
    </PageFrame>
  );
}
