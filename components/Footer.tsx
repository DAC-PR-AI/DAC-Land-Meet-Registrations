import { EVENT } from "@/lib/event";

export default function Footer({ stickyPad = false }: { stickyPad?: boolean }) {
  return (
    <footer className={`mt-6 bg-navy px-5 pt-8 text-center text-sm text-white/80 pb-10 ${stickyPad ? "pb-28" : "pb-10"}`}>
      <p className="font-serif text-lg text-white">{EVENT.organiserShort}</p>
      <p className="mt-1 text-[11px] tracking-[0.3em] text-gold">{EVENT.orgTagline}</p>
      <div className="mx-auto my-4 h-px w-24 bg-gold/50" />
      <p>
        Call:{" "}
        <a href={`tel:${EVENT.phoneTel}`} className="font-semibold text-white underline-offset-4 hover:underline">
          {EVENT.phoneDisplay}
        </a>
      </p>
      <p className="mt-1">
        Email:{" "}
        <a href={`mailto:${EVENT.email}`} className="font-semibold text-white underline-offset-4 hover:underline">
          {EVENT.email}
        </a>
      </p>
      <p className="mt-4 text-xs text-white/50">© {new Date().getFullYear()} DAC Developers. All rights reserved.</p>
    </footer>
  );
}
