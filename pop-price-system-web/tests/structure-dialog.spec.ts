import { selectRegion } from "./fixtures/structures";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const api = "http://127.0.0.1:3101";

test("primary provider is explicit and controls the canvas independently of provider order", async ({
  page,
  request,
}) => {
  await request.post(`${api}/test/reset?components=2&multicloud=true`);
  await page.goto("/estruturas");
  await page
    .getByRole("button", { name: "Nova estrutura", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Nova estrutura",
    exact: true,
  });
  const primary = dialog.getByRole("combobox", {
    name: "Provedor principal",
    exact: true,
  });
  const region = dialog.getByRole("combobox", {
    name: "Região principal",
    exact: true,
  });
  await expect(primary).toHaveValue("");
  await expect(region).toBeDisabled();
  const initialRequests = await (
    await request.get(`${api}/test/requests`)
  ).json();
  expect(
    initialRequests.filter((r: { path: string }) =>
      r.path.endsWith("/regions"),
    ),
  ).toHaveLength(0);
  await primary.selectOption("AWS");
  await selectRegion(region, "us-east-1");
  await primary.selectOption("AZURE");
  await expect(region).toHaveValue("");
  await selectRegion(region, "eastus");
  await expect(
    dialog.getByRole("combobox", { name: "Provedor adicional 1", exact: true }),
  ).toHaveValue("AWS");
  await dialog
    .getByRole("textbox", { name: "Nome da estrutura", exact: true })
    .fill("Azure como principal");
  await dialog
    .getByRole("button", { name: "Criar e abrir canvas", exact: true })
    .click();
  await expect(page).toHaveURL(/\/canvas\?model=[a-f0-9-]+$/);
  await expect(
    page.getByRole("combobox", { name: "Cloud da biblioteca", exact: true }),
  ).toHaveValue("AZURE");
  const id = new URL(page.url()).searchParams.get("model");
  const saved = await (
    await request.get(
      `${api}/pop-price-system-service/api/v1/architecture-models/${id}`,
    )
  ).json();
  expect(saved.specification.primaryProvider).toBe("AZURE");
  expect(saved.specification.locations[0].provider).toBe("AWS");
  const requests = await (await request.get(`${api}/test/requests`)).json();
  expect(
    requests.some(
      (r: { path: string; query: Record<string, string> }) =>
        r.path === "/architecture-components" && r.query.provider === "AZURE",
    ),
  ).toBe(true);
});

test("dialog fits narrow windows without horizontal scrolling and keeps actions visible", async ({
  page,
  request,
}) => {
  await request.post(`${api}/test/reset?multicloud=true`);
  await page.goto("/estruturas?new=1");
  const dialog = page.getByRole("dialog", {
    name: "Nova estrutura",
    exact: true,
  });
  await dialog
    .getByRole("combobox", { name: "Provedor principal", exact: true })
    .selectOption("AWS");
  await selectRegion(
    dialog.getByRole("combobox", { name: "Região principal", exact: true }),
    "us-east-1",
  );
  for (const viewport of [
    { width: 560, height: 650 },
    { width: 390, height: 844 },
    { width: 320, height: 700 },
  ]) {
    await page.setViewportSize(viewport);
    await expect
      .poll(() => dialog.evaluate((el) => el.scrollWidth <= el.clientWidth))
      .toBe(true);
    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    const action = await dialog
      .getByRole("button", { name: "Criar e abrir canvas", exact: true })
      .boundingBox();
    expect(action!.y + action!.height).toBeLessThanOrEqual(viewport.height);
    await page.screenshot({
      path: `test-results/new-structure-${viewport.width}.png`,
      fullPage: true,
    });
  }
  expect(
    (
      await new AxeBuilder({ page })
        .exclude('[data-tabster-dummy][aria-hidden="true"][role="none"]')
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page
    .getByRole("button", { name: "Nova estrutura", exact: true })
    .click();
  await expect(
    dialog.getByRole("combobox", { name: "Provedor principal", exact: true }),
  ).toHaveValue("");
});
