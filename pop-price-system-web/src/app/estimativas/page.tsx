import type { Metadata } from "next";
import { PageFrame } from "@/components/page-frame";
import { EstimatesView } from "@/components/estimates-view";
import { apiDocumentationEnabled, getEstimates } from "@/lib/api";
import { getQuotes, getValuations } from "@/lib/portal-api";

export const metadata: Metadata = { title: "Estimativas" };
export const dynamic = "force-dynamic";

export default async function EstimatesPage() {
  const [estimates, quotes, valuations] = await Promise.all([
    getEstimates(),
    getQuotes(),
    getValuations(),
  ]);
  return (
    <PageFrame route="/estimativas">
      <EstimatesView
        estimates={estimates}
        documentationEnabled={apiDocumentationEnabled()}
        quotes={quotes}
        valuations={valuations}
      />
    </PageFrame>
  );
}
