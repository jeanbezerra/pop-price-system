import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const api = "http://127.0.0.1:3101";
const list = "/construtor/componentes";
const section = (page: Page, name: string) =>
  page
    .getByRole("navigation", { name: "Seções do componente" })
    .getByRole("button", { name: new RegExp(name) });
const table = (page: Page) =>
  page.getByRole("table", { name: "Componentes de arquitetura", exact: true });

async function componentAction(page: Page, component: string, action: string) {
  await page
    .getByRole("button", { name: `Ações de ${component}`, exact: true })
    .click();
  await page.getByRole("menuitem", { name: action, exact: true }).click();
}

async function identify(page: Page, name: string) {
  await section(page, "2. Características").click();
  await page
    .getByRole("textbox", { name: "Nome do componente", exact: true })
    .fill(name);
  const category = page.getByRole("combobox", {
    name: "Categoria de arquitetura",
    exact: true,
  });
  await category.fill("computacao");
  await page
    .getByRole("option", { name: /^Computação(?: · Compute)?$/ })
    .click();
}

test("cadastro dedicado salva componente genérico com características e aproveita a tela", async ({
  page,
  request,
}, testInfo) => {
  await request.post(`${api}/test/reset`);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(list);
  await page
    .getByRole("button", { name: "Novo componente", exact: true })
    .click();
  await expect(page).toHaveURL(/\/construtor\/componentes\/novo$/);
  await expect(
    page.getByRole("navigation", { name: "Navegação principal" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("radio", { name: "Genérico", exact: true }),
  ).toBeChecked();
  for (const provider of [
    "Amazon Web Services",
    "Microsoft Azure",
    "Google Cloud",
  ])
    await expect(
      page.getByRole("radio", { name: provider, exact: true }),
    ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("component-provider-desktop.png"),
    fullPage: true,
  });
  await identify(page, "Aplicação interna");
  await page
    .getByRole("textbox", { name: "Descrição", exact: true })
    .fill("Coleta de telemetria");
  await page.getByRole("button", { name: "Adicionar característica" }).click();
  await page
    .getByRole("textbox", { name: "Característica 1", exact: true })
    .fill("Memória");
  await page
    .getByRole("textbox", { name: "Valor 1", exact: true })
    .fill("8 GiB");
  await page.getByRole("button", { name: "Adicionar característica" }).click();
  await page
    .getByRole("textbox", { name: "Característica 2", exact: true })
    .fill("vCPU");
  await page.getByRole("textbox", { name: "Valor 2", exact: true }).fill("2");
  await page.getByRole("button", { name: "Remover característica 1" }).click();
  await expect(
    page.getByRole("textbox", { name: "Característica 1", exact: true }),
  ).toHaveValue("vCPU");
  await section(page, "4. Serviço cloud").click();
  await expect(
    page.getByText(/Componentes genéricos não precisam de serviço cloud/),
  ).toBeVisible();
  await section(page, "2. Características").click();
  await expect(
    page.getByRole("textbox", { name: "Nome do componente", exact: true }),
  ).toHaveValue("Aplicação interna");
  const accessibility = await new AxeBuilder({ page })
    .exclude('[data-tabster-dummy=""]')
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.setViewportSize({ width: 1024, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("component-characteristics-notebook.png"),
    fullPage: true,
  });
  await section(page, "5. Revisão").click();
  await page
    .getByRole("combobox", { name: "Situação do componente", exact: true })
    .selectOption("ACTIVE");
  await page
    .getByRole("button", { name: "Salvar componente", exact: true })
    .click();
  await expect(page).toHaveURL(/\/construtor\/componentes$/);
  await expect(table(page)).toContainText("Aplicação interna");
  await expect(table(page)).toContainText("Sem vínculo cloud");
  await componentAction(page, "Aplicação interna", "Editar");
  await expect(page).toHaveURL(/\/construtor\/componentes\/[a-f0-9-]+$/);
  await page.reload();
  await section(page, "2. Características").click();
  await expect(
    page.getByRole("textbox", { name: "Valor 1", exact: true }),
  ).toHaveValue("2");
  await page.getByRole("link", { name: "Voltar aos componentes" }).click();
  await expect(table(page)).toContainText("Aplicação interna");
});

test("componente cloud começa sem vínculo e depois recebe ícone e serviço", async ({
  page,
  request,
}) => {
  await request.post(`${api}/test/reset?paginate=true`);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${list}/novo`);
  await page
    .getByRole("radio", { name: "Amazon Web Services", exact: true })
    .check();
  await identify(page, "Servidor de observabilidade");
  await section(page, "3. Iconografia").click();
  await expect(
    page.getByRole("combobox", {
      name: "Filtrar ícones por categoria",
      exact: true,
    }),
  ).toHaveValue("Compute");
  await expect(
    page.getByRole("radio", { name: "Amazon CloudWatch", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("combobox", {
      name: "Filtrar ícones por categoria",
      exact: true,
    })
    .selectOption("");
  await page
    .getByRole("textbox", { name: "Buscar ícone", exact: true })
    .fill("CloudWatch");
  await page
    .getByRole("button", { name: "Buscar ícones", exact: true })
    .click();
  await expect(
    page.getByRole("radio", { name: "Amazon CloudWatch", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Salvar componente", exact: true })
    .click();
  await expect(table(page)).toContainText("Pendente");
  await expect(table(page)).toContainText("Sem vínculo cloud");
  await componentAction(page, "Servidor de observabilidade", "Editar");
  await section(page, "5. Revisão").click();
  await page
    .getByRole("combobox", { name: "Situação do componente", exact: true })
    .selectOption("ACTIVE");
  await page
    .getByRole("button", { name: "Salvar componente", exact: true })
    .click();
  await expect(
    page.getByText("Selecione um ícone antes de ativar o componente.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Buscar ícone", exact: true })
    .fill("EC2");
  await page
    .getByRole("button", { name: "Buscar ícones", exact: true })
    .click();
  const radio = page.getByRole("radio", { name: "Amazon EC2", exact: true });
  await expect(radio).toBeEnabled();
  await radio.focus();
  await expect(radio).toBeFocused();
  await page.keyboard.press("Space");
  await expect(radio).toBeChecked();
  await page
    .getByRole("button", { name: "Salvar componente", exact: true })
    .click();
  await expect(
    page.getByText("Vincule um serviço cloud antes de ativar o componente.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Carregar mais serviços" }).click();
  await expect(
    page
      .getByRole("combobox", { name: "Serviço cloud vinculado", exact: true })
      .getByRole("option", { name: /AmazonS3/ }),
  ).toBeAttached();
  await page
    .getByRole("combobox", { name: "Serviço cloud vinculado", exact: true })
    .selectOption("AmazonEC2");
  await page
    .getByRole("button", { name: "Salvar componente", exact: true })
    .click();
  await expect(table(page)).toContainText("Ativo");
  await expect(table(page)).toContainText("AmazonEC2");
  await expect(table(page).locator('img[src$="/ec2.svg"]')).toHaveCount(1);
  await componentAction(page, "Servidor de observabilidade", "Desativar");
  await expect(table(page)).toContainText("Inativo");
  expect(errors).toEqual([]);
});

test("lista pagina e recupera falha de consulta", async ({ page, request }) => {
  await request.post(`${api}/test/reset?components=23`);
  await page.goto(list);
  await expect(table(page).getByRole("row")).toHaveCount(21);
  await page.getByRole("button", { name: "Carregar mais componentes" }).click();
  await expect(table(page).getByRole("row")).toHaveCount(24);
  await page
    .getByRole("textbox", { name: "Buscar componente", exact: true })
    .fill("23");
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect(table(page).getByRole("row")).toHaveCount(2);
  await request.post(`${api}/test/availability?enabled=false`);
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect(page.getByText(/API indisponível/).first()).toBeVisible();
  await request.post(`${api}/test/availability?enabled=true`);
  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await expect(table(page).getByRole("row")).toHaveCount(21);
});

test("filtra componentes com e sem serviço em todas as páginas e limpa o critério", async ({
  page,
  request,
}) => {
  await request.post(`${api}/test/reset?components=44&unlinked=21`);
  await request.post(
    `${api}/pop-price-system-service/api/v1/architecture-components`,
    {
      data: {
        provider: "GENERIC",
        name: "Aplicação independente",
        category: "application",
        status: "ACTIVE",
        revision: 0,
        characteristics: [],
      },
    },
  );
  await page.goto(list);
  const linkFilter = page.getByRole("combobox", {
    name: "Vínculo com serviço",
    exact: true,
  });
  const apply = page.getByRole("button", {
    name: "Aplicar filtros",
    exact: true,
  });
  await expect(linkFilter).toHaveValue("");
  await linkFilter.selectOption("true");
  await apply.click();
  await expect(table(page).getByRole("row")).toHaveCount(21);
  await expect(table(page)).not.toContainText("Sem vínculo cloud");
  await expect(table(page)).toContainText("Componente 22");
  await expect(table(page)).not.toContainText("Componente 01");
  await page.getByRole("button", { name: "Carregar mais componentes" }).click();
  await expect(table(page).getByRole("row")).toHaveCount(24);
  await expect(table(page)).not.toContainText("Sem vínculo cloud");
  await linkFilter.selectOption("false");
  await apply.click();
  await expect(table(page).getByRole("row")).toHaveCount(21);
  await expect(table(page)).not.toContainText("Amazon Elastic Compute Cloud");
  await page.getByRole("button", { name: "Carregar mais componentes" }).click();
  await expect(table(page).getByRole("row")).toHaveCount(23);
  await expect(table(page)).toContainText("Aplicação independente");
  await page
    .getByRole("combobox", { name: "Filtrar por provedor" })
    .selectOption("GENERIC");
  await apply.click();
  await expect(table(page).getByRole("row")).toHaveCount(2);
  await expect(table(page)).toContainText("Aplicação independente");
  await linkFilter.selectOption("true");
  await apply.click();
  await expect(page.getByText(/Nenhum componente encontrado/)).toBeVisible();
  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await expect(linkFilter).toHaveValue("");
  await expect(table(page).getByRole("row")).toHaveCount(21);
});

test("menu de ações confirma exclusão, preserva cancelamento e permite recuperar falhas", async ({
  page,
  request,
}) => {
  await request.post(`${api}/test/reset?components=2`);
  await page.goto(list);
  const linkFilter = page.getByRole("combobox", {
    name: "Vínculo com serviço",
    exact: true,
  });
  await linkFilter.selectOption("true");
  await page
    .getByRole("button", { name: "Aplicar filtros", exact: true })
    .click();
  const trigger = page.getByRole("button", {
    name: "Ações de Componente 01",
    exact: true,
  });
  await expect(trigger).toBeEnabled();
  await trigger.focus();
  await trigger.press("Enter");
  await expect(
    page.getByRole("menuitem", { name: "Editar", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await componentAction(page, "Componente 01", "Excluir componente");
  const dialog = page.getByRole("dialog", {
    name: "Excluir componente?",
    exact: true,
  });
  await expect(dialog).toContainText("Componente 01");
  await expect(
    dialog.getByRole("button", { name: "Cancelar", exact: true }),
  ).toBeFocused();
  const accessibility = await new AxeBuilder({ page })
    .exclude('[data-tabster-dummy=""]')
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(table(page)).toContainText("Componente 01");
  await componentAction(page, "Componente 01", "Excluir componente");
  await request.post(`${api}/test/availability?enabled=false`);
  await dialog.getByRole("button", { name: "Excluir", exact: true }).click();
  await expect(dialog.getByText(/indisponível/)).toBeVisible();
  await expect(dialog).toBeVisible();
  await request.post(`${api}/test/availability?enabled=true`);
  await dialog.getByRole("button", { name: "Excluir", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(table(page).getByRole("row")).toHaveCount(2);
  await expect(table(page)).not.toContainText("Componente 01");
  await expect(table(page)).toContainText("Componente 02");
  await expect(linkFilter).toHaveValue("true");
  await expect(
    page.getByRole("button", { name: "Novo componente", exact: true }),
  ).toBeFocused();
  const deleted = await request.get(
    `${api}/pop-price-system-service/api/v1/architecture-components/11111111-1111-4111-8111-000000000000`,
  );
  expect(deleted.status()).toBe(404);
  await page.reload();
  await expect(table(page)).not.toContainText("Componente 01");
});

test("categoria depende do provedor, rejeita texto livre e preserva valores anteriores", async ({
  page,
  request,
}) => {
  await request.post(`${api}/test/reset?components=1&noCategories=GCP`);
  await page.goto(`${list}/novo`);
  await identify(page, "Novo recurso");
  await section(page, "1. Provedor").click();
  await page
    .getByRole("radio", { name: "Amazon Web Services", exact: true })
    .check();
  await section(page, "2. Características").click();
  const category = page.getByRole("combobox", {
    name: "Categoria de arquitetura",
    exact: true,
  });
  await expect(category).toHaveValue("");
  await category.fill("categoria inventada");
  await expect(
    page.getByRole("option", { name: "Nenhuma categoria encontrada" }),
  ).toBeVisible();
  await category.press("Tab");
  await page
    .getByRole("button", { name: "Salvar componente", exact: true })
    .click();
  await expect(
    page.getByText("Selecione uma categoria da lista.", { exact: true }),
  ).toBeVisible();
  await section(page, "1. Provedor").click();
  await page
    .getByRole("radio", { name: "Microsoft Azure", exact: true })
    .check();
  await section(page, "2. Características").click();
  await category.fill("computacao");
  await expect(page.getByRole("option", { name: /Computação/ })).toBeVisible();
  await category.press("ArrowDown");
  await category.press("Enter");
  await expect(category).toHaveValue("Computação");
  await section(page, "1. Provedor").click();
  await page.getByRole("radio", { name: "Google Cloud", exact: true }).check();
  await section(page, "2. Características").click();
  await expect(category).toBeDisabled();
  await expect(
    page.getByText(/Categorias deste provedor ainda não estão disponíveis/),
  ).toBeVisible();
  await page.goto(list);
  await componentAction(page, "Componente 01", "Editar");
  await section(page, "2. Características").click();
  await expect(category).toHaveValue("Computação (categoria anterior)");
  await page
    .getByRole("textbox", { name: "Nome do componente", exact: true })
    .fill("Legado preservado");
  await page
    .getByRole("button", { name: "Salvar componente", exact: true })
    .click();
  await expect(table(page)).toContainText("Legado preservado");
});
