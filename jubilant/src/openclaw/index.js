/**
 * OpenClaw integration for LIRAS — barrel export.
 *
 * Usage:
 *   import { isOpenclawConfigured, callOpenclawChat, sendWhatsappMessage } from "./openclaw";
 */

export { OPENCLAW_GATEWAY_URL, OPENCLAW_GATEWAY_TOKEN, isOpenclawConfigured, OPENCLAW_DEFAULT_AGENT } from "./openclawConfig.js";
export { gatewayFetch, pingGateway, invokeTool } from "./openclawGatewayClient.js";
export {
  callOpenclawChat,
  openclawLeadSummary,
  openclawWhatsappDraft,
  openclawRejectionDraft,
  openclawTranslate,
} from "./openclawChatClient.js";
export {
  openclawMediatorFollowupDraft,
  openclawClientFollowupDraft,
  openclawFollowupSummary,
} from "./openclawFollowupClient.js";
export { buildOpenclawFollowupQueues, isOpenclawClosedLead } from "./followupQueue.js";
export { sendWhatsappMessage, sendTelegramMessage, sendChannelMessage } from "./openclawMessageClient.js";
