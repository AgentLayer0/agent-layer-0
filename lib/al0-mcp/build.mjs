import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import { rm, chmod } from "node:fs/promises";

const libDir = path.dirname(fileURLToPath(import.meta.url));

async function buildAll() {
  const distDir = path.resolve(libDir, "dist");
  await rm(distDir, { recursive: true, force: true });

  await esbuild({
    entryPoints: [path.resolve(libDir, "src/bin.ts")],
    platform: "node",
    bundle: true,
    format: "esm",
    outfile: path.resolve(distDir, "bin.js"),
    logLevel: "info",
    external: ["*.node"],
    sourcemap: "linked",
    banner: {
      js: "#!/usr/bin/env node\nimport { createRequire as __cr } from 'node:module'; globalThis.require = __cr(import.meta.url);",
    },
  });
}

buildAll()
  .then(() => chmod(path.resolve(libDir, "dist/bin.js"), 0o755))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
