import { readFile, writeFile, copyFile } from "node:fs/promises";
import { basename } from "node:path";

// Ship the application's stylesheet with the HTML itself. CSS no longer depends
// on a separate versioned URL that can temporarily return 404 after deployment.
const clientDir = new URL(`../dist/client/`, import.meta.url);
const indexUrl = new URL(`index.html`, clientDir);
const adminUrl = new URL(`admin.html`, clientDir);
const html = await readFile(indexUrl, `utf8`);
const linkPattern = /<link\b(?=[^>]*\brel=["']stylesheet["'])[^>]*\bhref=["']([^"']+\.css)["'][^>]*>/i;
const match = html.match(linkPattern);
if (!match) throw new Error(`Vite CSS stylesheet link not found in generated index.html`);
const cssFile = basename(new URL(match[1], `https://actionplan.invalid/`).pathname);
if (!/^index-[\w-]+\.css$/.test(cssFile)) {
  throw new Error(`Unexpected CSS bundle path: ${match[1]}`);
}
const css = await readFile(new URL(`assets/${cssFile}`, clientDir), `utf8`);
if (!css.trim()) throw new Error(`Generated CSS is empty`);
const safeCss = css.replace(/<\/style/gi, `<\\/style`);
const htmlWithInlineCss = html.replace(match[0], `<style data-actionplan-css="bundled">${safeCss}</style>`);
await Promise.all([
  writeFile(indexUrl, htmlWithInlineCss, `utf8`),
  writeFile(adminUrl, htmlWithInlineCss, `utf8`),
]);
await copyFile(new URL(`../setup.html`, import.meta.url), new URL(`setup.html`, clientDir));
await copyFile(new URL(`../firestore.rules`, import.meta.url), new URL(`firestore.rules.txt`, clientDir));
console.log(`Embedded ${cssFile} into index.html and admin.html (${css.length} CSS characters)`);

// Keep the historic lazy-loaded ExcelJS URL usable for browsers holding a cached
// previous app bundle. New builds use a stable URL for the workbook library.
const exceljsStable = new URL(`assets/exceljs.min.js`, clientDir);
const exceljsHistoric = new URL(`assets/exceljs.min-32YU9mBY.js`, clientDir);
const { stat } = await import("node:fs/promises");
if (!(await stat(exceljsStable).catch(() => null))) {
  throw new Error("Stable ExcelJS asset missing from build. Check Rollup chunk naming.");
}
await copyFile(exceljsStable, exceljsHistoric);
