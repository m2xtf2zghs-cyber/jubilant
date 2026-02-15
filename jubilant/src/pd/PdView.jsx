import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, ShieldAlert, UploadCloud } from "lucide-react";
import { generateDynamicDoubts } from "./dynamicDoubts.js";

const fmtInr = (n) => {
  const x = Math.round(Number(n) || 0);
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(x);
  } catch {
    return `₹${x}`;
  }
};

const chipClass = (sev) => {
  if (sev === "Immediate Action") return "chip bg-red-50 border-red-200 text-red-700";
  if (sev === "High Risk") return "chip bg-orange-50 border-orange-200 text-orange-700";
  return "chip bg-slate-50 border-slate-200 text-slate-700";
};

const answerField = (q, value, onChange) => {
  const type = String(q.answer_type || "text");
  if (type === "number") {
    return (
      <input
        className="w-full py-3"
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter number…"
      />
    );
  }
  if (type === "date") {
    return (
      <input
        className="w-full py-3"
        type="date"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (type === "yes-no") {
    return (
      <select className="w-full py-3" value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        <option value="Yes">Yes</option>
        <option value="No">No</option>
      </select>
    );
  }
  if (type === "select") {
    const opts = Array.isArray(q.options_json) ? q.options_json : [];
    return (
      <select className="w-full py-3" value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {opts.map((o) => (
          <option key={String(o)} value={String(o)}>
            {String(o)}
          </option>
        ))}
      </select>
    );
  }

  return (
    <textarea
      className="w-full p-3 border rounded-lg h-24 resize-none text-sm bg-white"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Type answer…"
    />
  );
};

export default function PdView({ backend, applicationId, lead = null, isAdmin = false, onBack }) {
  const supabase = backend?.supabase;
  const user = backend?.user;
  const backendEnabled = Boolean(backend?.enabled && supabase && user && applicationId);

  const iframeRef = useRef(null);
  const saveTimer = useRef(null);
  const pendingDraft = useRef(null);

  const [app, setApp] = useState(null);
  const [session, setSession] = useState(null);
  const [draft, setDraft] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answersByQ, setAnswersByQ] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [doubtsOpen, setDoubtsOpen] = useState(false);

  const ownerId = app?.owner_id || lead?.ownerId || null;

  const underwriting = useMemo(() => app?.report_json || null, [app]);

  // NOTE: We intentionally keep this empty for MVP so we don't accidentally suppress important
  // underwriting-driven doubts. If you want strict de-dup later, we can map PD master fields → doubt codes.
  const coveredCodes = useMemo(() => [], []);

  const buildPrefillDraftFromUnderwriting = (uw, basePrefill) => {
    const fiscalMonths = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const toMonthName = (yyyyMm) => {
      const s = String(yyyyMm || "");
      const m = s.match(/^(\d{4})-(\d{2})$/);
      if (!m) return null;
      const mm = Number(m[2]);
      if (!Number.isFinite(mm) || mm < 1 || mm > 12) return null;
      return monthNames[mm - 1];
    };

    const crossRows = Array.isArray(uw?.crossVerification?.rows) ? uw.crossVerification.rows : [];
    if (crossRows.length === 0) return null;

    const byMonth = new Map(); // monthName -> { ym, gst, bank }
    for (const r of crossRows) {
      const mn = toMonthName(r?.month);
      if (!mn) continue;
      const ym = String(r?.month || "");
      const prev = byMonth.get(mn);
      if (!prev || ym > prev.ym) {
        byMonth.set(mn, { ym, gst: r?.gstTurnover ?? "", bank: r?.bankCredits ?? "" });
      }
    }

    const monthly = fiscalMonths.map((mn) => {
      const x = byMonth.get(mn);
      return { month: mn, gst: x?.gst ?? "", bank: x?.bank ?? "" };
    });

    return {
      inputs: basePrefill || {},
      tables: { const: [], govt: [], market: [], monthly },
      decisionStatus: "Pending",
    };
  };

  const prefill = useMemo(() => {
    const rec = underwriting?.recommendation || {};
    const metrics = Array.isArray(underwriting?.metrics) ? underwriting.metrics : [];
    const avgMonthlyCredits = metrics.find((m) => m?.key === "avg_monthly_credits")?.value ?? null;
    const bounceReturnCount = metrics.find((m) => m?.key === "bounce_return_count")?.value ?? null;
    return {
      c_name: lead?.name || "",
      c_phone: lead?.phone || "",
      c_address: lead?.location || "",
      // PD Master v50 banking snapshot (best-effort prefill)
      b_turnover: avgMonthlyCredits == null ? "" : String(Math.round(Number(avgMonthlyCredits) || 0)),
      b_bounce: bounceReturnCount == null ? "" : String(Math.round(Number(bounceReturnCount) || 0)),
      p_amt: rec.recommendedExposure ? String(Math.round(Number(rec.recommendedExposure || 0))) : "",
      p_roi: rec.pricingApr ? String(Number(rec.pricingApr || 0).toFixed(1)) : "",
      p_ten: rec.tenureMonths ? String(rec.tenureMonths) : "",
    };
  }, [lead, underwriting]);

  const immediatePending = useMemo(
    () =>
      questions.filter((q) => q.severity === "Immediate Action" && q.status !== "Resolved" && q.status !== "Waived"),
    [questions],
  );

  const anyPending = useMemo(() => questions.some((q) => q.status !== "Resolved" && q.status !== "Waived"), [questions]);

  const refreshAll = async () => {
    if (!backendEnabled) return;
    setError("");
    setBusy(true);
    try {
      const { data: appRow, error: aErr } = await supabase
        .from("underwriting_applications")
        .select("id,lead_id,owner_id,created_by,created_at,bank_name,account_type,requested_exposure,report_json")
        .eq("id", applicationId)
        .limit(1)
        .maybeSingle();
      if (aErr) throw aErr;
      if (!appRow) throw new Error("Underwriting run not found.");
      setApp(appRow);

      const owner = appRow.owner_id;
      // Avoid `upsert` here so we don't accidentally overwrite `created_by` on existing sessions (audit).
      const { data: existingSess, error: esErr } = await supabase
        .from("pd_sessions")
        .select("*")
        .eq("application_id", appRow.id)
        .limit(1)
        .maybeSingle();
      if (esErr) throw esErr;

      let sess = existingSess;
      if (!sess) {
        const { data: createdSess, error: sErr } = await supabase
          .from("pd_sessions")
          .insert({ application_id: appRow.id, owner_id: owner, created_by: user.id, status: "in_progress", open_items_status: "pending" })
          .select("*")
          .single();
        if (sErr) throw sErr;
        sess = createdSess;
      }
      setSession(sess);

      const { data: pdAns, error: pErr } = await supabase
        .from("pd_answers")
        .select("*")
        .eq("pd_session_id", sess.id)
        .eq("field_key", "__pd_master_v50_json")
        .limit(1)
        .maybeSingle();
      if (pErr) throw pErr;
      const existingDraft = pdAns?.value_json || null;
      setDraft(existingDraft);

      // First-time prefill: populate the Monthly GST↔Bank table in PD Master v50 from underwriting cross-verification,
      // but only if there isn't already a saved PD draft.
      if (!existingDraft && appRow.report_json) {
        const rec = appRow.report_json?.recommendation || {};
        const metrics = Array.isArray(appRow.report_json?.metrics) ? appRow.report_json.metrics : [];
        const avgMonthlyCredits = metrics.find((m) => m?.key === "avg_monthly_credits")?.value ?? null;
        const bounceReturnCount = metrics.find((m) => m?.key === "bounce_return_count")?.value ?? null;
        const prefillForInit = {
          c_name: lead?.name || "",
          c_phone: lead?.phone || "",
          c_address: lead?.location || "",
          b_turnover: avgMonthlyCredits == null ? "" : String(Math.round(Number(avgMonthlyCredits) || 0)),
          b_bounce: bounceReturnCount == null ? "" : String(Math.round(Number(bounceReturnCount) || 0)),
          p_amt: rec.recommendedExposure ? String(Math.round(Number(rec.recommendedExposure || 0))) : "",
          p_roi: rec.pricingApr ? String(Number(rec.pricingApr || 0).toFixed(1)) : "",
          p_ten: rec.tenureMonths ? String(rec.tenureMonths) : "",
        };

        const initDraft = buildPrefillDraftFromUnderwriting(appRow.report_json, prefillForInit);
        if (initDraft) {
          const { error: initErr } = await supabase
            .from("pd_answers")
            .upsert(
              {
                pd_session_id: sess.id,
                owner_id: owner,
                created_by: user.id,
                updated_by: user.id,
                field_key: "__pd_master_v50_json",
                field_label: "PD Master v50 JSON",
                value_json: initDraft,
              },
              { onConflict: "pd_session_id,field_key" },
            );
          if (initErr) throw initErr;
          setDraft(initDraft);
        }
      }

      // Generate + upsert doubts
      const generated = generateDynamicDoubts(appRow.report_json || {}, { coveredCodes });
      const rows = generated
        .filter((q) => !q.coveredByPd)
        .map((q) => ({
          pd_session_id: sess.id,
          owner_id: owner,
          created_by: user.id,
          code: q.code,
          severity: q.severity,
          category: q.category,
          question_text: q.question_text,
          answer_type: q.answer_type,
          options_json: q.options_json || [],
          evidence_json: { ...(q.evidence_json || {}), required_upload_hint: q.required_upload_hint || "" },
          source_rule_id: q.source_rule_id || null,
          status: "Pending",
        }));
      if (rows.length) {
        const { error: upErr } = await supabase
          .from("pd_generated_questions")
          .upsert(rows, { onConflict: "pd_session_id,code", ignoreDuplicates: true });
        if (upErr) throw upErr;
      }

      const { data: qRows, error: qErr } = await supabase
        .from("pd_generated_questions")
        .select("*")
        .eq("pd_session_id", sess.id)
        .order("created_at", { ascending: true });
      if (qErr) throw qErr;
      setQuestions(Array.isArray(qRows) ? qRows : []);

      const qIds = (qRows || []).map((q) => q.id);
      if (qIds.length) {
        const { data: aRows, error: aaErr } = await supabase.from("pd_generated_answers").select("*").in("question_id", qIds);
        if (aaErr) throw aaErr;
        const map = {};
        (aRows || []).forEach((a) => {
          map[a.question_id] = a;
        });
        setAnswersByQ(map);
      } else {
        setAnswersByQ({});
      }
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendEnabled, applicationId]);

  const sendInitToIframe = () => {
    try {
      const win = iframeRef.current?.contentWindow;
      if (!win) return;
      win.postMessage({ type: "PD_INIT", payload: { prefill, draft } }, "*");
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const onMessage = (ev) => {
      const msg = ev?.data;
      if (!msg || msg.source !== "PD_MASTER_V50") return;

      if (msg.type === "PD_READY") {
        sendInitToIframe();
        return;
      }

      if (msg.type === "PD_DRAFT_CHANGE") {
        setDraft(msg.payload || null);
        pendingDraft.current = msg.payload || null;
        setStatusMsg("Saving draft…");
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(async () => {
          if (!session || !ownerId) return;
          try {
            const { error: uErr } = await supabase
              .from("pd_answers")
              .upsert(
                {
                  pd_session_id: session.id,
                  owner_id: ownerId,
                  created_by: user.id,
                  updated_by: user.id,
                  field_key: "__pd_master_v50_json",
                  field_label: "PD Master v50 JSON",
                  value_json: pendingDraft.current || {},
                },
                { onConflict: "pd_session_id,field_key" },
              );
            if (uErr) throw uErr;
            setStatusMsg("Draft saved");
            setTimeout(() => setStatusMsg(""), 1500);
          } catch (e) {
            setStatusMsg("");
            setError(String(e?.message || e));
          }
        }, 900);
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, ownerId, supabase, user, prefill, draft]);

  useEffect(() => {
    // If draft/prefill changes (loaded from DB), push into iframe again.
    sendInitToIframe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, prefill, applicationId]);

  const updateQuestion = async (qid, patch) => {
    if (!backendEnabled || !qid) return;
    setError("");
    setBusy(true);
    try {
      const { error: qErr } = await supabase.from("pd_generated_questions").update({ ...patch, updated_by: user.id }).eq("id", qid);
      if (qErr) throw qErr;
      await refreshAll();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const upsertAnswer = async (qid, { text, number, json, attachmentPath }) => {
    if (!backendEnabled || !qid || !session || !ownerId) return;
    setError("");
    try {
      const payload = {
        question_id: qid,
        owner_id: ownerId,
        updated_by: user.id,
        answer_text: text ?? null,
        answer_number: number ?? null,
        answer_json: json ?? null,
        attachment_path: attachmentPath ?? null,
      };
      const { error: aErr } = await supabase.from("pd_generated_answers").upsert(payload, { onConflict: "question_id" });
      if (aErr) throw aErr;
      // Auto-resolve when there is any answer content
      const hasAnswer = Boolean((text && String(text).trim()) || (number != null && String(number).trim()) || json || attachmentPath);
      if (hasAnswer) {
        await supabase.from("pd_generated_questions").update({ status: "Resolved", updated_by: user.id }).eq("id", qid);
      }
      await refreshAll();
    } catch (e) {
      setError(String(e?.message || e));
    }
  };

  const uploadEvidence = async (qid, file) => {
    if (!backendEnabled || !session || !ownerId) return;
    setError("");
    setBusy(true);
    try {
      const safeName = String(file.name || "evidence").replace(/[^\w.\-]+/g, "_").slice(0, 120);
      const path = `${ownerId}/pd/${session.id}/${qid}/${Date.now()}_${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("liras-attachments")
        .upload(path, file, { upsert: true, contentType: file.type || "application/octet-stream" });
      if (upErr) throw upErr;

      const { error: attErr } = await supabase.from("pd_attachments").insert({
        pd_session_id: session.id,
        owner_id: ownerId,
        created_by: user.id,
        question_id: qid,
        storage_path: path,
        file_type: file.type || "",
        meta_json: { file_name: safeName, size: file.size || 0 },
      });
      if (attErr) throw attErr;

      await upsertAnswer(qid, { attachmentPath: path });
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const submitPd = async () => {
    if (!backendEnabled || !session) return;
    setError("");
    if (immediatePending.length) {
      setError(`Resolve all Immediate Action doubts first (${immediatePending.length} pending).`);
      return;
    }
    setBusy(true);
    try {
      const openItemsStatus = immediatePending.length ? "critical" : anyPending ? "pending" : "resolved";
      const { error: sErr } = await supabase
        .from("pd_sessions")
        .update({ status: "submitted", open_items_status: openItemsStatus, updated_by: user.id })
        .eq("id", session.id);
      if (sErr) throw sErr;
      await refreshAll();
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
            <div className="font-extrabold text-slate-900">PD requires Cloud mode</div>
          </div>
          <div className="text-sm text-slate-600 mt-2">Enable Supabase (login) to persist PD answers and dynamic doubts.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] bg-slate-50">
      <iframe
        ref={iframeRef}
        title="PD Master v50"
        src="/pd/pd_master_v50.html"
        className="w-full h-full"
        style={{ border: 0 }}
        onLoad={() => sendInitToIframe()}
      />

      {/* Bottom action bar (keeps PD Master UI clean, avoids double headers) */}
      <div className="fixed inset-x-0 bottom-0 z-[70] safe-bottom print:hidden">
        <div className="mx-auto max-w-5xl px-3 pb-3">
          <div className="surface-solid px-3 py-2 flex items-center justify-between gap-2 bg-white/80 backdrop-blur">
            <button className="btn-secondary px-3 py-2" onClick={onBack} disabled={busy}>
              <ArrowLeft size={16} /> Back
            </button>

            <div className="min-w-0 flex-1 px-2">
              <div className="text-[11px] text-slate-600 truncate">
                Lead: <span className="font-bold text-slate-900">{lead?.name || "—"}</span>{" "}
                <span className="text-slate-300">•</span>{" "}
                {immediatePending.length ? (
                  <span className="text-red-600 font-bold">{immediatePending.length} Immediate Action pending</span>
                ) : anyPending ? (
                  <span className="text-orange-600 font-bold">Pending doubts remain</span>
                ) : (
                  <span className="text-emerald-700 font-bold">All doubts resolved</span>
                )}
              </div>
              {statusMsg ? <div className="text-[11px] text-slate-500 truncate">{statusMsg}</div> : null}
              {error ? <div className="text-[11px] text-red-700 font-bold truncate">{error}</div> : null}
            </div>

            <button className="btn-secondary px-3 py-2" onClick={() => setDoubtsOpen(true)} disabled={busy}>
              <ShieldAlert size={16} />
              Doubts
              {questions.length ? <span className="ml-1 chip bg-white/70 border-slate-200">{questions.length}</span> : null}
            </button>
            <button className="btn-primary px-3 py-2" onClick={submitPd} disabled={busy}>
              <CheckCircle2 size={18} /> Submit
            </button>
          </div>
        </div>
      </div>

      {/* Doubts drawer */}
      {doubtsOpen && (
        <div className="fixed inset-0 z-[80] bg-slate-950/50 backdrop-blur-sm p-3 md:p-6 overflow-y-auto print:hidden">
          <div className="mx-auto max-w-4xl surface-solid p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Auto-generated doubts</div>
                <div className="text-lg font-extrabold text-slate-900 mt-1">Questions that must be cleared</div>
                <div className="text-xs text-slate-500 mt-1">
                  Ask: {fmtInr(lead?.loanAmount || app?.requested_exposure || 0)} • Recommendation:{" "}
                  {fmtInr(underwriting?.recommendation?.recommendedExposure || 0)}
                </div>
              </div>
              <button className="btn-secondary px-3 py-2" onClick={() => setDoubtsOpen(false)}>
                Close
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {questions.length === 0 && <div className="text-sm text-slate-500 italic">No doubts generated.</div>}
              {questions.map((q) => {
                const ans = answersByQ[q.id] || null;
                const val =
                  q.answer_type === "number"
                    ? ans?.answer_number ?? ""
                    : q.answer_type === "date" || q.answer_type === "yes-no" || q.answer_type === "select"
                      ? ans?.answer_text ?? ""
                      : ans?.answer_text ?? "";
                const requiredHint = q?.evidence_json?.required_upload_hint || "";

                return (
                  <div key={q.id} className="border border-slate-200 rounded-2xl p-4 bg-white">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={chipClass(q.severity)}>{q.severity}</span>
                          {q.category && <span className="chip bg-slate-50 border-slate-200 text-slate-700">{q.category}</span>}
                          {q.source_rule_id && (
                            <span className="chip bg-indigo-50 border-indigo-200 text-indigo-700">Rule {q.source_rule_id}</span>
                          )}
                          <span className="text-[10px] font-mono text-slate-400">{q.code}</span>
                        </div>
                        <div className="mt-2 font-bold text-slate-900">{q.question_text}</div>
                        {requiredHint ? <div className="text-xs text-slate-500 mt-2">Evidence: {requiredHint}</div> : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          className="py-2"
                          value={q.status || "Pending"}
                          onChange={(e) => updateQuestion(q.id, { status: e.target.value })}
                          disabled={busy}
                        >
                          <option value="Pending">Pending</option>
                          <option value="Resolved">Resolved</option>
                          <option value="Waived" disabled={!isAdmin}>
                            Waived (Admin)
                          </option>
                        </select>
                        {isAdmin && q.status !== "Waived" && (
                          <button
                            className="btn-secondary px-3 py-2"
                            onClick={() => updateQuestion(q.id, { status: "Waived" })}
                            disabled={busy}
                          >
                            Waive
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      {answerField(q, val, (next) => {
                        if (q.answer_type === "number") return upsertAnswer(q.id, { number: next === "" ? null : Number(next) });
                        if (q.answer_type === "date" || q.answer_type === "yes-no" || q.answer_type === "select")
                          return upsertAnswer(q.id, { text: next });
                        return upsertAnswer(q.id, { text: next });
                      })}

                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs text-slate-500 font-mono truncate">
                          {ans?.attachment_path ? `Attachment: ${ans.attachment_path}` : "No attachment uploaded"}
                        </div>
                        <label className="btn-secondary px-3 py-2 cursor-pointer">
                          <UploadCloud size={16} /> Upload evidence
                          <input
                            type="file"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) uploadEvidence(q.id, f);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
