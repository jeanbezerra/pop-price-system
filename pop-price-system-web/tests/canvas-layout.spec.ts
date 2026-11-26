import { expect, test } from "@playwright/test";
import { storedStructure } from "./fixtures/structures";
import AxeBuilder from "@axe-core/playwright";

test("canvas fills the workspace and the right sidebar preserves section drafts", async ({
  page,
  request,
}) => {
  await request.post("http://127.0.0.1:3101/test/reset?components=2");
  await page.setViewportSize({ width: 1440, height: 900 });
  const id = await storedStructure(request);
  await page.goto(`/canvas?model=${id}`);
  const sidebar = page.getByRole("complementary", {
    name: "Central de recursos",
  });
  const canvas = page.getByRole("region", {
    name: "Editor visual de arquitetura",
  });
  await expect
    .poll(async () => {
      const drawing = await canvas.boundingBox();
      const panel = await sidebar.boundingBox();
      const header = await page.getByRole("banner").boundingBox();
      const commands = await page
        .getByRole("toolbar", { name: "Comandos da estrutura" })
        .boundingBox();
      return (
        !!drawing &&
        !!panel &&
        !!header &&
        !!commands &&
        commands.y === header.y + header.height &&
        drawing.x === 0 &&
        drawing.y === commands.y + commands.height &&
        drawing.x + drawing.width === panel.x &&
        panel.x + panel.width === 1440 &&
        drawing.y + drawing.height === 900
      );
    })
    .toBe(true);
  const headers = sidebar.locator("h2").getByRole("button");
  await expect(headers).toHaveText([
    "Propriedades do componente",
    "Recursos da solução",
    "Componentes e ligações",
    "Dados da estrutura",
    "Gerar estimativa",
  ]);
  await page
    .getByRole("region", { name: "Componentes disponíveis" })
    .getByRole("button")
    .first()
    .click();
  const properties = sidebar.getByRole("button", {
    name: "Propriedades do componente",
    exact: true,
  });
  await expect(properties).toHaveAttribute("aria-expanded", "true");
  const componentName = sidebar.getByRole("textbox", {
    name: "Nome do componente",
    exact: true,
  });
  await componentName.fill("Alteração em edição");
  await properties.click();
  await properties.click();
  await expect(componentName).toHaveValue("Alteração em edição");
  await sidebar
    .getByRole("button", { name: "Aplicar ao componente", exact: true })
    .click();
  await properties.click();
  await sidebar
    .getByRole("button", { name: "Dados da estrutura", exact: true })
    .click();
  const structureName = sidebar.getByRole("textbox", {
    name: "Nome da estrutura",
    exact: true,
  });
  await structureName.fill("Estrutura preservada");
  await sidebar
    .getByRole("button", { name: "Dados da estrutura", exact: true })
    .click();
  await sidebar
    .getByRole("button", { name: "Dados da estrutura", exact: true })
    .click();
  await expect(structureName).toHaveValue("Estrutura preservada");
  await sidebar
    .getByRole("button", { name: "Dados da estrutura", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Salvar estrutura", exact: true })
    .click();
  await expect(
    page.getByText("Estrutura salva.", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/canvas-right-sidebar.png",
    fullPage: true,
  });
  expect(
    (
      await new AxeBuilder({ page })
        .exclude('[data-tabster-dummy][aria-hidden="true"][role="none"]')
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
