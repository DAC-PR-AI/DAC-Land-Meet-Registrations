import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/Footer";
import PassView from "@/components/PassView";
import { callScript, ScriptError } from "@/lib/appsScript";
import { EVENT } from "@/lib/event";
import type { Pass } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Your Entry Pass – DAC Developers",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ passId: string }>; searchParams: Promise<{ k?: string }> };

export default async function PassPage({ params, searchParams }: Props) {
  const { passId } = await params;
  const { k = "" } = await searchParams;

  let pass: Pass | null = null;
  let failed = false;
  try {
    const r = await callScript<{ ok: boolean; pass: Pass }>("getPass", { passId: decodeURIComponent(passId), key: k });
    pass = r.pass;
  } catch (e) {
    if ((e as ScriptError).code !== "NOT_FOUND") failed = true;
  }

  return (
    <>
      <main className="mx-auto max-w-md px-4 pb-6 pt-6">
        {pass ? (
          <PassView pass={pass} />
        ) : (
          <div className="glass fade-up mt-10 p-8 text-center">
            <h1 className="font-serif text-2xl font-bold text-navy">{failed ? "We couldn't load your pass" : "Pass not found"}</h1>
            <p className="mt-3 text-slate-600">
              {failed
                ? "Please check your internet connection and try again."
                : "Please open the link from your confirmation email or WhatsApp message."}
            </p>
            <p className="mt-3 text-slate-600">
              Need help? Call <a className="font-semibold text-royal" href={`tel:${EVENT.phoneTel}`}>{EVENT.phoneShort}</a>
            </p>
            <div className="mt-6 flex flex-col gap-3">
              {failed && <a href="" className="btn-primary">Try again</a>}
              <Link href="/" className="btn-outline">Go to registration</Link>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
