import { copyFile } from "node:fs/promises";
await copyFile(
  new URL(`../dist/client/index.html`, import.meta.url),
  new URL(`../dist/client/admin.html`, import.meta.url),
);
await copyFile(new URL(`../setup.html`,import.meta.url),new URL(`../dist/client/setup.html`,import.meta.url));
await copyFile(new URL(`../firestore.rules`,import.meta.url),new URL(`../dist/client/firestore.rules.txt`,import.meta.url));
