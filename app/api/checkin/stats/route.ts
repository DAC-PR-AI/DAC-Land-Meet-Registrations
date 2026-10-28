import { callScript, errorJson, requirePin } from "@/lib/appsScript";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = requirePin(req);
  if (denied) return denied;
  try {
    const r = await callScript<{ ok: boolean; stats: unknown }>("stats");
    return Response.json({ ok: true, stats: r.stats }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return errorJson(e);
  }
}
