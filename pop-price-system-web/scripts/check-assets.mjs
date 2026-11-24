import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(directory, entry.name))
      : [join(directory, entry.name)],
  );
}

for (const file of files("src").filter((path) => /\.(tsx?|css)$/.test(path))) {
  const content = readFileSync(file, "utf8");
  assert(!/next\/font\/google/.test(content), `${file}: remote font loader`);
  assert(
    !/(?:url\(|@import\s+)["']?(?:https?:)?\/\//.test(content),
    `${file}: remote CSS asset`,
  );
  assert(
    !/(?:src|poster)=["'](?:https?:)?\/\//.test(content),
    `${file}: remote image or script`,
  );
}
for (const file of files("public").filter((path) => path.endsWith(".svg"))) {
  const content = readFileSync(file, "utf8");
  assert(
    !/<(?:script|foreignObject)\b/i.test(content),
    `${file}: active SVG content`,
  );
  assert(!/\bon\w+=/i.test(content), `${file}: event handler`);
  assert(
    !/(?:href|src)=["'](?:https?:)?\/\//i.test(content),
    `${file}: external reference`,
  );
}
for (const file of files("public/architecture-icons").filter((path) =>
  path.endsWith("manifest.json"),
)) {
  const manifest = JSON.parse(readFileSync(file, "utf8"));
  const identities = new Set();
  assert.equal(manifest.schemaVersion, 1, `${file}: unsupported schema`);
  const categories = new Map(
    (manifest.categories || []).map((category) => [category.code, category]),
  );
  assert.equal(
    categories.size,
    (manifest.categories || []).length,
    `${file}: duplicate category`,
  );
  for (const category of categories.values()) {
    assert.equal(category.provider, manifest.provider);
    assert.equal(category.release, manifest.release);
    assert(
      category.code && category.originalName && category.name,
      `${file}: incomplete category`,
    );
  }
  for (const icon of manifest.icons) {
    const identity = `${icon.provider}/${icon.key}/${icon.release}`;
    assert(!identities.has(identity), `${file}: duplicate ${identity}`);
    identities.add(identity);
    assert.equal(icon.provider, manifest.provider);
    assert.equal(icon.release, manifest.release);
    assert(
      categories.has(icon.category),
      `${file}: icon has no registered category`,
    );
    if (manifest.provider === "AWS") {
      const folder = icon.sourcePath.split("/")[1];
      const resourceCategories = {
        IoT: "Internet-of-Things",
        "Management-Governance": "Management-Tools",
      };
      const resourceFolder = folder.replace(/^Res_/, "");
      const sourceCategory =
        icon.kind === "SERVICE"
          ? folder.replace(/^Arch_/, "")
          : icon.kind === "RESOURCE"
            ? resourceCategories[resourceFolder] || resourceFolder
            : icon.kind === "CATEGORY"
              ? icon.sourcePath
                  .split("/")
                  .at(-1)
                  .replace(/^Arch-Category_/, "")
                  .replace(/_64\.svg$/, "")
              : "General-Icons";
      assert.equal(
        icon.category,
        sourceCategory,
        `${file}: icon category differs from official source directory`,
      );
    }
    assert(
      /^\/architecture-icons\/[a-z0-9-]+\/\d{4}-\d{2}-\d{2}\/[a-z0-9-]+\.svg$/.test(
        icon.assetPath,
      ),
      `${file}: invalid asset path`,
    );
    const asset = join("public", icon.assetPath.slice(1));
    assert(existsSync(asset), `Missing ${asset}`);
    assert.equal(
      createHash("sha256").update(readFileSync(asset)).digest("hex"),
      icon.sha256,
      `${asset}: hash mismatch`,
    );
    if (existsSync(".next/standalone/server.js")) {
      const distributed = join(".next/standalone", asset);
      assert(existsSync(distributed), `Missing standalone resource ${asset}`);
      assert.equal(
        createHash("sha256").update(readFileSync(distributed)).digest("hex"),
        icon.sha256,
        `${asset}: standalone hash mismatch`,
      );
    }
  }
}
for (const file of [
  "public/brand/porto-logo.svg",
  "public/fonts/inter-latin-variable.woff2",
  "public/fonts/Inter-LICENSE.txt",
])
  assert(existsSync(file), `Missing ${file}`);
if (existsSync(".next/standalone/server.js")) {
  for (const file of [
    "public/brand/porto-logo.svg",
    "public/fonts/inter-latin-variable.woff2",
    ".next/static",
  ])
    assert(
      existsSync(join(".next/standalone", file)),
      `Missing standalone resource ${file}`,
    );
}
console.log(
  "Static resources are local; fonts and official logo are present; standalone assets verified when built.",
);
