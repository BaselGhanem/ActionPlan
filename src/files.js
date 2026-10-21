export const columns = [
  {
    key: `code`,
    label: `كود العميل`,
    aliases: [`code`, `hcp code`, `customer code`, `كود`, `كود العميل`],
  },
  {
    key: `name`,
    label: `اسم العميل`,
    aliases: [`name`, `hcp name`, `customer name`, `الاسم`, `اسم العميل`],
  },
  {
    key: `kind`,
    label: `نوع العميل`,
    aliases: [`type`, `customer type`, `نوع العميل`],
  },
  {
    key: `specialty`,
    label: `التخصص`,
    aliases: [`specialty`, `speciality`, `التخصص`],
  },
  { key: `area`, label: `المنطقة`, aliases: [`area`, `region`, `المنطقة`] },
  {
    key: `classification`,
    label: `التصنيف`,
    aliases: [`classification`, `class`, `التصنيف`],
  },
];
export function delimited(text, separator) {
  const rows = [];
  let row = [],
    cell = ``,
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === `"`) {
      if (quoted && text[i + 1] === `"`) {
        cell += `"`;
        i++;
      } else quoted = !quoted;
    } else if (c === separator && !quoted) {
      row.push(cell);
      cell = ``;
    } else if ((c === `\n` || c === `\r`) && !quoted) {
      if (c === `\r` && text[i + 1] === `\n`) i++;
      row.push(cell);
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
      cell = ``;
    } else cell += c;
  }
  if (quoted) throw new Error(`علامات الاقتباس في الملف غير مكتملة`);
  row.push(cell);
  if (row.some((v) => v.trim())) rows.push(row);
  return rows;
}
const textValue = (v) =>
  v?.text ??
  v?.result ??
  (v?.richText ? v.richText.map((t) => t.text).join(``) : (v ?? ``));
export async function readFile(file) {
  if (file.name.toLowerCase().endsWith(`.xlsx`)) {
    const { default: ExcelJS } = await import(`exceljs`);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    const ws = wb.worksheets[0];
    if (!ws) throw new Error(`لا توجد ورقة بيانات`);
    const rows = [];
    ws.eachRow((r) =>
      rows.push(r.values.slice(1).map((v) => String(textValue(v)))),
    );
    return rows;
  }
  if (!file.name.toLowerCase().endsWith(`.csv`))
    throw new Error(`ارفع XLSX أو CSV`);
  const text = (await file.text()).replace(/^\uFEFF/, ``);
  const first = text.split(/\r?\n/)[0];
  return delimited(
    text,
    first.includes(`\t`)
      ? `\t`
      : first.split(`;`).length > first.split(`,`).length
        ? `;`
        : `,`,
  );
}
export const autoMap = (headers) =>
  Object.fromEntries(
    columns.map((c) => [
      c.key,
      headers.findIndex((h) =>
        c.aliases.includes(String(h).trim().toLowerCase()),
      ),
    ]),
  );
export async function buildWorkbook(data) {
  const { default: ExcelJS } = await import(`exceljs`);
  const wb = new ExcelJS.Workbook();
  wb.creator = `Dar Al Dawa`;
  wb.created = new Date();
  const sheets = [
    [
      `ملخص الفرق`,
      [`الفريق`, `الميزانية USD`, `المحجوز والمصروف USD`, `المتاح USD`],
      data.teams.map((t) => [
        t.name,
        t.budget / 100,
        t.used / 100,
        (t.budget - t.used) / 100,
      ]),
    ],
    [
      `العملاء`,
      [`الكود`, `الاسم`, `النوع`, `التخصص`, `المنطقة`],
      data.customers.map((c) => [c.code, c.name, c.kind, c.specialty, c.area]),
    ],
    [
      `ارتباط العملاء بالفرق`,
      [`كود العميل`, `العميل`, `الفريق`, `التصنيف`],
      data.rosters.flatMap((r) =>
        r.rows.map((c) => [
          c.code,
          data.customers.find((x) => x.code === c.code)?.name || c.name,
          data.teams.find((t) => t.id === r.teamId)?.name,
          c.classification,
        ]),
      ),
    ],
    [
      `الأنشطة`,
      [
        `رقم النشاط`,
        `النوع`,
        `الحالة`,
        `التاريخ`,
        `المخطط USD`,
        `الفعلي USD`,
        `الملاحظات`,
      ],
      data.activities.map((a) => [
        a.id,
        a.type,
        { planned: `مخطط`, executed: `منفذ`, cancelled: `ملغي` }[a.status],
        a.date || `غير مجدول`,
        a.total / 100,
        a.actual === null ? null : a.actual / 100,
        a.notes,
      ]),
    ],
    [
      `التوزيعات`,
      [
        `رقم النشاط`,
        `كود العميل`,
        `العميل`,
        `الفريق`,
        `المخطط USD`,
        `الفعلي USD`,
        `الحالة`,
      ],
      data.activities.flatMap((a) =>
        a.clients.flatMap((c) =>
          c.shares.map((s) => [
            a.id,
            c.code,
            c.name,
            s.teamName || data.teams.find((t) => t.id === s.teamId)?.name,
            s.amount / 100,
            s.actual === null ? null : s.actual / 100,
            { planned: `مخطط`, executed: `منفذ`, cancelled: `ملغي` }[a.status],
          ]),
        ),
      ),
    ],
  ];
  for (const [name, headers, rows] of sheets) {
    const ws = wb.addWorksheet(name, {
      views: [{ rightToLeft: true, state: `frozen`, ySplit: 4 }],
    });
    ws.mergeCells(1, 1, 1, headers.length);
    ws.getCell(1, 1).value = `دار الدواء | خطة الأنشطة الطبية 2027`;
    ws.getRow(1).height = 36;
    ws.getCell(1, 1).font = {
      name: `Arial`,
      size: 18,
      bold: true,
      color: { argb: `FFFFFFFF` },
    };
    ws.getCell(1, 1).fill = {
      type: `pattern`,
      pattern: `solid`,
      fgColor: { argb: `FF0B457F` },
    };
    ws.mergeCells(2, 1, 2, headers.length);
    ws.getCell(2, 1).value =
      `USD • تاريخ التصدير ${new Date().toLocaleDateString(`ar-JO`)} • ${rows.length} سجل`;
    ws.getRow(2).height = 25;
    ws.getRow(4).values = headers;
    ws.getRow(4).height = 28;
    ws.getRow(4).eachCell((c) => {
      c.fill = {
        type: `pattern`,
        pattern: `solid`,
        fgColor: { argb: `FFF07D00` },
      };
      c.font = { name: `Arial`, bold: true, color: { argb: `FFFFFFFF` } };
    });
    rows.forEach((row, i) => {
      const r = ws.addRow(row);
      r.height = 24;
      r.eachCell((c) => {
        c.font = { name: `Arial`, size: 11 };
        c.alignment = {
          vertical: `middle`,
          horizontal: typeof c.value === `number` ? `right` : `left`,
        };
        if (i % 2 === 0)
          c.fill = {
            type: `pattern`,
            pattern: `solid`,
            fgColor: { argb: `FFF1F5F9` },
          };
      });
    });
    headers.forEach((h, i) => {
      ws.getColumn(i + 1).width = Math.min(
        48,
        Math.max(
          20,
          ...rows.slice(0, 200).map((r) => String(r[i] ?? ``).length + 3),
        ),
      );
      if (h.includes(`USD`))
        ws.getColumn(i + 1).numFmt = `#,##0.00;[Red](#,##0.00)`;
    });
    ws.autoFilter = {
      from: { row: 4, column: 1 },
      to: { row: Math.max(4, rows.length + 4), column: headers.length },
    };
    ws.pageSetup = {
      orientation: `landscape`,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    };
  }
  return wb;
}
export async function downloadWorkbook(data) {
  const wb = await buildWorkbook(data);
  const blob = new Blob([await wb.xlsx.writeBuffer()], {
    type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`,
  });
  const url = URL.createObjectURL(blob),
    a = document.createElement(`a`);
  a.href = url;
  a.download = `Dar_Al_Dawa_ActionPlan_2027.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
