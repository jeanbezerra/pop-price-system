import { expect, test } from "@playwright/test";

for (const surface of ["components", "structures"] as const) {
  test(`action menu preserves the visible page on ${surface}`, async ({
    page,
    request,
  }) => {
    await request.post("http://127.0.0.1:3101/test/reset?components=2");
    if (surface === "structures") {
      await request.post(
        "http://127.0.0.1:3101/pop-price-system-service/api/v1/architecture-models",
        {
          data: {
            name: "Estrutura de teste",
            hoursPerMonth: 720,
            graph: { nodes: [], edges: [] },
            revision: 0,
          },
        },
      );
    }
    await page.setViewportSize({ width: 1900, height: 990 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(
      surface === "components" ? "/construtor/componentes" : "/estruturas",
    );
    const heading = page.getByRole("heading", {
      name:
        surface === "components"
          ? "Componentes de arquitetura"
          : "Gestão de estruturas",
      exact: true,
    });
    const trigger = page.getByRole("button", {
      name:
        surface === "components"
          ? "Ações de Componente 01"
          : "Ações de Estrutura de teste",
      exact: true,
    });
    await trigger.click();
    await expect(
      page.getByRole("menuitem", { name: "Editar", exact: true }),
    ).toBeVisible();
    // Visibility alone misses a full-page portal surface covering the underlying page.
    await expect
      .poll(() =>
        heading.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return element.contains(
            document.elementFromPoint(
              rect.x + rect.width / 2,
              rect.y + rect.height / 2,
            ),
          );
        }),
      )
      .toBe(true);
    await page.screenshot({
      path: `test-results/${surface}-actions.png`,
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toBeHidden();
    await expect(trigger).toBeFocused();
    await trigger.press("Enter");
    await expect(page.getByRole("menu")).toBeVisible();
    await heading.click();
    await expect(page.getByRole("menu")).toBeHidden();
    await trigger.click();
    await page
      .getByRole("menuitem", {
        name: surface === "components" ? "Excluir componente" : "Excluir",
        exact: true,
      })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(heading).toBeVisible();
    expect(errors).toEqual([]);
  });
}
