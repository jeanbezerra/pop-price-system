import { PageFrame } from "@/components/page-frame";
import { CanvasView } from "@/components/portal/canvas-view";
import { getProviders } from "@/lib/api";
import {
  getModel,
  getParameters,
  getQuotes,
  getRate,
  getRates,
  getServicePage,
} from "@/lib/portal-api";
import type { CatalogRate } from "@/lib/portal-contracts";
export const dynamic = "force-dynamic";
export const metadata = { title: "Canvas de arquitetura" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ model?: string }>;
}) {
  const query = await searchParams;
  const [model, providers, services, rates, quotes, parameters] =
    await Promise.all([
      query.model ? getModel(query.model) : null,
      getProviders(),
      getServicePage(),
      getRates({}),
      getQuotes(),
      getParameters(),
    ]);
  const ids = model?.ok
    ? [
        ...new Set([
          ...model.data.graph.nodes.map((n) => n.rateId),
          ...model.data.graph.edges.flatMap((e) =>
            e.charges.map((c) => c.rateId),
          ),
        ]),
      ]
    : [];
  const resolvedRates: CatalogRate[] = [];
  for (let offset = 0; offset < ids.length; offset += 8) {
    const results = await Promise.all(
      ids.slice(offset, offset + 8).map(getRate),
    );
    for (const result of results)
      if (result.ok) resolvedRates.push(result.data);
  }
  return (
    <PageFrame route="/canvas">
      <CanvasView
        key={model?.ok ? model.data.id : "new"}
        data={{
          model,
          providers,
          services,
          rates,
          quotes,
          parameters,
          resolvedRates,
        }}
      />
    </PageFrame>
  );
}
