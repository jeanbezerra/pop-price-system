type LayoutNode = { id: string; position: { x: number; y: number } };
type LayoutEdge = { source: string; target: string };

/** Collapse cycles before assigning columns, so feedback loops remain finite. */
export function organizeComponents<T extends LayoutNode>(
  nodes: T[],
  edges: LayoutEdge[],
): T[] {
  const adjacency = new Map(nodes.map((node) => [node.id, [] as string[]]));
  for (const edge of edges) {
    if (adjacency.has(edge.target))
      adjacency.get(edge.source)?.push(edge.target);
  }
  let nextIndex = 0;
  const indices = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const active = new Set<string>();
  const groups: string[][] = [];
  function visit(id: string) {
    indices.set(id, nextIndex);
    low.set(id, nextIndex++);
    stack.push(id);
    active.add(id);
    for (const target of adjacency.get(id)!) {
      if (!indices.has(target)) {
        visit(target);
        low.set(id, Math.min(low.get(id)!, low.get(target)!));
      } else if (active.has(target)) {
        low.set(id, Math.min(low.get(id)!, indices.get(target)!));
      }
    }
    if (low.get(id) === indices.get(id)) {
      const group: string[] = [];
      let member: string;
      do {
        member = stack.pop()!;
        active.delete(member);
        group.push(member);
      } while (member !== id);
      groups.push(group);
    }
  }
  for (const node of nodes) if (!indices.has(node.id)) visit(node.id);
  const owner = new Map(
    groups.flatMap((group, index) => group.map((id) => [id, index] as const)),
  );
  const outgoing = groups.map(() => new Set<number>());
  const indegrees = groups.map(() => 0);
  const ranks = groups.map(() => 0);
  const linked = new Set<string>();
  for (const edge of edges) {
    const source = owner.get(edge.source),
      target = owner.get(edge.target);
    if (source === undefined || target === undefined) continue;
    linked.add(edge.source);
    linked.add(edge.target);
    if (source !== target && !outgoing[source].has(target)) {
      outgoing[source].add(target);
      indegrees[target]++;
    }
  }
  const queue = indegrees.flatMap((degree, index) =>
    degree === 0 ? [index] : [],
  );
  for (let i = 0; i < queue.length; i++) {
    const source = queue[i];
    for (const target of outgoing[source]) {
      ranks[target] = Math.max(ranks[target], ranks[source] + 1);
      if (--indegrees[target] === 0) queue.push(target);
    }
  }
  const columns = new Map<number, T[]>();
  for (const node of nodes) {
    if (!linked.has(node.id)) continue;
    const rank = ranks[owner.get(node.id)!];
    columns.set(rank, [...(columns.get(rank) || []), node]);
  }
  const positions = new Map<string, { x: number; y: number }>();
  const tallest = Math.max(
    0,
    ...[...columns.values()].map((column) => column.length),
  );
  for (const [rank, column] of columns) {
    column.forEach((node, row) =>
      positions.set(node.id, {
        x: rank * 336,
        y: ((tallest - column.length) / 2 + row) * 192,
      }),
    );
  }
  const isolated = nodes.filter((node) => !linked.has(node.id));
  const width = Math.min(4, Math.ceil(Math.sqrt(isolated.length)));
  isolated.forEach((node, index) =>
    positions.set(node.id, {
      x: (index % width) * 336,
      y:
        (columns.size ? tallest * 192 + 64 : 0) +
        Math.floor(index / width) * 192,
    }),
  );
  return nodes.map((node) => ({ ...node, position: positions.get(node.id)! }));
}
