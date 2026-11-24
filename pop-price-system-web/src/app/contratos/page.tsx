import { PageFrame } from "@/components/page-frame";
import { ContractsView } from "@/components/portal/contracts-view";
import { getContracts, getValuations } from "@/lib/portal-api";
export const dynamic = "force-dynamic";
export const metadata = { title: "Contratos" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ valuation?: string }>;
}) {
  const [initial, valuations, query] = await Promise.all([
    getContracts(),
    getValuations(),
    searchParams,
  ]);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const selectedId =
    valuations.ok && valuations.data.items.some((v) => v.id === query.valuation)
      ? query.valuation || ""
      : "";
  return (
    <PageFrame route="/contratos">
      <ContractsView
        initial={initial}
        valuations={valuations}
        selectedId={selectedId}
        today={today}
      />
    </PageFrame>
  );
}
