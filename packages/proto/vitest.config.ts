import { defineConfig } from "vitest/config";
import swc from "unplugin-swc";

export default defineConfig({
  plugins: [swc.vite()],
  test: {
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
    },
  },
});
