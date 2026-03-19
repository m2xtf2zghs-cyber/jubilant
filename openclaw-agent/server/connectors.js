import nodemailer from "nodemailer";

const jsonHeaders = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

const ensureOk = async (response) => {
  if (response.ok) return response;
  const text = await response.text();
  throw new Error(text || `HTTP ${response.status}`);
};

export function createConnectorRegistry(config) {
  const statuses = () => ({
    whatsapp: {
      enabled: Boolean(config.whatsapp.accessToken && config.whatsapp.phoneNumberId),
      provider: "WhatsApp Cloud API",
    },
    telegram: {
      enabled: Boolean(config.telegram.botToken),
      provider: "Telegram Bot API",
    },
    sms: {
      enabled: Boolean(config.twilio.accountSid && config.twilio.authToken && config.twilio.fromNumber),
      provider: "Twilio SMS",
    },
    email: {
      enabled: Boolean(config.smtp.host && config.smtp.user && config.smtp.pass && config.smtp.from),
      provider: "SMTP",
    },
  });

  return {
    getStatuses: statuses,
    async sendWhatsappText({ to, text }) {
      if (!statuses().whatsapp.enabled) throw new Error("WhatsApp connector is not configured.");
      const response = await fetch(
        `https://graph.facebook.com/${config.whatsapp.apiVersion}/${config.whatsapp.phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            ...jsonHeaders,
            Authorization: `Bearer ${config.whatsapp.accessToken}`,
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to,
            type: "text",
            text: {
              preview_url: false,
              body: text,
            },
          }),
        }
      );
      await ensureOk(response);
      return response.json();
    },
    async sendTelegramText({ chatId, text }) {
      if (!statuses().telegram.enabled) throw new Error("Telegram connector is not configured.");
      const response = await fetch(`https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          chat_id: chatId,
          text,
        }),
      });
      await ensureOk(response);
      return response.json();
    },
    async sendSms({ to, text }) {
      if (!statuses().sms.enabled) throw new Error("SMS connector is not configured.");
      const auth = Buffer.from(`${config.twilio.accountSid}:${config.twilio.authToken}`).toString("base64");
      const body = new URLSearchParams({
        To: to,
        From: config.twilio.fromNumber,
        Body: text,
      });
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.twilio.accountSid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });
      await ensureOk(response);
      return response.json();
    },
    async sendEmail({ to, subject, text, html = "" }) {
      if (!statuses().email.enabled) throw new Error("SMTP connector is not configured.");
      const transport = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        auth: {
          user: config.smtp.user,
          pass: config.smtp.pass,
        },
      });
      return transport.sendMail({
        from: config.smtp.from,
        to,
        subject,
        text,
        html: html || `<pre>${text}</pre>`,
      });
    },
  };
}
