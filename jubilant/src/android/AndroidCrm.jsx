import React, { useEffect, useMemo, useState } from "react";
import { Briefcase, Calendar, CheckCircle, ClipboardList, Clock, MessageCircle, Phone, Plus, Search, Trash2, Users } from "lucide-react";

const TASKS_KEY = "liras_android_tasks_v1";

const parseJson = (raw, fallback) => {
  try {
    return JSON.parse(raw ?? "") ?? fallback;
  } catch {
    return fallback;
  }
};

const TZ = "Asia/Kolkata";

const nowIso = () => new Date().toISOString();

const formatDateTime = (d) =>
  d
    ? new Date(d).toLocaleString("en-IN", { timeZone: TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "";

const toYmdIST = (dateLike) => {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value || "";
  const y = get("year");
  const m = get("month");
  const day = get("day");
  if (!y || !m || !day) return "";
  return `${y}-${m}-${day}`;
};

const isSameDay = (a, b) => {
  if (!a || !b) return false;
  const ya = toYmdIST(a);
  const yb = toYmdIST(b);
  return Boolean(ya && yb && ya === yb);
};

const isToday = (d) => isSameDay(d, new Date());

const ymdToDayNumber = (ymd) => {
  const parts = String(ymd || "").split("-");
  if (parts.length !== 3) return 0;
  const [y, m, d] = parts.map((n) => parseInt(n, 10));
  if (!y || !m || !d) return 0;
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
};

const daysDiffFromToday = (d) => {
  const targetYmd = toYmdIST(d);
  const todayYmd = toYmdIST(new Date());
  if (!targetYmd || !todayYmd) return 0;
  return ymdToDayNumber(targetYmd) - ymdToDayNumber(todayYmd);
};

const safeDigits = (phone) => String(phone || "").replace(/[^\d+]/g, "");

const parseMediatorHistory = (mediator) =>
  (Array.isArray(mediator?.followUpHistory) ? mediator.followUpHistory : [])
    .map((h) => (typeof h === "string" ? { date: h, time: "00:00", type: "legacy" } : h))
    .filter((h) => h && typeof h === "object" && typeof h.date === "string")
    .map((h) => ({
      date: String(h.date || ""),
      time: String(h.time || ""),
      type: String(h.type || "legacy"),
      ts: h.ts ? String(h.ts) : "",
      outcome: h.outcome ? String(h.outcome) : "",
      notes: h.notes ? String(h.notes) : "",
    }));

const interactionTs = (h) => {
  if (h?.ts) return new Date(h.ts).getTime();
  if (h?.date) return new Date(h.date).getTime();
  return 0;
};

const escapeIcs = (text) =>
  String(text || "")
    .replace(/\\\\/g, "\\\\\\\\")
    .replace(/\\n/g, "\\\\n")
    .replace(/,/g, "\\\\,")
    .replace(/;/g, "\\\\;");

const toIcsUtc = (dateLike) => {
  const d = new Date(dateLike);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
};

const makeIcsEvent = ({ uid, title, start, end, description = "", location = "" }) => {
  const safeUid = uid || `${Date.now()}@jubilant-liras`;
  const dtStamp = toIcsUtc(new Date());
  const dtStart = toIcsUtc(start);
  const dtEnd = toIcsUtc(end);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Jubilant LIRAS//CRM//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${escapeIcs(safeUid)}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeIcs(title)}`,
    description ? `DESCRIPTION:${escapeIcs(description)}` : "",
    location ? `LOCATION:${escapeIcs(location)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\\r\\n");
};

const downloadTextFile = (filename, content, mime) => {
  const blob = new Blob([content], { type: mime || "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
};

const SectionHeader = ({ icon: Icon, title, subtitle, right }) => (
  <div className="flex items-start justify-between gap-3">
    <div>
      <div className="flex items-center gap-2">
        {Icon && <Icon size={18} className="text-indigo-600" />}
        <div className="text-sm font-extrabold text-slate-900">{title}</div>
      </div>
      {subtitle && <div className="text-xs text-slate-500 mt-1">{subtitle}</div>}
    </div>
    {right}
  </div>
);

const TaskRow = ({ task, leadLabel, onToggle, onDelete, onExportIcs }) => (
  <div className={`surface-solid p-4 flex items-start justify-between gap-3 ${task.done ? "opacity-70" : ""}`}>
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggle}
          className={`w-8 h-8 rounded-xl border flex items-center justify-center transition ${
            task.done ? "bg-emerald-600 border-emerald-700 text-white" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
          title={task.done ? "Mark as open" : "Mark as done"}
        >
          <CheckCircle size={16} />
        </button>
        <div className="min-w-0">
          <div className={`font-extrabold truncate ${task.done ? "text-slate-600 line-through" : "text-slate-900"}`}>{task.title}</div>
          <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1">
              <Clock size={12} /> {task.dueAt ? formatDateTime(task.dueAt) : "No due date"}
            </span>
            {leadLabel && <span className="chip">{leadLabel}</span>}
            <span className={`chip ${task.priority === "high" ? "border-rose-200 bg-rose-50 text-rose-700" : task.priority === "low" ? "border-slate-200 bg-slate-50 text-slate-600" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
              {task.priority || "medium"}
            </span>
          </div>
          {task.notes ? <div className="text-xs text-slate-600 mt-2 whitespace-pre-wrap">{task.notes}</div> : null}
        </div>
      </div>
    </div>
    <div className="flex flex-col gap-2 shrink-0">
      {task.dueAt && (
        <button type="button" onClick={onExportIcs} className="btn-secondary px-3 py-2 text-xs" title="Export as calendar event (.ics)">
          <Calendar size={14} /> Calendar
        </button>
      )}
      <button type="button" onClick={onDelete} className="btn-secondary px-3 py-2 text-xs" title="Delete task">
        <Trash2 size={14} /> Delete
      </button>
    </div>
  </div>
);

const TaskModal = ({ isOpen, onClose, leads, onCreate }) => {
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [priority, setPriority] = useState("medium");
  const [leadId, setLeadId] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setTitle("");
    setDueAt("");
    setPriority("medium");
    setLeadId("");
    setNotes("");
  }, [isOpen]);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-md p-4 flex items-center justify-center">
      <div className="surface-solid shadow-elevated w-full max-w-lg overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-200/60 bg-white/70 backdrop-blur flex items-center justify-between gap-3">
          <div className="text-lg font-extrabold text-slate-900">New Task</div>
          <button onClick={onClose} className="btn-secondary px-3 py-2">
            ✕
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full py-3" placeholder="Follow up with client…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Due</label>
              <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="w-full py-3" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full py-3">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Link to Lead (optional)</label>
            <select value={leadId} onChange={(e) => setLeadId(e.target.value)} className="w-full py-3">
              <option value="">— None —</option>
              {(leads || []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full p-3 h-24 resize-none text-sm" placeholder="Context, next steps…" />
          </div>
        </div>
        <div className="p-5 border-t border-slate-200/60 bg-white/70 backdrop-blur flex gap-2">
          <button onClick={onClose} className="flex-1 btn-secondary py-3">
            Cancel
          </button>
          <button
            onClick={() => {
              const trimmed = title.trim();
              if (!trimmed) return;
              onCreate({
                id: String(Date.now()),
                title: trimmed,
                dueAt: dueAt ? new Date(dueAt).toISOString() : "",
                priority,
                leadId: leadId || "",
                notes: notes.trim(),
                done: false,
                createdAt: nowIso(),
              });
              onClose();
            }}
            className="flex-1 btn-primary py-3"
          >
            <Plus size={16} /> Create
          </button>
        </div>
      </div>
    </div>
  );
};

export default function AndroidCrm({
  route,
  leads = [],
  mediators = [],
  tasks: tasksProp,
  onTasksChange,
  storageKey,
  onFollowUp,
  onOpenLead,
  onNavigate,
}) {
  const key = storageKey || TASKS_KEY;

  const [tasksState, setTasksState] = useState(() => {
    if (Array.isArray(tasksProp)) return tasksProp;
    const stored = parseJson(localStorage.getItem(key), []);
    return Array.isArray(stored) ? stored : [];
  });
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [showDone, setShowDone] = useState(false);

  useEffect(() => {
    if (!storageKey && Array.isArray(tasksProp)) return;
    if (typeof onTasksChange === "function") return;
    localStorage.setItem(key, JSON.stringify(tasksState));
  }, [tasksState, key, onTasksChange, storageKey, tasksProp]);

  const tasks = Array.isArray(tasksProp) ? tasksProp : tasksState;
  const setTasks = typeof onTasksChange === "function" ? onTasksChange : setTasksState;

  const leadById = useMemo(() => {
    const map = new Map();
    (leads || []).forEach((l) => map.set(l.id, l));
    return map;
  }, [leads]);

  const leadLabelForTask = (task) => {
    if (!task?.leadId) return "";
    const lead = leadById.get(task.leadId);
    return lead ? lead.name : "Lead";
  };

  const tasksFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (tasks || [])
      .filter((t) => (showDone ? true : !t.done))
      .filter((t) => {
        if (!q) return true;
        const leadLabel = leadLabelForTask(t).toLowerCase();
        return String(t.title || "").toLowerCase().includes(q) || leadLabel.includes(q) || String(t.notes || "").toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const ad = a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY;
        const bd = b.dueAt ? new Date(b.dueAt).getTime() : Number.POSITIVE_INFINITY;
        return ad - bd;
      });
  }, [tasks, query, showDone, leadById]); // eslint-disable-line react-hooks/exhaustive-deps

  const leadsDueToday = useMemo(() => (leads || []).filter((l) => l?.nextFollowUp && isToday(l.nextFollowUp)), [leads]);
  const leadsOverdue = useMemo(() => (leads || []).filter((l) => l?.nextFollowUp && daysDiffFromToday(l.nextFollowUp) < 0), [leads]);
  const tasksDueToday = useMemo(() => (tasks || []).filter((t) => t?.dueAt && !t.done && isToday(t.dueAt)), [tasks]);
  const tasksOverdue = useMemo(() => (tasks || []).filter((t) => t?.dueAt && !t.done && daysDiffFromToday(t.dueAt) < 0), [tasks]);

  const exportTaskToIcs = (task) => {
    if (!task?.dueAt) return;
    const start = new Date(task.dueAt);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    const leadLabel = leadLabelForTask(task);
    const ics = makeIcsEvent({
      uid: `${task.id}@liras-task`,
      title: leadLabel ? `${task.title} — ${leadLabel}` : task.title,
      start,
      end,
      description: task.notes || "",
    });
    downloadTextFile(`LIRAS_Task_${task.id}.ics`, ics, "text/calendar;charset=utf-8");
  };

  const exportLeadFollowupToIcs = (lead) => {
    if (!lead?.nextFollowUp) return;
    const start = new Date(lead.nextFollowUp);
    const end = new Date(start.getTime() + 45 * 60 * 1000);
    const ics = makeIcsEvent({
      uid: `${lead.id}@liras-followup`,
      title: `Follow-up: ${lead.name}`,
      start,
      end,
      description: `Lead: ${lead.name}\nCompany: ${lead.company || "-"}\nStatus: ${lead.status || "-"}`,
      location: lead.location || "",
    });
    downloadTextFile(`LIRAS_FollowUp_${lead.id}.ics`, ics, "text/calendar;charset=utf-8");
  };

  const mediatorEngagement = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 86400000;
    const monthAgo = now - 30 * 86400000;

    const latestLeadTsByMediator = new Map();
    (leads || []).forEach((l) => {
      if (!l?.mediatorId) return;
      const ts = new Date(l.createdAt || l.nextFollowUp || 0).getTime();
      if (!Number.isFinite(ts) || ts <= 0) return;
      const prev = latestLeadTsByMediator.get(l.mediatorId) || 0;
      if (ts > prev) latestLeadTsByMediator.set(l.mediatorId, ts);
    });

    return (mediators || [])
      .filter((m) => m && String(m.id) !== "3")
      .map((m) => {
        const history = parseMediatorHistory(m);
        const last = history.reduce((acc, h) => {
          const t = interactionTs(h);
          return t > (acc?.t || 0) ? { t, h } : acc;
        }, null);

        const week = history.filter((h) => {
          const t = interactionTs(h);
          return t >= weekAgo;
        });
        const month = history.filter((h) => {
          const t = interactionTs(h);
          return t >= monthAgo;
        });

        const counts = (list) =>
          list.reduce(
            (acc, h) => {
              const t = String(h.type || "legacy");
              if (t === "meeting") acc.meetings += 1;
              else if (t === "call") acc.calls += 1;
              else if (t === "whatsapp") acc.whatsapp += 1;
              else acc.other += 1;
              return acc;
            },
            { calls: 0, whatsapp: 0, meetings: 0, other: 0 }
          );

        const weekCounts = counts(week);
        const monthCounts = counts(month);

        const lastInteractionDays = last?.t ? Math.floor((now - last.t) / 86400000) : 999;
        const lastLeadTs = latestLeadTsByMediator.get(m.id) || 0;
        const lastLeadDays = lastLeadTs ? Math.floor((now - lastLeadTs) / 86400000) : 999;

        let status = "Dormant";
        let statusClass = "border-slate-200 bg-slate-50 text-slate-700";
        if (lastInteractionDays <= 7) {
          status = "Hot";
          statusClass = "border-emerald-200 bg-emerald-50 text-emerald-800";
        } else if (lastInteractionDays <= 30) {
          status = "Engaged";
          statusClass = "border-indigo-200 bg-indigo-50 text-indigo-800";
        }

        const score = Math.min(
          100,
          weekCounts.calls * 8 + weekCounts.whatsapp * 5 + weekCounts.meetings * 18 + Math.max(0, 30 - lastInteractionDays)
        );

        return {
          mediator: m,
          history,
          last,
          weekCounts,
          monthCounts,
          lastInteractionDays,
          lastLeadDays,
          status,
          statusClass,
          score,
        };
      })
      .sort((a, b) => b.score - a.score);
  }, [mediators, leads]);

  if (route === "tasks") {
    return (
      <div className="p-6 space-y-4 overflow-y-auto h-full animate-fade-in">
        <div className="surface p-5">
          <SectionHeader
            icon={ClipboardList}
            title="Tasks"
            subtitle="Personal task list on this Android device (offline-safe)."
            right={
              <button className="btn-primary" onClick={() => setIsCreateOpen(true)}>
                <Plus size={18} /> New Task
              </button>
            }
          />

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="surface-solid p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Due Today</div>
              <div className="text-3xl font-extrabold text-slate-900 mt-1">{tasksDueToday.length}</div>
            </div>
            <div className="surface-solid p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Overdue</div>
              <div className="text-3xl font-extrabold text-rose-700 mt-1">{tasksOverdue.length}</div>
            </div>
            <div className="surface-solid p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Open Total</div>
              <div className="text-3xl font-extrabold text-slate-900 mt-1">{(tasks || []).filter((t) => !t.done).length}</div>
            </div>
          </div>

          <div className="mt-4 flex flex-col md:flex-row gap-2">
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} className="w-full pl-10 pr-4 py-3" placeholder="Search tasks or lead name…" />
            </div>
            <button className={`btn-secondary ${showDone ? "ring-2 ring-indigo-200" : ""}`} onClick={() => setShowDone((v) => !v)}>
              {showDone ? "Showing: All" : "Showing: Open"}
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {tasksFiltered.length === 0 ? (
            <div className="surface p-8 text-center text-slate-500">
              <div className="text-lg font-extrabold text-slate-900">No tasks</div>
              <div className="text-sm mt-1">Create your first task to track follow-ups like a CRM.</div>
              <button className="btn-primary mt-4" onClick={() => setIsCreateOpen(true)}>
                <Plus size={18} /> New Task
              </button>
            </div>
          ) : (
            tasksFiltered.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                leadLabel={leadLabelForTask(task)}
                onToggle={() => setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)))}
                onDelete={() => setTasks((prev) => prev.filter((t) => t.id !== task.id))}
                onExportIcs={() => exportTaskToIcs(task)}
              />
            ))
          )}
        </div>

        <TaskModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} leads={leads} onCreate={(t) => setTasks((prev) => [t, ...prev])} />
      </div>
    );
  }

  if (route === "partners") {
    const q = query.trim().toLowerCase();
    const filtered = mediatorEngagement.filter((row) => {
      if (!q) return true;
      const name = String(row.mediator?.name || "").toLowerCase();
      const phone = String(row.mediator?.phone || "").toLowerCase();
      return name.includes(q) || phone.includes(q) || row.status.toLowerCase().includes(q);
    });

    const total = mediatorEngagement.length;
    const hot = mediatorEngagement.filter((m) => m.status === "Hot").length;
    const engaged = mediatorEngagement.filter((m) => m.status === "Engaged").length;
    const dormant = mediatorEngagement.filter((m) => m.status === "Dormant").length;

    return (
      <div className="p-6 space-y-4 overflow-y-auto h-full animate-fade-in">
        <div className="surface p-5">
          <SectionHeader
            icon={Users}
            title="Partners (Engagement)"
            subtitle="Auto-logs: Call/WhatsApp/Meeting taps are captured and reflected here."
            right={
              <div className="flex gap-2">
                <button className="btn-secondary" onClick={() => onNavigate?.("android_myday")}>
                  <Clock size={18} /> My Day
                </button>
                <button className="btn-primary" onClick={() => onNavigate?.("android_tasks")}>
                  <ClipboardList size={18} /> Tasks
                </button>
              </div>
            }
          />

          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="surface-solid p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total</div>
              <div className="text-3xl font-extrabold text-slate-900 mt-1">{total}</div>
            </div>
            <div className="surface-solid p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Hot (≤7d)</div>
              <div className="text-3xl font-extrabold text-emerald-700 mt-1">{hot}</div>
            </div>
            <div className="surface-solid p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Engaged (≤30d)</div>
              <div className="text-3xl font-extrabold text-indigo-700 mt-1">{engaged}</div>
            </div>
            <div className="surface-solid p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Dormant</div>
              <div className="text-3xl font-extrabold text-slate-700 mt-1">{dormant}</div>
            </div>
          </div>

          <div className="mt-4 flex flex-col md:flex-row gap-2">
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} className="w-full pl-10 pr-4 py-3" placeholder="Search partner name, phone, or status…" />
            </div>
            <button className={`btn-secondary ${showDone ? "ring-2 ring-indigo-200" : ""}`} onClick={() => setShowDone((v) => !v)} title="Toggle showing low-priority details">
              {showDone ? "Details: On" : "Details: Off"}
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="surface p-8 text-center text-slate-500">No partners match your search.</div>
          ) : (
            filtered.map((row) => {
              const m = row.mediator;
              const digits = safeDigits(m.phone);
              const lastText = row.last?.t ? `${row.lastInteractionDays}d ago` : "Never";
              const lastType = row.last?.h?.type ? String(row.last.h.type).replace(/_/g, " ") : "";
              const lastOutcome = row.last?.h?.outcome ? String(row.last.h.outcome).replace(/_/g, " ") : "";
              const lastLine = row.last?.t ? `${lastText} • ${lastType}${lastOutcome ? ` • ${lastOutcome}` : ""}` : "No recorded interactions yet";

              return (
                <div key={m.id} className="surface-solid p-4">
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => onNavigate?.(m.id)}
                      className="text-left min-w-0"
                      title="Open mediator profile"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-soft">
                          <Users size={18} />
                        </div>
                        <div className="min-w-0">
                          <div className="font-extrabold text-slate-900 truncate">{m.name}</div>
                          <div className="text-xs text-slate-500 mt-0.5 truncate">{m.phone || "No phone"}</div>
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-600 mt-3">{lastLine}</div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <span className={`chip border ${row.statusClass}`}>{row.status}</span>
                        <span className="chip">Week: 📞 {row.weekCounts.calls} • 💬 {row.weekCounts.whatsapp} • 🤝 {row.weekCounts.meetings}</span>
                        {showDone && <span className="chip">Last lead: {row.lastLeadDays >= 999 ? "—" : `${row.lastLeadDays}d ago`}</span>}
                      </div>
                    </button>

                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        type="button"
                        className={`btn-secondary px-3 py-2 text-xs ${digits ? "" : "opacity-60 cursor-not-allowed"}`}
                        onClick={() => {
                          if (!digits) return;
                          const startedAt = new Date().toISOString();
                          onFollowUp?.(m.id, "call", { ts: startedAt });
                          try {
                            localStorage.setItem(
                              "liras_pending_call_v1",
                              JSON.stringify({ kind: "mediator", mediatorId: m.id, phone: digits, startedAt, ts: startedAt })
                            );
                          } catch {
                            // ignore
                          }
                          window.location.href = `tel:${digits}`;
                        }}
                        title={digits ? "Call + auto-log" : "No phone number"}
                      >
                        <Phone size={14} /> Call
                      </button>
                      <button
                        type="button"
                        className={`btn-secondary px-3 py-2 text-xs ${digits ? "" : "opacity-60 cursor-not-allowed"}`}
                        onClick={() => {
                          if (!digits) return;
                          onFollowUp?.(m.id, "whatsapp");
                          window.location.href = `https://wa.me/${digits}?text=${encodeURIComponent(
                            `Good Morning ${m.name}, hope you're doing well. Do we have any new cases or updates for today?`
                          )}`;
                        }}
                        title="WhatsApp + auto-log"
                      >
                        <MessageCircle size={14} /> WhatsApp
                      </button>
                      <button
                        type="button"
                        className="btn-secondary px-3 py-2 text-xs"
                        onClick={() => onFollowUp?.(m.id, "meeting")}
                        title="Log meeting"
                      >
                        <Briefcase size={14} /> Meeting
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // Default: My Day
  return (
    <div className="p-6 space-y-4 overflow-y-auto h-full animate-fade-in">
      <div className="surface p-5">
          <SectionHeader
            icon={TimerIcon}
            title="My Day"
            subtitle="Agenda + tasks. Export follow-ups to your calendar when needed."
            right={
              <div className="flex gap-2">
                <button className="btn-secondary" onClick={() => setIsCreateOpen(true)}>
                  <Plus size={18} /> Task
                </button>
              <button className="btn-secondary" onClick={() => onNavigate?.("android_partners")}>
                <Users size={18} /> Partners
              </button>
              <button className="btn-primary" onClick={() => onNavigate?.("android_tasks")}>
                <ClipboardList size={18} /> Tasks
              </button>
            </div>
          }
        />

        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="surface-solid p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Leads Today</div>
            <div className="text-3xl font-extrabold text-slate-900 mt-1">{leadsDueToday.length}</div>
          </div>
          <div className="surface-solid p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Leads Overdue</div>
            <div className="text-3xl font-extrabold text-rose-700 mt-1">{leadsOverdue.length}</div>
          </div>
          <div className="surface-solid p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Tasks Today</div>
            <div className="text-3xl font-extrabold text-slate-900 mt-1">{tasksDueToday.length}</div>
          </div>
          <div className="surface-solid p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Tasks Overdue</div>
            <div className="text-3xl font-extrabold text-rose-700 mt-1">{tasksOverdue.length}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="surface p-5">
          <SectionHeader icon={Clock} title="Follow-ups Today" subtitle="Tap a lead to open, or export to calendar." />
          <div className="mt-4 space-y-3">
            {leadsDueToday.length === 0 ? (
              <div className="text-sm text-slate-500 italic">No follow-ups scheduled for today.</div>
            ) : (
              leadsDueToday.slice(0, 12).map((l) => (
                <div key={l.id} className="surface-solid p-4 flex items-center justify-between gap-3">
                  <button type="button" onClick={() => onOpenLead?.(l)} className="text-left min-w-0">
                    <div className="font-extrabold text-slate-900 truncate">{l.name}</div>
                    <div className="text-xs text-slate-500 mt-1 truncate">{l.company || l.location || "—"}</div>
                    <div className="text-[11px] text-slate-500 mt-2">{formatDateTime(l.nextFollowUp)}</div>
                  </button>
                  <div className="flex flex-col gap-2 shrink-0">
                    <button type="button" onClick={() => exportLeadFollowupToIcs(l)} className="btn-secondary px-3 py-2 text-xs">
                      <Calendar size={14} /> Calendar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="surface p-5">
          <SectionHeader
            icon={ClipboardList}
            title="Tasks"
            subtitle="Quick view (today + overdue)."
            right={
              <button className="btn-primary" onClick={() => setIsCreateOpen(true)}>
                <Plus size={18} /> New
              </button>
            }
          />
          <div className="mt-4 space-y-3">
            {(tasksDueToday.length === 0 && tasksOverdue.length === 0) ? (
              <div className="text-sm text-slate-500 italic">No urgent tasks.</div>
            ) : (
              [...tasksOverdue, ...tasksDueToday].slice(0, 8).map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  leadLabel={leadLabelForTask(task)}
                  onToggle={() => setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)))}
                  onDelete={() => setTasks((prev) => prev.filter((t) => t.id !== task.id))}
                  onExportIcs={() => exportTaskToIcs(task)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      <TaskModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} leads={leads} onCreate={(t) => setTasks((prev) => [t, ...prev])} />
    </div>
  );
}

const TimerIcon = (props) => <Clock {...props} />;
