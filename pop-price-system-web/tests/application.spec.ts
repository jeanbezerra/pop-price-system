import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function trackNavigationMotion(page: Page) {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      if (this.matches('[role="navigation"]'))
        performance.mark("navigation-motion");
      return animate.apply(this, args);
    };
  });
}

test("SSR delivers content, local logo and Fluent styles before JavaScript", async ({
  browser,
  request,
}) => {
  const response = await request.get("/");
  const html = await response.text();
  expect(response.status()).toBe(200);
  expect(html).toContain("Visão geral");
  expect(html).toContain("data-make-styles-rehydration");
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:3100/");
  await expect(
    page.getByRole("heading", { name: "Visão geral", exact: true }),
  ).toBeVisible();
  expect(
    await page.locator("head style[data-make-styles-rehydration]").count(),
  ).toBeGreaterThan(0);
  expect(
    await page.locator("body style[data-make-styles-rehydration]").count(),
  ).toBe(0);
  expect(
    await page
      .getByRole("img", { name: "Porto", exact: true })
      .evaluate(
        (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
      ),
  ).toBe(true);
  await page
    .getByRole("navigation", { name: "Navegação principal" })
    .getByRole("link", { name: "Catálogo", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Catálogo de serviços", exact: true }),
  ).toBeVisible();
  await context.close();
});

test("static resources work while all external origins are blocked", async ({
  page,
}) => {
  const external: string[] = [];
  const failures: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400)
      failures.push(`${response.status()} ${response.url()}`);
  });
  await page.route("**/*", (route) => {
    const origin = new URL(route.request().url()).origin;
    if (origin !== "http://127.0.0.1:3100") {
      // Endpoint security on this Windows host injects this script. It is blocked,
      // never allowed, and is not a resource declared by this application.
      if (origin !== "http://me.kis.v2.scr.kaspersky-labs.com")
        external.push(route.request().url());
      return route.abort();
    }
    return route.continue();
  });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await expect(
    page.getByRole("heading", { name: "Visão geral", exact: true }),
  ).toBeVisible();
  const font = await page.request.get("/fonts/inter-latin-variable.woff2");
  expect(font.status()).toBe(200);
  expect(
    await page.evaluate(async () =>
      (await document.fonts.load('14px "Inter Variable"')).every(
        (font) => font.status === "loaded",
      ),
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Atualizar dados" }).click();
  await expect(
    page.getByRole("button", { name: "Atualizar dados" }),
  ).toBeEnabled();
  expect(external).toEqual([]);
  expect(failures).toEqual([]);
  expect(errors).toEqual([]);
});

test("Fluent navigation and labeled filters remain usable after hydration", async ({
  page,
}) => {
  await trackNavigationMotion(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Navegação principal" })
    .getByRole("link", { name: "Catálogo", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Catálogo de serviços", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Buscar serviço" })
    .fill("Kubernetes");
  await expect(
    page.getByRole("table", { name: "Serviços do catálogo" }).getByRole("row"),
  ).toHaveCount(2);
  await expect(page.getByText("AmazonEKS", { exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Provedor" }).selectOption("AWS");
  await page
    .getByRole("navigation", { name: "Navegação principal" })
    .getByRole("link", { name: "Estimativas", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Ainda não há estimativas" }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Navegação principal" })
    .getByRole("link", { name: "Visão geral", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Visão geral", exact: true }),
  ).toBeVisible();
  expect(
    await page.locator("body style[data-make-styles-rehydration]").count(),
  ).toBe(0);
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => performance.getEntriesByName("navigation-motion").length,
    ),
  ).toBe(0);
});

test("keyboard, narrow layout and accessible Fluent composition", async ({
  page,
}) => {
  await trackNavigationMotion(page);
  await page.goto("/catalogo");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Ir para o conteúdo" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  // Tabster's internal focus sentinels intentionally redirect focus. Check actual
  // keyboard behavior below rather than treating these as application controls.
  const accessibility = await new AxeBuilder({ page })
    .exclude('[data-tabster-dummy][aria-hidden="true"][role="none"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("textbox", { name: "Buscar serviço" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.emulateMedia({ forcedColors: "active" });
  await page.getByRole("button", { name: "Expandir navegação" }).click();
  await expect(
    page.getByRole("navigation", { name: "Navegação principal" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Expandir navegação" }),
  ).toBeFocused();
  expect(
    await page.evaluate(
      () => performance.getEntriesByName("navigation-motion").length,
    ),
  ).toBe(0);
  await page.getByRole("textbox", { name: "Buscar serviço" }).fill("S3");
  await expect(page.getByText("AmazonS3", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 800 });
  await page.addStyleTag({
    content:
      "* { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } p { margin-bottom: 2em !important; }",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const tableRegion = page.getByRole("region", { name: "Lista de serviços" });
  await tableRegion.focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(() => tableRegion.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(0);
  for (const width of [641, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});

test("an unavailable API has a useful error state instead of fake data or HTTP 500", async ({
  page,
  request,
}) => {
  await request.post("http://127.0.0.1:3101/test/availability?enabled=false");
  try {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(
      page.getByText("API indisponível", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Não foi possível atualizar todos os dados.", {
        exact: false,
      }),
    ).toBeVisible();
  } finally {
    await request.post("http://127.0.0.1:3101/test/availability?enabled=true");
  }
});
