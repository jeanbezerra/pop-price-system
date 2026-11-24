import { ComponentEditorPage } from "@/components/portal/component-editor-page";

export const dynamic = "force-dynamic";
export const metadata = { title: "Novo componente" };
export default function Page() {
  return <ComponentEditorPage />;
}
