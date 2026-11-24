import { PageFrame } from "@/components/page-frame";
import { EmptyPage } from "@/components/shared";

export default function NotFound() {
  return (
    <PageFrame route="/404">
      <EmptyPage
        title="Página não encontrada"
        description="O endereço pode ter mudado. Volte ao início para continuar."
      />
    </PageFrame>
  );
}
