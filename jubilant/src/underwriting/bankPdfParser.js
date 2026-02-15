// pdf.js (pdfjs-dist) ships ESM bundles under `build/`. Import those explicitly so Vite/Rollup can resolve them
// deterministically in Netlify builds (export maps vary across versions).
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist/build/pdf.mjs";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerSrc;

const moneyToNumber = (raw) => {
  const s = String(raw || "").replace(/[,\s]/g, "").replace(/₹/g, "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

const normalizeDate = (raw) => {
  const s = String(raw || "").trim();
  if (!s) return null;
  // dd/mm/yyyy or dd-mm-yyyy
  const m1 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m1) {
    const dd = String(m1[1]).padStart(2, "0");
    const mm = String(m1[2]).padStart(2, "0");
    const yyyy = String(m1[3]).length === 2 ? `20${m1[3]}` : m1[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  // yyyy-mm-dd
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m2) return s;

  return null;
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
    "";
  const accountType = t.includes("SAVINGS") ? "SAVINGS" : t.includes("CURRENT") ? "CURRENT" : "";
  return { bankName, accountType };
};

const groupTextItemsToLines = (items) => {
  // pdf.js gives positional text items. Group by y coordinate (rounded) and sort by x.
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
  const out = [...lines.entries()]
    .sort((a, b) => b[0] - a[0]) // top to bottom
    .map(([, arr]) => arr.sort((a, b) => a.x - b.x).map((p) => p.str).join(" "));
  return out;
};

const parseLinesToTransactions = (lines) => {
  const txs = [];
  for (const line of lines) {
    // Look for a transaction-like line: date + at least one amount
    const tokens = String(line || "").replace(/\s+/g, " ").trim().split(" ");
    if (tokens.length < 4) continue;

    const dateIso = normalizeDate(tokens[0]);
    if (!dateIso) continue;

    // Extract amounts (numbers with optional commas/decimals)
    const amounts = (line.match(/-?\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?/g) || [])
      .map(moneyToNumber)
      .filter((n) => Number.isFinite(n));

    if (amounts.length < 1) continue;

    // Common pattern: last amount is balance.
    const balance = amounts[amounts.length - 1];

    // Build narration by removing the leading date and trailing numeric chunks.
    const narration = line
      .replace(tokens[0], "")
      .replace(/-?\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    txs.push({
      date: dateIso,
      narration: narration || "-",
      debit: 0,
      credit: 0,
      balance: Number.isFinite(balance) ? Math.round(balance) : null,
    });
  }

  // Infer debit/credit amounts from balance deltas when possible.
  txs.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  let prevBalance = null;
  for (const t of txs) {
    if (t.balance == null) continue;
    if (prevBalance == null) {
      prevBalance = t.balance;
      continue;
    }
    const delta = t.balance - prevBalance;
    if (delta > 0) t.credit = Math.round(delta);
    else if (delta < 0) t.debit = Math.round(Math.abs(delta));
    prevBalance = t.balance;
  }

  return txs;
};

export async function parseBankPdfFiles(files) {
  const list = Array.isArray(files) ? files : [];
  if (list.length === 0) throw new Error("Please upload at least one bank statement PDF.");

  let combinedText = "";
  let transactions = [];

  for (const file of list) {
    const buf = await file.arrayBuffer();
    const pdf = await getDocument({ data: buf }).promise;
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
      const page = await pdf.getPage(pageNum);
      const text = await page.getTextContent();
      const lines = groupTextItemsToLines(text.items || []);
      combinedText += `\n${lines.join("\n")}\n`;
      transactions = transactions.concat(parseLinesToTransactions(lines));
    }
  }

  const { bankName, accountType } = detectBankMeta(combinedText);
  const periodStart = transactions.length ? transactions[0].date : "";
  const periodEnd = transactions.length ? transactions[transactions.length - 1].date : "";

  // De-dup identical lines (some PDFs have repeated headers).
  const dedup = [];
  const seen = new Set();
  for (const t of transactions) {
    const k = `${t.date}|${t.narration}|${t.debit}|${t.credit}|${t.balance ?? ""}`;
    if (seen.has(k)) continue;
    seen.add(k);
    dedup.push(t);
  }

  return {
    bankName,
    accountType,
    periodStart,
    periodEnd,
    transactions: dedup,
    rawTextSnippet: combinedText.slice(0, 4000),
  };
}
