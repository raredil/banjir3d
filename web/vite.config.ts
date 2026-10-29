import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: { target: "es2022", chunkSizeWarningLimit: 1500 },
  worker: { format: "es" },
  server: { fs: { allow: [".."] } }, // data/ (methods text, roughness table) lives next to web/
});
