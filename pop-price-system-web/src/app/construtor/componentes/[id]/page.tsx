import { notFound } from "next/navigation";
import { ComponentEditorPage } from "@/components/portal/component-editor-page";

export const dynamic = "force-dynamic";
export const metadata = { title: "Editar componente" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)) notFound();
  return <ComponentEditorPage id={id} />;
}
