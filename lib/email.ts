import "server-only";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === "true",
  requireTLS: process.env.SMTP_SECURE !== "true", // STARTTLS on 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendLoginEmail(opts: {
  to: string;
  name: string;
  token: string;
  code: string;
}) {
  const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
  const link = `${baseUrl}/login/verify?token=${opts.token}`;

  const text = [
    `Hi ${opts.name},`,
    ``,
    `Use this code to log in to Wardly: ${opts.code}`,
    ``,
    `Or click this link to log in directly:`,
    link,
    ``,
    `The code and link expire in 5 minutes.`,
    ``,
    `If you didn't request this, you can ignore this email.`,
  ].join("\n");

  const html = `<!doctype html><html><body style="font-family:sans-serif;line-height:1.5">
    <p>Hi ${opts.name},</p>
    <p>Use this code to log in to Wardly:</p>
    <p style="font-size:24px;letter-spacing:4px;font-weight:bold">${opts.code}</p>
    <p>Or click this link to log in directly:<br><a href="${link}">${link}</a></p>
    <p style="color:#666">The code and link expire in 5 minutes.</p>
    <p style="color:#666">If you didn't request this, you can ignore this email.</p>
  </body></html>`;

  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? '"Wardly" <wardly@benritec.com>',
    to: opts.to,
    subject: "Your Wardly login code",
    text,
    html,
  });
}
