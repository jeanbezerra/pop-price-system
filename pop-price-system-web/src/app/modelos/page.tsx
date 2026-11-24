import { PageFrame } from "@/components/page-frame";
import { ModelsView } from "@/components/portal/models-view";
import { getModels } from "@/lib/portal-api";
export const dynamic = "force-dynamic";
export const metadata = { title: "Modelos de arquitetura" };
export default async function Page() {
  const initial = await getModels();
  return (
    <PageFrame route="/modelos">
      <ModelsView initial={initial} />
    </PageFrame>
  );
}
