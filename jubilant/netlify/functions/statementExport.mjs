import ExcelJS from "exceljs";
import path from "path";
import { existsSync } from "fs";

const TEMPLATE_FILE = "AFFAN METALS-FINAL WORKINGS- 05-02-2026.xlsx";

const findHeader = (sheet) => {
  let headerRow = null;
  sheet.eachRow((row) => {
    const values = row.values.map((v) => String(v || "").toLowerCase());
    if (values.some((v) => v.includes("date")) && values.some((v) => v.includes("narration") || v.includes("particular"))) {
      headerRow = row;
    }
  });
  return headerRow;
};

const findColumnIndexes = (headerRow) => {
  const indexes = {};
  headerRow.eachCell((cell, col) => {
    const label = String(cell.value || "").toLowerCase();
    if (label.includes("date")) indexes.date = col;
    if (label.includes("narration") || label.includes("particular") || label.includes("remarks")) indexes.narration = col;
    if (label.includes("debit") || label.includes("withdrawal") || label.includes("dr")) indexes.debit = col;
    if (label.includes("credit") || label.includes("deposit") || label.includes("cr")) indexes.credit = col;
    if (label.includes("balance")) indexes.balance = col;
  });
  return indexes;
};

const applyRowStyle = (targetRow, templateRow) => {
  templateRow.eachCell({ includeEmpty: true }, (cell, col) => {
    const tCell = targetRow.getCell(col);
    tCell.style = { ...cell.style };
    tCell.numFmt = cell.numFmt;
    tCell.border = cell.border;
    tCell.fill = cell.fill;
    tCell.font = cell.font;
    tCell.alignment = cell.alignment;
  });
};

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }
  try {
    const payload = JSON.parse(event.body || "{}");
    const report = payload.report;
    if (!report?.transactions?.length) {
      return { statusCode: 400, body: "Missing transactions." };
    }

    const candidates = [
      path.join(process.cwd(), "fixtures", TEMPLATE_FILE),
      path.join(process.cwd(), TEMPLATE_FILE),
    ];
    const templatePath = candidates.find((p) => existsSync(p));
    if (!templatePath) {
      return { statusCode: 500, body: "Template XLSX not bundled. Check Netlify included_files." };
    }
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);

    const xnsSheet =
      workbook.worksheets.find((s) => String(s.name || "").toUpperCase().startsWith("XNS")) || workbook.worksheets[0];
    const headerRow = findHeader(xnsSheet);
    if (!headerRow) {
      return { statusCode: 500, body: "Template header row not found." };
    }
    const colIdx = findColumnIndexes(headerRow);
    const startRow = headerRow.number + 1;
    const templateRow = xnsSheet.getRow(startRow);

    report.transactions.forEach((tx, idx) => {
      const row = xnsSheet.getRow(startRow + idx);
      applyRowStyle(row, templateRow);
      if (colIdx.date) row.getCell(colIdx.date).value = tx.date;
      if (colIdx.narration) row.getCell(colIdx.narration).value = tx.narration;
      if (colIdx.debit) row.getCell(colIdx.debit).value = tx.dr || "";
      if (colIdx.credit) row.getCell(colIdx.credit).value = tx.cr || "";
      if (colIdx.balance) row.getCell(colIdx.balance).value = tx.balance ?? "";
      row.commit();
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=Statement_Autopilot.xlsx",
      },
      body: Buffer.from(buffer).toString("base64"),
      isBase64Encoded: true,
    };
  } catch (e) {
    return { statusCode: 500, body: `Export failed: ${e?.message || e}` };
  }
};
