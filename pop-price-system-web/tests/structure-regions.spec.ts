import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("regions have readable names, searchable codes and opt-in localities without accepting arbitrary input", async ({
  page,
  request,
}) => {
  await request.post("http://127.0.0.1:3101/test/reset?complexRegions=true");
  await page.goto("/estruturas?new=1");
  const dialog = page.getByRole("dialog", {
    name: "Nova estrutura",
    exact: true,
  });
  await dialog
    .getByRole("combobox", { name: "Provedor principal", exact: true })
    .selectOption("AWS");
  await dialog
    .getByRole("textbox", { name: "Nome da estrutura", exact: true })
    .fill("Localidade preservada");
  const picker = dialog.getByRole("combobox", {
    name: "Região principal",
    exact: true,
  });
  await expect(picker).toBeEnabled();
  await picker.click();
  await expect(page.getByRole("listbox").getByRole("option")).toHaveCount(4);
  await expect(
    page.getByRole("option", { name: "eu-test-9", exact: true }),
  ).toHaveText("eu-test-9");
  await expect(
    page.getByRole("option", { name: "ap-northeast-1-tpe-1", exact: true }),
  ).toHaveCount(0);
  await picker.fill("sao paulo");
  await expect(page.getByRole("listbox").getByRole("option")).toHaveCount(1);
  await expect(page.getByRole("listbox").getByRole("option")).toContainText(
    "São Paulo (Brasil)",
  );
  await picker.press("ArrowDown");
  await picker.press("Enter");
  await expect(picker).toHaveValue("São Paulo (Brasil) · sa-east-1");
  const create = dialog.getByRole("button", {
    name: "Criar e abrir canvas",
    exact: true,
  });
  await expect(create).toBeEnabled();
  await picker.fill("regiao inexistente");
  await expect(
    page.getByRole("option", {
      name: "Nenhuma região encontrada",
      exact: true,
    }),
  ).toBeVisible();
  await expect(create).toBeDisabled();
  await picker.press("Escape");
  const advanced = dialog.getByRole("checkbox", {
    name: "Incluir zonas locais e outras localidades",
    exact: true,
  });
  await advanced.check();
  await picker.fill("tpe");
  await page
    .getByRole("option", { name: "ap-northeast-1-tpe-1", exact: true })
    .click();
  await create.click();
  await expect(page).toHaveURL(/\/canvas\?model=/);
  const id = new URL(page.url()).searchParams.get("model");
  const saved = await (
    await request.get(
      `http://127.0.0.1:3101/pop-price-system-service/api/v1/architecture-models/${id}`,
    )
  ).json();
  expect(saved.specification.locations[0].regionCode).toBe(
    "ap-northeast-1-tpe-1",
  );
  await page.goto(`/estruturas?duplicate=${id}`);
  const copy = page.getByRole("dialog", {
    name: "Duplicar estrutura",
    exact: true,
  });
  await expect(
    copy.getByRole("checkbox", {
      name: "Incluir zonas locais e outras localidades",
      exact: true,
    }),
  ).toBeChecked();
  await expect(
    copy.getByRole("combobox", { name: "Região principal", exact: true }),
  ).toHaveValue("ap-northeast-1-tpe-1");
  expect(
    (
      await new AxeBuilder({ page })
        .exclude('[data-tabster-dummy][aria-hidden="true"][role="none"]')
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});
