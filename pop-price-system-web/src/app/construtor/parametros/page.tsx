import { PageFrame } from "@/components/page-frame";
import { ParametersView } from "@/components/portal/parameters-view";
import { getParameters } from "@/lib/portal-api";
export const dynamic = "force-dynamic";
export const metadata = { title: "Parâmetros" };
export default async function Page() {
  const initial = await getParameters();
  return (
    <PageFrame route="/construtor/parametros">
      <ParametersView initial={initial} />
    </PageFrame>
  );
}
