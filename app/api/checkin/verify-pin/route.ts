import { pinMatches } from "@/lib/appsScript";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let pin = "";
  try {
    pin = String((await req.json())?.pin ?? "");
  } catch {}
  if (pinMatches(pin)) return Response.json({ ok: true });
  await new Promise((r) => setTimeout(r, 800)); // slow down guessing
  return Response.json({ ok: false, error: "Incorrect PIN" }, { status: 401 });
}
