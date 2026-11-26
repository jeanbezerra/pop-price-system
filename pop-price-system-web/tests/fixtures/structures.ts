import {
  expect,
  type APIRequestContext,
  type Page,
  type Locator,
} from "@playwright/test";

export async function selectRegion(picker: Locator, code: string) {
  await picker.fill(code);
  const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await picker
    .page()
    .getByRole("option", { name: new RegExp(`${escaped}$`) })
    .click();
}

export const specification = (regionCode = "us-east-1") => ({
  primaryProvider: "AWS",
  description: "Solução de teste",
  category: "APPLICATION",
  environment: "DEVELOPMENT",
  locations: [{ provider: "AWS", regionCode }],
});

export async function storedStructure(
  request: APIRequestContext,
  name = "Estrutura de teste",
  regionCode = "us-east-1",
) {
  const response = await request.post(
    "http://127.0.0.1:3101/pop-price-system-service/api/v1/architecture-models",
    {
      data: {
        name,
        hoursPerMonth: 720,
        specification: specification(regionCode),
        graph: { nodes: [], edges: [] },
        revision: 0,
      },
    },
  );
  expect(response.ok()).toBe(true);
  return (await response.json()).id as string;
}

export async function submitNewStructure(
  page: Page,
  name: string,
  region = "us-east-1",
) {
  const dialog = page.getByRole("dialog", {
    name: "Nova estrutura",
    exact: true,
  });
  await dialog
    .getByRole("combobox", { name: "Provedor principal", exact: true })
    .selectOption("AWS");
  await dialog
    .getByRole("textbox", { name: "Nome da estrutura", exact: true })
    .fill(name);
  await selectRegion(
    dialog.getByRole("combobox", { name: "Região principal", exact: true }),
    region,
  );
  await dialog
    .getByRole("button", { name: "Criar e abrir canvas", exact: true })
    .click();
  await expect(page).toHaveURL(/\/canvas\?model=[a-f0-9-]+$/);
}
