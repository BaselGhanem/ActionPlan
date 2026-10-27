import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: process.env.GITHUB_PAGES === `true` ? `/ActionPlan/` : `/`,
  build: {
    outDir: "dist/client",
    rollupOptions: {
      output: {
        chunkFileNames: (chunk) => /exceljs/i.test(chunk.name) ? "assets/exceljs.min.js" : "assets/[name]-[hash].js",
      },
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [react()],
});
