import { notFound } from "next/navigation";
import { PageFrame } from "@/components/page-frame";
import { ServiceCostsView } from "@/components/service-costs-view";
import { getRates, getRegions } from "@/lib/portal-api";

export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ provider: string; service: string }>;
}) {
  const { service } = await params;
  return { title: `Custos de ${service}` };
}
export default async function ServiceCostsPage({
  params,
}: {
  params: Promise<{ provider: string; service: string }>;
}) {
  const { provider, service } = await params;
  if (!provider || provider.length > 30 || !service || service.length > 150)
    notFound();
  const [initial, regions] = await Promise.all([
    getRates({ provider, service }),
    getRegions(provider),
  ]);
  return (
    <PageFrame route={`/catalogo/${provider}/${service}`}>
      <ServiceCostsView
        key={`${provider}/${service}`}
        provider={provider}
        service={service}
        initial={initial}
        regions={regions}
      />
    </PageFrame>
  );
}
