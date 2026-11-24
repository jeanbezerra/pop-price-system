import { PageFrame } from "@/components/page-frame";
import { SynchronizationView } from "@/components/portal/synchronization-view";
import { getProviders, getSynchronizations } from "@/lib/api";
import { getRegions, getServicePage } from "@/lib/portal-api";
export const dynamic = "force-dynamic";
export const metadata = { title: "Sincronização de provedores" };
export default async function Page() {
  const providers = await getProviders();
  const provider = providers.ok ? providers.data[0]?.code : null;
  const [services, regions, history] = await Promise.all([
    getServicePage(provider || ""),
    provider ? getRegions(provider) : { ok: true as const, data: [] },
    getSynchronizations({ size: 10 }),
  ]);
  return (
    <PageFrame route="/construtor/sincronizacoes">
      <SynchronizationView
        providers={providers}
        services={services}
        regions={regions}
        history={history}
      />
    </PageFrame>
  );
}
