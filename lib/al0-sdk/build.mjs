import { build } from "esbuild";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const contractsSrc = resolve(__dirname, "../al0-contracts/src/index.ts");

const shared = {
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  external: ["algosdk", "zod", "zod/v4"],
  alias: {
    "@workspace/al0-contracts": contractsSrc,
  },
};

await build({ ...shared, format: "esm", outfile: "dist/index.mjs" });
await build({ ...shared, format: "cjs", outfile: "dist/index.cjs" });

console.log("⚡ SDK build complete");
