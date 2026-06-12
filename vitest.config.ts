import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Test runner for the five security/contract suites only (decision D10) —
// no broader test infrastructure. `@/` mirrors the tsconfig path alias.
// (import.meta.url instead of __dirname — this config file is ESM.)
export default defineConfig({
  test: { include: ["tests/**/*.test.ts"] },
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
});
