import { expect, test } from "@playwright/test";
import { submitNewStructure } from "./fixtures/structures";
import AxeBuilder from "@axe-core/playwright";

test("draw, save, manage and logically delete a structure", async ({
  page,
  request,
}) => {
  await request.post(
    "http://127.0.0.1:3101/test/reset?prices=false&components=2",
  );
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/estruturas");
  await page
    .getByRole("button", { name: "Nova estrutura", exact: true })
    .click();
  await submitNewStructure(page, "Solu\u00e7\u00e3o de atendimento");
  await page
    .getByRole("button", { name: "Dados da estrutura", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Nome da estrutura", exact: true })
    .fill("Solução de atendimento");
  const palette = page.getByRole("region", { name: "Componentes disponíveis" });
  const first = palette.getByRole("button").first();
  await expect(first).toBeVisible();
  const transfer = await page.evaluateHandle(() => new DataTransfer());
  await first.dispatchEvent("dragstart", { dataTransfer: transfer });
  const drawing = page.getByRole("region", {
    name: "Editor visual de arquitetura",
  });
  const bounds = await drawing.boundingBox();
  await drawing.dispatchEvent("drop", {
    dataTransfer: transfer,
    clientX: bounds!.x + 140,
    clientY: bounds!.y + 140,
  });
  await palette.getByRole("button").nth(1).click();
  await expect(
    page.getByText("2 componentes · 0 ligações", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Componentes e ligações", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Origem da ligação", exact: true })
    .selectOption({ index: 1 });
  await page
    .getByRole("combobox", { name: "Destino da ligação", exact: true })
    .selectOption({ index: 1 });
  await page
    .getByRole("button", { name: "Adicionar ligação", exact: true })
    .click();
  await expect(
    page.getByText("2 componentes · 1 ligações", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Salvar estrutura", exact: true })
    .click();
  await expect(
    page.getByText("Estrutura salva.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Gestão de estruturas", exact: true })
    .click();
  const table = page.getByRole("table", { name: "Gestão de estruturas" });
  let row = table
    .getByRole("row")
    .filter({ hasText: "Solução de atendimento" });
  await expect(row.getByText("A calcular", { exact: true })).toBeVisible();
  await expect(row.getByText("2", { exact: true })).toBeVisible();
  await row
    .getByRole("button", { name: "Ações de Solução de atendimento" })
    .click();
  await page.getByRole("menuitem", { name: "Arquivar", exact: true }).click();
  await expect(row).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Situação", exact: true })
    .selectOption("ARCHIVED");
  await page
    .getByRole("button", { name: "Aplicar filtros", exact: true })
    .click();
  row = table.getByRole("row").filter({ hasText: "Solução de atendimento" });
  await row
    .getByRole("button", { name: "Ações de Solução de atendimento" })
    .click();
  await page
    .getByRole("menuitem", { name: "Desarquivar", exact: true })
    .click();
  await expect(row).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Situação", exact: true })
    .selectOption("ACTIVE");
  await page
    .getByRole("button", { name: "Aplicar filtros", exact: true })
    .click();
  await row.getByRole("button", { name: /^A/ }).click();
  await page.getByRole("menuitem", { name: "Editar", exact: true }).click();
  await expect(
    page.getByText("2 componentes · 1 ligações", { exact: false }),
  ).toBeVisible();
  const accessibility = await new AxeBuilder({ page })
    .exclude('[data-tabster-dummy][aria-hidden="true"][role="none"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({
    path: "test-results/structure-editor.png",
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Gestão de estruturas", exact: true })
    .click();
  await row
    .getByRole("button", { name: "Ações de Solução de atendimento" })
    .click();
  await page.getByRole("menuitem", { name: "Promover", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Promover estrutura", exact: true })
    .click();
  await expect(row.getByText("Promovida", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "test-results/structure-management.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.setViewportSize({ width: 1280, height: 720 });
  expect(
    (
      await new AxeBuilder({ page })
        .exclude('[data-tabster-dummy][aria-hidden="true"][role="none"]')
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await row
    .getByRole("button", { name: "Ações de Solução de atendimento" })
    .click();
  await page.getByRole("menuitem", { name: "Excluir", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancelar", exact: true })
    .click();
  await expect(row).toBeVisible();
  await row
    .getByRole("button", { name: "Ações de Solução de atendimento" })
    .click();
  await page.getByRole("menuitem", { name: "Excluir", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Excluir estrutura", exact: true })
    .click();
  await expect(row).toHaveCount(0);
  expect(errors).toEqual([]);
});
