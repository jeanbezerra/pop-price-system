import { PageFrame } from "@/components/page-frame";
import { ComponentsView } from "@/components/portal/components-view";
import {
  getArchitectureComponents,
  getComponentProviders,
} from "@/lib/component-api";

export const dynamic = "force-dynamic";
export const metadata = { title: "Componentes de arquitetura" };

export default async function Page() {
  const [initial, providers] = await Promise.all([
    getArchitectureComponents(),
    getComponentProviders(),
  ]);
  return (
    <PageFrame route="/construtor/componentes">
      <ComponentsView initial={initial} providers={providers} />
    </PageFrame>
  );
}
