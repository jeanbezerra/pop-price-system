import { PageFrame } from "@/components/page-frame";
import { ExchangeView } from "@/components/portal/exchange-view";
import { getQuotes } from "@/lib/portal-api";
export const dynamic = "force-dynamic";
export const metadata = { title: "Câmbio PTAX" };
export default async function Page() {
  const initial = await getQuotes();
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return (
    <PageFrame route="/construtor/cambio">
      <ExchangeView initial={initial} today={today} />
    </PageFrame>
  );
}
