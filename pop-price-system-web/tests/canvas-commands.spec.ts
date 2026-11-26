import { expect, test } from "@playwright/test";
import { specification } from "./fixtures/structures";

const api =
  "http://127.0.0.1:3101/pop-price-system-service/api/v1/architecture-models";

test("command bar organizes connected, cyclic and isolated components and persists only positions", async ({
  page,
  request,
}) => {
  await request.post("http://127.0.0.1:3101/test/reset?components=2");
  const graph = {
    nodes: Array.from({ length: 6 }, (_, index) => ({
      id: `00000000-0000-4000-8000-00000000000${index}`,
      name: `Recurso ${index + 1}`,
      x: 100,
      y: 100,
      rateId: null,
      provider: "AWS",
      serviceCode: "AmazonEC2",
      category: "Compute",
      accountCode: "principal",
      quantity: "1",
      consumption: "1",
      consumptionUnit: "Hrs",
      period: "HOUR",
      retentionDays: null,
      availabilityZone: null,
    })),
    edges: [
      [0, 1],
      [1, 2],
      [2, 1],
      [2, 3],
    ].map(([source, target], index) => ({
      id: `10000000-0000-4000-8000-00000000000${index}`,
      source: `00000000-0000-4000-8000-00000000000${source}`,
      target: `00000000-0000-4000-8000-00000000000${target}`,
      monthlyGb: "5",
      direction: "INTERNAL",
      connectivity: "DIRECT",
      charges: [],
    })),
  };
  const response = await request.post(api, {
    data: {
      name: "Organização",
      hoursPerMonth: 720,
      revision: 0,
      specification: specification(),
      graph,
    },
  });
  const { id } = await response.json();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/canvas?model=${id}`);
  const toolbar = page.getByRole("toolbar", { name: "Comandos da estrutura" });
  await toolbar
    .getByRole("button", { name: "Organizar componentes", exact: true })
    .click();
  await expect(
    page.getByText(
      "Componentes organizados. Salve a estrutura para manter o desenho.",
      { exact: true },
    ),
  ).toBeVisible();
  await toolbar
    .getByRole("button", { name: "Salvar estrutura", exact: true })
    .click();
  await expect(
    page.getByText("Estrutura salva.", { exact: true }),
  ).toBeVisible();
  const saved = await (await request.get(`${api}/${id}`)).json();
  expect(saved.graph.edges).toEqual(graph.edges);
  for (let i = 0; i < graph.nodes.length; i++) {
    const { x, y, ...content } = saved.graph.nodes[i];
    const { x: originalX, y: originalY, ...original } = graph.nodes[i];
    expect(content).toEqual(original);
    expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
    for (const other of saved.graph.nodes.slice(i + 1)) {
      expect(Math.abs(x - other.x) >= 240 || Math.abs(y - other.y) >= 128).toBe(
        true,
      );
    }
  }
  expect(saved.graph.nodes[0].x).toBeLessThan(saved.graph.nodes[1].x);
  expect(saved.graph.nodes[1].x).toBeLessThan(saved.graph.nodes[3].x);
  await page.reload();
  await expect(
    toolbar.getByRole("button", { name: "Organizar componentes", exact: true }),
  ).toBeEnabled();
  await page.screenshot({ path: "test-results/canvas-command-bar.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await toolbar
    .getByRole("button", { name: "Mais ações", exact: true })
    .click();
  await expect(
    page.getByRole("menuitem", { name: "Organizar componentes", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("menuitem", { name: "Organizar componentes", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/canvas-command-bar-mobile.png" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("group", { name: "Recurso 1", exact: true }).click();
  await toolbar
    .getByRole("button", { name: "Excluir seleção", exact: true })
    .click();
  await toolbar
    .getByRole("button", { name: "Salvar estrutura", exact: true })
    .click();
  await expect(
    page.getByText("Estrutura salva.", { exact: true }),
  ).toBeVisible();
  const afterDelete = await (await request.get(`${api}/${id}`)).json();
  expect(afterDelete.graph.nodes).toHaveLength(5);
  expect(afterDelete.graph.edges).toHaveLength(3);
  await request.post(`${api}/${id}/publish`, {
    data: { revision: afterDelete.revision },
  });
  await page.reload();
  await expect(
    toolbar.getByRole("button", { name: "Organizar componentes", exact: true }),
  ).toBeDisabled();
  await expect(
    toolbar.getByRole("button", { name: "Excluir seleção", exact: true }),
  ).toBeDisabled();
});
