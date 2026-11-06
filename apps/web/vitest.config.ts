import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  test: {
    environment: "jsdom",
    execArgv: ["--no-experimental-webstorage"],
    environmentOptions: { jsdom: { url: "http://localhost:3000" } },
    globals: true,
    setupFiles: ["./src/test/setup.ts"]
  }
});
