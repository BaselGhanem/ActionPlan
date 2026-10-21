import { copyFile } from "node:fs/promises";
await copyFile(
  new URL(`../dist/client/index.html`, import.meta.url),
  new URL(`../dist/client/admin.html`, import.meta.url),
);
