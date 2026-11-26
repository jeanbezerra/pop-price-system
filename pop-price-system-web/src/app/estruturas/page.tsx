import { PageFrame } from "@/components/page-frame";
import { StructuresView } from "@/components/portal/structures-view";
import { getStructures, getModel, getParameters } from "@/lib/portal-api";
import { getProviders } from "@/lib/api";

export const dynamic = "force-dynamic";
export const metadata = { title: "Gestão de estruturas" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    new?: string;
    configure?: string;
    duplicate?: string;
  }>;
}) {
  const query = await searchParams;
  const [initial, providers, parameters, configure] = await Promise.all([
    getStructures(),
    getProviders(),
    getParameters(),
    query.configure || query.duplicate
      ? getModel((query.configure || query.duplicate)!)
      : null,
  ]);
  return (
    <PageFrame route="/estruturas" wide>
      <StructuresView
        initial={initial}
        providers={providers}
        defaultHours={parameters.ok ? parameters.data.hoursPerMonth : 720}
        initialNew={query.new === "1"}
        initialDuplicate={!!query.duplicate}
        configure={configure?.ok ? configure.data : null}
      />
    </PageFrame>
  );
}
