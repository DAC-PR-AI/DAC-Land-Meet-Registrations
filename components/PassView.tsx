"use client";

import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { EVENT } from "@/lib/event";
import { gcalUrl, passMessage, passPath, waShare, waToNumber } from "@/lib/links";
import type { Pass } from "@/lib/types";
import { IconCalendar, IconClock, IconDirections, IconDownload, IconPin, IconShare, IconWhatsApp } from "./Icons";
import Logo from "./Logo";

export default function PassView({ pass }: { pass: Pass }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [qr, setQr] = useState("");
  const [passUrl, setPassUrl] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [dlError, setDlError] = useState("");

  useEffect(() => {
    const origin = (process.env.NEXT_PUBLIC_SITE_URL || window.location.origin).replace(/\/+$/, "");
    setPassUrl(origin + passPath(pass.passId, pass.key));
    QRCode.toDataURL(pass.passId, { width: 520, margin: 1, errorCorrectionLevel: "M", color: { dark: "#0E1B3D", light: "#FFFFFF" } })
      .then(setQr)
      .catch(() => setQr(""));
  }, [pass.passId, pass.key]);

  const msg = passMessage(pass, passUrl);

  async function download() {
    if (!cardRef.current || downloading) return;
    setDownloading(true);
    setDlError("");
    try {
      const { toPng } = await import("html-to-image");
      const opts = { pixelRatio: 3, cacheBust: true, backgroundColor: "#FAF8F5" };
      await toPng(cardRef.current, opts); // warm-up (fixes blank images on iOS Safari)
      const dataUrl = await toPng(cardRef.current, opts);
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${pass.passId}-DAC-Entry-Pass.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      setDlError("Couldn't download. Please take a screenshot of this pass instead.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="fade-up">
      {/* ===== Ticket (this block is what gets downloaded) ===== */}
      <div ref={cardRef} className="bg-cream p-2">
        <article className="overflow-hidden rounded-3xl border border-gold/70 bg-white shadow-ticket">
          <header className="relative bg-navy px-6 pb-6 pt-6 text-center text-white">
            <div className="flex justify-center">
              <div className="rounded-xl bg-white px-3 py-2"><Logo /></div>
            </div>
            <p className="mt-2 text-[10px] tracking-[0.35em] text-gold">{EVENT.orgTagline}</p>
            <div className="mx-auto my-4 h-px w-2/3 bg-gold/50" />
            <p className="text-[13px] font-bold tracking-[0.4em] text-accent">ENTRY PASS</p>
            <p className="mt-2 font-serif text-lg leading-snug">{EVENT.subtitle}</p>
          </header>
          <div className="h-1.5 bg-accent" />

          <div className="px-6 pb-2 pt-5 text-center">
            <p className="text-xs uppercase tracking-widest text-slate-500">Guest</p>
            <h1 className="mt-1 font-serif text-[26px] font-bold leading-tight text-navy break-words">{pass.name}</h1>
            <p className="mt-1 text-[15px] font-medium text-royal">{pass.participantType}</p>
            {pass.firm && <p className="text-sm text-slate-600 break-words">{pass.firm}</p>}
            <span className="mt-3 inline-block rounded-full bg-accent/10 px-4 py-1.5 text-[15px] font-bold text-accent">
              Admit {pass.persons}
            </span>
          </div>

          {/* Perforation */}
          <div className="relative my-3 flex items-center">
            <span className="absolute -left-3 h-6 w-6 rounded-full border border-gold/70 bg-cream" />
            <span className="mx-5 w-full border-t-2 border-dashed border-gold/60" />
            <span className="absolute -right-3 h-6 w-6 rounded-full border border-gold/70 bg-cream" />
          </div>

          <div className="flex flex-col items-center px-6">
            <div className="rounded-2xl border-2 border-gold/60 bg-white p-3">
              {qr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt={`QR code for ${pass.passId}`} width={190} height={190} className="h-[190px] w-[190px]" />
              ) : (
                <div className="skeleton h-[190px] w-[190px] rounded-lg" />
              )}
            </div>
            <p className="mt-3 font-mono text-xl font-bold tracking-[0.15em] text-navy">{pass.passId}</p>
          </div>

          <ul className="mx-6 mt-5 space-y-3 rounded-2xl bg-cream p-4 text-[15px] text-navy">
            <li className="flex items-start gap-3"><IconCalendar className="mt-0.5 h-5 w-5 text-accent" />{EVENT.dateLabel}</li>
            <li className="flex items-start gap-3"><IconClock className="mt-0.5 h-5 w-5 text-accent" />{EVENT.timeLabel}</li>
            <li className="flex items-start gap-3">
              <IconPin className="mt-0.5 h-5 w-5 text-accent" />
              <span><span className="font-semibold">{EVENT.venueName}</span><br /><span className="text-sm text-slate-600">{EVENT.venueAddress}</span></span>
            </li>
          </ul>

          <p className="px-6 pb-6 pt-4 text-center text-[13px] leading-relaxed text-slate-500">
            Valid only for registered guests. Please show this pass at the entry.
          </p>
        </article>
      </div>

      {/* ===== Actions ===== */}
      <div className="mt-5 grid gap-3">
        <button onClick={download} disabled={downloading || !qr} className="btn-navy w-full">
          {downloading ? <span className="spinner" aria-hidden="true" /> : <IconDownload />}
          {downloading ? "Preparing…" : "Download Pass"}
        </button>
        {dlError && <p className="text-center text-sm text-red-600">{dlError}</p>}

        <a href={passUrl ? waToNumber(pass.mobile, msg) : undefined} target="_blank" rel="noopener noreferrer" className="btn-wa w-full">
          <IconWhatsApp /> Save to my WhatsApp
        </a>
        <a href={passUrl ? waShare(msg) : undefined} target="_blank" rel="noopener noreferrer" className="btn-outline w-full">
          <IconShare /> Share on WhatsApp
        </a>
        <a href={gcalUrl(passUrl)} target="_blank" rel="noopener noreferrer" className="btn-outline w-full">
          <IconCalendar /> Add to Google Calendar
        </a>
        <a href={EVENT.mapsUrl} target="_blank" rel="noopener noreferrer" className="btn-outline w-full">
          <IconDirections /> Get Directions
        </a>
      </div>

      <p className="mt-5 text-center text-sm text-slate-500">
        A confirmation has also been sent to your email{pass.email ? <> (<span className="font-medium text-slate-700">{maskEmail(pass.email)}</span>)</> : null}.
      </p>
    </div>
  );
}

function maskEmail(e: string) {
  const [u, d] = e.split("@");
  if (!d) return e;
  return `${u.slice(0, 2)}${"•".repeat(Math.max(1, Math.min(6, u.length - 2)))}@${d}`;
}
