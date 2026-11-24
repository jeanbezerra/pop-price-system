import { PageFrame } from "@/components/page-frame";
import { Overview } from "@/components/overview";
import { getOverview } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await getOverview();
  return (
    <PageFrame route="/">
      <Overview data={data} />
    </PageFrame>
  );
}
