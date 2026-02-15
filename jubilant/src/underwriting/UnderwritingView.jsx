import React, { useEffect, useMemo, useState } from "react";
import { FileText, UploadCloud, ShieldAlert, RefreshCw, Eye, Trash2, ArrowRight } from "lucide-react";
import { parseBankPdfFiles } from "./bankPdfParser.js";
import { runUnderwriting } from "./underwritingEngine.js";
import { generateDynamicDoubts } from "../pd/dynamicDoubts.js";

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

export default function UnderwritingView({ backend, leads, onProceedToPd = null }) {
  const supabase = backend?.supabase;
  const user = backend?.user;
  const backendEnabled = Boolean(backend?.enabled && supabase && user);

  const leadsList = useMemo(() => (Array.isArray(leads) ? leads : []).slice().sort((a, b) => (a?.name || "").localeCompare(b?.name || "")), [leads]);
  const [leadId, setLeadId] = useState(leadsList[0]?.id || "");

  const selectedLead = useMemo(() => leadsList.find((l) => l.id === leadId) || null, [leadsList, leadId]);

  const [files, setFiles] = useState([]);
  const [gstFiles, setGstFiles] = useState([]);
  const [itrFiles, setItrFiles] = useState([]);

  const [gstMonths, setGstMonths] = useState([]);
  const [itrYears, setItrYears] = useState([]);
  const [parseMeta, setParseMeta] = useState(null);
  const [txPreview, setTxPreview] = useState([]);
  const [result, setResult] = useState(null);
  const doubts = useMemo(() => {
    if (!result) return [];
    return generateDynamicDoubts(result, { coveredCodes: [] }).filter((q) => !q.coveredByPd);
  }, [result]);
  const gstDoubts = useMemo(() => doubts.filter((q) => q.category === "GST"), [doubts]);
  const itrDoubts = useMemo(() => doubts.filter((q) => q.category === "ITR"), [doubts]);
  const crossDoubts = useMemo(() => doubts.filter((q) => q.category === "Cross Verification"), [doubts]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [apps, setApps] = useState([]);
  const [openApp, setOpenApp] = useState(null);
  const [reportTab, setReportTab] = useState("bank"); // bank | gst | itr | cross
  const [credTrend, setCredTrend] = useState([]);

  const refreshApps = async () => {
    if (!backendEnabled || !selectedLead) return;
    const { data, error: e } = await supabase
      .from("underwriting_applications")
      .select("id,created_at,status,period_start,period_end,bank_name,account_type,requested_exposure,aggressive_summary")
      .eq("lead_id", selectedLead.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (e) throw e;
    setApps(Array.isArray(data) ? data : []);
  };

  const refreshCredTrend = async () => {
    if (!backendEnabled || !selectedLead) return;
    const { data, error: e } = await supabase
      .from("underwriting_applications")
      .select("id,created_at,report_json")
      .eq("lead_id", selectedLead.id)
      .order("created_at", { ascending: false })
      .limit(3);
    if (e) throw e;
    const items = (Array.isArray(data) ? data : [])
      .map((row) => {
        const score = row?.report_json?.credibility?.score ?? null;
        return score == null ? null : { created_at: row.created_at, score: Number(score) };
      })
      .filter(Boolean);
    setCredTrend(items);
  };

  useEffect(() => {
    setError("");
    setResult(null);
    setOpenApp(null);
    setReportTab("bank");
    setCredTrend([]);
    setParseMeta(null);
    setTxPreview([]);
    setFiles([]);
    setGstFiles([]);
    setItrFiles([]);
    setGstMonths([]);
    setItrYears([]);
    if (!backendEnabled) return;
    refreshApps().catch((e) => setError(String(e?.message || e)));
    refreshCredTrend().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendEnabled, leadId]);

  const handleParse = async () => {
    if (!selectedLead) return;
    setError("");
    setBusy(true);
    try {
      const meta = await parseBankPdfFiles(files);
      setParseMeta(meta);
      setTxPreview(meta.transactions.slice(0, 60));
      setResult(null);
      setOpenApp(null);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const handleRun = async () => {
    if (!selectedLead) return;
    if (!parseMeta?.transactions?.length) {
      setError("Parse the PDF first (no transactions found).");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const r = runUnderwriting(
        parseMeta.transactions,
        { requestedExposure: selectedLead.loanAmount || 50_00_000, maxTenureMonths: 12 },
        {
          // Keep 0-turnover months so we can detect NIL returns vs active bank credits.
          gstMonths: (gstMonths || []).filter((m) => m?.month),
          itrYears: (itrYears || []).filter((y) => y?.year && Number(y?.turnover || 0) > 0),
        },
      );
      setResult(r);
      setOpenApp(null);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    if (!backendEnabled) return;
    if (!selectedLead) return;
    if (!result) {
      setError("Run underwriting first.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const ownerId = selectedLead.ownerId;
      const createdBy = user.id;

      const { data: inserted, error: insErr } = await supabase
        .from("underwriting_applications")
        .insert({
          owner_id: ownerId,
          created_by: createdBy,
          lead_id: selectedLead.id,
          status: "completed",
          period_start: parseMeta?.periodStart || null,
          period_end: parseMeta?.periodEnd || null,
          bank_name: parseMeta?.bankName || "",
          account_type: parseMeta?.accountType || "",
          requested_exposure: Number(selectedLead.loanAmount || 0),
          report_json: result,
          aggressive_summary: String(result.aggressiveSummary || ""),
        })
        .select("id")
        .single();
      if (insErr) throw insErr;

      const applicationId = inserted.id;

      // Upload PDFs → Storage, then log in underwriting_documents
      const uploadDocs = async (list, type) => {
        if (!Array.isArray(list) || !list.length) return;
        for (const file of list) {
          const safeName = String(file.name || "document.pdf").replace(/[^\w.\-]+/g, "_").slice(0, 120);
          const path = `${ownerId}/underwriting/${applicationId}/${Date.now()}_${safeName}`;
          const { error: upErr } = await supabase.storage
            .from("liras-attachments")
            .upload(path, file, { upsert: true, contentType: file.type || "application/pdf" });
          if (upErr) throw upErr;
          const { error: docErr } = await supabase.from("underwriting_documents").insert({
            application_id: applicationId,
            owner_id: ownerId,
            created_by: createdBy,
            type,
            storage_path: path,
            meta_json: { file_name: safeName, size: file.size || 0 },
          });
          if (docErr) throw docErr;
        }
      };

      await uploadDocs(files, "BANK_PDF");
      await uploadDocs(gstFiles, "GST");
      await uploadDocs(itrFiles, "ITR");

      // Transactions (audit). Cap at 3000 rows for safety.
      const txRows = (parseMeta?.transactions || []).slice(0, 3000).map((t) => ({
        application_id: applicationId,
        owner_id: ownerId,
        created_by: createdBy,
        tx_date: t.date,
        narration: String(t.narration || "-").slice(0, 500),
        debit: Number(t.debit || 0),
        credit: Number(t.credit || 0),
        balance: t.balance == null ? null : Number(t.balance),
      }));
      for (const batch of chunk(txRows, 500)) {
        if (!batch.length) continue;
        const { error: txErr } = await supabase.from("underwriting_transactions").insert(batch);
        if (txErr) throw txErr;
      }

      // Metrics
      const metricRows = (result.metrics || []).map((m) => ({
        application_id: applicationId,
        owner_id: ownerId,
        created_by: createdBy,
        key: String(m.key),
        value_numeric: Number(m.value || 0),
        unit: String(m.unit || ""),
        period: String(m.period || ""),
        meta_json: m.meta || {},
      }));
      for (const batch of chunk(metricRows, 500)) {
        if (!batch.length) continue;
        const { error: mErr } = await supabase.from("underwriting_metrics").insert(batch);
        if (mErr) throw mErr;
      }

      // Rule runs + flags
      const ruleRows = (result.ruleRunLog || []).map((r) => ({
        application_id: applicationId,
        owner_id: ownerId,
        created_by: createdBy,
        rule_id: String(r.id),
        result: Boolean(r.passed),
        severity: String(r.severity || "Medium"),
        score_delta: Number(r.scoreDelta || 0),
        evidence_json: { thresholds: r.thresholds || {}, evidence: r.evidence || {}, reason: String(r.reason || "") },
      }));
      for (const batch of chunk(ruleRows, 500)) {
        if (!batch.length) continue;
        const { error: rErr } = await supabase.from("underwriting_rule_runs").insert(batch);
        if (rErr) throw rErr;
      }

      const flagRows = (result.ruleRunLog || [])
        .filter((r) => !r.passed)
        .slice(0, 200)
        .map((r) => ({
          application_id: applicationId,
          owner_id: ownerId,
          created_by: createdBy,
          code: String(r.id),
          severity: String(r.severity || "Medium"),
          description: String(r.reason || ""),
          evidence_json: { thresholds: r.thresholds || {}, evidence: r.evidence || {} },
        }));
      if (flagRows.length) {
        for (const batch of chunk(flagRows, 500)) {
          const { error: fErr } = await supabase.from("underwriting_flags").insert(batch);
          if (fErr) throw fErr;
        }
      }

      // Recommendation
      const rec = result.recommendation || {};
      const { error: recErr } = await supabase.from("underwriting_recommendations").upsert({
        application_id: applicationId,
        owner_id: ownerId,
        created_by: createdBy,
        updated_by: createdBy,
        recommended_exposure: Number(rec.recommendedExposure || 0),
        tenure_months: Number(rec.tenureMonths || 0),
        collection_freq: String(rec.collectionFrequency || "Monthly"),
        collection_amt: Number(rec.collectionAmount || 0),
        upfront_deduction_pct: Number(rec.upfrontDeductionPct || 0),
        upfront_deduction_amt: Number(rec.upfrontDeductionAmt || 0),
        pricing_apr: Number(rec.pricingApr || 0),
        structure_json: rec.structure || {},
      });
      if (recErr) throw recErr;

      // Triggers
      const trigRows = (result.triggers || []).map((t) => ({
        application_id: applicationId,
        owner_id: ownerId,
        created_by: createdBy,
        trigger_type: String(t.triggerType),
        severity: String(t.severity || "Medium"),
        condition_json: t.condition || {},
        description: String(t.description || ""),
      }));
      for (const batch of chunk(trigRows, 500)) {
        if (!batch.length) continue;
        const { error: tErr } = await supabase.from("underwriting_triggers").insert(batch);
        if (tErr) throw tErr;
      }

      await refreshApps();
      if (onProceedToPd) onProceedToPd(applicationId, selectedLead.id);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const loadApp = async (id) => {
    if (!backendEnabled) return;
    setError("");
    setBusy(true);
    try {
      const { data, error: e } = await supabase.from("underwriting_applications").select("*").eq("id", id).limit(1).maybeSingle();
      if (e) throw e;
      setOpenApp(data || null);
      setResult(data?.report_json || null);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const deleteApp = async (id) => {
    if (!backendEnabled) return;
    if (!window.confirm("Delete this underwriting run?")) return;
    setError("");
    setBusy(true);
    try {
      const { error: e } = await supabase.from("underwriting_applications").delete().eq("id", id);
      if (e) throw e;
      await refreshApps();
      if (openApp?.id === id) {
        setOpenApp(null);
        setResult(null);
      }
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  if (!backendEnabled) {
    return (
      <div className="p-6">
        <div className="surface p-6">
          <div className="flex items-center gap-3">
            <ShieldAlert className="text-orange-600" />
            <div className="font-extrabold text-slate-900">Underwriting requires Cloud mode</div>
          </div>
          <div className="text-sm text-slate-600 mt-2">
            Enable Supabase (login) to upload statements and persist rule logs for audit.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <div className="surface p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="text-indigo-600" />
              <div className="text-xl font-extrabold text-slate-900">Hardcoded Underwriting</div>
            </div>
            <div className="text-sm text-slate-600 mt-1">
              Deterministic, explainable, lender-aggressive credit & recovery intelligence. No ML.
            </div>
          </div>
          <button className="btn-secondary px-3 py-2" onClick={() => refreshApps().catch((e) => setError(String(e?.message || e)))} disabled={busy}>
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Lead</label>
            <select className="w-full py-3" value={leadId} onChange={(e) => setLeadId(e.target.value)}>
              {leadsList.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} • {l.company || "—"} • Ask {fmtInr(l.loanAmount || 0)}
                </option>
              ))}
            </select>
            <div className="text-xs text-slate-500 mt-2">
              Owner: <span className="font-mono">{selectedLead?.ownerId?.slice?.(0, 8) || "-"}</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Bank PDF(s)</label>
            <div className="border border-dashed border-slate-300 rounded-xl p-4 bg-white/60">
              <input
                type="file"
                accept="application/pdf"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
              />
              <div className="text-xs text-slate-500 mt-2">
                Upload bank statement PDFs. MVP parser uses text extraction (best results when PDFs are text-based).
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">GST PDF(s) (Optional)</label>
            <div className="border border-dashed border-slate-300 rounded-xl p-4 bg-white/60">
              <input type="file" accept="application/pdf" multiple onChange={(e) => setGstFiles(Array.from(e.target.files || []))} />
              <div className="text-xs text-slate-500 mt-2">Upload GSTR-3B/GSTR-1 PDFs (optional). Add monthly turnover below for cross-verification.</div>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">ITR PDF(s) (Optional)</label>
            <div className="border border-dashed border-slate-300 rounded-xl p-4 bg-white/60">
              <input type="file" accept="application/pdf" multiple onChange={(e) => setItrFiles(Array.from(e.target.files || []))} />
              <div className="text-xs text-slate-500 mt-2">Upload ITR + computation summary PDFs (optional). Add turnover/profit below for sanity checks.</div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="surface p-4 border-slate-200">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">GST Inputs</div>
                <div className="font-extrabold text-slate-900">Monthly turnover (for cross-check)</div>
              </div>
              <button
                type="button"
                className="btn-secondary px-3 py-2"
                onClick={() => setGstMonths((prev) => [...(prev || []), { month: "", turnover: 0, taxPaid: 0, daysLate: 0 }])}
              >
                + Add month
              </button>
            </div>
            <div className="mt-3 overflow-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold">
                  <tr>
                    <th className="p-3 text-left">Month</th>
                    <th className="p-3 text-right">Turnover (₹)</th>
                    <th className="p-3 text-right">Tax paid (₹)</th>
                    <th className="p-3 text-right">Days late</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(gstMonths || []).map((m, idx) => (
                    <tr key={idx}>
                      <td className="p-2">
                        <input
                          className="w-full py-2"
                          type="month"
                          value={m.month || ""}
                          onChange={(e) =>
                            setGstMonths((prev) => prev.map((x, i) => (i === idx ? { ...x, month: e.target.value } : x)))
                          }
                        />
                      </td>
                      <td className="p-2">
                        <input
                          className="w-full py-2 text-right"
                          type="number"
                          min="0"
                          value={m.turnover ?? 0}
                          onChange={(e) =>
                            setGstMonths((prev) => prev.map((x, i) => (i === idx ? { ...x, turnover: Number(e.target.value || 0) } : x)))
                          }
                        />
                      </td>
                      <td className="p-2">
                        <input
                          className="w-full py-2 text-right"
                          type="number"
                          min="0"
                          value={m.taxPaid ?? 0}
                          onChange={(e) =>
                            setGstMonths((prev) => prev.map((x, i) => (i === idx ? { ...x, taxPaid: Number(e.target.value || 0) } : x)))
                          }
                        />
                      </td>
                      <td className="p-2">
                        <input
                          className="w-full py-2 text-right"
                          type="number"
                          min="0"
                          value={m.daysLate ?? 0}
                          onChange={(e) =>
                            setGstMonths((prev) => prev.map((x, i) => (i === idx ? { ...x, daysLate: Number(e.target.value || 0) } : x)))
                          }
                        />
                      </td>
                      <td className="p-2 text-right">
                        <button
                          type="button"
                          className="btn-secondary px-3 py-2"
                          onClick={() => setGstMonths((prev) => prev.filter((_, i) => i !== idx))}
                          title="Remove"
                        >
                          <Trash2 size={16} className="text-red-600" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(!gstMonths || gstMonths.length === 0) && (
                    <tr>
                      <td colSpan="5" className="p-4 text-center text-slate-400 italic">
                        Optional. Add months if you want GST cross-verification + doubts.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="surface p-4 border-slate-200">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">ITR Inputs</div>
                <div className="font-extrabold text-slate-900">Turnover + profit (sanity check)</div>
              </div>
              <button
                type="button"
                className="btn-secondary px-3 py-2"
                onClick={() => setItrYears((prev) => [...(prev || []), { year: "", turnover: 0, profit: 0, taxPaid: 0 }])}
              >
                + Add year
              </button>
            </div>
            <div className="mt-3 overflow-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold">
                  <tr>
                    <th className="p-3 text-left">Year</th>
                    <th className="p-3 text-right">Turnover (₹)</th>
                    <th className="p-3 text-right">Profit (₹)</th>
                    <th className="p-3 text-right">Tax paid (₹)</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(itrYears || []).map((y, idx) => (
                    <tr key={idx}>
                      <td className="p-2">
                        <input
                          className="w-full py-2"
                          value={y.year || ""}
                          onChange={(e) =>
                            setItrYears((prev) => prev.map((x, i) => (i === idx ? { ...x, year: e.target.value } : x)))
                          }
                          placeholder="FY 2023-24"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          className="w-full py-2 text-right"
                          type="number"
                          min="0"
                          value={y.turnover ?? 0}
                          onChange={(e) =>
                            setItrYears((prev) => prev.map((x, i) => (i === idx ? { ...x, turnover: Number(e.target.value || 0) } : x)))
                          }
                        />
                      </td>
                      <td className="p-2">
                        <input
                          className="w-full py-2 text-right"
                          type="number"
                          value={y.profit ?? 0}
                          onChange={(e) =>
                            setItrYears((prev) => prev.map((x, i) => (i === idx ? { ...x, profit: Number(e.target.value || 0) } : x)))
                          }
                        />
                      </td>
                      <td className="p-2">
                        <input
                          className="w-full py-2 text-right"
                          type="number"
                          min="0"
                          value={y.taxPaid ?? 0}
                          onChange={(e) =>
                            setItrYears((prev) => prev.map((x, i) => (i === idx ? { ...x, taxPaid: Number(e.target.value || 0) } : x)))
                          }
                        />
                      </td>
                      <td className="p-2 text-right">
                        <button
                          type="button"
                          className="btn-secondary px-3 py-2"
                          onClick={() => setItrYears((prev) => prev.filter((_, i) => i !== idx))}
                          title="Remove"
                        >
                          <Trash2 size={16} className="text-red-600" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(!itrYears || itrYears.length === 0) && (
                    <tr>
                      <td colSpan="5" className="p-4 text-center text-slate-400 italic">
                        Optional. Add years if you want ITR sanity checks + doubts.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn-secondary px-4 py-2" onClick={handleParse} disabled={busy || !files.length}>
            <UploadCloud size={16} />
            Parse PDFs
          </button>
          <button className="btn-primary px-4 py-2" onClick={handleRun} disabled={busy || !parseMeta?.transactions?.length}>
            <ShieldAlert size={16} />
            Run Underwriting
          </button>
          <button className="btn-secondary px-4 py-2" onClick={handleSave} disabled={busy || !result}>
            <FileText size={16} />
            Save Run (Audit)
          </button>
          {busy && <div className="text-sm font-bold text-slate-500 px-2 py-2">Working…</div>}
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 font-bold">{error}</div>
        )}

        {parseMeta && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="surface p-4 border-slate-200">
              <div className="text-xs font-bold text-slate-500 uppercase">Bank</div>
              <div className="text-sm font-extrabold text-slate-900 mt-1">{parseMeta.bankName || "—"}</div>
              <div className="text-xs text-slate-500 mt-1">{parseMeta.accountType || ""}</div>
            </div>
            <div className="surface p-4 border-slate-200">
              <div className="text-xs font-bold text-slate-500 uppercase">Period</div>
              <div className="text-sm font-extrabold text-slate-900 mt-1">{parseMeta.periodStart || "—"} → {parseMeta.periodEnd || "—"}</div>
            </div>
            <div className="surface p-4 border-slate-200">
              <div className="text-xs font-bold text-slate-500 uppercase">Txns</div>
              <div className="text-sm font-extrabold text-slate-900 mt-1">{parseMeta.transactions?.length || 0}</div>
            </div>
            <div className="surface p-4 border-slate-200">
              <div className="text-xs font-bold text-slate-500 uppercase">Preview</div>
              <div className="text-xs text-slate-500 mt-1">Scroll below for parsed rows.</div>
            </div>
          </div>
        )}
      </div>

      {parseMeta?.transactions?.length > 0 && (
        <div className="surface p-6">
          <div className="font-extrabold text-slate-900">Parsed transactions (preview)</div>
          <div className="mt-3 overflow-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold">
                <tr>
                  <th className="p-3 text-left">Date</th>
                  <th className="p-3 text-left">Narration</th>
                  <th className="p-3 text-right">Debit</th>
                  <th className="p-3 text-right">Credit</th>
                  <th className="p-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {txPreview.map((t, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-3 font-mono text-xs text-slate-600 whitespace-nowrap">{t.date}</td>
                    <td className="p-3 text-slate-800 max-w-[520px] truncate">{t.narration}</td>
                    <td className="p-3 text-right text-slate-700">{fmtInr(t.debit || 0)}</td>
                    <td className="p-3 text-right text-emerald-700">{fmtInr(t.credit || 0)}</td>
                    <td className="p-3 text-right text-slate-700">{t.balance == null ? "—" : fmtInr(t.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {parseMeta.transactions.length > txPreview.length && (
            <div className="text-xs text-slate-500 mt-2">Showing first {txPreview.length} rows.</div>
          )}
        </div>
      )}

      <div className="surface p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="font-extrabold text-slate-900">Saved underwriting runs</div>
          <div className="text-xs text-slate-500">{apps.length} runs</div>
        </div>
        <div className="mt-3 overflow-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold">
              <tr>
                <th className="p-3 text-left">Created</th>
                <th className="p-3 text-left">Period</th>
                <th className="p-3 text-left">Bank</th>
                <th className="p-3 text-right">Ask</th>
                <th className="p-3 text-left">Summary</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {apps.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="p-3 font-mono text-xs text-slate-600 whitespace-nowrap">{String(a.created_at || "").replace("T", " ").slice(0, 16)}</td>
                  <td className="p-3 text-slate-700 whitespace-nowrap">{a.period_start || "—"} → {a.period_end || "—"}</td>
                  <td className="p-3 text-slate-700">{a.bank_name || "—"} {a.account_type ? `(${a.account_type})` : ""}</td>
                  <td className="p-3 text-right text-slate-700">{fmtInr(a.requested_exposure || 0)}</td>
                  <td className="p-3 text-slate-700 max-w-[520px] truncate">{a.aggressive_summary || ""}</td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {onProceedToPd && (
                        <button className="btn-secondary px-3 py-2" onClick={() => onProceedToPd(a.id, selectedLead.id)} title="Proceed to PD">
                          <ArrowRight size={16} />
                        </button>
                      )}
                      <button className="btn-secondary px-3 py-2" onClick={() => loadApp(a.id)} title="View">
                        <Eye size={16} />
                      </button>
                      <button className="btn-secondary px-3 py-2" onClick={() => deleteApp(a.id)} title="Delete">
                        <Trash2 size={16} className="text-red-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {apps.length === 0 && (
                <tr>
                  <td colSpan="6" className="p-6 text-center text-slate-400 italic">No underwriting runs yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-6">
          <div className="surface p-4 lg:sticky lg:top-6 self-start">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Underwriting</div>
            <div className="text-sm font-extrabold text-slate-900 mt-1">{selectedLead?.name || "—"}</div>
            <div className="text-xs text-slate-500 mt-1">
              {result.periodStart || parseMeta?.periodStart || openApp?.period_start || "—"} →{" "}
              {result.periodEnd || parseMeta?.periodEnd || openApp?.period_end || "—"}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                { key: "bank", label: "Bank" },
                { key: "gst", label: "GST" },
                { key: "itr", label: "ITR" },
                { key: "cross", label: "Cross" },
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setReportTab(t.key)}
                  className={`px-3 py-2 rounded-lg text-sm font-extrabold border transition-colors ${
                    reportTab === t.key ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="mt-4 space-y-1 text-sm">
              <a href="#uw_verdict" className="block rounded-lg px-3 py-2 font-bold text-slate-900 hover:bg-slate-50">
                Verdict
              </a>
              {reportTab === "bank" ? (
                <>
                  <a href="#uw_snapshot" className="block rounded-lg px-3 py-2 font-medium text-slate-700 hover:bg-slate-50">
                    Cash power snapshot
                  </a>
                  <a href="#uw_heatmaps" className="block rounded-lg px-3 py-2 font-medium text-slate-700 hover:bg-slate-50">
                    Heat maps
                  </a>
                  <a href="#uw_competition" className="block rounded-lg px-3 py-2 font-medium text-slate-700 hover:bg-slate-50">
                    Competition
                  </a>
                  <a href="#uw_triggers" className="block rounded-lg px-3 py-2 font-medium text-slate-700 hover:bg-slate-50">
                    Early warnings
                  </a>
                </>
              ) : (
                <a href="#uw_docs" className="block rounded-lg px-3 py-2 font-medium text-slate-700 hover:bg-slate-50">
                  Details
                </a>
              )}
              <a href="#uw_rules" className="block rounded-lg px-3 py-2 font-medium text-slate-700 hover:bg-slate-50">
                Rule run log
              </a>
              <a href="#uw_summary" className="block rounded-lg px-3 py-2 font-medium text-slate-700 hover:bg-slate-50">
                Street summary
              </a>
            </div>
          </div>

          <div className="space-y-6 min-w-0">
            <section id="uw_verdict" className="surface p-6 scroll-mt-24">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Credit & Recovery Intelligence</div>
                  <div className="text-2xl font-extrabold text-slate-900 mt-1">Aggressive underwriting verdict</div>
                  <div className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">{result.aggressiveSummary}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-bold text-slate-500 uppercase">Risk Fit</div>
                  <div className="text-xl font-extrabold text-slate-900">{String(result.verdict?.riskFit || "—")}</div>
                  <div className="text-sm text-slate-600">Grade {result.verdict?.riskGrade} • Score {result.verdict?.score}</div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-xs font-bold text-slate-500 uppercase">Recommended Exposure</div>
                  <div className="text-xl font-extrabold text-slate-900 mt-1">{fmtInr(result.recommendation?.recommendedExposure || 0)}</div>
                  <div className="text-xs text-slate-500 mt-1">Ask: {fmtInr(selectedLead?.loanAmount || 0)}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-xs font-bold text-slate-500 uppercase">Collections</div>
                  <div className="text-xl font-extrabold text-slate-900 mt-1">
                    {result.recommendation?.collectionFrequency} {fmtInr(result.recommendation?.collectionAmount || 0)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Tenure: {result.recommendation?.tenureMonths || 0} months</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-xs font-bold text-slate-500 uppercase">Pricing + Upfront</div>
                  <div className="text-xl font-extrabold text-slate-900 mt-1">{Number(result.recommendation?.pricingApr || 0).toFixed(1)}% APR</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Upfront: {Math.round((result.recommendation?.upfrontDeductionPct || 0) * 100)}% • {fmtInr(result.recommendation?.upfrontDeductionAmt || 0)}
                  </div>
                </div>
              </div>
            </section>

            {reportTab === "bank" && (
              <>
            <section id="uw_snapshot" className="surface p-6 scroll-mt-24">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Snapshot</div>
                  <div className="text-xl font-extrabold text-slate-900 mt-1">Account & cash power</div>
                </div>
                <div className="text-xs text-slate-500">Decision-support metrics</div>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                {(() => {
                  const byKey = Object.fromEntries((result.metrics || []).map((m) => [m.key, m]));
                  const pick = (key) => byKey[key]?.value ?? null;
                  return (
                    <>
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="text-xs font-bold text-slate-500 uppercase">Avg monthly credits</div>
                        <div className="text-lg font-extrabold text-slate-900 mt-1">{fmtInr(pick("avg_monthly_credits") || 0)}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="text-xs font-bold text-slate-500 uppercase">Avg usable balance</div>
                        <div className="text-lg font-extrabold text-slate-900 mt-1">{fmtInr(pick("avg_usable_balance") || 0)}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="text-xs font-bold text-slate-500 uppercase">Low balance days</div>
                        <div className="text-lg font-extrabold text-slate-900 mt-1">{Math.round(Number(pick("low_balance_days") || 0))}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="text-xs font-bold text-slate-500 uppercase">Fixed obligations (est.)</div>
                        <div className="text-lg font-extrabold text-slate-900 mt-1">{fmtInr(pick("fixed_obligation_estimate_monthly") || 0)}</div>
                      </div>
                    </>
                  );
                })()}
              </div>

              {result.cashVelocityControl && (
                <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Cash velocity & control</div>
                  <div className="text-sm text-slate-800 mt-2">{result.cashVelocityControl.commentary}</div>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs font-bold text-slate-500 uppercase">Top inflow weekday</div>
                      <div className="font-extrabold text-slate-900 mt-1">{result.cashVelocityControl.topInflowWeekday || "—"}</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs font-bold text-slate-500 uppercase">Top month days</div>
                      <div className="font-extrabold text-slate-900 mt-1">
                        {(result.cashVelocityControl.topInflowMonthDays || []).length ? result.cashVelocityControl.topInflowMonthDays.join(", ") : "—"}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs font-bold text-slate-500 uppercase">Borrower type</div>
                      <div className="font-extrabold text-slate-900 mt-1">{result.cashVelocityControl.borrowerType || "—"}</div>
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section id="uw_heatmaps" className="surface p-6 scroll-mt-24">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Dependency</div>
              <div className="text-xl font-extrabold text-slate-900 mt-1">Counterparty heat maps</div>

              <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="min-w-0">
                  <div className="font-extrabold text-slate-900">Credits</div>
                  <div className="mt-3 overflow-auto rounded-xl border border-slate-200 bg-white">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold">
                        <tr>
                          <th className="p-3 text-left sticky top-0 bg-slate-50 z-10">Counterparty</th>
                          <th className="p-3 text-left sticky top-0 bg-slate-50 z-10">Nature</th>
                          <th className="p-3 text-right sticky top-0 bg-slate-50 z-10">Freq</th>
                          <th className="p-3 text-right sticky top-0 bg-slate-50 z-10">Avg Amt</th>
                          <th className="p-3 text-right sticky top-0 bg-slate-50 z-10">% Credits</th>
                          <th className="p-3 text-left sticky top-0 bg-slate-50 z-10">Dependency</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(result.creditHeatMap || []).map((r, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-3 font-bold text-slate-800 whitespace-nowrap">{r.counterparty}</td>
                            <td className="p-3 text-slate-700 whitespace-nowrap">{r.nature}</td>
                            <td className="p-3 text-right text-slate-700">{r.freq}</td>
                            <td className="p-3 text-right text-slate-700">{fmtInr(r.avgAmt || 0)}</td>
                            <td className="p-3 text-right font-mono text-slate-700">{Number(r.pctOfTotal || 0).toFixed(1)}%</td>
                            <td className="p-3 text-slate-700">{r.dependency || "—"}</td>
                          </tr>
                        ))}
                        {(!result.creditHeatMap || result.creditHeatMap.length === 0) && (
                          <tr><td colSpan="6" className="p-4 text-center text-slate-400 italic">No credit rows.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="font-extrabold text-slate-900">Debits</div>
                  <div className="mt-3 overflow-auto rounded-xl border border-slate-200 bg-white">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold">
                        <tr>
                          <th className="p-3 text-left sticky top-0 bg-slate-50 z-10">Counterparty</th>
                          <th className="p-3 text-left sticky top-0 bg-slate-50 z-10">Type</th>
                          <th className="p-3 text-right sticky top-0 bg-slate-50 z-10">Freq</th>
                          <th className="p-3 text-right sticky top-0 bg-slate-50 z-10">Avg Amt</th>
                          <th className="p-3 text-right sticky top-0 bg-slate-50 z-10">% Debits</th>
                          <th className="p-3 text-left sticky top-0 bg-slate-50 z-10">Priority</th>
                          <th className="p-3 text-left sticky top-0 bg-slate-50 z-10">Flexi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(result.debitHeatMap || []).map((r, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-3 font-bold text-slate-800 whitespace-nowrap">{r.counterparty}</td>
                            <td className="p-3 text-slate-700 whitespace-nowrap">{r.nature}</td>
                            <td className="p-3 text-right text-slate-700">{r.freq}</td>
                            <td className="p-3 text-right text-slate-700">{fmtInr(r.avgAmt || 0)}</td>
                            <td className="p-3 text-right font-mono text-slate-700">{Number(r.pctOfTotal || 0).toFixed(1)}%</td>
                            <td className="p-3 text-slate-700">{r.priorityLevel || "—"}</td>
                            <td className="p-3 text-slate-700">{r.flexi || "—"}</td>
                          </tr>
                        ))}
                        {(!result.debitHeatMap || result.debitHeatMap.length === 0) && (
                          <tr><td colSpan="7" className="p-4 text-center text-slate-400 italic">No debit rows.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </section>

            <section id="uw_competition" className="surface p-6 scroll-mt-24">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Competition</div>
              <div className="text-xl font-extrabold text-slate-900 mt-1">Private lender overlap & stacking risk</div>
              <div className="text-sm text-slate-700 mt-2">{result.privateLenderCompetition?.summary || "—"}</div>
              <div className="mt-3 text-xs text-slate-500">
                Evidence is narration/round-figure/weekly-pattern based. Confirm lender list during PD.
              </div>

              {Array.isArray(result.privateLenderCompetition?.evidence) && result.privateLenderCompetition.evidence.length ? (
                <div className="mt-4 overflow-auto rounded-xl border border-slate-200 bg-white">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold">
                      <tr>
                        <th className="p-3 text-left sticky top-0 bg-slate-50 z-10">Date</th>
                        <th className="p-3 text-left sticky top-0 bg-slate-50 z-10">Direction</th>
                        <th className="p-3 text-right sticky top-0 bg-slate-50 z-10">Amount</th>
                        <th className="p-3 text-left sticky top-0 bg-slate-50 z-10">Narration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {result.privateLenderCompetition.evidence.slice(0, 18).map((e, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-3 font-mono text-xs text-slate-600 whitespace-nowrap">{e.date}</td>
                          <td className="p-3 text-slate-700">{e.direction}</td>
                          <td className="p-3 text-right text-slate-700">{fmtInr(e.amount || 0)}</td>
                          <td className="p-3 text-slate-800 max-w-[640px] truncate">{e.narration}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </section>

            <section id="uw_triggers" className="surface p-6 scroll-mt-24">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Early warning system</div>
              <div className="text-xl font-extrabold text-slate-900 mt-1">Triggers & hard-stop alerts</div>
              <div className="mt-4 space-y-2">
                {(result.triggers || []).slice(0, 12).map((t, idx) => (
                  <div key={idx} className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="text-xs font-bold text-slate-500 uppercase">{t.severity} • {t.triggerType}</div>
                    <div className="text-sm text-slate-800 mt-1">{t.description}</div>
                  </div>
                ))}
                {(!result.triggers || result.triggers.length === 0) && (
                  <div className="text-sm text-slate-400 italic">No triggers.</div>
                )}
              </div>
            </section>
              </>
            )}

            {reportTab !== "bank" && (
              <section id="uw_docs" className="surface p-6 scroll-mt-24">
                {reportTab === "gst" && (
                  <div className="space-y-6">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-500">GST</div>
                      <div className="text-xl font-extrabold text-slate-900 mt-1">Filing discipline + turnover trend</div>
                      <div className="text-sm text-slate-700 mt-2">{result.gst?.commentary || "No GST input provided."}</div>
                    </div>

                    {result.gst && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                          <div className="text-xs font-bold text-slate-500 uppercase">Volatility</div>
                          <div className="text-lg font-extrabold text-slate-900 mt-1">{result.gst.volatilityBucket || "—"}</div>
                          <div className="text-xs text-slate-500 mt-1">CV: {Number(result.gst.volatilityScore || 0).toFixed(2)}</div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                          <div className="text-xs font-bold text-slate-500 uppercase">Seasonality</div>
                          <div className="text-lg font-extrabold text-slate-900 mt-1">{result.gst.seasonalityBucket || "—"}</div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                          <div className="text-xs font-bold text-slate-500 uppercase">Discipline</div>
                          <div className="text-sm text-slate-800 mt-1">
                            Missed: <span className="font-bold">{Math.round(Number(result.gst.filingGapCount || 0))}</span>
                            {" • "}Late: <span className="font-bold">{Math.round(Number(result.gst.lateFilingCount || 0))}</span>
                          </div>
                          {Array.isArray(result.gst.missingMonths) && result.gst.missingMonths.length ? (
                            <div className="text-[11px] text-slate-500 mt-2">
                              Missing months: {result.gst.missingMonths.slice(0, 8).join(", ")}
                              {result.gst.missingMonths.length > 8 ? "…" : ""}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )}

                    {Array.isArray(result.crossVerification?.rows) && result.crossVerification.rows.length ? (
                      <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold">
                            <tr>
                              <th className="p-3 text-left sticky top-0 bg-slate-50 z-10">Month</th>
                              <th className="p-3 text-right sticky top-0 bg-slate-50 z-10">Turnover</th>
                              <th className="p-3 text-right sticky top-0 bg-slate-50 z-10">Tax paid</th>
                              <th className="p-3 text-left sticky top-0 bg-slate-50 z-10">Filing status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {result.crossVerification.rows.slice(0, 24).map((r, idx) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="p-3 font-mono text-xs text-slate-600 whitespace-nowrap">{r.month}</td>
                                <td className="p-3 text-right text-slate-700">{r.gstTurnover == null ? "—" : fmtInr(r.gstTurnover)}</td>
                                <td className="p-3 text-right text-slate-700">{r.gstTaxPaid == null ? "—" : fmtInr(r.gstTaxPaid)}</td>
                                <td className="p-3 text-slate-700">{r.gstFilingStatus || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-sm text-slate-400 italic">Add GST months to see a month-wise trend table.</div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="font-extrabold text-slate-900">GST risk flags (rules)</div>
                        <div className="mt-3 overflow-auto rounded-xl border border-slate-200 bg-white">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold">
                              <tr>
                                <th className="p-3 text-left sticky top-0 bg-slate-50 z-10">Rule</th>
                                <th className="p-3 text-left sticky top-0 bg-slate-50 z-10">Severity</th>
                                <th className="p-3 text-left sticky top-0 bg-slate-50 z-10">Reason</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {(result.ruleRunLog || [])
                                .filter((x) => String(x.id || "").startsWith("GST-") && x.passed === false)
                                .map((x) => (
                                  <tr key={x.id} className="hover:bg-slate-50">
                                    <td className="p-3 font-mono text-xs text-slate-600 whitespace-nowrap">{x.id}</td>
                                    <td className="p-3 text-slate-700">{x.severity}</td>
                                    <td className="p-3 text-slate-800 max-w-[520px] truncate">{x.reason}</td>
                                  </tr>
                                ))}
                              {(result.ruleRunLog || []).filter((x) => String(x.id || "").startsWith("GST-") && x.passed === false).length === 0 && (
                                <tr><td colSpan="3" className="p-4 text-center text-slate-400 italic">No GST flags.</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="font-extrabold text-slate-900">Generate doubts from GST (preview)</div>
                        <div className="mt-3 space-y-2">
                          {gstDoubts.map((q) => (
                            <div key={q.code} className="rounded-xl border border-slate-200 bg-white p-3">
                              <div className="text-xs font-bold text-slate-500 uppercase">{q.severity}</div>
                              <div className="text-sm text-slate-800 mt-1">{q.question_text}</div>
                            </div>
                          ))}
                          {gstDoubts.length === 0 && <div className="text-sm text-slate-400 italic">No GST doubts generated.</div>}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {reportTab === "itr" && (
                  <div className="space-y-6">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-500">ITR</div>
                      <div className="text-xl font-extrabold text-slate-900 mt-1">ITR summary + YoY sanity</div>
                      <div className="text-sm text-slate-700 mt-2">{result.itr?.commentary || "No ITR input provided."}</div>
                    </div>

                    {result.itr && (
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                          <div className="text-xs font-bold text-slate-500 uppercase">Turnover</div>
                          <div className="text-lg font-extrabold text-slate-900 mt-1">{fmtInr(result.itr.latestTurnover || 0)}</div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                          <div className="text-xs font-bold text-slate-500 uppercase">Profit</div>
                          <div className="text-lg font-extrabold text-slate-900 mt-1">{fmtInr(result.itr.latestProfit || 0)}</div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                          <div className="text-xs font-bold text-slate-500 uppercase">Margin</div>
                          <div className="text-lg font-extrabold text-slate-900 mt-1">{Number(result.itr.latestMarginPct || 0).toFixed(1)}%</div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                          <div className="text-xs font-bold text-slate-500 uppercase">Tax paid</div>
                          <div className="text-lg font-extrabold text-slate-900 mt-1">{fmtInr(result.itr.latestTaxPaid || 0)}</div>
                        </div>
                      </div>
                    )}

                    {result.itr?.years?.length ? (
                      <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold">
                            <tr>
                              <th className="p-3 text-left sticky top-0 bg-slate-50 z-10">Year</th>
                              <th className="p-3 text-right sticky top-0 bg-slate-50 z-10">Turnover</th>
                              <th className="p-3 text-right sticky top-0 bg-slate-50 z-10">Profit</th>
                              <th className="p-3 text-right sticky top-0 bg-slate-50 z-10">Tax paid</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {(result.itr.years || []).slice(0, 8).map((y, idx) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="p-3 font-mono text-xs text-slate-600 whitespace-nowrap">{y.year}</td>
                                <td className="p-3 text-right text-slate-700">{fmtInr(y.turnover || 0)}</td>
                                <td className="p-3 text-right text-slate-700">{fmtInr(y.profit || 0)}</td>
                                <td className="p-3 text-right text-slate-700">{fmtInr(y.taxPaid || 0)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-sm text-slate-400 italic">Add ITR years to populate YoY and tax logic.</div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="font-extrabold text-slate-900">ITR risk flags (rules)</div>
                        <div className="mt-3 overflow-auto rounded-xl border border-slate-200 bg-white">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold">
                              <tr>
                                <th className="p-3 text-left sticky top-0 bg-slate-50 z-10">Rule</th>
                                <th className="p-3 text-left sticky top-0 bg-slate-50 z-10">Severity</th>
                                <th className="p-3 text-left sticky top-0 bg-slate-50 z-10">Reason</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {(result.ruleRunLog || [])
                                .filter((x) => String(x.id || "").startsWith("ITR-") && x.passed === false)
                                .map((x) => (
                                  <tr key={x.id} className="hover:bg-slate-50">
                                    <td className="p-3 font-mono text-xs text-slate-600 whitespace-nowrap">{x.id}</td>
                                    <td className="p-3 text-slate-700">{x.severity}</td>
                                    <td className="p-3 text-slate-800 max-w-[520px] truncate">{x.reason}</td>
                                  </tr>
                                ))}
                              {(result.ruleRunLog || []).filter((x) => String(x.id || "").startsWith("ITR-") && x.passed === false).length === 0 && (
                                <tr><td colSpan="3" className="p-4 text-center text-slate-400 italic">No ITR flags.</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="font-extrabold text-slate-900">Generate doubts from ITR (preview)</div>
                        <div className="mt-3 space-y-2">
                          {itrDoubts.map((q) => (
                            <div key={q.code} className="rounded-xl border border-slate-200 bg-white p-3">
                              <div className="text-xs font-bold text-slate-500 uppercase">{q.severity}</div>
                              <div className="text-sm text-slate-800 mt-1">{q.question_text}</div>
                            </div>
                          ))}
                          {itrDoubts.length === 0 && <div className="text-sm text-slate-400 italic">No ITR doubts generated.</div>}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {reportTab === "cross" && (
                  <div className="space-y-6">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Cross-Verification</div>
                      <div className="text-xl font-extrabold text-slate-900 mt-1">Credibility score + reconciliation</div>
                    </div>

                    {result.credibility ? (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="rounded-xl border border-slate-200 bg-white p-5">
                          <div className="text-xs font-bold text-slate-500 uppercase">Business Credibility Score</div>
                          <div className="text-4xl font-extrabold text-slate-900 mt-2">{result.credibility.score}</div>
                          <div className="text-sm text-slate-600 mt-1">Band: <span className="font-bold text-slate-900">{result.credibility.band}</span></div>
                          {Array.isArray(result.credibility.reasons) && result.credibility.reasons.length ? (
                            <div className="text-xs text-slate-500 mt-3">Drivers: {result.credibility.reasons.join(", ")}</div>
                          ) : null}
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-5">
                          <div className="text-xs font-bold text-slate-500 uppercase">Contributors</div>
                          <div className="mt-3 space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-slate-600">GST score</span><span className="font-bold text-slate-900">{result.credibility.gstScore}</span></div>
                            <div className="flex justify-between"><span className="text-slate-600">ITR score</span><span className="font-bold text-slate-900">{result.credibility.itrScore}</span></div>
                            <div className="flex justify-between"><span className="text-slate-600">Mismatch penalty</span><span className="font-bold text-slate-900">{result.credibility.mismatchPenalty}</span></div>
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-5">
                          <div className="text-xs font-bold text-slate-500 uppercase">Trend (last 3)</div>
                          <div className="mt-3 space-y-2 text-sm">
                            {(credTrend || []).map((t, idx) => (
                              <div key={idx} className="flex justify-between">
                                <span className="text-slate-600">{String(t.created_at || "").slice(0, 10)}</span>
                                <span className="font-bold text-slate-900">{Math.round(Number(t.score || 0))}</span>
                              </div>
                            ))}
                            {(!credTrend || credTrend.length === 0) && <div className="text-slate-400 italic">No prior runs.</div>}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500 italic">Credibility score requires GST/ITR inputs.</div>
                    )}

                    {result.crossVerification ? (
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="font-extrabold text-slate-900">GST vs Bank monthly reconciliation</div>
                        <div className="text-sm text-slate-700 mt-2">{result.crossVerification?.commentary || "—"}</div>
                        {Array.isArray(result.crossVerification?.rows) && result.crossVerification.rows.length ? (
                          <div className="mt-3 overflow-auto rounded-xl border border-slate-200 bg-white">
                            <table className="w-full text-sm">
                              <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold">
                                <tr>
                                  <th className="p-3 text-left sticky top-0 bg-slate-50 z-10">Month</th>
                                  <th className="p-3 text-right sticky top-0 bg-slate-50 z-10">GST Turnover</th>
                                  <th className="p-3 text-right sticky top-0 bg-slate-50 z-10">Bank Credits</th>
                                  <th className="p-3 text-right sticky top-0 bg-slate-50 z-10">Variance %</th>
                                  <th className="p-3 text-left sticky top-0 bg-slate-50 z-10">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {result.crossVerification.rows.slice(0, 24).map((r, idx) => {
                                  const varianceAbs = r.diffPct == null ? null : Math.abs(Number(r.diffPct || 0));
                                  const status =
                                    r.gstFilingStatus === "Missing"
                                      ? "Missing"
                                      : varianceAbs == null
                                        ? "No GST value"
                                        : varianceAbs <= 10
                                          ? "OK"
                                          : varianceAbs <= 25
                                            ? "Needs Review"
                                            : "Critical";
                                  const chip =
                                    status === "OK"
                                      ? "chip bg-emerald-50 border-emerald-200 text-emerald-700"
                                      : status === "Needs Review"
                                        ? "chip bg-amber-50 border-amber-200 text-amber-700"
                                        : "chip bg-red-50 border-red-200 text-red-700";
                                  return (
                                    <tr key={idx} className="hover:bg-slate-50">
                                      <td className="p-3 font-mono text-xs text-slate-600 whitespace-nowrap">{r.month}</td>
                                      <td className="p-3 text-right text-slate-700">{r.gstTurnover == null ? "—" : fmtInr(r.gstTurnover)}</td>
                                      <td className="p-3 text-right text-slate-700">{fmtInr(r.bankCredits || 0)}</td>
                                      <td className="p-3 text-right font-mono text-slate-700">{varianceAbs == null ? "—" : `${varianceAbs.toFixed(1)}%`}</td>
                                      <td className="p-3"><span className={chip}>{status}</span></td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="font-extrabold text-slate-900">Generate doubts (cross-verification) — preview</div>
                      <div className="mt-3 space-y-2">
                        {crossDoubts.map((q) => (
                          <div key={q.code} className="rounded-xl border border-slate-200 bg-white p-3">
                            <div className="text-xs font-bold text-slate-500 uppercase">{q.severity}</div>
                            <div className="text-sm text-slate-800 mt-1">{q.question_text}</div>
                          </div>
                        ))}
                        {crossDoubts.length === 0 && <div className="text-sm text-slate-400 italic">No cross-verification doubts generated.</div>}
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}

            <section id="uw_rules" className="surface p-6 scroll-mt-24">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Explainability</div>
              <div className="text-xl font-extrabold text-slate-900 mt-1">Rule run log</div>
              <div className="mt-4 overflow-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold">
                    <tr>
                      <th className="p-3 text-left sticky top-0 bg-slate-50 z-10">Rule</th>
                      <th className="p-3 text-left sticky top-0 bg-slate-50 z-10">Category</th>
                      <th className="p-3 text-left sticky top-0 bg-slate-50 z-10">Severity</th>
                      <th className="p-3 text-right sticky top-0 bg-slate-50 z-10">Δ Score</th>
                      <th className="p-3 text-left sticky top-0 bg-slate-50 z-10">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(result.ruleRunLog || []).map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-3 font-mono text-xs text-slate-600 whitespace-nowrap">{r.id}</td>
                        <td className="p-3 text-slate-700">{r.category}</td>
                        <td className="p-3 text-slate-700">{r.severity}</td>
                        <td className="p-3 text-right font-mono text-slate-700">{r.scoreDelta}</td>
                        <td className="p-3 text-slate-800 max-w-[680px] truncate">{r.reason}</td>
                      </tr>
                    ))}
                    {(!result.ruleRunLog || result.ruleRunLog.length === 0) && (
                      <tr><td colSpan="5" className="p-4 text-center text-slate-400 italic">No rule log.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section id="uw_summary" className="surface p-6 scroll-mt-24">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Final</div>
              <div className="text-xl font-extrabold text-slate-900 mt-1">Street-level summary</div>
              <div className="text-sm text-slate-800 mt-3">{result.verdict?.streetSummary || "—"}</div>
              <div className="text-sm text-slate-600 mt-2">{result.verdict?.recoveryLeverageSummary || ""}</div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
