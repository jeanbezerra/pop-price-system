import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("constructor prepares bases, architect publishes a reusable model and registers a BRL contract", async ({
  page,
  request,
}) => {
  test.setTimeout(60000);
  await request.post("http://127.0.0.1:3101/test/reset?prices=false");
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/construtor/sincronizacoes");
  const nav = page.getByRole("navigation", { name: "Navegação principal" });
  await expect(nav.getByText("Arquiteto e estimador")).toBeVisible();
  await expect(nav.getByText("Construtor e avançado")).toBeVisible();
  await page
    .getByRole("combobox", { name: "Serviço", exact: true })
    .fill("AmazonEC2");
  await page.getByRole("option", { name: /AmazonEC2/ }).click();
  await page
    .getByRole("combobox", { name: "Região", exact: true })
    .fill("us-east-1");
  await page.getByRole("option", { name: /us-east-1/ }).click();
  await page.getByRole("button", { name: "Adicionar à lista" }).click();
  await page
    .getByRole("button", { name: "Sincronizar 1 importação", exact: true })
    .click();
  await expect(
    page.getByText("Importação concluída.", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Câmbio PTAX", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Data de referência", exact: true })
    .fill("2025-01-12");
  await page
    .getByRole("button", { name: "Sincronizar PTAX", exact: true })
    .click();
  await expect(
    page.getByRole("table", { name: "Histórico PTAX" }).getByText("10/01/2025"),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Canvas de arquitetura", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Nome da arquitetura", exact: true })
    .fill("Plataforma de teste");
  const palette = page.getByRole("region", { name: "Tarifas disponíveis" });
  for (const name of ["API", "Banco"]) {
    await palette
      .getByRole("button", { name: "Adicionar componente", exact: true })
      .first()
      .click();
    await page
      .getByRole("textbox", { name: "Nome do componente", exact: true })
      .fill(name);
    await page
      .getByRole("textbox", { name: "AZ física", exact: true })
      .fill("use1-az1");
    await page
      .getByRole("button", { name: "Aplicar ao componente", exact: true })
      .click();
  }
  await page
    .getByRole("combobox", { name: "Origem da ligação", exact: true })
    .selectOption({ label: "API" });
  await page
    .getByRole("combobox", { name: "Destino da ligação", exact: true })
    .selectOption({ label: "Banco" });
  await page
    .getByRole("button", { name: "Adicionar ligação", exact: true })
    .click();
  await page
    .getByRole("spinbutton", { name: "Tráfego mensal em GB", exact: true })
    .fill("100");
  await page
    .getByRole("button", { name: "Aplicar à ligação", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Publicar modelo", exact: true })
    .click();
  await expect(
    page.getByText("Modelo publicado no catálogo final.", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Nome da estimativa", exact: true })
    .fill("Produção da plataforma");
  await page
    .getByRole("button", { name: "Calcular e salvar estimativa", exact: true })
    .click();
  await expect(
    page.getByText("Cálculo completo", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/782,22/)).toBeVisible();
  await page
    .getByRole("link", { name: "Criar contrato desta estimativa", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Referência do contrato", exact: true })
    .fill("CT-PORTAL-001");
  await page
    .getByRole("textbox", { name: "Nome do contrato", exact: true })
    .fill("Operação da plataforma");
  await page
    .getByRole("textbox", { name: "Cliente ou área contratante", exact: true })
    .fill("Equipe plataforma");
  await page
    .getByRole("spinbutton", { name: "Prazo em meses", exact: true })
    .fill("6");
  await page
    .getByRole("button", { name: "Cadastrar contrato", exact: true })
    .click();
  await expect(
    page
      .getByRole("table", { name: "Contratos cadastrados" })
      .getByText("CT-PORTAL-001"),
  ).toBeVisible();
  await expect(
    page
      .getByRole("table", { name: "Contratos cadastrados" })
      .getByText(/4\.693,32/),
  ).toBeVisible();
  await page.goto("/modelos");
  await expect(
    page
      .getByRole("table", { name: "Modelos de arquitetura" })
      .getByText("Plataforma de teste"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Criar cópia", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Nome da arquitetura", exact: true }),
  ).toHaveValue("Plataforma de teste (cópia)");
  const accessibility = await new AxeBuilder({ page })
    .exclude('[data-tabster-dummy][aria-hidden="true"][role="none"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  expect(errors).toEqual([]);
  const recorded = await (
    await request.get("http://127.0.0.1:3101/test/requests")
  ).json();
  const writes = recorded
    .filter((r: { method: string }) => r.method === "POST")
    .map((r: { path: string }) => r.path);
  expect(writes.indexOf("/synchronizations")).toBeLessThan(
    writes.findIndex((p: string) => p.includes("/architecture-models")),
  );
  expect(writes).toContain("/exchange-rates/synchronize");
  expect(writes).toContain("/contracts");
});

test("no cloud prices means the Canvas cannot invent priced components", async ({
  page,
  request,
}) => {
  await request.post("http://127.0.0.1:3101/test/reset?prices=false");
  await page.goto("/canvas");
  await expect(
    page.getByRole("heading", { name: "Nenhuma tarifa disponível" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Publicar modelo", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", {
      name: "Calcular e salvar estimativa",
      exact: true,
    }),
  ).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
