import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const css=readFileSync(new URL("../src/styles.css",import.meta.url),"utf8");
test("dark palette explicitly covers high-contrast expense summary cards and totals",()=>{
 assert.ok(css.includes('html[data-theme="dark"] :is('));
 assert.ok(css.includes(".incoming-summary>div"));
 assert.match(css,/\.incoming-summary b,\.actual-stats b/);
 assert.match(css,/color:#eaf5ff!important/);
 assert.match(css,/background:var\(--surface\)!important/);
});
test("dark mode covers interactive and semantic states across pages",()=>{
 for(const selector of [".standalone-status-filters",".activity-cost-item",".activity-client-item",".incoming-disclaimer",".table-wrap tbody tr:nth-child(even)",'input[type="checkbox"]:checked',".report-active-filter-chip"]){
   assert.ok(css.includes(selector),`Missing dark-mode coverage: ${selector}`);
 }
});
test("English navigation allows long labels to wrap without clipping",()=>{
 assert.match(css,/html\[data-lang="en"\] \.sidebar nav button\{/);
 assert.match(css,/white-space:normal/);
});
