const explicitBase = import.meta.env.VITE_API_BASE_URL;
const explicitWs = import.meta.env.VITE_WS_URL;

const defaultApiBase = () => {
  if (explicitBase) return explicitBase.replace(/\/$/, "");
  if (typeof window === "undefined") return "http://localhost:8787/api";
  return `${window.location.origin}/api`;
};

const defaultWsUrl = () => {
  if (explicitWs) return explicitWs;
  const base = defaultApiBase().replace(/\/api$/, "");
  return base.replace(/^http/, "ws") + "/ws";
};

async function request(path, options = {}) {
  const response = await fetch(`${defaultApiBase()}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || body.message || `HTTP ${response.status}`);
  }
  return body;
}

export const apiClient = {
  async health() {
    return request("/health", { method: "GET" });
  },
  async getState() {
    return request("/state", { method: "GET" });
  },
  async resetState() {
    return request("/state/reset", { method: "POST", body: "{}" });
  },
  async runCommand(command) {
    return request("/commands", { method: "POST", body: JSON.stringify({ command }) });
  },
  async importDsa(csvText) {
    return request("/import/dsa", { method: "POST", body: JSON.stringify({ csvText }) });
  },
  async launchCampaign(payload) {
    return request("/campaigns", { method: "POST", body: JSON.stringify(payload) });
  },
  async respond(conversationId, text = "") {
    return request(`/conversations/${conversationId}/respond`, { method: "POST", body: JSON.stringify({ text }) });
  },
  async autoClearInbox() {
    return request("/inbox/auto-clear", { method: "POST", body: "{}" });
  },
  async extractSampleLead() {
    return request("/leads/extract-sample", { method: "POST", body: "{}" });
  },
  async sendLeadFollowups() {
    return request("/leads/followups", { method: "POST", body: "{}" });
  },
  async moveLead(leadId, stage) {
    return request(`/leads/${leadId}/stage`, { method: "PATCH", body: JSON.stringify({ stage }) });
  },
  async logPayment(borrowerId, amount) {
    return request(`/borrowers/${borrowerId}/payments`, { method: "POST", body: JSON.stringify({ amount }) });
  },
  async shareBriefing() {
    return request("/reports/briefing/share", { method: "POST", body: "{}" });
  },
  async connectorsStatus() {
    return request("/connectors/status", { method: "GET" });
  },
  async sendMessage(payload) {
    return request("/messages/send", { method: "POST", body: JSON.stringify(payload) });
  },
  createSocket(handlers = {}) {
    const socket = new WebSocket(defaultWsUrl());
    socket.onopen = () => handlers.onOpen?.();
    socket.onerror = (event) => handlers.onError?.(event);
    socket.onclose = (event) => handlers.onClose?.(event);
    socket.onmessage = (event) => {
      try {
        handlers.onMessage?.(JSON.parse(event.data));
      } catch {
        // ignore invalid frames
      }
    };
    return socket;
  },
};
