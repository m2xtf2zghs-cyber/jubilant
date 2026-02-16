const parseMoney = (value) => {
  const clean = String(value || "").replace(/[,₹\s]/g, "").trim();
  if (!clean) return null;
  const n = Number(clean);
  return Number.isFinite(n) ? Math.round(n) : null;
};

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

const fnv1a = (input) => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16);
};

const stripDateFromNarration = (narration) =>
  String(narration || "").replace(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/, "").trim();

const normalizeCounterparty = (narration) => {
  const clean = String(narration || "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = clean.split(" ").filter((t) => t.length >= 3);
  return tokens.slice(0, 2).join(" ") || "UNKNOWN";
};

const categorize = (narration, dr, cr, counterparty) => {
  const n = String(narration || "").toUpperCase();
  const amt = Math.max(dr, cr);
  if (n.includes("RTN") || n.includes("RETURN") || n.includes("CHQ RET") || n.includes("NOT REP")) return "RETURN";
  if (n.includes("GST") || n.includes("TAX") || n.includes("CBDT") || n.includes("ITD")) return "TAX";
  if (n.includes("ATM") || n.includes("CASH") || n.includes("SELF")) return "CASH";
  if (n.includes("EMI") || n.includes("LOAN") || n.includes("INTEREST") || n.includes("OD INTEREST") || n.includes("PROC FEE") || n.includes("LEGAL FEE"))
    return "BANK_FIN";
  if (n.includes("HAND LOAN") || n.includes("PVT") || n.includes("WEEKLY")) return "PVT_FIN";
  if (counterparty === "UNKNOWN" && amt >= 500000) return "DOUBT";
  if (amt >= 1000000 && amt % 1000 !== 0) return "ODD FIG";
  if (dr > 0 && cr > 0) return "CONS";
  return "FINAL";
};

const buildFlags = (narration, dr, cr) => {
  const flags = [];
  const n = String(narration || "").toUpperCase();
  const amt = Math.max(dr, cr);
  if (n.includes("PENALTY") || n.includes("CHARGE")) flags.push("PENALTY");
  if (n.includes("RETURN") || n.includes("BOUNCE")) flags.push("BOUNCE");
  if (amt > 500000) flags.push("HIGH_VALUE");
  if (amt >= 1000000 && amt % 1000 !== 0) flags.push("ODD_FIG");
  return flags;
};

const extractAmounts = (rawRow, rawDr, rawCr, rawBal) => {
  const dr = parseMoney(rawDr) || 0;
  const cr = parseMoney(rawCr) || 0;
  const bal = parseMoney(rawBal);
  if (dr || cr || bal != null) return [dr, cr, bal];
  const nums = (String(rawRow || "").match(/-?\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?/g) || [])
    .map(parseMoney)
    .filter((n) => Number.isFinite(n));
  if (!nums.length) return [0, 0, null];
  const balanceGuess = nums[nums.length - 1];
  const others = nums.length >= 2 ? nums.slice(0, -1) : [];
  const maybeDr = others.length ? others[others.length - 1] : 0;
  const maybeCr = others.length >= 2 ? others[others.length - 2] : 0;
  return [maybeDr || 0, maybeCr || 0, balanceGuess];
};

const normalizeLines = (rawLines, bankName = "", accountType = "") => {
  const adjusted = rawLines.map((l) => ({ ...l }));
  const txns = [];
  let current = null;
  let seq = 0;

  const finish = () => {
    if (!current) return;
    const month = current.date.slice(0, 7);
    const counterparty = normalizeCounterparty(current.narration);
    const category = categorize(current.narration, current.dr, current.cr, counterparty);
    const flags = buildFlags(current.narration, current.dr, current.cr);
    const uidBase = [bankName, accountType, current.date, current.dr, current.cr, current.balance ?? "", current.narration, current.pageNo, current.rowNo].join("|");
    txns.push({
      id: `txn_${seq++}`,
      rawLineIds: [...current.rawLineIds],
      date: current.date,
      month,
      narration: current.narration || "-",
      dr: current.dr,
      cr: current.cr,
      balance: current.balance ?? null,
      counterpartyNorm: counterparty,
      txnType: current.cr > 0 ? "CREDIT" : current.dr > 0 ? "DEBIT" : "UNKNOWN",
      category,
      flags,
      transactionUid: fnv1a(uidBase),
    });
    current = null;
  };

  rawLines.forEach((line, idx) => {
    const date = normalizeDate(line.rawDateText || line.rawRowText);
    const [dr, cr, bal] = extractAmounts(line.rawRowText, line.rawDrText, line.rawCrText, line.rawBalanceText);
    const narration = stripDateFromNarration(line.rawNarrationText || line.rawRowText || "");
    if (date) {
      finish();
      adjusted[idx] = { ...line, rawLineType: "TRANSACTION" };
      current = {
        rawLineIds: [line.id],
        date,
        narration,
        dr,
        cr,
        balance: bal,
        pageNo: line.pageNo,
        rowNo: line.rowNo,
      };
    } else if (current) {
      adjusted[idx] = { ...line, rawLineType: "TRANSACTION" };
      current.rawLineIds.push(line.id);
      if (narration) current.narration = `${current.narration} ${narration}`.trim();
    } else {
      adjusted[idx] = { ...line, rawLineType: "NON_TXN_LINE" };
    }
  });
  finish();
  return { adjustedLines: adjusted, transactions: txns };
};

const reconcile = (rawLines, txns) => {
  const txnLineIds = new Set(txns.flatMap((t) => t.rawLineIds));
  const txnLines = rawLines.filter((l) => l.rawLineType === "TRANSACTION");
  const unmapped = txnLines.filter((l) => !txnLineIds.has(l.id)).map((l) => l.id);
  const continuityFailures = [];
  let prevBalance = null;
  txns.forEach((tx, idx) => {
    if (tx.balance != null && prevBalance != null) {
      const expected = prevBalance + tx.cr - tx.dr;
      const diff = Math.abs(tx.balance - expected);
      if (diff > 5) continuityFailures.push({ index: idx, prevBalance, expected, actual: tx.balance, diff });
    }
    if (tx.balance != null) prevBalance = tx.balance;
  });
  const confidence = txnLines.length ? (txnLines.length - unmapped.length) / txnLines.length : 0;
  const status = unmapped.length ? "PARSE_FAILED" : "READY";
  return {
    totalRawLines: rawLines.length,
    totalTxnLines: txnLines.length,
    normalizedCount: txns.length,
    unmappedLineIds: unmapped,
    continuityFailures,
    parseConfidence: confidence,
    status,
  };
};

const buildHeatMap = (txns, type) => {
  if (!txns.length) return [];
  const total = txns.reduce((sum, t) => sum + (type === "CREDIT" ? t.cr : t.dr), 0) || 1;
  const buckets = {};
  txns.forEach((t) => {
    const key = t.counterpartyNorm || "UNKNOWN";
    if (!buckets[key]) buckets[key] = { total: 0, count: 0 };
    buckets[key].total += type === "CREDIT" ? t.cr : t.dr;
    buckets[key].count += 1;
  });
  return Object.entries(buckets)
    .map(([name, val]) => ({
      name,
      total: val.total,
      count: val.count,
      avg: Math.round(val.total / Math.max(val.count, 1)),
      pct: (val.total / total) * 100,
      type,
    }))
    .sort((a, b) => b.total - a.total);
};

const computeVolatility = (values) => {
  const clean = values.filter((v) => v > 0);
  if (clean.length < 2) return 0;
  const mean = clean.reduce((sum, v) => sum + v, 0) / clean.length;
  const variance = clean.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (clean.length - 1);
  return Math.sqrt(variance) / mean;
};

const balanceOnDay = (rows, day) => rows.find((r) => r.date.slice(-2) === String(day).padStart(2, "0"))?.balance ?? null;

const buildMonthlyAggregates = (txns) => {
  const groups = {};
  txns.forEach((t) => {
    groups[t.month] ||= [];
    groups[t.month].push(t);
  });
  return Object.entries(groups).map(([month, rows]) => {
    const credits = rows.filter((r) => r.cr > 0);
    const debits = rows.filter((r) => r.dr > 0);
    const cashDeposits = credits.filter((r) => r.category === "CASH").reduce((sum, r) => sum + r.cr, 0);
    const cashWithdrawals = debits.filter((r) => r.category === "CASH").reduce((sum, r) => sum + r.dr, 0);
    const penaltyCharges = rows.filter((r) => r.category === "BANK_FIN" && r.flags.includes("PENALTY")).length;
    const bounces = rows.filter((r) => r.category === "RETURN").length;
    const balances = rows.map((r) => r.balance).filter((b) => b != null);
    const overdrawnDays = rows.filter((r) => (r.balance ?? 0) < 0).length;
    return {
      month,
      creditCount: credits.length,
      creditTotal: credits.reduce((sum, r) => sum + r.cr, 0),
      debitCount: debits.length,
      debitTotal: debits.reduce((sum, r) => sum + r.dr, 0),
      cashDeposits,
      cashWithdrawals,
      penaltyCharges,
      bounces,
      balanceOn10th: balanceOnDay(rows, 10),
      balanceOn20th: balanceOnDay(rows, 20),
      balanceOnLast: balances.length ? balances[balances.length - 1] : null,
      overdrawnDays,
      volatilityScore: computeVolatility(credits.map((c) => c.cr)),
    };
  });
};

const applySpikeDrainFlags = (txns) => {
  if (txns.length < 2) return txns;
  const updated = txns.slice();
  for (let i = 0; i < txns.length - 1; i += 1) {
    const current = txns[i];
    const next = txns[i + 1];
    if (current.cr >= 500000 && next.dr >= current.cr * 0.7) {
      updated[i] = { ...current, flags: Array.from(new Set([...(current.flags || []), "SPIKE_DRAIN"])) };
      updated[i + 1] = { ...next, flags: Array.from(new Set([...(next.flags || []), "SPIKE_DRAIN"])) };
    }
  }
  return updated;
};

export function runStatementAutopilot(rawLines, meta = {}) {
  const { adjustedLines, transactions: rawTxns } = normalizeLines(rawLines, meta.bankName, meta.accountType);
  const transactions = applySpikeDrainFlags(rawTxns);
  const reconciliation = reconcile(adjustedLines, transactions);
  const categories = transactions.reduce((acc, tx) => {
    acc[tx.category] ||= [];
    acc[tx.category].push(tx);
    return acc;
  }, {});
  return {
    rawLines: adjustedLines,
    transactions,
    monthlyAggregates: buildMonthlyAggregates(transactions),
    creditHeat: buildHeatMap(transactions.filter((t) => t.cr > 0), "CREDIT"),
    debitHeat: buildHeatMap(transactions.filter((t) => t.dr > 0), "DEBIT"),
    reconciliation,
    categories,
  };
}
