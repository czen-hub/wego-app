import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    // Use jsdom so tests can render HTML/React components
    environment: "jsdom",
    // Makes describe/it/expect available globally (no need to import them)
    globals: true,
    // Runs this file before every test file
    setupFiles: ["./client/test/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
    },
  },
});
