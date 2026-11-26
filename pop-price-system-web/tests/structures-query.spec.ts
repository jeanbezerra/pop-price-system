import { expect, test } from "@playwright/test";
import { specification } from "./fixtures/structures";
import AxeBuilder from "@axe-core/playwright";

const api =
  "http://127.0.0.1:3101/pop-price-system-service/api/v1/architecture-models";
test("server filters, sorting and pagination span all records and reset page when criteria change", async ({
  page,
  request,
}) => {
  await request.post("http://127.0.0.1:3101/test/reset?multicloud=true");
  for (let index = 0; index < 26; index++) {
    const spec = specification();
    spec.category = index % 2 ? "PLATFORM" : "APPLICATION";
    spec.environment = index % 3 ? "DEVELOPMENT" : "PRODUCTION";
    await request.post(api, {
      data: {
        name: `Estrutura ${String(index).padStart(2, "0")}`,
        hoursPerMonth: 720,
        revision: 0,
        specification: spec,
        graph: { nodes: [], edges: [] },
      },
    });
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/estruturas");
  const table = page.getByRole("table");
  const pagination = page.getByRole("navigation", {
    name: "Paginação de estruturas",
  });
  await expect(table.getByRole("row")).toHaveCount(21);
  await expect(
    pagination.getByText("Página 1 de 2", { exact: true }),
  ).toBeVisible();
  await table
    .getByRole("columnheader", { name: "Estrutura", exact: true })
    .click();
  await expect(
    table.getByRole("columnheader", { name: "Estrutura", exact: true }),
  ).toHaveAttribute("aria-sort", "ascending");
  await expect(
    table.getByRole("row").nth(1).getByText("Estrutura 00", { exact: true }),
  ).toBeVisible();
  await pagination
    .getByRole("button", { name: "Próxima página", exact: true })
    .click();
  await expect(
    pagination.getByText("Página 2 de 2", { exact: true }),
  ).toBeVisible();
  await expect(table.getByRole("row")).toHaveCount(7);
  await expect(
    table.getByRole("row").nth(1).getByText("Estrutura 20", { exact: true }),
  ).toBeVisible();
  await expect(
    pagination.getByRole("button", { name: "Próxima página", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("textbox", { name: "Buscar estruturas", exact: true })
    .fill("Estrutura 00");
  await page
    .getByRole("button", { name: "Aplicar filtros", exact: true })
    .click();
  await expect(table.getByRole("row")).toHaveCount(2);
  await expect(
    pagination.getByText("Página 1 de 1", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Limpar filtros", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Categoria", exact: true })
    .selectOption("PLATFORM");
  await page
    .getByRole("combobox", { name: "Ambiente", exact: true })
    .selectOption("PRODUCTION");
  await page
    .getByRole("button", { name: "Aplicar filtros", exact: true })
    .click();
  await expect(table.getByRole("row")).toHaveCount(5);
  await page
    .getByRole("combobox", { name: "Provedor", exact: true })
    .selectOption("AZURE");
  await page
    .getByRole("button", { name: "Aplicar filtros", exact: true })
    .click();
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(
    pagination.getByText("Nenhuma estrutura", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Limpar filtros", exact: true })
    .click();
  await pagination
    .getByRole("combobox", { name: "Por página", exact: true })
    .selectOption("10");
  await expect(table.getByRole("row")).toHaveCount(11);
  await pagination
    .getByRole("button", { name: "Última página", exact: true })
    .click();
  await expect(
    pagination.getByText("Página 3 de 3", { exact: true }),
  ).toBeVisible();
  await table
    .getByRole("columnheader", { name: "Estrutura", exact: true })
    .click();
  await expect(
    pagination.getByText("Página 1 de 3", { exact: true }),
  ).toBeVisible();
  await expect(
    table.getByRole("row").nth(1).getByText("Estrutura 25", { exact: true }),
  ).toBeVisible();
  const fields = page.getByRole("search", { name: "Filtros de estruturas" });
  const boxes = await fields
    .getByRole("combobox")
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()));
  expect(new Set(boxes.map((box) => box.y)).size).toBe(1);
  expect(
    Math.max(...boxes.map((box) => box.width)) -
      Math.min(...boxes.map((box) => box.width)),
  ).toBeLessThan(1);
  expect(
    (
      await new AxeBuilder({ page })
        .exclude('[data-tabster-dummy][aria-hidden="true"][role="none"]')
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: "test-results/structures-filters-pagination.png",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/structures-filters-pagination-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await pagination
    .getByRole("button", { name: "Última página", exact: true })
    .click();
  const lastPage = await (
    await request.get(`${api}?sort=name&direction=DESC&size=10&offset=20`)
  ).json();
  for (const row of lastPage.items) {
    expect(
      (await request.delete(`${api}/${row.id}?revision=${row.revision}`)).ok(),
    ).toBe(true);
  }
  await page
    .getByRole("button", { name: "Atualizar estruturas", exact: true })
    .click();
  await expect(
    pagination.getByText("Página 2 de 2", { exact: true }),
  ).toBeVisible();
  await expect(table.getByRole("row")).toHaveCount(11);
});
