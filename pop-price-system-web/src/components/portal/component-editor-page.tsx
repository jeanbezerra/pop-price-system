import { notFound } from "next/navigation";
import {
  getArchitectureComponent,
  getArchitectureIcons,
  getComponentProviders,
  getComponentCategories,
} from "@/lib/component-api";
import { getServicePage } from "@/lib/portal-api";
import { PageFrame } from "../page-frame";
import { ApiNotice, PageHeading } from "../shared";
import { ComponentEditor } from "./component-editor";

/** Resolve the complete server data before mounting the synchronous Griffel tree. */
export async function ComponentEditorPage({ id }: { id?: string }) {
  const [providers, result] = await Promise.all([
    getComponentProviders(),
    id ? getArchitectureComponent(id) : null,
  ]);
  if (result && !result.ok && result.status === 404) notFound();
  const component = result?.ok ? result.data : null;
  const provider = component?.provider || "GENERIC";
  const [services, categories] = await Promise.all([
    provider === "GENERIC" ? null : getServicePage(provider),
    getComponentCategories(provider),
  ]);
  const iconCategory =
    categories.ok && categories.data.some((c) => c.code === component?.category)
      ? component!.category
      : "";
  const icons =
    provider === "GENERIC"
      ? null
      : await getArchitectureIcons(provider, "", "", iconCategory);
  return (
    <PageFrame
      route={
        id ? `/construtor/componentes/${id}` : "/construtor/componentes/novo"
      }
      workspace={providers.ok && (!result || result.ok)}
    >
      {!providers.ok || (result && !result.ok) ? (
        <div>
          <PageHeading
            title="Cadastro de componente"
            description="Atualize os dados para continuar o cadastro."
          />
          <ApiNotice
            message={
              !providers.ok
                ? providers.message
                : result && !result.ok
                  ? result.message
                  : undefined
            }
          />
        </div>
      ) : (
        <ComponentEditor
          providers={providers.data}
          initial={{
            component,
            provider,
            categories: categories.ok ? categories.data : [],
            iconCategory,
            services: services?.ok
              ? services.data
              : { items: [], size: 200, hasMore: false, nextAfter: null },
            icons: icons?.ok
              ? icons.data
              : { items: [], size: 24, hasMore: false, nextAfter: null },
            loadError: !categories.ok
              ? categories.message
              : services && !services.ok
                ? services.message
                : icons && !icons.ok
                  ? icons.message
                  : undefined,
          }}
        />
      )}
    </PageFrame>
  );
}
