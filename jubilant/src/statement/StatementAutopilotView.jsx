import React, { useMemo, useState } from "react";
import { UploadCloud, RefreshCw, ShieldCheck, AlertTriangle, Save, FileText } from "lucide-react";
import { extractRawLines } from "./statementParser.js";
import { runStatementAutopilot } from "./statementEngine.js";

const fmtInr = (n) => {
  const x = Math.round(Number(n) || 0);
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(x);
  } catch {
    return `₹${x}`;
  }
};

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

export default function StatementAutopilotView({ backend, leads, isAdmin }) {
  const supabase = backend?.supabase;
  const user = backend?.user;
  const backendEnabled = Boolean(backend?.enabled && supabase && user);

  const leadsList = useMemo(() => (Array.isArray(leads) ? leads : []).slice().sort((a, b) => (a?.name || "").localeCompare(b?.name || "")), [leads]);
  const [leadId, setLeadId] = useState(leadsList[0]?.id || "");
  const selectedLead = useMemo(() => leadsList.find((l) => l.id === leadId) || null, [leadsList, leadId]);

  const [files, setFiles] = useState([]);
  const [parseMeta, setParseMeta] = useState(null);
  const [rawLines, setRawLines] = useState([]);
  const [manualEdits, setManualEdits] = useState({});
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState("XNS");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [approvalStatus, setApprovalStatus] = useState("DRAFT");

  const categoryTabMap = {
    "ODD FIG": "ODD FIG",
    DOUBT: "DOUBT",
    "BANK FIN": "BANK_FIN",
    "PVT FIN": "PVT_FIN",
    RETURN: "RETURN",
    CONS: "CONS",
    FINAL: "FINAL",
  };

  const handleParse = async () => {
    if (!selectedLead) {
      setError("Select a lead first.");
      return;
    }
    if (!files.length) {
      setError("Upload at least one PDF.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const meta = await extractRawLines(files);
      setParseMeta(meta);
      setRawLines(meta.rawLines);
      setResult(null);
      setManualEdits({});
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const applyManualEdits = (lines) =>
    lines.map((line) => {
      const edit = manualEdits[line.id];
      if (!edit) return line;
      if (edit.ignore) return { ...line, rawDateText: null, rawLineType: "NON_TXN_LINE" };
      return {
        ...line,
        rawDateText: edit.date || line.rawDateText,
        rawDrText: edit.dr ?? line.rawDrText,
        rawCrText: edit.cr ?? line.rawCrText,
        rawBalanceText: edit.balance ?? line.rawBalanceText,
        rawNarrationText: edit.narration ?? line.rawNarrationText,
      };
    });

  const handleRun = () => {
    setError("");
    if (!rawLines.length) {
      setError("Parse the PDF first.");
      return;
    }
    try {
      const adjusted = applyManualEdits(rawLines);
      const r = runStatementAutopilot(adjusted, parseMeta || {});
      setResult(r);
    } catch (e) {
      setError(String(e?.message || e));
    }
  };

  const handleSave = async () => {
    if (!backendEnabled) {
      setError("Supabase not configured.");
      return;
    }
    if (!selectedLead || !result) {
      setError("Run Statement Autopilot first.");
      return;
    }
    if (result?.reconciliation?.status === "PARSE_FAILED") {
      setError("Parse failed. Resolve unmapped lines before saving.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const ownerId = selectedLead.ownerId;
      const createdBy = user.id;

      const { data: statement, error: stmtErr } = await supabase
        .from("statements")
        .insert({
          owner_id: ownerId,
          created_by: createdBy,
          lead_id: selectedLead.id,
          account_id: null,
        })
        .select("id")
        .single();
      if (stmtErr) throw stmtErr;

      const versionNo = 1;
      const { data: version, error: verErr } = await supabase
        .from("statement_versions")
        .insert({
          statement_id: statement.id,
          owner_id: ownerId,
          created_by: createdBy,
          status: approvalStatus,
          version_no: versionNo,
          bank_name: parseMeta?.bankName || "",
          account_type: parseMeta?.accountType || "",
          period_start: result?.transactions?.[0]?.date || null,
          period_end: result?.transactions?.[result.transactions.length - 1]?.date || null,
          report_json: result,
        })
        .select("id")
        .single();
      if (verErr) throw verErr;

      const pdfFileIds = {};
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        const safeName = `${Date.now()}_${file.name || "statement.pdf"}`;
        const path = `${ownerId}/statements/${version.id}/${safeName}`;
        const { error: uploadErr } = await supabase.storage.from("liras-attachments").upload(path, file, {
          upsert: true,
          contentType: file.type || "application/pdf",
        });
        if (uploadErr) throw uploadErr;

        const { data: pdfFileRow, error: pdfErr } = await supabase
          .from("pdf_files")
          .insert({
            statement_version_id: version.id,
            owner_id: ownerId,
            created_by: createdBy,
            storage_path: path,
            file_name: file.name || "statement.pdf",
            meta_json: { size: file.size, type: file.type || "application/pdf" },
          })
          .select("id")
          .single();
        if (pdfErr) throw pdfErr;
        pdfFileIds[i] = pdfFileRow.id;
      }

      const fileIndexFor = (lineId) => {
        const match = /^f(\d+)_/.exec(lineId || "");
        return match ? Number(match[1]) : null;
      };

      const rawLinePayload = result.rawLines.map((l) => ({
        statement_version_id: version.id,
        owner_id: ownerId,
        created_by: createdBy,
        pdf_file_id: fileIndexFor(l.id) != null ? pdfFileIds[fileIndexFor(l.id)] : null,
        page_no: l.pageNo,
        row_no: l.rowNo,
        raw_row_text: l.rawRowText,
        raw_date_text: l.rawDateText || null,
        raw_narration_text: l.rawNarrationText || null,
        raw_dr_text: l.rawDrText || null,
        raw_cr_text: l.rawCrText || null,
        raw_balance_text: l.rawBalanceText || null,
        raw_line_type: l.rawLineType || "NON_TXN_LINE",
        extraction_method: l.extractionMethod || "pdfjs",
        bbox_json: l.bboxJson || null,
      }));
      for (const batch of chunk(rawLinePayload, 500)) {
        const { error: rawErr } = await supabase.from("raw_statement_lines").insert(batch);
        if (rawErr) throw rawErr;
      }

      const txnPayload = result.transactions.map((t) => ({
        statement_version_id: version.id,
        owner_id: ownerId,
        created_by: createdBy,
        raw_line_ids: t.rawLineIds,
        date: t.date,
        month: t.month,
        narration: t.narration,
        dr: t.dr,
        cr: t.cr,
        balance: t.balance ?? null,
        counterparty_norm: t.counterpartyNorm,
        txn_type: t.txnType,
        category: t.category,
        flags_json: t.flags || [],
        transaction_uid: t.transactionUid,
      }));
      for (const batch of chunk(txnPayload, 500)) {
        const { error: txErr } = await supabase.from("transactions").insert(batch);
        if (txErr) throw txErr;
      }
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const reconciliation = result?.reconciliation;
  const unmapped = reconciliation?.unmappedLineIds || [];

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <div className="surface p-6 space-y-4">
        <div className="flex items-center gap-3">
          <FileText size={20} className="text-slate-500" />
          <div>
            <h2 className="text-lg font-bold text-slate-900">Statement Autopilot</h2>
            <p className="text-sm text-slate-500">Strict transaction capture + reconciliation. PDF blocked if parse fails.</p>
          </div>
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm p-3">{error}</div>}

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Lead</label>
            <select className="w-full mt-1 border rounded-lg p-2" value={leadId} onChange={(e) => setLeadId(e.target.value)}>
              {leadsList.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Approval Status</label>
            <select className="w-full mt-1 border rounded-lg p-2" value={approvalStatus} onChange={(e) => setApprovalStatus(e.target.value)}>
              <option value="DRAFT">Draft</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <label className="btn-secondary cursor-pointer">
            <UploadCloud size={16} />
            <span className="ml-2">{files.length ? `${files.length} PDF(s)` : "Upload PDF(s)"}</span>
            <input
              type="file"
              accept="application/pdf"
              multiple
              className="hidden"
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
            />
          </label>
          <button className="btn-secondary" onClick={handleParse} disabled={busy || !files.length}>
            <RefreshCw size={16} /> <span className="ml-2">Parse</span>
          </button>
          <button className="btn-primary" onClick={handleRun} disabled={busy || !rawLines.length}>
            <ShieldCheck size={16} /> <span className="ml-2">Run Autopilot</span>
          </button>
          <button className="btn-primary" onClick={handleSave} disabled={busy || !result}>
            <Save size={16} /> <span className="ml-2">Save (Cloud)</span>
          </button>
        </div>
      </div>

      {result && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="surface p-5 space-y-2">
            <h3 className="font-bold text-slate-900">Reconciliation</h3>
            <p className="text-sm text-slate-500">Strict capture: unmapped lines must be 0.</p>
            <div className="text-sm text-slate-700">
              Raw lines: <strong>{reconciliation.totalRawLines}</strong> | Txn lines:{" "}
              <strong>{reconciliation.totalTxnLines}</strong> | Mapped:{" "}
              <strong>{reconciliation.totalTxnLines - unmapped.length}</strong>
            </div>
            <div className="text-xs text-slate-500">Parse confidence: {(reconciliation.parseConfidence * 100).toFixed(1)}%</div>
          <div className="text-sm">
            Status:{" "}
            <span className={`chip ${reconciliation.status === "READY" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
              {reconciliation.status}
            </span>
          </div>
          {reconciliation.continuityFailures?.length > 0 && (
            <div className="mt-2 text-xs text-amber-700">
              {reconciliation.continuityFailures.length} balance continuity issue(s) detected.
            </div>
          )}
          {unmapped.length > 0 && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900 text-sm">
              <AlertTriangle size={16} className="inline-block mr-2" />
              {unmapped.length} unmapped line(s). Resolve before export.
            </div>
          )}
          </div>

          <div className="surface p-5 space-y-3">
            <h3 className="font-bold text-slate-900">Monthly KPIs</h3>
            <div className="overflow-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th className="text-right">Credits</th>
                    <th className="text-right">Debits</th>
                    <th className="text-right">Cash</th>
                    <th className="text-right">Bounces</th>
                  </tr>
                </thead>
                <tbody>
                  {result.monthlyAggregates.map((m) => (
                    <tr key={m.month}>
                      <td>{m.month}</td>
                      <td className="text-right">{fmtInr(m.creditTotal)}</td>
                      <td className="text-right">{fmtInr(m.debitTotal)}</td>
                      <td className="text-right">{fmtInr(m.cashDeposits + m.cashWithdrawals)}</td>
                      <td className="text-right">{m.bounces}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {result && unmapped.length > 0 && isAdmin && (
        <div className="surface p-5 space-y-4">
          <h3 className="font-bold text-slate-900">Manual Mapping (Admin)</h3>
          <p className="text-sm text-slate-500">Mark non-txn lines or force-map to a transaction.</p>
          <div className="space-y-3">
            {result.rawLines.filter((l) => unmapped.includes(l.id)).map((line) => (
              <div key={line.id} className="border rounded-lg p-3 space-y-2">
                <div className="text-xs text-slate-500">Page {line.pageNo}, Row {line.rowNo}</div>
                <div className="text-sm text-slate-800">{line.rawRowText}</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="btn-secondary"
                    onClick={() => setManualEdits((prev) => ({ ...prev, [line.id]: { ignore: true } }))}
                  >
                    Mark Non-Txn
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      const date = prompt("Enter date (YYYY-MM-DD)", line.rawDateText || "");
                      if (!date) return;
                      const dr = prompt("Debit (optional)", "");
                      const cr = prompt("Credit (optional)", "");
                      const balance = prompt("Balance (optional)", "");
                      const narration = prompt("Narration (optional)", line.rawRowText);
                      setManualEdits((prev) => ({
                        ...prev,
                        [line.id]: { date, dr, cr, balance, narration },
                      }));
                    }}
                  >
                    Create Transaction
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button className="btn-primary" onClick={handleRun}>Re-run Autopilot</button>
        </div>
      )}
      {result && unmapped.length > 0 && !isAdmin && (
        <div className="surface p-5 text-sm text-rose-600">
          Parse failed. Admin must resolve unmapped lines before export.
        </div>
      )}

      {result && (
        <div className="surface p-5 space-y-4">
          <div className="flex flex-wrap gap-2">
            {["XNS", "PIVOT", "ANALYSIS", "ODD FIG", "DOUBT", "BANK FIN", "PVT FIN", "RETURN", "CONS", "FINAL"].map((tab) => (
              <button
                key={tab}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                  activeTab === tab ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-500 border-slate-200"
                }`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === "XNS" && (
            <div className="overflow-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Narration</th>
                    <th className="text-right">DR</th>
                    <th className="text-right">CR</th>
                    <th className="text-right">Balance</th>
                    <th>Category</th>
                  </tr>
                </thead>
                <tbody>
                  {result.transactions.slice(0, 200).map((t) => (
                    <tr key={t.id}>
                      <td>{t.date}</td>
                      <td className="max-w-[360px] truncate">{t.narration}</td>
                      <td className="text-right">{fmtInr(t.dr)}</td>
                      <td className="text-right">{fmtInr(t.cr)}</td>
                      <td className="text-right">{fmtInr(t.balance || 0)}</td>
                      <td>{t.category}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.transactions.length > 200 && (
                <div className="text-xs text-slate-500 mt-2">Showing first 200 rows.</div>
              )}
            </div>
          )}

          {activeTab === "PIVOT" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="overflow-auto">
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Credit Heatmap</h4>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Counterparty</th>
                      <th className="text-right">Total</th>
                      <th className="text-right">% Credits</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.creditHeat.slice(0, 20).map((row) => (
                      <tr key={row.name}>
                        <td>{row.name}</td>
                        <td className="text-right">{fmtInr(row.total)}</td>
                        <td className="text-right">{row.pct.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="overflow-auto">
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Debit Heatmap</h4>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Counterparty</th>
                      <th className="text-right">Total</th>
                      <th className="text-right">% Debits</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.debitHeat.slice(0, 20).map((row) => (
                      <tr key={row.name}>
                        <td>{row.name}</td>
                        <td className="text-right">{fmtInr(row.total)}</td>
                        <td className="text-right">{row.pct.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "ANALYSIS" && (
            <div className="overflow-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th className="text-right">Credits</th>
                    <th className="text-right">Debits</th>
                    <th className="text-right">Volatility</th>
                    <th className="text-right">Bounces</th>
                  </tr>
                </thead>
                <tbody>
                  {result.monthlyAggregates.map((m) => (
                    <tr key={m.month}>
                      <td>{m.month}</td>
                      <td className="text-right">{fmtInr(m.creditTotal)}</td>
                      <td className="text-right">{fmtInr(m.debitTotal)}</td>
                      <td className="text-right">{m.volatilityScore.toFixed(2)}</td>
                      <td className="text-right">{m.bounces}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {["ODD FIG", "DOUBT", "BANK FIN", "PVT FIN", "RETURN", "CONS", "FINAL"].includes(activeTab) && (
            <div className="overflow-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Narration</th>
                    <th className="text-right">DR</th>
                    <th className="text-right">CR</th>
                    <th>Category</th>
                  </tr>
                </thead>
                <tbody>
                  {(result.categories?.[categoryTabMap[activeTab]] || []).slice(0, 200).map((t) => (
                    <tr key={t.id}>
                      <td>{t.date}</td>
                      <td className="max-w-[360px] truncate">{t.narration}</td>
                      <td className="text-right">{fmtInr(t.dr)}</td>
                      <td className="text-right">{fmtInr(t.cr)}</td>
                      <td>{t.category}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
