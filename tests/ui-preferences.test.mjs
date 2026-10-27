import test from "node:test";
import assert from "node:assert/strict";
import {translateValue} from "../src/ui-preferences.js";
test("core navigation and actions translate into English",()=>{
 assert.equal(translateValue("لوحة التحكم"),"Dashboard");
 assert.equal(translateValue("حذف"),"Delete");
 assert.equal(translateValue("التقارير"),"Reports");
 assert.equal(translateValue("الميزانية السنوية"),"Annual Budget");
 assert.equal(translateValue("  اسم العميل  "),"  Customer Name  ");
});
test("dynamic report counters translate while business records remain unchanged",()=>{
 assert.equal(translateValue("12 نشاط"),"12 activities");
 assert.equal(translateValue("3 نشاط مخطط"),"3 planned activities");
 assert.equal(translateValue("المختارون فقط (7)"),"Selected Only (7)");
 assert.equal(translateValue("د. أحمد المصري"),"د. أحمد المصري");
 assert.equal(translateValue("Azord"),"Azord");
});

test("English labels cover the screenshot: incoming expenses, counters and customer forms",()=>{
 assert.equal(translateValue("54 نشاط"),"54 activities");
 assert.equal(translateValue("نشاط"),"Activities");
 assert.equal(translateValue("اختر التصنيف"),"Select Classification");
 assert.equal(translateValue("مخطط حمّلته الفرق الأخرى"),"Planned by Other Teams");
 assert.equal(translateValue("المؤثر على الميزانية حالياً"),"Currently Impacting Budget");
 assert.equal(translateValue("غير محدد"),"Not Specified");
 assert.equal(translateValue("الفريق المصدر:"),"Source Team:");
});
