import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const api = "http://127.0.0.1:3101";
async function chooseService(page: Page, code: string) {
  const service = page.getByRole("combobox", { name: "Serviço", exact: true });
  await service.fill(code);
  await page.getByRole("option", { name: new RegExp(code) }).click();
  await expect(
    page.getByRole("combobox", { name: "Região", exact: true }),
  ).toBeEnabled();
}
async function addImport(page: Page, code: string) {
  await chooseService(page, code);
  await page
    .getByRole("combobox", { name: "Região", exact: true })
    .fill("us-east-1");
  await page.getByRole("option", { name: /us-east-1/ }).click();
  await page
    .getByRole("button", { name: "Adicionar à lista", exact: true })
    .click();
}

test("guided selection supports keyboard, blocks duplicates and preserves the queue on history refresh", async ({
  page,
  request,
}, testInfo) => {
  await request.post(`${api}/test/reset`);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/construtor/sincronizacoes");
  const region = page.getByRole("combobox", { name: "Região", exact: true });
  const add = page.getByRole("button", {
    name: "Adicionar à lista",
    exact: true,
  });
  await expect(region).toBeDisabled();
  await expect(add).toBeDisabled();
  const service = page.getByRole("combobox", { name: "Serviço", exact: true });
  await service.fill("Elastic Kubernetes");
  await expect(add).toBeDisabled();
  await service.press("ArrowDown");
  await service.press("Enter");
  await expect(region).toBeEnabled();
  await region.fill("us-east-1");
  await region.press("ArrowDown");
  await region.press("Enter");
  await add.click();
  await add.click();
  await expect(
    page.getByText("Esse serviço e região já estão na lista.", {
      exact: false,
    }),
  ).toBeVisible();
  const queue = page.getByRole("table", {
    name: "Importações de preços",
    exact: true,
  });
  await expect(queue.getByRole("row")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Atualizar histórico", exact: true })
    .click();
  await expect(queue.getByText("Pendente", { exact: true })).toBeVisible();
  await addImport(page, "AmazonEC2");
  await expect(
    page.getByRole("button", {
      name: "Sincronizar 2 importações",
      exact: true,
    }),
  ).toBeEnabled();
  await page.screenshot({
    path: testInfo.outputPath("queue-desktop.png"),
    fullPage: true,
  });
  const accessibility = await new AxeBuilder({ page })
    .exclude('[data-tabster-dummy][aria-hidden="true"][role="none"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: testInfo.outputPath("queue-mobile.png"),
    fullPage: true,
  });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page
    .getByRole("button", {
      name: "Remover AmazonEC2 em us-east-1",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", { name: "Sincronizar 1 importação", exact: true }),
  ).toBeEnabled();
  expect(errors).toEqual([]);
});

test("a failed import does not stop the batch or repeat completed imports on retry", async ({
  page,
  request,
}) => {
  await request.post(`${api}/test/reset?prices=false&failService=AmazonEC2`);
  await page.goto("/construtor/sincronizacoes");
  await addImport(page, "AmazonEC2");
  await addImport(page, "AmazonEKS");
  await page
    .getByRole("button", { name: "Sincronizar 2 importações", exact: true })
    .click();
  const queue = page.getByRole("table", {
    name: "Importações de preços",
    exact: true,
  });
  await expect(queue.getByText("Falhou", { exact: true })).toBeVisible();
  await expect(queue.getByText("Concluída", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sincronizar preços", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Preparar nova tentativa", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Sincronizar 1 importação", exact: true })
    .click();
  await expect(queue.getByText("Concluída", { exact: true })).toHaveCount(2);
  const recorded = await (await request.get(`${api}/test/requests`)).json();
  expect(
    recorded
      .filter(
        (item: { method: string; path: string }) =>
          item.method === "POST" && item.path === "/synchronizations",
      )
      .map((item: { body: { serviceCode: string } }) => item.body.serviceCode),
  ).toEqual(["AmazonEC2", "AmazonEKS", "AmazonEC2"]);
});

test("region lookup errors can be retried without losing the selected service", async ({
  page,
  request,
}) => {
  await request.post(`${api}/test/reset`);
  await page.goto("/construtor/sincronizacoes");
  await request.post(`${api}/test/availability?enabled=false`);
  await page
    .getByRole("combobox", { name: "Serviço", exact: true })
    .fill("AmazonEKS");
  await page.getByRole("option", { name: /AmazonEKS/ }).click();
  const retry = page.getByRole("button", {
    name: "Buscar regiões novamente",
    exact: true,
  });
  await expect(retry).toBeEnabled();
  await expect(
    page.getByRole("combobox", { name: "Região", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Adicionar à lista", exact: true }),
  ).toBeDisabled();
  await request.post(`${api}/test/availability?enabled=true`);
  await retry.click();
  await expect(
    page.getByRole("combobox", { name: "Região", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("combobox", { name: "Serviço", exact: true }),
  ).toHaveValue("AmazonEKS");
});

test("empty service catalog can be discovered and subsequent pages remain searchable", async ({
  page,
  request,
}) => {
  await request.post(`${api}/test/reset?services=false&paginate=true`);
  await page.goto("/construtor/sincronizacoes");
  await expect(
    page.getByRole("combobox", { name: "Serviço", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Buscar serviços", exact: true })
    .click();
  const service = page.getByRole("combobox", { name: "Serviço", exact: true });
  await expect(service).toBeEnabled();
  await service.fill("AmazonS3");
  await expect(
    page.getByRole("option", {
      name: "Nenhum serviço encontrado",
      exact: true,
    }),
  ).toBeVisible();
  await service.press("Escape");
  await page
    .getByRole("button", { name: "Carregar mais serviços", exact: true })
    .click();
  await service.click();
  await page.getByRole("option", { name: /AmazonS3/ }).click();
  await expect(
    page.getByRole("combobox", { name: "Região", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Carregar mais serviços", exact: true }),
  ).toHaveCount(0);
});

test("history pages and sorts all records while preserving prepared imports", async ({
  page,
  request,
}, testInfo) => {
  await request.post(`${api}/test/reset?history=23`);
  await page.goto("/construtor/sincronizacoes");
  const history = page.getByRole("table", {
    name: "Histórico de sincronizações",
    exact: true,
  });
  const rows = history.getByRole("row");
  const pager = page.getByRole("navigation", {
    name: "Paginação do histórico",
    exact: true,
  });
  await expect(rows).toHaveCount(11);
  await expect(rows.nth(1)).toContainText("History-23");
  await expect(
    history.getByRole("columnheader", { name: /Início/ }),
  ).toHaveAttribute("aria-sort", "descending");
  await expect(
    pager.getByRole("button", { name: "Anterior", exact: true }),
  ).toBeDisabled();
  await addImport(page, "AmazonEC2");
  await pager.getByRole("button", { name: "Próxima", exact: true }).click();
  await expect(
    page.getByText("Registros 11–20 · Página 2", { exact: true }),
  ).toBeVisible();
  await expect(rows.nth(1)).toContainText("History-13");
  const sortService = history.getByRole("button", {
    name: "Serviço: ordenar crescente",
    exact: true,
  });
  await sortService.focus();
  await sortService.press("Enter");
  await expect(rows.nth(1)).toContainText("History-01");
  await expect(
    history.getByRole("columnheader", { name: /Serviço/ }),
  ).toHaveAttribute("aria-sort", "ascending");
  await pager.getByRole("button", { name: "Próxima", exact: true }).click();
  await expect(rows.nth(1)).toContainText("History-11");
  await pager.getByRole("button", { name: "Próxima", exact: true }).click();
  await expect(rows).toHaveCount(4);
  await expect(
    page.getByText("Registros 21–23 · Página 3", { exact: true }),
  ).toBeVisible();
  await expect(
    pager.getByRole("button", { name: "Próxima", exact: true }),
  ).toBeDisabled();
  await pager.getByRole("button", { name: "Anterior", exact: true }).click();
  await expect(rows.nth(1)).toContainText("History-11");
  await pager
    .getByRole("button", { name: "Primeira página", exact: true })
    .click();
  await history
    .getByRole("button", { name: "Serviço: ordenar decrescente", exact: true })
    .click();
  await expect(rows.nth(1)).toContainText("History-23");
  await page
    .getByRole("combobox", { name: "Linhas por página", exact: true })
    .selectOption("25");
  await expect(rows).toHaveCount(24);
  await expect(
    pager.getByRole("button", { name: "Próxima", exact: true }),
  ).toBeDisabled();
  await history
    .getByRole("button", {
      name: "Tarifas processadas: ordenar crescente",
      exact: true,
    })
    .click();
  await expect(rows.nth(1).getByRole("cell").last()).toHaveText("0");
  await page
    .getByRole("button", { name: "Atualizar histórico", exact: true })
    .click();
  await expect(
    history.getByRole("columnheader", { name: /Tarifas processadas/ }),
  ).toHaveAttribute("aria-sort", "ascending");
  await expect(
    page
      .getByRole("table", { name: "Importações de preços", exact: true })
      .getByText("Pendente", { exact: true }),
  ).toBeVisible();
  const accessibility = await new AxeBuilder({ page })
    .exclude('[data-tabster-dummy][aria-hidden="true"][role="none"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("history-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("history-mobile.png"),
    fullPage: true,
  });
  const recorded = await (await request.get(`${api}/test/requests`)).json();
  expect(
    recorded.some(
      (item: {
        query: { offset?: string; sortBy?: string; direction?: string };
      }) =>
        item.query.offset === "10" &&
        item.query.sortBy === "serviceCode" &&
        item.query.direction === "asc",
    ),
  ).toBe(true);
});

test("history keeps the current page and sorting after a request error", async ({
  page,
  request,
}) => {
  await request.post(`${api}/test/reset?history=23`);
  await page.goto("/construtor/sincronizacoes");
  await request.post(`${api}/test/availability?enabled=false`);
  const pager = page.getByRole("navigation", {
    name: "Paginação do histórico",
    exact: true,
  });
  await pager.getByRole("button", { name: "Próxima", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Não foi possível atualizar o histórico",
  );
  await expect(
    page.getByText("Registros 1–10 · Página 1", { exact: true }),
  ).toBeVisible();
  await request.post(`${api}/test/availability?enabled=true`);
  await pager.getByRole("button", { name: "Próxima", exact: true }).click();
  await expect(
    page.getByText("Registros 11–20 · Página 2", { exact: true }),
  ).toBeVisible();
});
