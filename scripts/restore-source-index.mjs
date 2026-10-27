import { copyFile } from "node:fs/promises";

// Vite always builds from the clean source template, even when GitHub Pages
// is configured to serve the generated index.html from main / (root).
await copyFile(
  new URL("../source/index.template.html", import.meta.url),
  new URL("../index.html", import.meta.url),
);
