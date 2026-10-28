// SERVER-ONLY helper. Never import this from a "use client" file.
import { EVENT } from "./event";

export class ScriptError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

type ScriptResponse = { ok: boolean; error?: string; code?: string; [k: string]: unknown };

/**
 * Calls the Google Apps Script Web App.
 * text/plain avoids a CORS preflight; redirect "follow" is required because
 * Apps Script answers with a 302 to googleusercontent.com.
 */
export async function callScript<T extends ScriptResponse = ScriptResponse>(
  action: string,
  payload: Record<string, unknown> = {},
  timeoutMs = 25000
): Promise<T> {
  const url = process.env.APPS_SCRIPT_URL;
  const secret = process.env.APPS_SCRIPT_SECRET;
  if (!url || !secret) throw new ScriptError("Server is not configured (APPS_SCRIPT_URL / APPS_SCRIPT_SECRET).", "CONFIG");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, secret, ...payload }),
      redirect: "follow",
      cache: "no-store",
      signal: ctrl.signal,
    });
  } catch (e) {
    throw new ScriptError(ctrl.signal.aborted ? "Request timed out" : `Network error: ${(e as Error).message}`, "NETWORK");
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    // Usually means the Web App isn't deployed for "Anyone", or the URL is wrong.
    console.error("[appsScript] Non-JSON response", res.status, text.slice(0, 300));
    throw new ScriptError("Unexpected response from backend", "BAD_RESPONSE");
  }
  if (!data.ok) throw new ScriptError(data.error || "Backend error", data.code);
  return data;
}

export function errorJson(e: unknown, status = 502) {
  const err = e as ScriptError;
  console.error("[api]", err?.code, err?.message);

  let userMessage = `Something went wrong. Please try again, or call ${EVENT.phoneShort} for help.`;
  if (err?.code === "CONFIG") {
    userMessage = `Configuration Error: ${err.message} Please add them in Vercel Settings > Environment Variables and redeploy.`;
  } else if (err?.code === "AUTH" || err?.message === "Unauthorized") {
    userMessage = `Authentication Error: APPS_SCRIPT_SECRET in Vercel does not match the Script Property APPS_SCRIPT_SECRET in Google Apps Script.`;
  } else if (err?.code === "BAD_RESPONSE") {
    userMessage = `Deployment Error: Invalid response from Google Apps Script. Ensure Web App access is set to "Anyone" (not "Only myself") and the URL ends with /exec.`;
  } else if (err?.code === "NETWORK") {
    userMessage = `Network Error: Could not connect to Google Apps Script (${err.message}).`;
  } else if (err?.message && err.message !== "Backend error") {
    userMessage = `Backend Error: ${err.message}`;
  }

  return Response.json(
    { ok: false, error: userMessage, code: err?.code },
    { status }
  );
}

/** Constant-time-ish string comparison for the staff PIN. */
export function pinMatches(given: unknown): boolean {
  const expected = process.env.CHECKIN_PIN || "";
  const g = String(given ?? "");
  if (!expected || g.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < g.length; i++) diff |= g.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export function requirePin(req: Request): Response | null {
  if (pinMatches(req.headers.get("x-checkin-pin"))) return null;
  return Response.json({ ok: false, error: "Invalid PIN" }, { status: 401 });
}
