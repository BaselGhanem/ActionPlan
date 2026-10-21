import { columns } from "./files.js";

const signature = `DAD_ACTIONPLAN_ROSTER_2027_V1`;
const worksheetName = `العملاء`;
const metaSheet = `_ActionPlan`;
const headerRow = 5;
const maxCustomers = 10000;
const widths = [23, 43, 23, 29, 29, 21];

const textOf = (value) => {
  if (value == null) return ``;
  if (typeof value === `object`) {
    if (value.text != null) return String(value.text);
    if (value.richText) return value.richText.map((v) => v.text).join(``);
    if (value.result != null) return String(value.result);
  }
  return String(value);
};
const fill = (argb) => ({
  type: `pattern`,
  pattern: `solid`,
  fgColor: { argb },
});
const makeCell = (cell, color, bold = false) => {
  cell.fill = fill(color);
  cell.font = {
    name: `Arial`,
    size: 11,
    bold,
    color: { argb: bold ? `FFFFFFFF` : `FF17324D` },
  };
  cell.alignment = { vertical: `middle`, horizontal: `right` };
};
const fileName = (team) => {
  const safeName = String(team.name)
    .replace(/[\\/:*?"<>|]/g, `-`)
    .trim()
    .replace(/\s+/g, `_`)
    .slice(0, 55);
  return `ActionPlan_Customers_${safeName || `Team`}_2027.xlsx`;
};

export async function buildRosterTemplate(team, customers = []) {
  if (!team?.id || !team?.name)
    throw new Error(`اختر الفريق قبل تنزيل قالب العملاء`);
  if (customers.length > maxCustomers)
    throw new Error(`قائمة الفريق أكبر من الحد المسموح به للقالب (10,000 عميل)`);

  const { default: ExcelJS } = await import(`exceljs`);
  const wb = new ExcelJS.Workbook();
  wb.creator = `Dar Al Dawa - ActionPlan`;
  wb.title = `ActionPlan 2027 | Customer Roster Template`;
  const ws = wb.addWorksheet(worksheetName, {
    views: [{ state: `frozen`, ySplit: headerRow, rightToLeft: true }],
  });
  ws.properties.defaultRowHeight = 23;
  ws.mergeCells(`A1:F1`);
  ws.getCell(`A1`).value = `دار الدواء | قالب عملاء الفريق - خطة 2027`;
  ws.getRow(1).height = 43;
  ws.getCell(`A1`).font = { name: `Arial`, size: 19, bold: true, color: { argb: `FFFFFFFF` } };
  ws.getCell(`A1`).fill = fill(`FF0B457F`);
  ws.getCell(`A1`).alignment = { vertical: `middle`, horizontal: `right` };

  ws.mergeCells(`A2:F2`);
  ws.getCell(`A2`).value = `الفريق: ${team.name} | 2027 | ${customers.length ? `قائمة العملاء الحالية قابلة للتعديل` : `نموذج إدخال جديد`}`;
  ws.getRow(2).height = 33;
  ws.getCell(`A2`).font = { name: `Arial`, size: 12, bold: true, color: { argb: `FF0B457F` } };
  ws.getCell(`A2`).fill = fill(`FFEAF3FA`);
  ws.getCell(`A2`).alignment = { vertical: `middle`, horizontal: `right` };

  ws.mergeCells(`A3:F3`);
  ws.getCell(`A3`).value = `عبئ العملاء بدءا من الصف 6 | كود العميل واسمه إلزاميان | اترك الأعمدة والعناوين كما هي`;
  ws.getRow(3).height = 30;
  ws.getCell(`A3`).font = { name: `Arial`, size: 11, color: { argb: `FF42556A` } };
  ws.getCell(`A3`).alignment = { vertical: `middle`, horizontal: `right` };

  ws.mergeCells(`A4:F4`);
  ws.getCell(`A4`).value = `هام: كود العميل نص للحفاظ على الأصفار الأولى. استيراد الملف يستبدل القائمة الكاملة لهذا الفريق فقط.`;
  ws.getRow(4).height = 29;
  ws.getCell(`A4`).font = { name: `Arial`, size: 11, bold: true, color: { argb: `FF98510D` } };
  ws.getCell(`A4`).fill = fill(`FFFFF5E8`);
  ws.getCell(`A4`).alignment = { vertical: `middle`, horizontal: `right` };

  const header = ws.getRow(headerRow);
  header.values = columns.map((c) => c.label);
  header.height = 32;
  columns.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    makeCell(cell, i < 2 ? `FFF07D00` : `FF0B457F`, true);
    ws.getColumn(i + 1).width = widths[i];
    ws.getColumn(i + 1).numFmt = `@`;
  });

  for (let i = 0; i < Math.max(200, customers.length); i++) {
    const row = ws.getRow(headerRow + 1 + i);
    row.height = 23;
    const record = customers[i];
    columns.forEach((column, index) => {
      const cell = row.getCell(index + 1);
      makeCell(cell, i % 2 === 0 ? `FFF5F8FC` : `FFFFFFFF`);
      cell.numFmt = `@`;
      if (record) cell.value = String(record[column.key] ?? ``);
    });
  }
  ws.autoFilter = {
    from: { row: headerRow, column: 1 },
    to: { row: Math.max(headerRow + 1, headerRow + customers.length), column: columns.length },
  };
  ws.dataValidations.add(`A6:A10005`, {
    type: `textLength`,
    operator: `between`,
    formulae: [1, 100],
    allowBlank: true,
    showErrorMessage: true,
    errorTitle: `كود العميل`,
    error: `اكتب كود العميل كنص بطول لا يزيد عن 100 حرف`,
  });
  ws.pageSetup = { orientation: `landscape`, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  const meta = wb.addWorksheet(metaSheet);
  meta.getCell(`A1`).value = signature;
  meta.getCell(`A2`).value = String(team.id);
  meta.getCell(`A3`).value = String(team.name);
  meta.state = `veryHidden`;
  return wb;
}

export async function downloadRosterTemplate(team, customers = []) {
  const wb = await buildRosterTemplate(team, customers);
  const blob = new Blob([await wb.xlsx.writeBuffer()], {
    type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`,
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement(`a`);
  link.href = url;
  link.download = fileName(team);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export async function readRosterTemplate(file, teamId) {
  if (!teamId) throw new Error(`اختر الفريق المستهدف أولا`);
  if (!file?.name?.toLowerCase().endsWith(`.xlsx`))
    throw new Error(`يجب رفع قالب العملاء بصيغة Excel (.xlsx) فقط`);

  const { default: ExcelJS } = await import(`exceljs`);
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(await file.arrayBuffer());
  } catch {
    throw new Error(`تعذر فتح ملف Excel. نزل القالب من النظام ثم أعد تعبئته`);
  }
  const meta = wb.getWorksheet(metaSheet);
  if (!meta || textOf(meta.getCell(`A1`).value) !== signature)
    throw new Error(`هذا الملف ليس قالب عملاء ActionPlan المعتمد. نزّل القالب من النظام`);
  if (textOf(meta.getCell(`A2`).value) !== String(teamId))
    throw new Error(`القالب خاص بفريق آخر. اختر الفريق الصحيح أو نزّل قالب الفريق المختار`);
  const ws = wb.getWorksheet(worksheetName);
  if (!ws || columns.some((c, i) => textOf(ws.getRow(headerRow).getCell(i + 1).value).trim() !== c.label))
    throw new Error(`تغيرت عناوين أو ورقة العملاء. استخدم القالب كما تم تنزيله`);

  const rows = [];
  const issues = [];
  const seen = new Set();
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= headerRow) return;
    const values = columns.map((c, i) => textOf(row.getCell(i + 1).value).trim());
    if (values.every((v) => !v)) return;
    if (rows.length >= maxCustomers)
      throw new Error(`الحد الأقصى لملف واحد هو 10,000 عميل`);
    const record = Object.fromEntries(columns.map((c, i) => [c.key, values[i]]));
    record.rowNumber = rowNumber;
    rows.push(record);
    if (!record.code || !record.name)
      issues.push(`الصف ${rowNumber}: كود العميل واسمه إلزاميان`);
    if (record.code.includes(`/`))
      issues.push(`الصف ${rowNumber}: لا يمكن استخدام / داخل كود العميل`);
    if (columns.some((c) => record[c.key].length > (c.key === `code` ? 100 : 200)))
      issues.push(`الصف ${rowNumber}: إحدى القيم أطول من الحد المسموح`);
    const key = record.code;
    if (key && seen.has(key))
      issues.push(`الصف ${rowNumber}: كود العميل ${key} مكرر`);
    seen.add(key);
    if (typeof row.getCell(1).value === `number`)
      issues.push(`الصف ${rowNumber}: كود العميل رقمي. اجعله نصا للحفاظ على الأصفار الأولى`);
    if (columns.some((c, i) => {
      const v = row.getCell(i + 1).value;
      return v && typeof v === `object` && (`formula` in v || `sharedFormula` in v);
    })) issues.push(`الصف ${rowNumber}: لا تستخدم معادلات داخل بيانات العملاء`);
  });
  if (!rows.length) throw new Error(`القالب فارغ. أدخل عميلا واحدا على الأقل من الصف 6`);
  return { rows, issues };
}
