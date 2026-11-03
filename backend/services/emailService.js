const fetch = require("node-fetch");

// Sends mail through Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email).
// Set RESEND_API_KEY and EMAIL_FROM (an address on a domain verified in Resend,
// e.g. "Krisgen <no-reply@yourdomain.com>"). Nothing else is needed.
function isConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

async function sendEmail({ to, subject, text, html }) {
  if (!isConfigured()) {
    const error = new Error("Email is not configured (set RESEND_API_KEY and EMAIL_FROM)");
    error.code = "EMAIL_NOT_CONFIGURED";
    throw error;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    timeout: 15000,
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text, html }),
  });
  if (!response.ok) {
    const error = new Error(`Email provider rejected the message (HTTP ${response.status})`);
    error.code = "EMAIL_SEND_FAILED";
    throw error;
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function passwordResetMessage({ name, link }) {
  const text = [
    `Hello ${name},`,
    "",
    "We received a request to reset your Krisgen Communications password.",
    `Open this link within 1 hour to choose a new one:\n${link}`,
    "",
    "If you did not ask for this, ignore this email — your password stays the same.",
  ].join("\n");
  const html = `<p>Hello ${escapeHtml(name)},</p>
<p>We received a request to reset your Krisgen Communications password.</p>
<p><a href="${escapeHtml(link)}">Choose a new password</a> (the link works for 1 hour).</p>
<p>If you did not ask for this, ignore this email — your password stays the same.</p>`;
  return { subject: "Reset your Krisgen password", text, html };
}

module.exports = { sendEmail, isConfigured, passwordResetMessage };
