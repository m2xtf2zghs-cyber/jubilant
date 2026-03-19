import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeIndianRupee,
  BellRing,
  Bot,
  Briefcase,
  Building2,
  CalendarClock,
  CheckCheck,
  ChevronRight,
  Database,
  Download,
  FileText,
  Gauge,
  Globe,
  LayoutDashboard,
  MessageCircle,
  PhoneCall,
  Radar,
  RefreshCcw,
  Send,
  Settings2,
  ShieldAlert,
  Sparkles,
  Target,
  Upload,
  Users,
  Wallet,
  Waypoints,
  Workflow,
} from "lucide-react";
import { demoCsv, skillCatalog } from "./data.js";
import { apiClient } from "./apiClient.js";
import {
  autoClearInbox,
  buildTemplateVariations,
  cloneDemoState,
  extractLeadFromMessage,
  formatCompactCurrency,
  formatCurrency,
  formatDate,
  formatDateTime,
  getAnalyticsSnapshot,
  getCollectionBuckets,
  getContactByConversation,
  getDashboardMetrics,
  getDsaById,
  getMediatorById,
  getMorningBriefing,
  getStoredOpenClawState,
  importDsaCsv,
  launchCampaign,
  logPayment,
  markLeadStage,
  persistOpenClawState,
  respondToConversation,
  runAgentCommand,
  scheduleBroadcast,
  sendLeadFollowups,
} from "./engine.js";

const navItems = [
  { id: "dashboard", label: "War Room", icon: LayoutDashboard },
  { id: "outreach", label: "DSA Engine", icon: Target },
  { id: "inbox", label: "Inbox", icon: MessageCircle },
  { id: "leads", label: "Leads", icon: Workflow },
  { id: "collections", label: "Collections", icon: Wallet },
  { id: "mediators", label: "Mediators", icon: Users },
  { id: "analytics", label: "Analytics", icon: Radar },
  { id: "skills", label: "Skills", icon: Sparkles },
  { id: "settings", label: "Settings", icon: Settings2 },
];

const laneColors = {
  "DSA Outreach": "text-cyan-300 bg-cyan-500/10 border-cyan-500/20",
  "Lead Pipeline": "text-blue-300 bg-blue-500/10 border-blue-500/20",
  Collections: "text-rose-300 bg-rose-500/10 border-rose-500/20",
  Mediators: "text-violet-300 bg-violet-500/10 border-violet-500/20",
};

const sectionDescriptions = {
  dashboard: "Daily war room: KPIs, overnight briefing, live activity, and response speed.",
  outreach: "Import DSAs, launch anti-ban campaigns, rotate message variants, and manage follow-up pressure.",
  inbox: "Single queue for DSAs, leads, borrowers, and mediators with near-zero unread target.",
  leads: "Capture, qualify, and move referrals through the loan pipeline without losing response speed.",
  collections: "Run reminder sequences, track PTPs, and escalate overdue accounts with field support.",
  mediators: "Assign field work, monitor check-ins, and push performance accountability every day.",
  analytics: "See funnel health, response latency, collection buckets, and operational load across the machine.",
  skills: "Prebuilt OpenClaw skills catalog mapped to growth, collections, and operations workflows.",
  settings: "Configure models, messaging safety rails, business rules, and product metadata.",
};

const sectionIcons = {
  dashboard: LayoutDashboard,
  outreach: Send,
  inbox: Bot,
  leads: Briefcase,
  collections: ShieldAlert,
  mediators: Users,
  analytics: Gauge,
  skills: Sparkles,
  settings: Settings2,
};

const SectionHeader = ({ section, onOpenLegacy, onResetDemo, command, setCommand, onRunCommand, agentResponse }) => {
  const Icon = sectionIcons[section] || LayoutDashboard;
  return (
    <div className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
      <div className="flex flex-col gap-4 px-4 py-4 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-1 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-cyan-300">
              <Icon size={22} />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">OpenClaw Agent</div>
              <div className="mt-1 text-2xl font-black tracking-tight text-white">{navItems.find((item) => item.id === section)?.label}</div>
              <div className="mt-1 max-w-3xl text-sm text-slate-400">{sectionDescriptions[section]}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {onOpenLegacy && (
              <button
                type="button"
                onClick={onOpenLegacy}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
              >
                <Building2 size={16} />
                Legacy LIRAS
              </button>
            )}
            <button
              type="button"
              onClick={onResetDemo}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
            >
              <RefreshCcw size={16} />
              Reset Demo State
            </button>
          </div>
        </div>
        <div className="grid gap-3 lg:grid-cols-[1fr_360px]">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onRunCommand();
            }}
            className="flex items-center gap-3 rounded-3xl border border-cyan-500/20 bg-slate-900/75 px-4 py-3 shadow-2xl shadow-cyan-950/20"
          >
            <Bot className="shrink-0 text-cyan-300" size={18} />
            <input
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              placeholder='Ask: "How many new DSA replies today?" or "Send follow-up to all leads waiting for documents"'
              className="w-full border-0 bg-transparent px-0 py-0 text-sm text-white placeholder:text-slate-500 focus:ring-0"
            />
            <button
              type="submit"
              className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-cyan-500 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-400"
            >
              Run
              <ArrowRight size={14} />
            </button>
          </form>
          <div className="rounded-3xl border border-white/10 bg-slate-900/70 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Agent Console</div>
            <div className="mt-1 text-sm text-slate-200">{agentResponse}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Surface = ({ className = "", children }) => (
  <div className={`rounded-3xl border border-white/10 bg-slate-900/70 p-5 shadow-2xl shadow-slate-950/25 ${className}`}>{children}</div>
);

const Chip = ({ children, className = "" }) => (
  <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${className}`}>
    {children}
  </span>
);

const MetricCard = ({ label, value, subtext, icon: Icon, tone = "cyan" }) => {
  const tones = {
    cyan: "from-cyan-500/20 to-slate-900 border-cyan-500/20 text-cyan-300",
    blue: "from-blue-500/20 to-slate-900 border-blue-500/20 text-blue-300",
    amber: "from-amber-500/20 to-slate-900 border-amber-500/20 text-amber-300",
    rose: "from-rose-500/20 to-slate-900 border-rose-500/20 text-rose-300",
    emerald: "from-emerald-500/20 to-slate-900 border-emerald-500/20 text-emerald-300",
    violet: "from-violet-500/20 to-slate-900 border-violet-500/20 text-violet-300",
  };
  return (
    <div className={`rounded-3xl border bg-gradient-to-br p-4 ${tones[tone] || tones.cyan}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">{label}</div>
          <div className="mt-2 text-2xl font-black text-white">{value}</div>
        </div>
        <div className="rounded-2xl bg-white/5 p-3">
          <Icon size={18} />
        </div>
      </div>
      {subtext && <div className="mt-3 text-sm text-slate-400">{subtext}</div>}
    </div>
  );
};

const ProgressBar = ({ label, value, max, tone = "cyan" }) => {
  const width = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const bgTone =
    tone === "emerald"
      ? "bg-emerald-400"
      : tone === "amber"
      ? "bg-amber-400"
      : tone === "rose"
      ? "bg-rose-400"
      : tone === "violet"
      ? "bg-violet-400"
      : "bg-cyan-400";
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="font-semibold text-white">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-white/5">
        <div className={`h-2 rounded-full ${bgTone}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
};

const TableCell = ({ children, subtle = false }) => <td className={`px-4 py-3 text-sm ${subtle ? "text-slate-400" : "text-slate-200"}`}>{children}</td>;

const StatusPill = ({ children, tone = "slate" }) => {
  const tones = {
    cyan: "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
    blue: "border-blue-500/20 bg-blue-500/10 text-blue-300",
    amber: "border-amber-500/20 bg-amber-500/10 text-amber-300",
    rose: "border-rose-500/20 bg-rose-500/10 text-rose-300",
    emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    violet: "border-violet-500/20 bg-violet-500/10 text-violet-300",
    slate: "border-white/10 bg-white/5 text-slate-300",
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${tones[tone] || tones.slate}`}>{children}</span>;
};

function OpenClawApp({ onOpenLegacy = null }) {
  const [state, setState] = useState(() => getStoredOpenClawState());
  const [section, setSection] = useState("dashboard");
  const [command, setCommand] = useState("How many new DSA replies today?");
  const [agentResponse, setAgentResponse] = useState(
    "OpenClaw is armed for DSA outreach, instant inbox handling, lead follow-up, collections pressure, and mediator coordination."
  );
  const [csvText, setCsvText] = useState(demoCsv);
  const [importSummary, setImportSummary] = useState("");
  const [activityFilter, setActivityFilter] = useState("All");
  const [inboxFilter, setInboxFilter] = useState("All");
  const [selectedConversationId, setSelectedConversationId] = useState(() => getStoredOpenClawState().conversations[0]?.id || "");
  const [campaignForm, setCampaignForm] = useState({
    name: "OpenClaw Fresh DSA Push",
    segment: "Chennai",
    template: "Fast loan + commission intro",
    dailyLimit: 25,
    sendWindow: "09:00 - 20:00",
    randomDelayRange: "45s - 3m",
    senderPool: 2,
  });
  const [runtime, setRuntime] = useState({
    connected: false,
    mode: "local-fallback",
    storageMode: "browser",
    websocketConnected: false,
    connectors: null,
    lastError: "",
  });

  useEffect(() => {
    persistOpenClawState(state);
  }, [state]);

  useEffect(() => {
    let cancelled = false;
    let socket;

    const bootstrap = async () => {
      try {
        const [health, currentState] = await Promise.all([apiClient.health(), apiClient.getState()]);
        if (cancelled) return;
        setState(currentState.state);
        setRuntime({
          connected: true,
          mode: "backend",
          storageMode: health.storageMode || "backend",
          websocketConnected: false,
          connectors: health.connectors || null,
          lastError: "",
        });
        socket = apiClient.createSocket({
          onOpen: () => {
            if (!cancelled) {
              setRuntime((prev) => ({ ...prev, websocketConnected: true }));
            }
          },
          onClose: () => {
            if (!cancelled) {
              setRuntime((prev) => ({ ...prev, websocketConnected: false }));
            }
          },
          onError: () => {
            if (!cancelled) {
              setRuntime((prev) => ({ ...prev, websocketConnected: false }));
            }
          },
          onMessage: (payload) => {
            if (cancelled) return;
            if (payload?.state) {
              setState(payload.state);
            }
          },
        });
      } catch (error) {
        if (!cancelled) {
          setRuntime({
            connected: false,
            mode: "local-fallback",
            storageMode: "browser",
            websocketConnected: false,
            connectors: null,
            lastError: String(error.message || error),
          });
        }
      }
    };

    bootstrap();
    return () => {
      cancelled = true;
      socket?.close();
    };
  }, []);

  useEffect(() => {
    if (!state.conversations.some((item) => item.id === selectedConversationId)) {
      setSelectedConversationId(state.conversations[0]?.id || "");
    }
  }, [selectedConversationId, state.conversations]);

  const metrics = useMemo(() => getDashboardMetrics(state), [state]);
  const briefing = useMemo(() => getMorningBriefing(state), [state]);
  const analytics = useMemo(() => getAnalyticsSnapshot(state), [state]);
  const collectionBuckets = useMemo(() => getCollectionBuckets(state), [state]);
  const selectedConversation = useMemo(
    () => state.conversations.find((item) => item.id === selectedConversationId) || state.conversations[0] || null,
    [selectedConversationId, state.conversations]
  );
  const selectedConversationContact = useMemo(() => getContactByConversation(state, selectedConversation), [selectedConversation, state]);
  const activityItems = useMemo(() => {
    if (activityFilter === "All") return state.activityFeed;
    return state.activityFeed.filter((item) => item.lane === activityFilter);
  }, [activityFilter, state.activityFeed]);
  const inboxItems = useMemo(() => {
    if (inboxFilter === "All") return state.conversations;
    return state.conversations.filter((item) => item.contactType === inboxFilter);
  }, [inboxFilter, state.conversations]);
  const templatePreview = useMemo(
    () => buildTemplateVariations("outreach", { name: "Rajesh", city: campaignForm.segment }),
    [campaignForm.segment]
  );

  const updateState = (next) => {
    setState(next);
  };

  const applyResult = (result, fallbackMessage = "") => {
    if (result?.state) updateState(result.state);
    if (result?.summary) setImportSummary(result.summary);
    if (result?.response || result?.summary || fallbackMessage) {
      setAgentResponse(result?.response || result?.summary || fallbackMessage);
    }
  };

  const runWithBackendFallback = async (remoteAction, localAction) => {
    if (runtime.connected) {
      try {
        const result = await remoteAction();
        applyResult(result);
        return result;
      } catch (error) {
        setRuntime((prev) => ({
          ...prev,
          connected: false,
          websocketConnected: false,
          mode: "local-fallback",
          storageMode: "browser",
          lastError: String(error.message || error),
        }));
      }
    }

    const localResult = await localAction();
    applyResult(localResult);
    return localResult;
  };

  const handleRunCommand = async () => {
    await runWithBackendFallback(
      () => apiClient.runCommand(command),
      async () => runAgentCommand(state, command)
    );
  };

  const handleCsvImport = async () => {
    await runWithBackendFallback(
      () => apiClient.importDsa(csvText),
      async () => importDsaCsv(state, csvText)
    );
  };

  const handleFileImport = async (file) => {
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
    await runWithBackendFallback(
      () => apiClient.importDsa(text),
      async () => importDsaCsv(state, text)
    );
  };

  const handleLaunchCampaign = async () => {
    await runWithBackendFallback(
      () => apiClient.launchCampaign(campaignForm),
      async () => ({
        state: launchCampaign(state, campaignForm),
        response: `Campaign '${campaignForm.name}' launched against ${campaignForm.segment} segment.`,
      })
    );
  };

  const handleRespond = async (conversationId, text = "") => {
    const convo = state.conversations.find((item) => item.id === conversationId);
    await runWithBackendFallback(
      () => apiClient.respond(conversationId, text),
      async () => ({
        state: respondToConversation(state, conversationId, text),
        response: `Replied to ${convo?.contactName || "contact"} and updated the operational log.`,
      })
    );
  };

  const handleAutoClearInbox = async () => {
    await runWithBackendFallback(
      () => apiClient.autoClearInbox(),
      async () => ({
        state: autoClearInbox(state),
        response: "All routine inbox items now have agent replies. Complex decisions remain for human review.",
      })
    );
  };

  const handleLeadSampleExtract = async () => {
    const dsa = getDsaById(state, "dsa-001");
    await runWithBackendFallback(
      () => apiClient.extractSampleLead(),
      async () => {
        const lead = extractLeadFromMessage("I have a client Ramesh needs PL 5 lakh salaried TCS Chennai", dsa);
        return {
          state: {
            ...state,
            leads: [lead, ...state.leads],
            activityFeed: [
              {
                id: `act-sample-${Date.now()}`,
                at: new Date().toISOString(),
                lane: "Lead Pipeline",
                text: `Sample lead extraction created ${lead.name} for ${formatCompactCurrency(lead.amount)} from ${dsa?.name}.`,
              },
              ...state.activityFeed,
            ],
          },
          response: `Lead extractor parsed ${lead.name}, ${lead.loanType}, ${formatCompactCurrency(lead.amount)} in ${lead.city}.`,
        };
      }
    );
  };

  const handleLeadFollowups = async () => {
    await runWithBackendFallback(
      () => apiClient.sendLeadFollowups(),
      async () => ({
        state: sendLeadFollowups(state),
        response: "Lead document chase automation fired for every file waiting on docs.",
      })
    );
  };

  const handleMoveLead = async (leadId, nextStage) => {
    await runWithBackendFallback(
      () => apiClient.moveLead(leadId, nextStage),
      async () => ({
        state: markLeadStage(state, leadId, nextStage),
        response: `Lead moved to ${nextStage}. Referring DSA updates can now be broadcast.`,
      })
    );
  };

  const handleLogPayment = async (borrowerId, amount) => {
    await runWithBackendFallback(
      () => apiClient.logPayment(borrowerId, amount),
      async () => ({
        state: logPayment(state, borrowerId, amount),
        response: "Payment logged for borrower account. Outstanding and DPD recalculated.",
      })
    );
  };

  const handleBriefingShare = async () => {
    await runWithBackendFallback(
      () => apiClient.shareBriefing(),
      async () => ({
        state: scheduleBroadcast(state, "Morning Briefing", "owner WhatsApp", "Today 07:00 AM"),
        response: "Morning briefing has been queued to your WhatsApp feed.",
      })
    );
  };

  const handleResetDemo = async () => {
    const result = await runWithBackendFallback(
      () => apiClient.resetState(),
      async () => {
        const fresh = cloneDemoState();
        return { state: fresh, response: "OpenClaw demo state reset to the seeded operating baseline." };
      }
    );
    const nextState = result?.state || cloneDemoState();
    setSection("dashboard");
    setSelectedConversationId(nextState.conversations[0]?.id || "");
    setImportSummary("");
    setCommand("How many new DSA replies today?");
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(6,182,212,0.15),_transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(139,92,246,0.14),_transparent_24%),linear-gradient(180deg,_#020617_0%,_#0f172a_46%,_#111827_100%)] font-[Inter,ui-sans-serif,system-ui] text-white">
      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <aside className="border-r border-white/10 bg-slate-950/85 px-4 py-6 backdrop-blur-xl lg:px-6">
          <div className="rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/15 via-slate-900 to-slate-950 p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-cyan-500/20 p-3 text-cyan-300">
                <Bot size={24} />
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-300">24/7 Machine</div>
                <div className="text-xl font-black tracking-tight text-white">OpenClaw</div>
              </div>
            </div>
            <div className="mt-4 text-sm leading-6 text-slate-300">
              Aggressive DSA hunting, instant reply coverage, lead capture, collection pressure, and mediator accountability in one operating layer.
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Chip className="border-cyan-500/20 bg-cyan-500/10 text-cyan-300">Response &lt; 60 sec</Chip>
              <Chip className="border-amber-500/20 bg-amber-500/10 text-amber-300">Anti-Ban Safety</Chip>
            </div>
          </div>

          <div className="mt-6 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                    active
                      ? "border-cyan-500/30 bg-cyan-500/10 text-white"
                      : "border-white/5 bg-white/[0.03] text-slate-300 hover:border-white/10 hover:bg-white/[0.05]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={18} className={active ? "text-cyan-300" : "text-slate-500"} />
                    <span className="font-semibold">{item.label}</span>
                  </div>
                  {item.id === "inbox" && metrics.pendingResponses > 0 ? (
                    <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-rose-500 px-2 py-1 text-xs font-bold text-white">
                      {metrics.pendingResponses}
                    </span>
                  ) : (
                    <ChevronRight size={16} className="text-slate-600" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-6 space-y-3">
            <Surface className="p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Safety Rails</div>
              <div className="mt-3 space-y-3">
                <ProgressBar label="Daily new conversations" value={Math.min(metrics.contactedToday, 50)} max={50} tone="amber" />
                <ProgressBar label="Inbox SLA risk" value={Math.min(metrics.longestPendingMinutes, 10)} max={10} tone="rose" />
                <ProgressBar label="Collection escalations" value={state.borrowers.filter((item) => item.daysPastDue > 15).length} max={10} tone="violet" />
              </div>
            </Surface>
            <Surface className="p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Channel Health</div>
              <div className="mt-3 grid gap-2 text-sm text-slate-300">
                <div className="flex items-center justify-between rounded-2xl bg-white/[0.03] px-3 py-2">
                  <span>WhatsApp Business</span>
                  <StatusPill tone="emerald">Primary</StatusPill>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-white/[0.03] px-3 py-2">
                  <span>Telegram Bot</span>
                  <StatusPill tone="cyan">Standby</StatusPill>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-white/[0.03] px-3 py-2">
                  <span>SMS Gateway</span>
                  <StatusPill tone="amber">Backup</StatusPill>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-white/[0.03] px-3 py-2">
                  <span>Email</span>
                  <StatusPill tone="slate">Formal notices</StatusPill>
                </div>
              </div>
            </Surface>
            <Surface className="p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Backend Link</div>
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                <div className="flex items-center justify-between rounded-2xl bg-white/[0.03] px-3 py-2">
                  <span>API mode</span>
                  <StatusPill tone={runtime.connected ? "emerald" : "amber"}>{runtime.mode}</StatusPill>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-white/[0.03] px-3 py-2">
                  <span>Storage</span>
                  <StatusPill tone="cyan">{runtime.storageMode}</StatusPill>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-white/[0.03] px-3 py-2">
                  <span>WebSocket</span>
                  <StatusPill tone={runtime.websocketConnected ? "emerald" : "slate"}>
                    {runtime.websocketConnected ? "Live" : "Offline"}
                  </StatusPill>
                </div>
                {runtime.lastError && <div className="text-xs text-amber-300">{runtime.lastError}</div>}
              </div>
            </Surface>
          </div>
        </aside>

        <div className="min-w-0">
          <SectionHeader
            section={section}
            onOpenLegacy={onOpenLegacy}
            onResetDemo={handleResetDemo}
            command={command}
            setCommand={setCommand}
            onRunCommand={handleRunCommand}
            agentResponse={agentResponse}
          />

          <main className="space-y-6 px-4 py-6 lg:px-8">
            {section === "dashboard" && (
              <>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                  <MetricCard label="DSAs Contacted Today" value={`${metrics.contactedToday} / ${metrics.dsaTotal}`} subtext="New outreach vs total DSA base" icon={Target} tone="cyan" />
                  <MetricCard label="Replies Today" value={metrics.repliesToday} subtext="DSA + lead replies in queue" icon={BellRing} tone="blue" />
                  <MetricCard label="New Leads Today" value={metrics.newLeadsToday} subtext="Fresh referral capture" icon={Briefcase} tone="emerald" />
                  <MetricCard label="Follow-Ups" value={`${metrics.followupsCompleted} / ${metrics.followupsPending}`} subtext="Completed vs still pending" icon={Waypoints} tone="amber" />
                  <MetricCard label="Collections" value={`${metrics.collectionRemindersSent} / ${metrics.paymentsReceived}`} subtext="Reminders sent / payments received" icon={BadgeIndianRupee} tone="rose" />
                  <MetricCard label="Mediator Tasks" value={`${metrics.activeMediatorTasks} / ${metrics.completedMediatorTasks}`} subtext="Active vs completed today" icon={Users} tone="violet" />
                </div>

                <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                  <Surface>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Morning Briefing</div>
                        <div className="mt-1 text-xl font-black text-white">07:00 command summary</div>
                      </div>
                      <button
                        type="button"
                        onClick={handleBriefingShare}
                        className="inline-flex items-center gap-2 rounded-2xl bg-cyan-500 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-400"
                      >
                        <Send size={16} />
                        Send to WhatsApp
                      </button>
                    </div>
                    <div className="mt-5 space-y-3">
                      {briefing.map((line) => (
                        <div key={line} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200">
                          {line}
                        </div>
                      ))}
                    </div>
                  </Surface>

                  <Surface>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Response Speed Monitor</div>
                    <div className="mt-1 text-xl font-black text-white">No warm thread should wait</div>
                    <div className="mt-5 grid gap-4">
                      <MetricCard label="Average Reply Time" value={`${metrics.avgReplyMinutes.toFixed(1)} min`} subtext="Target: under 1 minute for warm replies" icon={Gauge} tone="cyan" />
                      <MetricCard label="Messages Waiting" value={metrics.pendingResponses} subtext="Queue target is zero" icon={MessageCircle} tone={metrics.pendingResponses ? "rose" : "emerald"} />
                      <MetricCard label="Oldest Pending" value={`${metrics.longestPendingMinutes} min`} subtext={metrics.longestPendingMinutes > 5 ? "Alert: beyond SLA" : "Within active SLA"} icon={AlertTriangle} tone={metrics.longestPendingMinutes > 5 ? "rose" : "amber"} />
                    </div>
                    <button
                      type="button"
                      onClick={handleAutoClearInbox}
                      className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm font-bold text-cyan-300 transition hover:bg-cyan-500/15"
                    >
                      <CheckCheck size={16} />
                      Clear routine inbox now
                    </button>
                  </Surface>
                </div>

                <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
                  <Surface>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Live Activity Feed</div>
                        <div className="mt-1 text-xl font-black text-white">Real-time agent ticker</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {["All", "DSA Outreach", "Lead Pipeline", "Collections", "Mediators"].map((lane) => (
                          <button
                            key={lane}
                            type="button"
                            onClick={() => setActivityFilter(lane)}
                            className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                              activityFilter === lane
                                ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                                : "border-white/10 bg-white/[0.03] text-slate-400"
                            }`}
                          >
                            {lane}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="mt-5 space-y-3">
                      {activityItems.slice(0, 8).map((item) => (
                        <div key={item.id} className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                          <div className="mt-1 h-2.5 w-2.5 rounded-full bg-cyan-400" />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <StatusPill tone={item.lane === "Collections" ? "rose" : item.lane === "Mediators" ? "violet" : item.lane === "Lead Pipeline" ? "blue" : "cyan"}>
                                {item.lane}
                              </StatusPill>
                              <span className="text-xs text-slate-500">{formatDateTime(item.at)}</span>
                            </div>
                            <div className="mt-2 text-sm text-slate-200">{item.text}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Surface>

                  <Surface>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Campaign Watch</div>
                    <div className="mt-1 text-xl font-black text-white">Outreach pressure and queue heat</div>
                    <div className="mt-5 space-y-4">
                      {state.campaigns.slice(0, 4).map((campaign) => (
                        <div key={campaign.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-bold text-white">{campaign.name}</div>
                            <StatusPill tone={campaign.status === "Running" ? "emerald" : "amber"}>{campaign.status}</StatusPill>
                          </div>
                          <div className="mt-2 text-sm text-slate-400">
                            {campaign.segment} | {campaign.sendWindow} | {campaign.randomDelayRange}
                          </div>
                          <div className="mt-4 space-y-2">
                            <ProgressBar label="Today's sent" value={campaign.todaySent} max={campaign.dailyLimit} tone="cyan" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </Surface>
                </div>
              </>
            )}

            {section === "outreach" && (
              <div className="grid gap-6 2xl:grid-cols-[1.15fr_0.85fr]">
                <div className="space-y-6">
                  <Surface>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">DSA Database & Import</div>
                        <div className="mt-1 text-xl font-black text-white">5,000+ contact-ready structure</div>
                      </div>
                      <Chip className="border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
                        <Database size={12} />
                        {state.dsaContacts.length} contacts
                      </Chip>
                    </div>
                    <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_320px]">
                      <div className="space-y-3">
                        <textarea
                          value={csvText}
                          onChange={(event) => setCsvText(event.target.value)}
                          rows={9}
                          className="w-full rounded-3xl border border-white/10 bg-slate-950/70 px-4 py-4 text-sm text-slate-200"
                        />
                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={handleCsvImport}
                            className="inline-flex items-center gap-2 rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-400"
                          >
                            <Upload size={16} />
                            Import CSV Text
                          </button>
                          <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06]">
                            <Download size={16} />
                            Upload CSV File
                            <input
                              type="file"
                              accept=".csv,text/csv"
                              className="hidden"
                              onChange={(event) => handleFileImport(event.target.files?.[0])}
                            />
                          </label>
                        </div>
                        {importSummary && <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{importSummary}</div>}
                      </div>
                      <div className="space-y-3">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                          <div className="text-sm font-bold text-white">De-duplication summary</div>
                          <div className="mt-2 text-sm text-slate-400">Phone numbers are normalized to 10 digits and merged into a single partner record.</div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                          <div className="text-sm font-bold text-white">Default tags</div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {["New", "Contacted", "Replied", "Active Partner", "Cold", "Dead", "Blacklisted"].map((tag) => (
                              <StatusPill key={tag} tone={tag === "Active Partner" ? "emerald" : tag === "Dead" ? "rose" : tag === "Replied" ? "cyan" : "slate"}>
                                {tag}
                              </StatusPill>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-6 overflow-hidden rounded-3xl border border-white/10">
                      <table className="min-w-full divide-y divide-white/10">
                        <thead className="bg-white/[0.03]">
                          <tr>
                            {["Name", "City", "Tag", "Loan Types", "Leads", "Commission", "Last Contact"].map((head) => (
                              <th key={head} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                                {head}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 bg-slate-950/30">
                          {state.dsaContacts.slice(0, 7).map((dsa) => (
                            <tr key={dsa.id}>
                              <TableCell>
                                <div className="font-semibold text-white">{dsa.name}</div>
                                <div className="text-xs text-slate-500">{dsa.phone}</div>
                              </TableCell>
                              <TableCell subtle>{dsa.city}</TableCell>
                              <TableCell>
                                <StatusPill tone={dsa.tag === "Active Partner" ? "emerald" : dsa.tag === "Replied" ? "cyan" : dsa.tag === "Dead" ? "rose" : "slate"}>
                                  {dsa.tag}
                                </StatusPill>
                              </TableCell>
                              <TableCell subtle>{dsa.loanTypes.join(", ")}</TableCell>
                              <TableCell subtle>{dsa.leadsReferred}</TableCell>
                              <TableCell subtle>{formatCompactCurrency(dsa.commissionEarned)}</TableCell>
                              <TableCell subtle>{dsa.lastContactedAt ? formatDateTime(dsa.lastContactedAt) : "Not contacted"}</TableCell>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Surface>

                  <Surface>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Message Rotation</div>
                    <div className="mt-1 text-xl font-black text-white">Variation preview for anti-ban hygiene</div>
                    <div className="mt-5 grid gap-3">
                      {templatePreview.slice(0, 3).map((message) => (
                        <div key={message} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200">
                          {message}
                        </div>
                      ))}
                    </div>
                  </Surface>
                </div>

                <div className="space-y-6">
                  <Surface>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Campaign Builder</div>
                    <div className="mt-1 text-xl font-black text-white">Controlled mass outreach</div>
                    <div className="mt-5 grid gap-3">
                      {[
                        ["Campaign name", "name"],
                        ["Target segment", "segment"],
                        ["Template", "template"],
                        ["Daily limit", "dailyLimit"],
                        ["Send window", "sendWindow"],
                        ["Random delay", "randomDelayRange"],
                        ["Sender pool", "senderPool"],
                      ].map(([label, key]) => (
                        <label key={key} className="space-y-2 text-sm">
                          <div className="font-semibold text-slate-300">{label}</div>
                          <input
                            value={campaignForm[key]}
                            onChange={(event) => setCampaignForm((prev) => ({ ...prev, [key]: event.target.value }))}
                            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white"
                          />
                        </label>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={handleLaunchCampaign}
                      className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-400"
                    >
                      <Send size={16} />
                      Launch Campaign
                    </button>
                  </Surface>

                  <Surface>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Follow-Up Sequence</div>
                    <div className="mt-4 space-y-3">
                      {[
                        "Day 2: polite re-touch asking for active cases.",
                        "Day 5: confirm referral activity and talk TAT.",
                        "Day 10: value-add proof with real commission story.",
                        "Day 20: final soft attempt before cooling off.",
                        "Day 30: mark cold, restart after 60 days.",
                      ].map((step) => (
                        <div key={step} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200">
                          {step}
                        </div>
                      ))}
                    </div>
                  </Surface>

                  <Surface>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Top DSA Leaderboard</div>
                    <div className="mt-4 space-y-3">
                      {[...state.dsaContacts]
                        .sort((a, b) => (b.commissionEarned || 0) - (a.commissionEarned || 0))
                        .slice(0, 4)
                        .map((dsa, index) => (
                          <div key={dsa.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                            <div>
                              <div className="font-semibold text-white">
                                #{index + 1} {dsa.name}
                              </div>
                              <div className="text-sm text-slate-400">
                                {dsa.city} | {dsa.leadsReferred} leads | {dsa.convertedCount} converted
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-emerald-300">{formatCompactCurrency(dsa.commissionEarned)}</div>
                              <div className="text-xs text-slate-500">{dsa.engagementLevel}</div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </Surface>
                </div>
              </div>
            )}

            {section === "inbox" && (
              <div className="grid gap-6 2xl:grid-cols-[400px_1fr]">
                <Surface>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Unified Inbox</div>
                      <div className="mt-1 text-xl font-black text-white">Unread counter must trend to zero</div>
                    </div>
                    <button
                      type="button"
                      onClick={handleAutoClearInbox}
                      className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-sm font-bold text-cyan-300"
                    >
                      Auto-reply all
                    </button>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {["All", "DSA", "Lead", "Borrower", "Mediator"].map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setInboxFilter(filter)}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                          inboxFilter === filter
                            ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                            : "border-white/10 bg-white/[0.03] text-slate-400"
                        }`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                  <div className="mt-5 space-y-3">
                    {inboxItems.map((conversation) => (
                      <button
                        key={conversation.id}
                        type="button"
                        onClick={() => setSelectedConversationId(conversation.id)}
                        className={`w-full rounded-2xl border p-4 text-left transition ${
                          selectedConversationId === conversation.id
                            ? "border-cyan-500/30 bg-cyan-500/10"
                            : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-bold text-white">{conversation.contactName}</div>
                            <div className="mt-1 text-sm text-slate-400">
                              {conversation.contactType} via {conversation.channel}
                            </div>
                          </div>
                          {conversation.unreadCount > 0 && (
                            <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-rose-500 px-2 py-1 text-xs font-bold text-white">
                              {conversation.unreadCount}
                            </span>
                          )}
                        </div>
                        <div className="mt-3 text-sm text-slate-300 line-clamp-2">{conversation.messages.at(-1)?.text}</div>
                        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                          <StatusPill tone={conversation.priority === "Hot" ? "amber" : conversation.priority === "Escalation" ? "rose" : "slate"}>
                            {conversation.priority}
                          </StatusPill>
                          <span>{formatDateTime(conversation.lastMessageAt)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </Surface>

                <Surface>
                  {selectedConversation ? (
                    <>
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Active Thread</div>
                          <div className="mt-1 text-2xl font-black text-white">{selectedConversation.contactName}</div>
                          <div className="mt-1 text-sm text-slate-400">
                            {selectedConversation.contactType} | {selectedConversation.channel} | last active {formatDateTime(selectedConversation.lastMessageAt)}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <StatusPill tone={selectedConversation.priority === "Hot" ? "amber" : selectedConversation.priority === "Escalation" ? "rose" : "cyan"}>
                            {selectedConversation.priority}
                          </StatusPill>
                          <button
                            type="button"
                            onClick={() => handleRespond(selectedConversation.id)}
                            className="inline-flex items-center gap-2 rounded-2xl bg-cyan-500 px-4 py-2 text-sm font-bold text-slate-950"
                          >
                            <Bot size={16} />
                            Auto reply
                          </button>
                        </div>
                      </div>
                      <div className="mt-5 grid gap-6 xl:grid-cols-[1fr_320px]">
                        <div className="space-y-3">
                          {selectedConversation.messages.map((message) => (
                            <div
                              key={message.id}
                              className={`max-w-[88%] rounded-3xl px-4 py-3 text-sm ${
                                message.direction === "out"
                                  ? "ml-auto border border-cyan-500/20 bg-cyan-500/10 text-cyan-50"
                                  : "border border-white/10 bg-white/[0.04] text-slate-200"
                              }`}
                            >
                              <div>{message.text}</div>
                              <div className="mt-2 text-xs text-slate-400">{formatDateTime(message.at)}</div>
                            </div>
                          ))}
                        </div>
                        <div className="space-y-4">
                          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                            <div className="text-sm font-bold text-white">Linked profile</div>
                            <div className="mt-3 space-y-2 text-sm text-slate-300">
                              {selectedConversation.contactType === "DSA" && selectedConversationContact && (
                                <>
                                  <div>City: {selectedConversationContact.city}</div>
                                  <div>Loan types: {selectedConversationContact.loanTypes.join(", ")}</div>
                                  <div>Commission earned: {formatCompactCurrency(selectedConversationContact.commissionEarned)}</div>
                                </>
                              )}
                              {selectedConversation.contactType === "Lead" && selectedConversationContact && (
                                <>
                                  <div>Stage: {selectedConversationContact.stage}</div>
                                  <div>Amount: {formatCompactCurrency(selectedConversationContact.amount)}</div>
                                  <div>Missing docs: {selectedConversationContact.missingDocuments.join(", ") || "None"}</div>
                                </>
                              )}
                              {selectedConversation.contactType === "Borrower" && selectedConversationContact && (
                                <>
                                  <div>DPD: {selectedConversationContact.daysPastDue}</div>
                                  <div>Outstanding: {formatCompactCurrency(selectedConversationContact.outstanding)}</div>
                                  <div>Tag: {selectedConversationContact.tag}</div>
                                </>
                              )}
                              {selectedConversation.contactType === "Mediator" && selectedConversationContact && (
                                <>
                                  <div>Area: {selectedConversationContact.area}</div>
                                  <div>Tasks completed: {selectedConversationContact.tasksCompleted}</div>
                                  <div>Recovery: {formatCompactCurrency(selectedConversationContact.recoveryAmount)}</div>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                            <div className="text-sm font-bold text-white">Quick actions</div>
                            <div className="mt-3 grid gap-2">
                              <button type="button" onClick={() => handleRespond(selectedConversation.id)} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm text-slate-200">
                                Smart reply from intent
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRespond(selectedConversation.id, "I’m checking this file now. You’ll have the next concrete update within 10 minutes.")}
                                className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm text-slate-200"
                              >
                                Send human-style holding reply
                              </button>
                              {selectedConversation.contactType === "Borrower" && (
                                <button
                                  type="button"
                                  onClick={() => handleLogPayment(selectedConversation.contactId, 5000)}
                                  className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-left text-sm text-emerald-300"
                                >
                                  Log part payment ₹5,000
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-slate-400">No conversation selected.</div>
                  )}
                </Surface>
              </div>
            )}

            {section === "leads" && (
              <div className="space-y-6">
                <div className="grid gap-4 lg:grid-cols-3">
                  <MetricCard label="Pipeline Value" value={formatCompactCurrency(state.leads.reduce((sum, lead) => sum + lead.amount, 0))} subtext="Total active requested volume" icon={BadgeIndianRupee} tone="blue" />
                  <MetricCard label="Docs Pending" value={state.leads.filter((lead) => lead.stage === "Documents Pending").length} subtext="Immediate document chase target" icon={FileText} tone="amber" />
                  <MetricCard label="Approved / Disbursed" value={state.leads.filter((lead) => ["Approved", "Disbursed"].includes(lead.stage)).length} subtext="High-probability revenue" icon={CheckCheck} tone="emerald" />
                </div>

                <div className="grid gap-6 2xl:grid-cols-[1.1fr_0.9fr]">
                  <Surface>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Lead Pipeline</div>
                        <div className="mt-1 text-xl font-black text-white">New inquiry to disbursement</div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleLeadSampleExtract}
                          className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-sm font-bold text-cyan-300"
                        >
                          Run lead extractor
                        </button>
                        <button
                          type="button"
                          onClick={handleLeadFollowups}
                          className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm font-bold text-amber-300"
                        >
                          Chase documents
                        </button>
                      </div>
                    </div>
                    <div className="mt-5 grid gap-4 xl:grid-cols-4">
                      {["New Inquiry", "Documents Pending", "Under Review", "Approved"].map((stage) => (
                        <div key={stage} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-bold text-white">{stage}</div>
                            <StatusPill tone={stage === "Approved" ? "emerald" : stage === "Documents Pending" ? "amber" : stage === "Under Review" ? "blue" : "cyan"}>
                              {state.leads.filter((lead) => lead.stage === stage).length}
                            </StatusPill>
                          </div>
                          <div className="mt-4 space-y-3">
                            {state.leads
                              .filter((lead) => lead.stage === stage)
                              .map((lead) => (
                                <div key={lead.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-3">
                                  <div className="font-semibold text-white">{lead.name}</div>
                                  <div className="mt-1 text-sm text-slate-400">
                                    {lead.loanType} | {formatCompactCurrency(lead.amount)} | {lead.city}
                                  </div>
                                  <div className="mt-2 text-xs text-slate-500">{lead.nextAction}</div>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {stage !== "Approved" && (
                                      <button
                                        type="button"
                                        onClick={() => handleMoveLead(lead.id, stage === "New Inquiry" ? "Documents Pending" : stage === "Documents Pending" ? "Under Review" : "Approved")}
                                        className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300"
                                      >
                                        Move forward
                                      </button>
                                    )}
                                    <StatusPill tone="slate">{lead.daysInStage} days</StatusPill>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Surface>

                  <Surface>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Lead Alerts</div>
                    <div className="mt-1 text-xl font-black text-white">Follow-up pressure and stale file watch</div>
                    <div className="mt-5 space-y-4">
                      {state.leads.map((lead) => (
                        <div key={lead.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-bold text-white">{lead.name}</div>
                              <div className="mt-1 text-sm text-slate-400">
                                {lead.stage} | {lead.loanType} | {formatCompactCurrency(lead.amount)}
                              </div>
                            </div>
                            <StatusPill tone={lead.missingDocuments.length ? "amber" : "emerald"}>
                              {lead.missingDocuments.length ? "Pending docs" : "Complete"}
                            </StatusPill>
                          </div>
                          <div className="mt-3 text-sm text-slate-300">{lead.statusNote}</div>
                          {lead.sourceDsaId && (
                            <div className="mt-3 text-xs text-slate-500">Source DSA: {getDsaById(state, lead.sourceDsaId)?.name || "Unknown"}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </Surface>
                </div>
              </div>
            )}

            {section === "collections" && (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                  <MetricCard label="Active Loans" value={state.borrowers.length} subtext="Borrower profiles in collection stack" icon={Wallet} tone="blue" />
                  <MetricCard label="Overdue Amount" value={formatCompactCurrency(analytics.totalOverdue)} subtext="Current outstanding balance" icon={ShieldAlert} tone="rose" />
                  <MetricCard label="EMI Collection Rate" value="78%" subtext="This month portfolio recovery rate" icon={Gauge} tone="emerald" />
                  <MetricCard label="PTP Open" value={state.borrowers.filter((item) => item.ptp && !item.ptp.fulfilled).length} subtext="Promises requiring check-back" icon={CalendarClock} tone="amber" />
                  <MetricCard label="NPA Flagged" value={state.borrowers.filter((item) => item.daysPastDue >= 90).length} subtext="Serious delinquency queue" icon={AlertTriangle} tone="violet" />
                </div>

                <div className="grid gap-6 2xl:grid-cols-[0.85fr_1.15fr]">
                  <Surface>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Aging Buckets</div>
                    <div className="mt-5 space-y-4">
                      {collectionBuckets.map((bucket) => (
                        <ProgressBar key={bucket.label} label={`${bucket.label} DPD`} value={bucket.count} max={Math.max(1, state.borrowers.length)} tone={bucket.label === "90+" ? "rose" : bucket.label === "61-90" ? "amber" : "cyan"} />
                      ))}
                    </div>
                    <div className="mt-6 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4">
                      <div className="font-bold text-rose-300">Serious escalation watch</div>
                      <div className="mt-2 text-sm text-slate-200">
                        {state.borrowers.filter((item) => item.daysPastDue >= 90).map((item) => `${item.name} (${item.daysPastDue} DPD)`).join(", ") || "No 90+ DPD account currently flagged."}
                      </div>
                    </div>
                  </Surface>

                  <Surface>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Borrower Collection Profiles</div>
                        <div className="mt-1 text-xl font-black text-white">Reminder sequences, PTPs, and field escalation</div>
                      </div>
                    </div>
                    <div className="mt-5 grid gap-4">
                      {state.borrowers.map((borrower) => (
                        <div key={borrower.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                            <div>
                              <div className="font-bold text-white">{borrower.name}</div>
                              <div className="mt-1 text-sm text-slate-400">
                                EMI {formatCurrency(borrower.emi)} | Outstanding {formatCurrency(borrower.outstanding)} | {borrower.daysPastDue} DPD
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <StatusPill tone={borrower.daysPastDue > 30 ? "rose" : borrower.daysPastDue > 7 ? "amber" : "cyan"}>{borrower.tag}</StatusPill>
                                <StatusPill tone="slate">Mediator: {getMediatorById(state, borrower.assignedMediatorId)?.name || "Unassigned"}</StatusPill>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => handleLogPayment(borrower.id, borrower.ptp?.amount || 5000)}
                                className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-300"
                              >
                                Log payment
                              </button>
                              <button
                                type="button"
                                onClick={() => updateState(scheduleBroadcast(state, `${borrower.name} escalation`, borrower.name, "Today 5:30 PM"))}
                                className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-2 text-sm font-bold text-rose-300"
                              >
                                Escalate
                              </button>
                            </div>
                          </div>
                          <div className="mt-4 grid gap-3 xl:grid-cols-3">
                            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-3 text-sm text-slate-300">
                              <div className="font-semibold text-white">Sequence stage</div>
                              <div className="mt-2">
                                {borrower.daysPastDue >= 90
                                  ? "NPA flag + legal notice draft"
                                  : borrower.daysPastDue >= 30
                                  ? "Serious 30+ day legal-prep sequence"
                                  : borrower.daysPastDue >= 15
                                  ? "Field mediator escalation"
                                  : borrower.daysPastDue >= 7
                                  ? "Firm reminder sequence"
                                  : "Soft reminder sequence"}
                              </div>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-3 text-sm text-slate-300">
                              <div className="font-semibold text-white">PTP tracker</div>
                              <div className="mt-2">
                                {borrower.ptp
                                  ? `${formatCurrency(borrower.ptp.amount)} promised by ${formatDate(borrower.ptp.promisedDate)}`
                                  : "No active promise-to-pay logged"}
                              </div>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-3 text-sm text-slate-300">
                              <div className="font-semibold text-white">Payment history</div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {borrower.paymentHistory.map((item, index) => (
                                  <span
                                    key={`${borrower.id}-${index}`}
                                    className={`h-8 w-8 rounded-full border text-xs font-bold inline-flex items-center justify-center ${
                                      item === "paid"
                                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                                        : item === "partial"
                                        ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
                                        : "border-rose-500/20 bg-rose-500/10 text-rose-300"
                                    }`}
                                  >
                                    {item === "paid" ? "P" : item === "partial" ? "H" : "M"}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Surface>
                </div>
              </div>
            )}

            {section === "mediators" && (
              <div className="grid gap-6 2xl:grid-cols-[1fr_1fr]">
                <Surface>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Daily Task Assignment</div>
                  <div className="mt-1 text-xl font-black text-white">Morning field deployment</div>
                  <div className="mt-5 space-y-4">
                    {state.mediators.map((mediator) => {
                      const tasks = state.mediatorTasks.filter((task) => task.mediatorId === mediator.id);
                      return (
                        <div key={mediator.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-bold text-white">{mediator.name}</div>
                              <div className="mt-1 text-sm text-slate-400">
                                {mediator.type} | {mediator.area} | {mediator.status}
                              </div>
                            </div>
                            <StatusPill tone={mediator.avgResponseMinutes <= 6 ? "emerald" : mediator.avgResponseMinutes <= 10 ? "amber" : "rose"}>
                              {mediator.avgResponseMinutes}m avg response
                            </StatusPill>
                          </div>
                          <div className="mt-4 space-y-2">
                            {tasks.map((task, index) => (
                              <div key={task.id} className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-200">
                                {index + 1}. {task.title} | {task.notes}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Surface>

                <div className="space-y-6">
                  <Surface>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Mediator Scorecards</div>
                    <div className="mt-5 space-y-4">
                      {[...state.mediators]
                        .sort((a, b) => (b.recoveryAmount || 0) - (a.recoveryAmount || 0))
                        .map((mediator, index) => (
                          <div key={mediator.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-bold text-white">
                                  #{index + 1} {mediator.name}
                                </div>
                                <div className="mt-1 text-sm text-slate-400">
                                  Recovery {formatCompactCurrency(mediator.recoveryAmount)} | Commission {formatCompactCurrency(mediator.commissionEarned)}
                                </div>
                              </div>
                              <StatusPill tone={mediator.tasksCompleted === mediator.tasksAssigned ? "emerald" : "amber"}>
                                {mediator.tasksCompleted}/{mediator.tasksAssigned} done
                              </StatusPill>
                            </div>
                            <div className="mt-4 grid gap-3 md:grid-cols-3">
                              <ProgressBar label="Task completion" value={mediator.tasksCompleted} max={Math.max(1, mediator.tasksAssigned)} tone="cyan" />
                              <ProgressBar label="PTP won" value={mediator.ptpWon} max={Math.max(1, mediator.tasksAssigned)} tone="amber" />
                              <ProgressBar label="PTP fulfilled" value={mediator.ptpFulfilled} max={Math.max(1, mediator.ptpWon)} tone="emerald" />
                            </div>
                          </div>
                        ))}
                    </div>
                  </Surface>

                  <Surface>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Operational alerts</div>
                    <div className="mt-4 space-y-3">
                      {state.mediators.map((mediator) => {
                        const daysSilent = mediator.lastReportedAt ? Math.round((Date.now() - new Date(mediator.lastReportedAt).getTime()) / 86_400_000) : 999;
                        return (
                          <div key={mediator.id} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200">
                            {daysSilent >= 2
                              ? `${mediator.name} has not reported in ${daysSilent} days. Escalate manager check-in.`
                              : `${mediator.name} is active. Last report ${formatDateTime(mediator.lastReportedAt)}.`}
                          </div>
                        );
                      })}
                    </div>
                  </Surface>
                </div>
              </div>
            )}

            {section === "analytics" && (
              <div className="grid gap-6 2xl:grid-cols-[0.95fr_1.05fr]">
                <Surface>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Growth Funnels</div>
                  <div className="mt-5 space-y-5">
                    <div>
                      <div className="mb-3 text-sm font-bold text-white">DSA Outreach Funnel</div>
                      <div className="space-y-3">
                        {analytics.dsaFunnel.map((step, index) => (
                          <ProgressBar key={step.label} label={`${index + 1}. ${step.label}`} value={step.value} max={analytics.dsaFunnel[0].value || 1} tone={index > 2 ? "emerald" : "cyan"} />
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="mb-3 text-sm font-bold text-white">Lead Funnel</div>
                      <div className="space-y-3">
                        {analytics.leadFunnel.map((step, index) => (
                          <ProgressBar key={step.label} label={`${index + 1}. ${step.label}`} value={step.value} max={analytics.leadFunnel[0].value || 1} tone={index > 1 ? "emerald" : "blue"} />
                        ))}
                      </div>
                    </div>
                  </div>
                </Surface>

                <div className="space-y-6">
                  <Surface>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Predictive Insights</div>
                    <div className="mt-4 space-y-3">
                      {[
                        "Rajesh Kumar and Priya Agency are most likely to refer new files this week based on reply tempo and prior case quality.",
                        "Mohan and Lakshmi are likely to miss the next EMI unless field follow-up lands before the promised date.",
                        "Chennai outreach window 11:00 AM to 1:00 PM is outperforming other slots in this seed run.",
                        "Lead Deepa is at risk of going cold within the next 4 hours without a qualification response.",
                      ].map((line) => (
                        <div key={line} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200">
                          {line}
                        </div>
                      ))}
                    </div>
                  </Surface>

                  <Surface>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Scheduled Reports</div>
                    <div className="mt-4 space-y-3">
                      {state.scheduledReports.map((report) => (
                        <div key={report.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                          <div>
                            <div className="font-semibold text-white">{report.name}</div>
                            <div className="text-sm text-slate-400">
                              {report.cadence} | {report.destination}
                            </div>
                          </div>
                          <StatusPill tone={report.status === "Active" ? "emerald" : "amber"}>{report.status}</StatusPill>
                        </div>
                      ))}
                    </div>
                  </Surface>
                </div>
              </div>
            )}

            {section === "skills" && (
              <div className="space-y-6">
                <Surface>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Prebuilt OpenClaw Skills</div>
                  <div className="mt-1 text-xl font-black text-white">24 operational skills wired into the app model</div>
                  <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {skillCatalog.map((skill) => (
                      <div key={skill.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{skill.category}</div>
                            <div className="mt-2 font-bold text-white">{skill.name}</div>
                          </div>
                          <StatusPill tone="emerald">{skill.status}</StatusPill>
                        </div>
                        <div className="mt-3 text-sm text-slate-300">{skill.summary}</div>
                      </div>
                    ))}
                  </div>
                </Surface>
              </div>
            )}

            {section === "settings" && (
              <div className="grid gap-6 xl:grid-cols-2">
                <Surface>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Agent Settings</div>
                  <div className="mt-5 space-y-4">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="font-bold text-white">LLM routing</div>
                      <div className="mt-3 grid gap-2 text-sm text-slate-300">
                        <div>Provider: {state.settings.llmProvider}</div>
                        <div>Fast replies: {state.settings.fastReplyModel}</div>
                        <div>Complex reasoning: {state.settings.complexReasoningModel}</div>
                        <div>Bulk ops: {state.settings.bulkOpsModel}</div>
                        <div>Tone: {state.settings.tone}</div>
                        <div>Language priority: {state.settings.languagePriority.join(" → ")}</div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="font-bold text-white">WhatsApp safety</div>
                      <div className="mt-3 grid gap-2 text-sm text-slate-300">
                        <div>Daily new conversation cap: {state.settings.dailyMessageLimit}</div>
                        <div>Minimum delay: {state.settings.minDelaySeconds} sec</div>
                        <div>Cool-down after {state.settings.cooldownEvery} messages for {state.settings.cooldownMinutes} min</div>
                        <div>Rotate numbers: {state.settings.rotateNumbers ? "Enabled" : "Disabled"}</div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="font-bold text-white">Connector status</div>
                      <div className="mt-3 grid gap-3 text-sm text-slate-300">
                        {Object.entries(runtime.connectors || {}).length ? (
                          Object.entries(runtime.connectors).map(([key, value]) => (
                            <div key={key} className="flex items-center justify-between rounded-2xl bg-slate-950/40 px-3 py-2">
                              <span className="capitalize">{key}</span>
                              <StatusPill tone={value.enabled ? "emerald" : "amber"}>
                                {value.enabled ? value.provider : "Not configured"}
                              </StatusPill>
                            </div>
                          ))
                        ) : (
                          <div className="text-slate-400">No backend connector status available yet.</div>
                        )}
                      </div>
                    </div>
                  </div>
                </Surface>

                <Surface>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Business Configuration</div>
                  <div className="mt-5 space-y-4">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="font-bold text-white">{state.settings.companyName}</div>
                      <div className="mt-2 text-sm text-slate-400">
                        Working hours {state.settings.workingHours} | {state.settings.holidayMode}
                      </div>
                    </div>
                    <div className="space-y-3">
                      {state.settings.products.map((product) => (
                        <div key={product.code} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-bold text-white">
                              {product.code} · {product.label}
                            </div>
                            <StatusPill tone="cyan">{product.commission}</StatusPill>
                          </div>
                          <div className="mt-2 text-sm text-slate-400">
                            {product.amountRange} | {product.rate}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Surface>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

export default OpenClawApp;
