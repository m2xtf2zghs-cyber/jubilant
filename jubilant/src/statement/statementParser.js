import { GlobalWorkerOptions, getDocument } from "pdfjs-dist/build/pdf.mjs";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerSrc;

const normalizeDate = (raw) => {
  const s = String(raw || "").trim();
  if (!s) return null;
  const m1 = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m1) {
    const dd = String(m1[1]).padStart(2, "0");
    const mm = String(m1[2]).padStart(2, "0");
    const yyyy = String(m1[3]).length === 2 ? `20${m1[3]}` : m1[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  const m2 = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  return m2 ? m2[0] : null;
};

const detectBankMeta = (text) => {
  const t = String(text || "").toUpperCase();
  const bankName =
    t.includes("HDFC") ? "HDFC" :
    t.includes("ICICI") ? "ICICI" :
    t.includes("AXIS") ? "AXIS" :
    (t.includes("STATE BANK") || t.includes("SBI")) ? "SBI" :
    t.includes("KOTAK") ? "KOTAK" :
    t.includes("INDUSIND") ? "INDUSIND" :
    t.includes("TMB") ? "TMB" :
    "";
  const accountType = t.includes("SAVINGS") ? "SAVINGS" : t.includes("CURRENT") ? "CURRENT" : "";
  return { bankName, accountType };
};

const extractAmounts = (raw) => {
  const nums = String(raw || "").match(/-?\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?/g) || [];
  if (!nums.length) return { dr: null, cr: null, balance: null };
  if (nums.length === 1) return { dr: null, cr: null, balance: nums[0] };
  if (nums.length === 2) return { dr: nums[0], cr: null, balance: nums[1] };
  return { dr: nums[nums.length - 3], cr: nums[nums.length - 2], balance: nums[nums.length - 1] };
};

const stripNumbers = (raw) =>
  String(raw || "")
    .replace(/-?\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const groupTextItemsToLines = (items) => {
  const lines = new Map();
  for (const it of items) {
    const str = String(it?.str || "").trim();
    if (!str) continue;
    const y = Math.round(it.transform?.[5] || 0);
    const x = Math.round(it.transform?.[4] || 0);
    const arr = lines.get(y) || [];
    arr.push({ x, str });
    lines.set(y, arr);
  }
  return [...lines.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, arr]) => arr.sort((a, b) => a.x - b.x).map((p) => p.str).join(" "));
};

export async function extractRawLines(files) {
  const list = Array.isArray(files) ? files : [];
  if (!list.length) throw new Error("Please upload at least one bank statement PDF.");

  const rawLines = [];
  let combinedText = "";

  let fileIndex = 0;
  for (const file of list) {
    const buf = await file.arrayBuffer();
    const pdf = await getDocument({ data: buf }).promise;
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
      const page = await pdf.getPage(pageNum);
      const text = await page.getTextContent();
      const lines = groupTextItemsToLines(text.items || []);
      combinedText += `\n${lines.join("\n")}\n`;
      lines.forEach((line, rowNo) => {
        const date = normalizeDate(line);
        const amounts = extractAmounts(line);
        const narration = stripNumbers(line);
        rawLines.push({
          id: `f${fileIndex}_p${pageNum}_r${rowNo + 1}`,
          pageNo: pageNum,
          rowNo: rowNo + 1,
          rawRowText: line,
          rawDateText: date || null,
          rawNarrationText: narration || null,
          rawDrText: amounts.dr || null,
          rawCrText: amounts.cr || null,
          rawBalanceText: amounts.balance || null,
          rawLineType: "NON_TXN_LINE",
          extractionMethod: "pdfjs",
          bboxJson: null,
        });
      });
    }
    fileIndex += 1;
  }

  const { bankName, accountType } = detectBankMeta(combinedText);
  return { rawLines, bankName, accountType };
}
