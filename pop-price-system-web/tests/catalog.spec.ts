import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const api = "http://127.0.0.1:3101";

test("catalog shows provider artwork first and links each service to its costs", async ({
  page,
  request,
}, testInfo) => {
  await request.post(`${api}/test/reset?multicloud=true`);
  const imported = await (
    await request.post(
      `${api}/pop-price-system-service/api/v1/synchronizations`,
      {
        data: {
          provider: "AWS",
          serviceCode: "AmazonEC2",
          regionCode: "us-east-1",
        },
      },
    )
  ).json();
  await page.goto("/catalogo");
  const table = page.getByRole("table", {
    name: "Serviços do catálogo",
    exact: true,
  });
  await expect(table.getByRole("columnheader")).toHaveText([
    "Provedor",
    "Código",
    "Serviço",
    "Última sincronização",
    "Custos",
  ]);
  const importedCell = table.getByRole("row").nth(1).getByRole("cell").nth(3);
  await expect(importedCell.locator("time")).toHaveAttribute(
    "datetime",
    imported.finishedAt,
  );
  await expect(importedCell).toHaveText(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(imported.finishedAt)),
  );
  await expect(
    table.getByText("Não sincronizado", { exact: true }),
  ).toHaveCount(4);
  for (const [name, path] of [
    ["AWS", "aws"],
    ["Azure", "azure"],
    ["GCP", "gcp"],
  ]) {
    const icon = table.getByRole("img", { name, exact: true }).first();
    await expect(icon).toHaveAttribute("src", `/providers/${path}.svg`);
    await expect
      .poll(() =>
        icon.evaluate(
          (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
        ),
      )
      .toBe(true);
  }
  await page.screenshot({
    path: testInfo.outputPath("catalog-desktop.png"),
    fullPage: true,
  });
  await page
    .getByRole("combobox", { name: "Provedor", exact: true })
    .selectOption("AZURE");
  await expect(table.getByRole("row")).toHaveCount(2);
  await expect(
    table.getByRole("row").nth(1).getByRole("cell").nth(1),
  ).toHaveText("VirtualMachines");
  await page
    .getByRole("combobox", { name: "Provedor", exact: true })
    .selectOption("AWS");
  await page
    .getByRole("textbox", { name: "Buscar serviço", exact: true })
    .fill("Kubernetes");
  await table
    .getByRole("link", {
      name: /Ver custos de Amazon Elastic Kubernetes Service/,
    })
    .click();
  await expect(page).toHaveURL(/\/catalogo\/AWS\/AmazonEKS$/);
  await expect(
    page.getByRole("heading", { name: "Custos de AmazonEKS", exact: true }),
  ).toBeVisible();
  const costs = page.getByRole("table", {
    name: "Custos do serviço",
    exact: true,
  });
  await expect(costs.getByRole("row")).toHaveCount(2);
  await expect(costs.getByText(/0,10/)).toBeVisible();
  await expect(
    costs.getByRole("link", { name: "Fonte do preço", exact: true }),
  ).toHaveAttribute("href", "https://example.invalid/test-only");
  await expect(
    page
      .getByRole("navigation", { name: "Navegação principal", exact: true })
      .getByRole("link", { name: "Catálogo", exact: true }),
  ).toHaveAttribute("aria-current", "location");
  const accessibility = await new AxeBuilder({ page })
    .exclude('[data-tabster-dummy][aria-hidden="true"][role="none"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page
    .getByRole("link", { name: "Voltar ao catálogo", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Catálogo de serviços", exact: true }),
  ).toBeVisible();
});

test("costs retain exact unit prices, paginate and filter only the selected service", async ({
  page,
  request,
}, testInfo) => {
  await request.post(`${api}/test/reset?ratePages=true`);
  await page.goto("/catalogo/AWS/AmazonEKS");
  const costs = page.getByRole("table", {
    name: "Custos do serviço",
    exact: true,
  });
  await expect(costs.getByRole("row")).toHaveCount(51);
  const pager = page.getByRole("navigation", {
    name: "Paginação dos custos",
    exact: true,
  });
  await pager.getByRole("button", { name: "Próxima", exact: true }).click();
  await expect(costs.getByRole("row")).toHaveCount(7);
  await expect(costs.getByRole("row").nth(1)).toContainText("Cost tier 49");
  await expect(costs.getByRole("row").nth(1)).toContainText("0,000000123456");
  await expect(
    pager.getByRole("button", { name: "Próxima", exact: true }),
  ).toBeDisabled();
  await costs.getByText("Detalhes da tarifa", { exact: true }).first().click();
  await expect(
    costs.getByText("test-instance", { exact: true }).first(),
  ).toBeVisible();
  await pager.getByRole("button", { name: "Anterior", exact: true }).click();
  await expect(costs.getByRole("row")).toHaveCount(51);
  await page
    .getByRole("combobox", { name: "Região dos custos", exact: true })
    .selectOption("us-east-1");
  await expect(costs.getByRole("row")).toHaveCount(2);
  await expect(pager).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath("costs-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("costs-mobile.png"),
    fullPage: true,
  });
  const recorded = await (await request.get(`${api}/test/requests`)).json();
  const queries = recorded.filter(
    (item: { path: string }) => item.path === "/catalog/rates",
  );
  expect(
    queries.every(
      (item: { query: { service: string; provider: string } }) =>
        item.query.service === "AmazonEKS" && item.query.provider === "AWS",
    ),
  ).toBe(true);
});

test("unsynchronized costs have a clear empty state and failures remain retryable", async ({
  page,
  request,
}) => {
  await request.post(`${api}/test/reset?prices=false`);
  await page.goto("/catalogo/AWS/AmazonS3");
  await expect(
    page.getByRole("heading", {
      name: "Nenhum custo sincronizado",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Sincronizar preços", exact: true }),
  ).toHaveAttribute("href", "/construtor/sincronizacoes");
  await request.post(`${api}/test/availability?enabled=false`);
  await page
    .getByRole("button", { name: "Atualizar custos", exact: true })
    .click();
  await expect(
    page.getByRole("main").getByText("API indisponível", { exact: false }),
  ).toBeVisible();
  await request.post(`${api}/test/availability?enabled=true`);
  await page
    .getByRole("button", { name: "Atualizar custos", exact: true })
    .click();
  await expect(
    page.getByRole("main").getByText("API indisponível", { exact: false }),
  ).toHaveCount(0);
});
