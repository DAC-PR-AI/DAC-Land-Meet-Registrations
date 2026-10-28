import { callScript, errorJson, requirePin } from "@/lib/appsScript";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const denied = requirePin(req);
  if (denied) return denied;
  let passId = "";
  try {
    passId = String((await req.json())?.passId ?? "").trim().slice(0, 30);
  } catch {}
  if (!passId) return Response.json({ ok: false, error: "Missing Pass ID." }, { status: 400 });
  try {
    const r = await callScript<{ ok: boolean; found: boolean; alreadyCheckedIn?: boolean; checkinTime?: string; pass?: unknown }>(
      "checkin",
      { passId }
    );
    return Response.json({ ok: true, found: r.found, alreadyCheckedIn: !!r.alreadyCheckedIn, checkinTime: r.checkinTime ?? "", pass: r.pass ?? null });
  } catch (e) {
    return errorJson(e);
  }
}
