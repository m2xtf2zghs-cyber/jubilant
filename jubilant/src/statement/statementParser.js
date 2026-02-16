import { GlobalWorkerOptions, getDocument } from "pdfjs-dist/build/pdf.mjs";

GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";

const DEFAULT_HEADER_KEYWORDS = {
  date: ["date", "txn date", "value date", "transaction date"],
  narration: ["narration", "description", "remarks", "particulars", "transaction remarks", "details"],
  debit: ["debit", "withdrawal", "dr"],
  credit: ["credit", "deposit", "cr"],
  balance: ["balance", "closing balance", "account balance"],
};

const normalizeDate = (raw, customRegex) => {
  const s = String(raw || "").trim();
  if (!s) return null;
  if (customRegex) {
    const re = new RegExp(customRegex);
    const m = re.exec(s);
    if (m?.[0]) return normalizeDate(m[0], null);
  }
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

const parseNumber = (raw) => {
  const clean = String(raw || "").replace(/[,₹\s]/g, "").trim();
  if (!clean) return null;
  const n = Number(clean);
  return Number.isFinite(n) ? clean : null;
};

const extractAmounts = (raw, customRegex) => {
  const re = customRegex ? new RegExp(customRegex, "g") : /-?\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?/g;
  const nums = String(raw || "").match(re) || [];
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
    .map(([y, arr]) => ({
      y,
      items: arr.sort((a, b) => a.x - b.x),
      text: arr.sort((a, b) => a.x - b.x).map((p) => p.str).join(" ").trim(),
    }));
};

const scoreHeaderLine = (lineText, keywords) => {
  const t = lineText.toLowerCase();
  let score = 0;
  Object.values(keywords).forEach((list) => {
    if (list.some((k) => t.includes(k))) score += 1;
  });
  return score;
};

const detectHeaderLine = (lines, keywords) => {
  let best = null;
  lines.forEach((line, idx) => {
    const score = scoreHeaderLine(line.text, keywords);
    if (score >= 2 && (!best || score > best.score)) {
      best = { idx, score, line };
    }
  });
  return best;
};

const detectColumnsFromHeader = (line, keywords) => {
  const map = {};
  const lower = line.items.map((it) => ({ ...it, lower: it.str.toLowerCase() }));
  Object.entries(keywords).forEach(([key, list]) => {
    const hit = lower.find((it) => list.some((k) => it.lower.includes(k)));
    if (hit) map[key] = hit.x;
  });
  return map;
};

const buildRanges = (columnMap) => {
  const entries = Object.entries(columnMap)
    .map(([key, x]) => ({ key, x }))
    .filter((entry) => typeof entry.x === "number" && !Number.isNaN(entry.x))
    .sort((a, b) => a.x - b.x);
  const ranges = entries.map((col, idx) => {
    const prev = entries[idx - 1];
    const next = entries[idx + 1];
    const minX = prev ? (prev.x + col.x) / 2 : col.x - 80;
    const maxX = next ? (col.x + next.x) / 2 : col.x + 120;
    return { key: col.key, minX, maxX };
  });
  return { entries, ranges };
};

const assignToColumns = (line, ranges) => {
  const columns = {};
  line.items.forEach((it) => {
    const target = ranges.find((r) => it.x >= r.minX && it.x < r.maxX) || ranges[ranges.length - 1];
    if (!target) return;
    columns[target.key] = columns[target.key] ? `${columns[target.key]} ${it.str}` : it.str;
  });
  return columns;
};

const isHeaderRow = (text, keywords) => scoreHeaderLine(text, keywords) >= 2;

const pickTemplate = (templates, lines) => {
  if (!Array.isArray(templates) || templates.length === 0) return null;
  let best = null;
  templates.forEach((tpl) => {
    const keywords = tpl.header_keywords_json || DEFAULT_HEADER_KEYWORDS;
    const header = detectHeaderLine(lines, keywords);
    if (header && (!best || header.score > best.score)) best = { tpl, score: header.score };
  });
  return best?.tpl || null;
};

export async function extractRawLines(files, options = {}) {
  const list = Array.isArray(files) ? files : [];
  if (!list.length) throw new Error("Please upload at least one bank statement PDF.");

  const rawLines = [];
  let combinedText = "";
  let templateUsed = null;
  let templateMeta = {};

  let fileIndex = 0;
  for (const file of list) {
    const buf = await file.arrayBuffer();
    const pdf = await getDocument({ data: buf }).promise;
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
      const page = await pdf.getPage(pageNum);
      const text = await page.getTextContent();
      const lines = groupTextItemsToLines(text.items || []);
      combinedText += `\n${lines.map((l) => l.text).join("\n")}\n`;

      const chosenTemplate = templateUsed || pickTemplate(options.templates, lines);
      templateUsed = templateUsed || chosenTemplate;
      const keywords = chosenTemplate?.header_keywords_json || DEFAULT_HEADER_KEYWORDS;
      const headerHit = detectHeaderLine(lines, keywords);
      const headerCols = chosenTemplate?.column_map_json || (headerHit ? detectColumnsFromHeader(headerHit.line, keywords) : {});
      const { ranges } = buildRanges(headerCols);

      if (headerHit) {
        templateMeta = {
          ...templateMeta,
          headerText: headerHit.line.text,
          headerY: headerHit.line.y,
          columnMap: headerCols,
          templateId: chosenTemplate?.id || null,
        };
      }

      lines.forEach((line, rowNo) => {
        if (isHeaderRow(line.text, keywords)) {
          rawLines.push({
            id: `f${fileIndex}_p${pageNum}_r${rowNo + 1}`,
            pageNo: pageNum,
            rowNo: rowNo + 1,
            rawRowText: line.text,
            rawDateText: null,
            rawNarrationText: null,
            rawDrText: null,
            rawCrText: null,
            rawBalanceText: null,
            rawLineType: "NON_TXN_LINE",
            extractionMethod: "pdfjs-table",
            bboxJson: JSON.stringify({ y: line.y }),
          });
          return;
        }

        const cols = ranges.length ? assignToColumns(line, ranges) : {};
        const rawDate = normalizeDate(cols.date || line.text, chosenTemplate?.date_regex);
        const narration = cols.narration || stripNumbers(line.text);
        const amounts = extractAmounts(
          `${cols.debit || ""} ${cols.credit || ""} ${cols.balance || ""} ${line.text}`,
          chosenTemplate?.amount_regex,
        );

        rawLines.push({
          id: `f${fileIndex}_p${pageNum}_r${rowNo + 1}`,
          pageNo: pageNum,
          rowNo: rowNo + 1,
          rawRowText: line.text,
          rawDateText: rawDate || null,
          rawNarrationText: narration || null,
          rawDrText: parseNumber(cols.debit) || amounts.dr || null,
          rawCrText: parseNumber(cols.credit) || amounts.cr || null,
          rawBalanceText: parseNumber(cols.balance) || amounts.balance || null,
          rawLineType: "NON_TXN_LINE",
          extractionMethod: ranges.length ? "pdfjs-table" : "pdfjs",
          bboxJson: JSON.stringify({ y: line.y }),
        });
      });
    }
    fileIndex += 1;
  }

  const { bankName, accountType } = detectBankMeta(combinedText);
  return { rawLines, bankName, accountType, templateUsed, templateMeta };
}
