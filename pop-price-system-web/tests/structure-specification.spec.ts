import { selectRegion } from "./fixtures/structures";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { storedStructure, submitNewStructure } from "./fixtures/structures";

const api = "http://127.0.0.1:3101";
test("new structure is stored before the canvas and a failed save stays in the dialog", async ({
  page,
  request,
}) => {
  await request.post(`${api}/test/reset?components=2`);
  await page.goto("/canvas");
  const dialog = page.getByRole("dialog", {
    name: "Nova estrutura",
    exact: true,
  });
  await expect(page).toHaveURL(/\/estruturas\?new=1$/);
  await expect(
    dialog.getByRole("combobox", { name: "Provedor principal", exact: true }),
  ).toHaveValue("");
  await expect(
    dialog.getByRole("combobox", { name: "Região principal", exact: true }),
  ).toBeDisabled();
  await dialog
    .getByRole("combobox", { name: "Provedor principal", exact: true })
    .selectOption("AWS");
  await expect(
    dialog.getByRole("button", { name: "Criar e abrir canvas" }),
  ).toBeDisabled();
  await dialog
    .getByRole("textbox", { name: "Nome da estrutura", exact: true })
    .fill("Atendimento regional");
  await dialog
    .getByRole("textbox", { name: "Descrição", exact: true })
    .fill("Solução para a área de atendimento");
  await dialog
    .getByRole("combobox", { name: "Categoria da estrutura", exact: true })
    .selectOption("PLATFORM");
  await dialog
    .getByRole("combobox", { name: "Ambiente", exact: true })
    .selectOption("PRODUCTION");
  await selectRegion(
    dialog.getByRole("combobox", { name: "Região principal", exact: true }),
    "us-east-1",
  );
  expect(
    (
      await new AxeBuilder({ page })
        .exclude('[data-tabster-dummy][aria-hidden="true"][role="none"]')
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: "test-results/new-structure-modal.png",
    fullPage: true,
  });
  await request.post(`${api}/test/availability?enabled=false`);
  await dialog.getByRole("button", { name: "Criar e abrir canvas" }).click();
  await expect(dialog.getByText(/indisponível/)).toBeVisible();
  await expect(page).toHaveURL(/\/estruturas\?new=1$/);
  await request.post(`${api}/test/availability?enabled=true`);
  await dialog.getByRole("button", { name: "Criar e abrir canvas" }).click();
  await expect(page).toHaveURL(/\/canvas\?model=[a-f0-9-]+$/);
  const id = new URL(page.url()).searchParams.get("model")!;
  const saved = await (
    await request.get(
      `${api}/pop-price-system-service/api/v1/architecture-models/${id}`,
    )
  ).json();
  expect(saved.specification).toMatchObject({
    primaryProvider: "AWS",
    environment: "PRODUCTION",
    category: "PLATFORM",
    locations: [{ provider: "AWS", regionCode: "us-east-1" }],
  });
  expect(saved.graph.nodes).toEqual([]);
  await page
    .getByRole("region", { name: "Componentes disponíveis" })
    .getByRole("button")
    .first()
    .click();
  await expect(
    page.getByRole("combobox", { name: "Tarifa do componente", exact: true }),
  ).toHaveValue("123");
  const requests = await (await request.get(`${api}/test/requests`)).json();
  expect(
    requests
      .filter((r: { path: string }) => r.path === "/catalog/rates")
      .every(
        (r: { query: Record<string, string> }) =>
          r.query.provider === "AWS" &&
          r.query.region === "us-east-1" &&
          r.query.service === "AmazonEC2",
      ),
  ).toBe(true);
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`model=${id}$`));
});

test("duplicate for another region preserves the drawing and resolves regional prices", async ({
  page,
  request,
}) => {
  await request.post(`${api}/test/reset?components=2&regionalPrices=true`);
  const originalId = await storedStructure(request, "Origem regional");
  await page.goto(`/canvas?model=${originalId}`);
  await page
    .getByRole("region", { name: "Componentes disponíveis" })
    .getByRole("button")
    .first()
    .click();
  await expect(
    page.getByRole("combobox", { name: "Tarifa do componente", exact: true }),
  ).toHaveValue("123");
  await page
    .getByRole("textbox", { name: "AZ física", exact: true })
    .fill("use1-az1");
  await page
    .getByRole("button", { name: "Aplicar ao componente", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Salvar estrutura", exact: true })
    .click();
  await expect(
    page.getByText("Estrutura salva.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Gestão de estruturas", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Ações de Origem regional", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Duplicar estrutura", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Duplicar estrutura",
    exact: true,
  });
  await selectRegion(
    dialog.getByRole("combobox", { name: "Região principal", exact: true }),
    "ca-central-1",
  );
  await dialog
    .getByRole("button", { name: "Duplicar e abrir canvas", exact: true })
    .click();
  await expect(page).toHaveURL(/\/canvas\?model=[a-f0-9-]+$/);
  const copyId = new URL(page.url()).searchParams.get("model")!;
  expect(copyId).not.toBe(originalId);
  const copy = await (
    await request.get(
      `${api}/pop-price-system-service/api/v1/architecture-models/${copyId}`,
    )
  ).json();
  expect(copy.graph.nodes[0]).toMatchObject({
    rateId: null,
    availabilityZone: null,
  });
  await page
    .getByRole("button", { name: "Componentes e ligações", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Configurar componente", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Tarifa do componente", exact: true }),
  ).toHaveValue("223");
  const original = await (
    await request.get(
      `${api}/pop-price-system-service/api/v1/architecture-models/${originalId}`,
    )
  ).json();
  expect(original.graph.nodes[0]).toMatchObject({
    rateId: 123,
    availabilityZone: "use1-az1",
  });
});

test("multiple regional prices require an explicit configuration", async ({
  page,
  request,
}) => {
  await request.post(
    `${api}/test/reset?components=1&unlinked=1&ratePages=true`,
  );
  const id = await storedStructure(
    request,
    "Configurações comerciais",
    "ca-central-1",
  );
  await page.goto(`/canvas?model=${id}`);
  await page
    .getByRole("region", { name: "Componentes disponíveis" })
    .getByRole("button")
    .first()
    .click();
  await page
    .getByRole("combobox", { name: "Serviço do componente", exact: true })
    .selectOption("AmazonEKS");
  const price = page.getByRole("combobox", {
    name: "Tarifa do componente",
    exact: true,
  });
  await expect(price.getByRole("option")).toHaveCount(51);
  await expect(price).toHaveValue("");
  await page
    .getByRole("button", { name: "Carregar mais tarifas", exact: true })
    .click();
  await expect(price.getByRole("option")).toHaveCount(56);
  await price.selectOption("1000");
  await expect(price).toHaveValue("1000");
});
