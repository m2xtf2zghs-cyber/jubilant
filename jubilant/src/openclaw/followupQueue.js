const CLOSED_STATUSES = new Set([
  "Payment Done",
  "Deal Closed",
  "Not Eligible",
  "Not Reliable",
  "Lost to Competitor",
  "Not Interested",
  "Not Interested (Temp)",
  "Rejected",
]);

const safeString = (value) => String(value || "").trim();

const parseIsoOrNull = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatYmd = (value) => {
  const date = parseIsoOrNull(value);
  if (!date) return "";
  const ist = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const y = ist.getFullYear();
  const m = String(ist.getMonth() + 1).padStart(2, "0");
  const d = String(ist.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const formatTime = (value) => {
  const date = parseIsoOrNull(value);
  if (!date) return "";
  return date.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const latestNote = (lead) => {
  const notes = Array.isArray(lead?.notes) ? lead.notes : [];
  for (let i = notes.length - 1; i >= 0; i -= 1) {
    const text = safeString(notes[i]?.text);
    if (text) return { text, date: notes[i]?.date || null };
  }
  return { text: "", date: null };
};

const getLeadLastActivityIso = (lead) => {
  const note = latestNote(lead);
  return note.date || lead?.nextFollowUp || lead?.createdAt || null;
};

const buildNextFollowUpLabel = (lead) => {
  if (!lead?.nextFollowUp) return "Not set";
  const ymd = formatYmd(lead.nextFollowUp);
  const time = formatTime(lead.nextFollowUp);
  return time ? `${ymd} • ${time}` : ymd;
};

const sortByFollowUp = (a, b) => {
  const aTs = parseIsoOrNull(a.nextFollowUp)?.getTime() || Number.MAX_SAFE_INTEGER;
  const bTs = parseIsoOrNull(b.nextFollowUp)?.getTime() || Number.MAX_SAFE_INTEGER;
  return aTs - bTs;
};

export const isOpenclawClosedLead = (status) => CLOSED_STATUSES.has(safeString(status));

export function buildOpenclawFollowupQueues({ leads = [], mediators = [] } = {}) {
  const mediatorMap = new Map();
  (Array.isArray(mediators) ? mediators : []).forEach((mediator) => {
    const id = safeString(mediator?.id);
    if (id) mediatorMap.set(id, mediator);
  });

  const getMediator = (lead) => {
    const mediatorId = safeString(lead?.mediatorId);
    if (!mediatorId || mediatorId === "3") return null;
    return mediatorMap.get(mediatorId) || null;
  };

  const openLeads = (Array.isArray(leads) ? leads : []).filter((lead) => lead && !isOpenclawClosedLead(lead.status));

  const groupedMediatorRows = new Map();
  const clientQueue = [];

  openLeads.forEach((lead) => {
    const mediator = getMediator(lead);
    const status = safeString(lead?.status);
    const note = latestNote(lead);
    const noteText = note.text;

    const row = {
      id: safeString(lead?.id),
      name: safeString(lead?.name) || "Unnamed Lead",
      company: safeString(lead?.company),
      status,
      mediatorName: safeString(mediator?.name) || "Direct Client",
      phone: safeString(lead?.phone),
      loanAmount: Number(lead?.loanAmount || 0),
      nextFollowUp: lead?.nextFollowUp || null,
      nextFollowUpLabel: buildNextFollowUpLabel(lead),
      latestNoteText: noteText || "Pending update.",
      lastActivity: note.date || getLeadLastActivityIso(lead),
    };

    const partnerSide =
      mediator &&
      (
        status === "Partner Follow-Up" ||
        status === "Contact Details Not Received" ||
        status === "Statements Not Received" ||
        /partner/i.test(status) ||
        /TRIAGE ROUTE/i.test(noteText) ||
        /contact details/i.test(noteText) ||
        /statement/i.test(noteText)
      );

    if (partnerSide) {
      const key = safeString(mediator?.id);
      const existing = groupedMediatorRows.get(key) || { mediator, rows: [] };
      existing.rows.push(row);
      groupedMediatorRows.set(key, existing);
    }

    const clientSide =
      status === "Follow-Up Required" ||
      status === "Meeting Scheduled" ||
      status === "Commercial Client" ||
      status === "Interest Rate Issue" ||
      /meeting/i.test(status) ||
      /follow-up/i.test(status) ||
      /PHONE PD/i.test(noteText);

    if (clientSide) clientQueue.push(row);
  });

  const mediatorQueueBase = Array.from(groupedMediatorRows.values())
    .map(({ mediator, rows }) => ({
      mediator,
      rows: [...rows].sort(sortByFollowUp),
    }))
    .sort((a, b) => b.rows.length - a.rows.length || safeString(a?.mediator?.name).localeCompare(safeString(b?.mediator?.name)));

  const clientQueueSorted = [...clientQueue].sort(sortByFollowUp);

  const mediatorQueueSummary = mediatorQueueBase.map((group) => ({
    mediator: safeString(group?.mediator?.name) || "Mediator",
    count: group.rows.length,
    leads: group.rows.map((row) => ({
      name: row.name,
      status: row.status,
      nextFollowUp: row.nextFollowUpLabel,
    })),
  }));

  return {
    openLeads,
    mediatorQueueBase,
    clientQueue: clientQueueSorted,
    mediatorQueueSummary,
  };
}
