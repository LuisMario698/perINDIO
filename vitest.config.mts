import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    // Todos los archivos comparten la base de pruebas: se ejecutan uno a la vez.
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
