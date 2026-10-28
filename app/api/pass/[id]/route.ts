import { callScript, errorJson, ScriptError } from "@/lib/appsScript";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const key = new URL(req.url).searchParams.get("k") || "";
  try {
    const r = await callScript<{ ok: boolean; pass: unknown }>("getPass", { passId: decodeURIComponent(id), key });
    return Response.json({ ok: true, pass: r.pass }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if ((e as ScriptError).code === "NOT_FOUND") {
      return Response.json({ ok: false, error: "Pass not found." }, { status: 404 });
    }
    return errorJson(e);
  }
}
