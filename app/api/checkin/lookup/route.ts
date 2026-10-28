import { callScript, errorJson, requirePin } from "@/lib/appsScript";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const denied = requirePin(req);
  if (denied) return denied;
  let query = "";
  try {
    query = String((await req.json())?.query ?? "").trim().slice(0, 40);
  } catch {}
  if (!query) return Response.json({ ok: false, error: "Enter a mobile number or Pass ID." }, { status: 400 });
  try {
    const r = await callScript<{ ok: boolean; found: boolean; pass?: unknown }>("lookup", { query });
    return Response.json({ ok: true, found: r.found, pass: r.pass ?? null });
  } catch (e) {
    return errorJson(e);
  }
}
