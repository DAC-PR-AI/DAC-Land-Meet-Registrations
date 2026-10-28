import { callScript, errorJson } from "@/lib/appsScript";
import { EVENT, isRegistrationClosed } from "@/lib/event";
import { validateRegistration } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  if (isRegistrationClosed()) {
    return Response.json(
      { ok: false, closed: true, error: `Registrations are closed. For assistance, call ${EVENT.phoneShort}.` },
      { status: 403 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  // Honeypot: real people never fill this hidden field.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return Response.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const { data, errors } = validateRegistration(body);
  if (Object.keys(errors).length) {
    return Response.json({ ok: false, error: "Please correct the highlighted fields.", errors }, { status: 400 });
  }

  try {
    const r = await callScript<{ ok: boolean; passId: string; key: string; duplicate: boolean }>("register", data);
    return Response.json({ ok: true, passId: r.passId, key: r.key, duplicate: !!r.duplicate });
  } catch (e) {
    return errorJson(e);
  }
}
