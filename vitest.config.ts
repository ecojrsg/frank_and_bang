// @Author: Jonathan Serna
// @Date:   2026-11-23 20:50:15
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 20:50:15

/**
 * Vitest unit test runner configuration.
 */

import { resolve } from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
