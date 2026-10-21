import { defineConfig } from "vitest/config";

export default defineConfig({
  // Relative asset paths so the build works from GitHub Pages' /<repo>/ subpath.
  base: "./",
  // data/ and patterns/ are bundled on purpose so the wheel works offline in OBS.
  build: { chunkSizeWarningLimit: 2000 },
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/engine/**/*.ts"],
      thresholds: { statements: 90, branches: 90, functions: 90, lines: 90 },
    },
  },
});
