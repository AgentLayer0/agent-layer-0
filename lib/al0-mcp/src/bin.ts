#!/usr/bin/env node
import { startStdioServer } from "./server.js";

const apiKey = process.env["AL0_API_KEY"];

if (!apiKey) {
  process.stderr.write(
    "Error: AL0_API_KEY environment variable is required.\n" +
      "Obtain an API key from https://agentlayer0.xyz/dashboard\n"
  );
  process.exit(1);
}

startStdioServer(apiKey).catch((err: unknown) => {
  process.stderr.write(
    `Fatal error: ${err instanceof Error ? err.message : String(err)}\n`
  );
  process.exit(1);
});
