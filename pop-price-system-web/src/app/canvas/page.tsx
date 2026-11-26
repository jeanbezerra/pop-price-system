import { PageFrame } from "@/components/page-frame";
import { CanvasView } from "@/components/portal/canvas-view";
import { redirect } from "next/navigation";
import { ApiNotice } from "@/components/shared";
import { getArchitectureComponents } from "@/lib/component-api";
import { getModel, getParameters, getQuotes, getRate } from "@/lib/portal-api";
import type { CatalogRate } from "@/lib/portal-contracts";
export const dynamic = "force-dynamic";
export const metadata = { title: "Editor de estruturas" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ model?: string }>;
}) {
  const query = await searchParams;
  if (!query.model) redirect("/estruturas?new=1");
  const model = await getModel(query.model);
  if (!model.ok)
    return (
      <PageFrame route="/canvas">
        <ApiNotice message={model.message} />
      </PageFrame>
    );
  if (!model.data.specification?.primaryProvider)
    redirect(`/estruturas?configure=${encodeURIComponent(model.data.id)}`);
  const [quotes, parameters, components] = await Promise.all([
    getQuotes(),
    getParameters(),
    getArchitectureComponents({
      provider: model.data.specification.primaryProvider,
    }),
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
  const rateIds = ids.filter((id): id is number => id !== null);
  const resolvedRates: CatalogRate[] = [];
  for (let offset = 0; offset < rateIds.length; offset += 8) {
    const results = await Promise.all(
      rateIds.slice(offset, offset + 8).map(getRate),
    );
    for (const result of results)
      if (result.ok) resolvedRates.push(result.data);
  }
  return (
    <PageFrame route="/canvas" workspace>
      <CanvasView
        key={model?.ok ? model.data.id : "new"}
        data={{
          model,
          quotes,
          parameters,
          resolvedRates,
          components,
        }}
      />
    </PageFrame>
  );
}
