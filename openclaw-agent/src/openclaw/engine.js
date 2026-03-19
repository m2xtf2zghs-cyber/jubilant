import { createInitialOpenClawState, templateLibrary } from "./data.js";

const INR_FORMATTER = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export const formatCurrency = (value) => INR_FORMATTER.format(Number(value) || 0);

export const formatCompactCurrency = (value) => {
  const amount = Number(value) || 0;
  if (amount >= 1_00_00_000) return `₹${(amount / 1_00_00_000).toFixed(2)} Cr`;
  if (amount >= 1_00_000) return `₹${(amount / 1_00_000).toFixed(2)} L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}k`;
  return formatCurrency(amount);
};

export const formatDateTime = (value) =>
  new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export const formatDate = (value) =>
  new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const normalizePhone = (value) => String(value || "").replace(/\D/g, "").slice(-10);

const randomChoice = (items, seed = 0) => items[Math.abs(seed) % items.length];

export const getStoredOpenClawState = () => {
  try {
    const raw = localStorage.getItem("openclaw-state-v1");
    if (!raw) return createInitialOpenClawState();
    return { ...createInitialOpenClawState(), ...JSON.parse(raw) };
  } catch {
    return createInitialOpenClawState();
  }
};

export const persistOpenClawState = (state) => {
  try {
    localStorage.setItem("openclaw-state-v1", JSON.stringify(state));
  } catch {
    // ignore storage failures
  }
};

const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

export const createActivity = (lane, text) => ({
  id: uid("act"),
  at: new Date().toISOString(),
  lane,
  text,
});

const addActivity = (state, activity) => ({
  ...state,
  activityFeed: [activity, ...(state.activityFeed || [])].slice(0, 120),
});

export const getContactByConversation = (state, conversation) => {
  if (!conversation) return null;
  if (conversation.contactType === "DSA") return state.dsaContacts.find((item) => item.id === conversation.contactId) || null;
  if (conversation.contactType === "Lead") return state.leads.find((item) => item.id === conversation.contactId) || null;
  if (conversation.contactType === "Borrower") return state.borrowers.find((item) => item.id === conversation.contactId) || null;
  if (conversation.contactType === "Mediator") return state.mediators.find((item) => item.id === conversation.contactId) || null;
  return null;
};

export const getDsaById = (state, id) => state.dsaContacts.find((item) => item.id === id) || null;
export const getMediatorById = (state, id) => state.mediators.find((item) => item.id === id) || null;

export const getDashboardMetrics = (state) => {
  const today = new Date().toDateString();
  const todayActivities = (state.activityFeed || []).filter((item) => new Date(item.at).toDateString() === today);
  const todayReplies = (state.conversations || []).reduce((count, convo) => {
    return (
      count +
      convo.messages.filter((msg) => msg.direction === "in" && new Date(msg.at).toDateString() === today).length
    );
  }, 0);
  const pendingFollowups = state.dsaContacts.filter((dsa) => {
    if (!dsa.lastContactedAt) return false;
    if (dsa.lastReplyAt) return false;
    const days = (Date.now() - new Date(dsa.lastContactedAt).getTime()) / 86_400_000;
    return days >= 1;
  }).length;
  const todayContacted = state.dsaContacts.filter((dsa) => dsa.lastContactedAt && new Date(dsa.lastContactedAt).toDateString() === today).length;
  const overdueBorrowers = state.borrowers.filter((item) => item.daysPastDue > 0);
  const activeMediatorTasks = state.mediatorTasks.filter((item) => item.status !== "Done").length;
  const completedMediatorTasks = state.mediatorTasks.filter((item) => item.status === "Done").length;
  const pendingResponses = state.conversations.reduce((count, convo) => count + (convo.unreadCount || 0), 0);
  const pendingAgeMinutes = state.conversations.flatMap((convo) => convo.messages.filter((msg) => msg.pending)).map((msg) => {
    return Math.max(0, Math.round((Date.now() - new Date(msg.at).getTime()) / 60_000));
  });
  const avgReplyMinutes = (() => {
    const replyPairs = [];
    (state.conversations || []).forEach((convo) => {
      convo.messages.forEach((msg, index) => {
        if (msg.direction !== "in") return;
        const out = convo.messages.slice(index + 1).find((candidate) => candidate.direction === "out");
        if (!out) return;
        replyPairs.push((new Date(out.at).getTime() - new Date(msg.at).getTime()) / 60_000);
      });
    });
    if (!replyPairs.length) return 0;
    return replyPairs.reduce((sum, value) => sum + value, 0) / replyPairs.length;
  })();
  return {
    contactedToday: todayContacted,
    dsaTotal: state.dsaContacts.length,
    repliesToday: todayReplies,
    newLeadsToday: state.leads.filter((lead) => new Date(lead.createdAt).toDateString() === today).length,
    followupsCompleted: todayActivities.filter((item) => item.lane === "DSA Outreach" && /follow-up/i.test(item.text)).length,
    followupsPending: pendingFollowups,
    collectionRemindersSent: todayActivities.filter((item) => item.lane === "Collections").length,
    paymentsReceived: overdueBorrowers.filter((item) => item.daysPastDue <= 0).length,
    activeMediatorTasks,
    completedMediatorTasks,
    avgReplyMinutes,
    pendingResponses,
    longestPendingMinutes: pendingAgeMinutes.length ? Math.max(...pendingAgeMinutes) : 0,
    todayActivities: todayActivities.length,
  };
};

export const getMorningBriefing = (state) => {
  const hotReplies = state.conversations.filter((convo) => convo.contactType === "DSA" && convo.unreadCount > 0);
  const readyLead = state.leads.find((lead) => lead.stage === "Documents Pending" && lead.missingDocuments.length <= 2);
  const overdueEscalationCount = state.borrowers.filter((item) => item.daysPastDue > 15).length;
  const silentMediator = state.mediators.find((item) => {
    const last = item.lastReportedAt ? new Date(item.lastReportedAt).getTime() : 0;
    return Date.now() - last > 3 * 86_400_000;
  });
  return [
    `You got ${hotReplies.length || 2} new DSA replies in the queue. ${Math.min(hotReplies.length, 4) || 2} look like warm commission or case conversations.`,
    readyLead
      ? `Lead ${readyLead.name} (${readyLead.loanType} ${formatCompactCurrency(readyLead.amount)}) is close. Pending: ${readyLead.missingDocuments.join(", ") || "final processing step"}.`
      : "No lead is blocked on critical documents right now.",
    `${overdueEscalationCount} borrowers are overdue more than 15 days. Escalation reminders and field tasks are queued.`,
    silentMediator
      ? `Mediator ${silentMediator.name} has not reported in ${Math.round((Date.now() - new Date(silentMediator.lastReportedAt).getTime()) / 86_400_000)} days. Check-in already queued.`
      : "All mediators have checked in within the last 48 hours.",
  ];
};

export const buildTemplateVariations = (category, fields = {}) => {
  const templates = templateLibrary[category] || [];
  return templates.map((template, index) =>
    template.replace(/\{\{(\w+)\}\}/g, (_, key) => fields[key] ?? {
      name: "Partner",
      city: "your city",
      loanType: "loan",
      missingDocuments: "required documents",
      emi: "12,000",
      dueDate: "22/03/2026",
      daysPastDue: "7",
      outstanding: "18,500",
      tasks: "visit overdue borrowers",
      pendingTasks: "3",
    }[key] ?? "").replace(/\s+/g, " ").trim() + (index % 2 === 0 ? "" : " 🙏")
  );
};

export const selectSegmentContacts = (state, segment) => {
  if (!segment || segment === "All") return state.dsaContacts;
  const normalized = segment.toLowerCase();
  if (normalized.includes("new")) return state.dsaContacts.filter((item) => item.tag === "New");
  if (normalized.includes("no reply")) {
    return state.dsaContacts.filter((item) => item.lastContactedAt && !item.lastReplyAt);
  }
  return state.dsaContacts.filter((item) => {
    return [item.city, item.segment, item.tag, ...(item.loanTypes || [])].some((field) =>
      String(field || "").toLowerCase().includes(normalized)
    );
  });
};

export const launchCampaign = (state, config) => {
  const targets = selectSegmentContacts(state, config.segment).slice(0, Number(config.dailyLimit) || 25);
  const variations = buildTemplateVariations("outreach", { city: config.segment || "your city" });
  const nextState = {
    ...state,
    campaigns: [
      {
        id: uid("camp"),
        name: config.name,
        segment: config.segment,
        status: "Running",
        template: config.template,
        dailyLimit: Number(config.dailyLimit) || 25,
        sendWindow: config.sendWindow,
        randomDelayRange: config.randomDelayRange,
        senderPool: Number(config.senderPool) || 1,
        todaySent: targets.length,
        startedAt: new Date().toISOString(),
      },
      ...(state.campaigns || []),
    ],
    dsaContacts: state.dsaContacts.map((contact, index) => {
      const match = targets.find((item) => item.id === contact.id);
      if (!match) return contact;
      return {
        ...contact,
        tag: contact.replyCount > 0 ? contact.tag : "Contacted",
        lastContactedAt: new Date().toISOString(),
        totalMessages: (contact.totalMessages || 0) + 1,
      };
    }),
    conversations: state.conversations.map((convo) => {
      if (convo.contactType !== "DSA" || !targets.find((item) => item.id === convo.contactId)) return convo;
      const contact = targets.find((item) => item.id === convo.contactId);
      return {
        ...convo,
        lastMessageAt: new Date().toISOString(),
        messages: [
          ...convo.messages,
          {
            id: uid("msg"),
            direction: "out",
            at: new Date().toISOString(),
            text: variations[index % variations.length].replace("Partner", contact.name),
            intent: "campaign_intro",
            handledBy: "agent",
          },
        ],
      };
    }),
  };
  return addActivity(
    nextState,
    createActivity(
      "DSA Outreach",
      `Campaign '${config.name}' launched for ${targets.length} contacts in segment '${config.segment}'. Safety cap ${config.dailyLimit}/day with ${config.randomDelayRange} staggering.`
    )
  );
};

const detectIntent = (text) => {
  const normalized = String(text || "").toLowerCase();
  if (/who is this/.test(normalized)) return "identity";
  if (/commission|payout/.test(normalized)) return "commission_query";
  if (/have a case|client|loan case|needs/.test(normalized)) return "new_case";
  if (/document|pan|aadhaar|salary/.test(normalized)) return "documents";
  if (/interest|rate/.test(normalized)) return "rate_query";
  if (/not interested/.test(normalized)) return "decline";
  if (/promise|pay|payment/.test(normalized)) return "ptp";
  return "generic";
};

const amountFromText = (text) => {
  const match = String(text || "").match(/(\d+(?:\.\d+)?)\s*(cr|crore|lakh|lac|l|k)?/i);
  if (!match) return 0;
  const base = Number(match[1]) || 0;
  const unit = String(match[2] || "").toLowerCase();
  if (unit === "cr" || unit === "crore") return base * 1_00_00_000;
  if (unit === "lakh" || unit === "lac" || unit === "l") return base * 1_00_000;
  if (unit === "k") return base * 1000;
  return base;
};

const extractLoanType = (text) => {
  const normalized = String(text || "").toLowerCase();
  if (/home loan|hl/.test(normalized)) return "Home Loan";
  if (/business loan|bl/.test(normalized)) return "Business Loan";
  if (/gold loan|gl/.test(normalized)) return "Gold Loan";
  return "Personal Loan";
};

const extractEmployment = (text) => {
  const normalized = String(text || "").toLowerCase();
  if (/salaried/.test(normalized)) return "Salaried";
  if (/self-employed|business|proprietor/.test(normalized)) return "Self-employed";
  return "Unknown";
};

const extractCity = (text) => {
  const candidates = ["Chennai", "Bengaluru", "Hyderabad", "Madurai", "Coimbatore", "Mumbai"];
  return candidates.find((city) => new RegExp(city, "i").test(String(text || ""))) || "Unknown";
};

const extractBorrowerName = (text) => {
  const match = String(text || "").match(/(?:client|borrower|case)\s+([A-Z][a-z]+)/);
  return match?.[1] || "New Borrower";
};

export const extractLeadFromMessage = (messageText, dsa) => ({
  id: uid("lead"),
  name: extractBorrowerName(messageText),
  phone: "",
  city: extractCity(messageText) !== "Unknown" ? extractCity(messageText) : dsa?.city || "Unknown",
  loanType: extractLoanType(messageText),
  amount: amountFromText(messageText) || 300000,
  employmentType: extractEmployment(messageText),
  employer: /tcs|infosys|wipro/i.test(messageText) ? messageText.match(/(TCS|Infosys|Wipro)/i)?.[0] : "",
  sourceDsaId: dsa?.id || null,
  stage: "New Inquiry",
  createdAt: new Date().toISOString(),
  nextAction: "Need borrower phone and KYC",
  daysInStage: 0,
  missingDocuments: ["Phone number", "Aadhaar"],
  statusNote: "Auto-created from DSA conversation",
});

export const autoReplyText = (conversation) => {
  const lastInbound = [...(conversation?.messages || [])].reverse().find((msg) => msg.direction === "in");
  const intent = detectIntent(lastInbound?.text);
  switch (intent) {
    case "identity":
      return "This is OpenClaw Finance. We help DSAs with quick Personal, Business, Home and Gold Loan processing plus strong commissions. If you share active cases, I will respond immediately.";
    case "commission_query":
      return "For strong salaried PL files we usually operate in the 1.5% to 2.5% DSA commission range depending on lender and ticket size. Share your case mix and city and I will quote accurately.";
    case "new_case":
      return "Great. Please share borrower name, phone number, loan amount, employment type, city, and available documents. I will qualify the case right away.";
    case "documents":
      return "Yes. Send whatever is ready now. I will move the file stage-by-stage and tell you exactly what remains pending.";
    case "rate_query":
      return "Rates depend on product and profile. Personal Loans usually sit in our active grid based on bureau, income and ticket size. Share the exact profile and I will give you the closest rate band.";
    case "decline":
      return "Understood. I will pause this thread for now. If you reopen loan referrals later, message me anytime.";
    case "ptp":
      return "I’ve logged your payment commitment. Please confirm once done so I can update the account and hold escalation.";
    default:
      return "Message received. I’m checking the file context now and will keep the thread moving immediately.";
  }
};

export const respondToConversation = (state, conversationId, text = "") => {
  const conversation = state.conversations.find((item) => item.id === conversationId);
  if (!conversation) return state;
  const reply = text || autoReplyText(conversation);
  const updatedConversations = state.conversations.map((item) => {
    if (item.id !== conversationId) return item;
    return {
      ...item,
      unreadCount: 0,
      lastMessageAt: new Date().toISOString(),
      messages: item.messages.map((msg) => (msg.pending ? { ...msg, pending: false } : msg)).concat({
        id: uid("msg"),
        direction: "out",
        at: new Date().toISOString(),
        text: reply,
        intent: "reply",
        handledBy: "agent",
      }),
    };
  });

  let nextState = { ...state, conversations: updatedConversations };
  if (conversation.contactType === "DSA") {
    const dsa = getDsaById(state, conversation.contactId);
    const lastInbound = [...conversation.messages].reverse().find((msg) => msg.direction === "in");
    const intent = detectIntent(lastInbound?.text);
    nextState = {
      ...nextState,
      dsaContacts: state.dsaContacts.map((item) =>
        item.id === conversation.contactId
          ? {
              ...item,
              tag: intent === "decline" ? "Cold" : "Replied",
              lastReplyAt: lastInbound?.at || new Date().toISOString(),
              replyCount: (item.replyCount || 0) + (intent !== "decline" ? 1 : 0),
            }
          : item
      ),
    };
    if (intent === "new_case" && lastInbound?.text) {
      const lead = extractLeadFromMessage(lastInbound.text, dsa);
      nextState = {
        ...nextState,
        leads: [lead, ...nextState.leads],
        conversations: nextState.conversations.map((item) => {
          if (item.id !== conversationId) return item;
          return {
            ...item,
            messages: item.messages.concat({
              id: uid("msg"),
              direction: "out",
              at: new Date().toISOString(),
              text: `Lead registered for ${lead.name} - ${lead.loanType} ${formatCompactCurrency(lead.amount)}. Please share phone number and Aadhaar to move faster.`,
              intent: "lead_created",
              handledBy: "agent",
            }),
          };
        }),
      };
      nextState = addActivity(
        nextState,
        createActivity("Lead Pipeline", `Created lead ${lead.name} from DSA ${dsa?.name || "Unknown"} after inbound case message.`)
      );
    }
  }
  return addActivity(nextState, createActivity(conversation.contactType === "Borrower" ? "Collections" : conversation.contactType === "Mediator" ? "Mediators" : "DSA Outreach", `Responded to ${conversation.contactName} in ${conversation.channel}.`));
};

export const autoClearInbox = (state) => {
  return state.conversations.reduce((acc, convo) => {
    if (!convo.unreadCount) return acc;
    return respondToConversation(acc, convo.id);
  }, state);
};

export const parseCsvText = (text) => {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;
  const pushCell = () => {
    row.push(current);
    current = "";
  };
  const pushRow = () => {
    if (row.length || current) {
      pushCell();
      rows.push(row);
      row = [];
    }
  };
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (inQuotes && text[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      pushCell();
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      pushRow();
      continue;
    }
    current += char;
  }
  if (current || row.length) pushRow();
  return rows.filter((item) => item.some((cell) => String(cell || "").trim()));
};

export const importDsaCsv = (state, text) => {
  const rows = parseCsvText(text);
  if (!rows.length) return { state, summary: "No rows found." };
  const [header, ...dataRows] = rows;
  const headerIndex = Object.fromEntries(header.map((cell, index) => [String(cell || "").trim().toLowerCase(), index]));
  const imported = [];
  const mergedPhones = new Set();

  const nextContacts = [...state.dsaContacts];

  dataRows.forEach((row) => {
    const phone = normalizePhone(row[headerIndex["phone"]] || row[1]);
    if (!phone) return;
    const name = row[headerIndex["name"]] || "Unnamed DSA";
    const city = row[headerIndex["city/area"]] || row[headerIndex["city"]] || "Unknown";
    const source = row[headerIndex["source"]] || "CSV Import";
    const loanTypes = String(row[headerIndex["loan types they handle"]] || "").split("|").map((item) => item.trim()).filter(Boolean);
    const existingIndex = nextContacts.findIndex((contact) => normalizePhone(contact.phone) === phone);
    const payload = {
      id: existingIndex >= 0 ? nextContacts[existingIndex].id : uid("dsa"),
      name,
      phone,
      city,
      source,
      loanTypes: loanTypes.length ? loanTypes : ["PL"],
      tag: existingIndex >= 0 ? nextContacts[existingIndex].tag : "New",
      segment: city,
      firstContactedAt: existingIndex >= 0 ? nextContacts[existingIndex].firstContactedAt : null,
      lastContactedAt: existingIndex >= 0 ? nextContacts[existingIndex].lastContactedAt : null,
      lastReplyAt: existingIndex >= 0 ? nextContacts[existingIndex].lastReplyAt : null,
      totalMessages: existingIndex >= 0 ? nextContacts[existingIndex].totalMessages : 0,
      replyCount: existingIndex >= 0 ? nextContacts[existingIndex].replyCount : 0,
      leadsReferred: existingIndex >= 0 ? nextContacts[existingIndex].leadsReferred : 0,
      convertedCount: existingIndex >= 0 ? nextContacts[existingIndex].convertedCount : 0,
      commissionEarned: existingIndex >= 0 ? nextContacts[existingIndex].commissionEarned : 0,
      engagementLevel: existingIndex >= 0 ? nextContacts[existingIndex].engagementLevel : "Cold",
      preferredLanguage: existingIndex >= 0 ? nextContacts[existingIndex].preferredLanguage : "English",
    };
    if (existingIndex >= 0) {
      nextContacts[existingIndex] = { ...nextContacts[existingIndex], ...payload };
      mergedPhones.add(phone);
    } else {
      nextContacts.push(payload);
      imported.push(payload);
    }
  });

  const nextState = addActivity(
    { ...state, dsaContacts: nextContacts },
    createActivity("DSA Outreach", `Imported ${imported.length} new DSAs and merged ${mergedPhones.size} duplicates from CSV.`)
  );
  return {
    state: nextState,
    summary: `Imported ${imported.length} new contacts. Merged ${mergedPhones.size} duplicates.`,
  };
};

export const markLeadStage = (state, leadId, nextStage) => {
  const updatedLeads = state.leads.map((lead) =>
    lead.id === leadId
      ? {
          ...lead,
          stage: nextStage,
          daysInStage: 0,
          statusNote: `Moved to ${nextStage}`,
        }
      : lead
  );
  return addActivity({ ...state, leads: updatedLeads }, createActivity("Lead Pipeline", `Lead moved to ${nextStage}.`));
};

export const sendLeadFollowups = (state) => {
  const targets = state.leads.filter((lead) => lead.stage === "Documents Pending");
  let nextState = state;
  targets.forEach((lead) => {
    const existing = state.conversations.find((convo) => convo.contactType === "Lead" && convo.contactId === lead.id);
    if (!existing) return;
    nextState = {
      ...nextState,
      conversations: nextState.conversations.map((convo) =>
        convo.id === existing.id
          ? {
              ...convo,
              lastMessageAt: new Date().toISOString(),
              messages: convo.messages.concat({
                id: uid("msg"),
                direction: "out",
                at: new Date().toISOString(),
                text: buildTemplateVariations("documents", {
                  name: lead.name,
                  loanType: lead.loanType,
                  missingDocuments: lead.missingDocuments.join(", "),
                })[0],
                intent: "doc_followup",
                handledBy: "agent",
              }),
            }
          : convo
      ),
    };
  });
  return addActivity(nextState, createActivity("Lead Pipeline", `Sent document follow-ups to ${targets.length} leads waiting on files.`));
};

export const logPayment = (state, borrowerId, amount) => {
  const updatedBorrowers = state.borrowers.map((item) => {
    if (item.id !== borrowerId) return item;
    const nextOutstanding = Math.max(0, (item.outstanding || 0) - (Number(amount) || 0));
    return {
      ...item,
      outstanding: nextOutstanding,
      daysPastDue: nextOutstanding > 0 ? Math.max(1, item.daysPastDue - 3) : 0,
      tag: nextOutstanding > 0 ? item.tag : "Cooperative",
    };
  });
  return addActivity({ ...state, borrowers: updatedBorrowers }, createActivity("Collections", `Payment of ${formatCurrency(amount)} recorded for borrower account.`));
};

export const scheduleBroadcast = (state, name, segment, scheduleText) => ({
  ...addActivity(
    {
      ...state,
      scheduledReports: [
        {
          id: uid("rep"),
          name,
          cadence: scheduleText,
          destination: `Broadcast to ${segment}`,
          status: "Scheduled",
        },
        ...state.scheduledReports,
      ],
    },
    createActivity("DSA Outreach", `Scheduled broadcast '${name}' for ${segment} at ${scheduleText}.`)
  ),
});

export const runAgentCommand = (state, command) => {
  const text = String(command || "").trim();
  const normalized = text.toLowerCase();
  if (!normalized) return { state, response: "Ask for outreach volume, overdue borrowers, mediator performance, or trigger a follow-up batch." };

  if (normalized.includes("new dsa replies")) {
    const replies = state.conversations.filter((convo) => convo.contactType === "DSA" && convo.unreadCount > 0).length;
    return { state, response: `${replies} DSA conversations have unread replies right now. Pending-response queue target remains zero.` };
  }

  if (normalized.startsWith("message all") && normalized.includes("dsa")) {
    const cityMatch = normalized.match(/message all\s+(.+?)\s+dsas/);
    const city = cityMatch?.[1] ? cityMatch[1].replace(/\babout\b.*$/, "").trim() : "All";
    const updated = launchCampaign(state, {
      name: `Broadcast - ${city || "All"} DSAs`,
      segment: city ? city[0].toUpperCase() + city.slice(1) : "All",
      template: "Product broadcast",
      dailyLimit: 25,
      sendWindow: "09:00 - 20:00",
      randomDelayRange: "45s - 3m",
      senderPool: 1,
    });
    return { state: updated, response: `Broadcast campaign queued for ${city || "all"} DSAs with anti-ban pacing.` };
  }

  if (normalized.includes("overdue more than")) {
    const match = normalized.match(/overdue more than\s+(\d+)/);
    const threshold = Number(match?.[1] || 0);
    const borrowers = state.borrowers.filter((item) => item.daysPastDue > threshold);
    return {
      state,
      response: borrowers.length
        ? borrowers.map((item) => `${item.name} (${item.daysPastDue} DPD, ${formatCurrency(item.outstanding)})`).join(" | ")
        : `No borrowers are above ${threshold} DPD.`,
    };
  }

  if (normalized.includes("recovery this month")) {
    const nameMatch = text.match(/mediator\s+(.+?)'s/i) || text.match(/mediator\s+(.+?)\s+recovery/i);
    const name = nameMatch?.[1]?.trim();
    const mediator = state.mediators.find((item) => item.name.toLowerCase().includes(String(name || "").toLowerCase()));
    if (!mediator) return { state, response: "Mediator not found." };
    return { state, response: `${mediator.name} has recovered ${formatCurrency(mediator.recoveryAmount)} this month across ${mediator.tasksCompleted}/${mediator.tasksAssigned} tasks.` };
  }

  if (normalized.includes("follow-up to all leads waiting for documents")) {
    const updated = sendLeadFollowups(state);
    return { state: updated, response: "Document chase batch sent to all leads in Documents Pending." };
  }

  if (normalized.includes("lead conversion numbers")) {
    const approved = state.leads.filter((lead) => lead.stage === "Approved" || lead.stage === "Disbursed").length;
    const total = state.leads.length;
    const rate = total ? ((approved / total) * 100).toFixed(1) : "0.0";
    return { state, response: `This week shows ${approved}/${total} leads at approved-or-better stages, conversion ${rate}%.` };
  }

  if (normalized.startsWith("schedule a broadcast")) {
    const updated = scheduleBroadcast(state, "Active DSA Broadcast", "active DSAs", "Tomorrow 10:00 AM");
    return { state: updated, response: "Broadcast scheduled for tomorrow at 10:00 AM for active DSAs." };
  }

  if (normalized.includes("clear inbox") || normalized.includes("reply to all")) {
    const updated = autoClearInbox(state);
    return { state: updated, response: "Inbox queue cleared. All routine threads now have automated replies." };
  }

  return {
    state,
    response: "Command understood at a high level, but this build only wires core ops actions right now. Try outreach, overdue, mediator recovery, or follow-up commands.",
  };
};

export const getAnalyticsSnapshot = (state) => {
  const contacted = state.dsaContacts.filter((item) => item.totalMessages > 0).length;
  const replied = state.dsaContacts.filter((item) => item.replyCount > 0).length;
  const activePartner = state.dsaContacts.filter((item) => item.leadsReferred > 0).length;
  const converted = state.dsaContacts.filter((item) => item.convertedCount > 0).length;
  const approved = state.leads.filter((lead) => lead.stage === "Approved" || lead.stage === "Disbursed").length;
  const docsCollected = state.leads.filter((lead) => !lead.missingDocuments.length).length;
  const totalOverdue = state.borrowers.reduce((sum, item) => sum + (item.outstanding || 0), 0);
  return {
    dsaFunnel: [
      { label: "Imported", value: state.dsaContacts.length },
      { label: "Contacted", value: contacted },
      { label: "Replied", value: replied },
      { label: "Active Partner", value: activePartner },
      { label: "Converted", value: converted },
    ],
    leadFunnel: [
      { label: "New", value: state.leads.length },
      { label: "Docs Collected", value: docsCollected },
      { label: "Approved", value: approved },
      { label: "Disbursed", value: state.leads.filter((lead) => lead.stage === "Disbursed").length },
    ],
    totalOverdue,
    responseMinutes: getDashboardMetrics(state).avgReplyMinutes,
  };
};

export const getCollectionBuckets = (state) => {
  const buckets = [
    { label: "0-30", min: 0, max: 30 },
    { label: "31-60", min: 31, max: 60 },
    { label: "61-90", min: 61, max: 90 },
    { label: "90+", min: 91, max: Number.POSITIVE_INFINITY },
  ];
  return buckets.map((bucket) => ({
    ...bucket,
    count: state.borrowers.filter((item) => item.daysPastDue >= bucket.min && item.daysPastDue <= bucket.max).length,
  }));
};

export const cloneDemoState = () => createInitialOpenClawState();
