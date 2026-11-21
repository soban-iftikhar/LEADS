import "server-only";
import { Resend } from "resend";
import { env } from "@/server/env";

let client: Resend | undefined;

// Created on first send, so importing this module needs no API key (build, tests).
function resend(): Resend {
  const { RESEND_API_KEY } = env();
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set: cannot send email");
  client ??= new Resend(RESEND_API_KEY);
  return client;
}

function fromAddress(): string {
  const { EMAIL_FROM_NAME, EMAIL_FROM } = env();
  return `${EMAIL_FROM_NAME || "LEADS"} <${EMAIL_FROM || "onboarding@resend.dev"}>`;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

// Email clients ignore CSS variables, so the brand colours are written out here.
const INK = "#17150F";
const MUTED = "#625F55";
const YELLOW = "#F2C230";
const BG = "#F4F4F1";

function layout(title: string, body: string): string {
  return `<!doctype html><html><body style="margin:0;background:${BG};font-family:Arial,Helvetica,sans-serif;color:${INK}">
<div style="max-width:480px;margin:0 auto;padding:28px 16px">
  <div style="font-weight:800;font-size:22px;letter-spacing:-.04em;margin-bottom:18px"><span style="display:inline-block;width:26px;height:26px;background:${YELLOW};border-radius:4px;vertical-align:-6px;margin-right:8px"></span>leads</div>
  <div style="background:#ffffff;border:1px solid #DEDED7;border-radius:6px;padding:28px">
    <h1 style="margin:0 0 10px;font-size:22px;letter-spacing:-.02em">${title}</h1>
    ${body}
  </div>
  <p style="color:${MUTED};font-size:12px;margin:16px 4px 0">LEADS · Islamabad, Pakistan. You get this email because someone used this address on LEADS.</p>
</div></body></html>`;
}

const p = (t: string) => `<p style="margin:0 0 14px;color:${MUTED};font-size:15px;line-height:1.5">${t}</p>`;

async function send(to: string, subject: string, html: string, text: string): Promise<void> {
  const { error, data } = await resend().emails.send({ from: fromAddress(), to, subject, html, text });
  if (error) throw new Error(`Resend: ${error.name}: ${error.message}`);
  if (!data?.id) throw new Error("Resend returned no message id");
}

export async function sendEmailCode(to: string, name: string, code: string, minutes: number) {
  const html = layout(
    "Your code",
    `${p(`Hi ${esc(name)}, enter this code on LEADS to confirm your email.`)}
     <div style="font:700 34px/1 'Courier New',monospace;letter-spacing:10px;background:${BG};border-radius:4px;padding:18px 0;text-align:center;margin:0 0 14px">${code}</div>
     ${p(`It works for ${minutes} minutes. If you didn't ask for it, ignore this email.`)}`,
  );
  await send(to, `${code} is your LEADS code`, html, `Your LEADS code is ${code}. It works for ${minutes} minutes.`);
}

export async function sendPasswordResetEmail(to: string, name: string, url: string, minutes: number) {
  const html = layout(
    "Set a new password",
    `${p(`Hi ${esc(name)}, use the button below to set a new password.`)}
     <p style="margin:0 0 16px"><a href="${esc(url)}" style="display:inline-block;background:${YELLOW};color:${INK};padding:13px 22px;border-radius:4px;text-decoration:none;font-weight:700">Set a new password</a></p>
     ${p(`The link works once, for ${minutes} minutes. If you didn't ask for it, ignore this email; your password stays the same.`)}`,
  );
  await send(to, "Set a new LEADS password", html, `Set a new LEADS password: ${url} (works once, for ${minutes} minutes).`);
}

export async function sendPasswordChangedEmail(to: string, name: string) {
  const html = layout("Your password was changed", `${p(`Hi ${esc(name)}, your LEADS password was just changed and other devices were logged out.`)}${p("If this wasn't you, use “Forgot password?” on the login page right away.")}`);
  await send(to, "Your LEADS password was changed", html, "Your LEADS password was just changed. If this wasn't you, reset it from the login page.");
}

export async function sendAccountLockedEmail(to: string, name: string, until: string) {
  const html = layout("Too many login tries", `${p(`Hi ${esc(name)}, someone typed the wrong password for your account too many times. Logging in is paused until ${esc(until)}.`)}${p("If this wasn't you, consider changing your password.")}`);
  await send(to, "LEADS login paused", html, `Too many wrong passwords. Logging in is paused until ${until}.`);
}
