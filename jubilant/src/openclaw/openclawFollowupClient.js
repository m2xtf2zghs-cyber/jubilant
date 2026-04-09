import { callOpenclawChat } from "./openclawChatClient.js";

const safeLine = (value) => String(value || "").replace(/\s+/g, " ").trim();

const formatLeadContext = (lead) => ({
  name: safeLine(lead?.name),
  company: safeLine(lead?.company),
  status: safeLine(lead?.status),
  amount: Number(lead?.loanAmount || 0),
  next_action: safeLine(lead?.nextFollowUpLabel || lead?.nextFollowUp),
  latest_update: safeLine(lead?.latestNoteText),
  mediator: safeLine(lead?.mediatorName),
  phone: safeLine(lead?.phone),
});

export async function openclawMediatorFollowupDraft({ mediator, leads = [], language = "English" }) {
  const mediatorName = safeLine(mediator?.name || "Partner");
  const systemPrompt = [
    "You are writing a WhatsApp follow-up for a business partner/mediator in a lending CRM.",
    "Output plain text only.",
    "Keep it concise, respectful, professional, and action-oriented.",
    "Do not use markdown, bullets, or emojis.",
    `Language: ${language}`,
  ].join("\n");

  const prompt = [
    `Write one WhatsApp follow-up message to ${mediatorName}.`,
    "Goal: ask for updates on the listed client cases, mention only the key pending reason for each, and ask for next actionable status.",
    "Tone: polite, corporate, not robotic.",
    "Limit: 6 short lines max.",
    "Include client names inline naturally.",
    "If contact details are pending, ask to share contact details.",
    "If statement/documents are pending, ask for the statement/documents or ETA.",
    "If meeting is scheduled, ask for post-meeting update.",
    "Cases:",
    JSON.stringify(leads.map(formatLeadContext), null, 2),
  ].join("\n");

  return callOpenclawChat({ prompt, systemPrompt, maxTokens: 260 });
}

export async function openclawClientFollowupDraft({ lead, language = "English" }) {
  const systemPrompt = [
    "You are drafting a short client follow-up WhatsApp for a lending CRM.",
    "Output plain text only.",
    "No markdown, no bullets, no emojis.",
    "Keep it concise and natural, max 3 lines.",
    `Language: ${language}`,
  ].join("\n");

  const prompt = [
    "Write a short WhatsApp follow-up to this client.",
    "Goal: ask for the next required step based on current status and latest update.",
    "Avoid sounding aggressive.",
    "Lead:",
    JSON.stringify(formatLeadContext(lead), null, 2),
  ].join("\n");

  return callOpenclawChat({ prompt, systemPrompt, maxTokens: 180 });
}

export async function openclawFollowupSummary({ mediatorQueue = [], clientQueue = [], language = "English" }) {
  const systemPrompt = [
    "You are summarizing today's follow-up workload for a lending operations owner.",
    "Output plain text only.",
    "Give 4 to 6 concise lines.",
    `Language: ${language}`,
  ].join("\n");

  const prompt = [
    "Summarize the follow-up queues with emphasis on bottlenecks and who needs attention first.",
    "Mediator queue:",
    JSON.stringify(mediatorQueue, null, 2),
    "Client queue:",
    JSON.stringify(clientQueue.map(formatLeadContext), null, 2),
  ].join("\n");

  return callOpenclawChat({ prompt, systemPrompt, maxTokens: 220 });
}
