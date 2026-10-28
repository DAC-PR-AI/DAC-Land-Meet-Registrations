import { EVENT } from "@/lib/event";
import Logo from "./Logo";
import { IconCalendar, IconClock, IconPin } from "./Icons";

export default function Hero() {
  return (
    <header className="px-5 pb-6 pt-8 text-center sm:pt-12">
      <div className="fade-up flex flex-col items-center">
        <Logo className="h-14 sm:h-16" />
      </div>

      <p className="fade-up delay-1 mt-7 text-xs font-semibold uppercase tracking-[0.25em] text-accent">You are invited</p>
      <h1 className="fade-up delay-1 mx-auto mt-2 max-w-2xl font-serif text-[28px] font-bold leading-tight text-navy sm:text-4xl">
        {EVENT.title}
      </h1>
      <p className="fade-up delay-2 mx-auto mt-3 max-w-xl text-[17px] text-royal">{EVENT.subtitle}</p>

      <ul className="fade-up delay-2 mx-auto mt-6 flex max-w-2xl flex-wrap justify-center gap-2 text-[14px]">
        <li className="inline-flex items-center gap-2 rounded-full border border-gold/60 bg-white/80 px-4 py-2">
          <IconCalendar className="h-4 w-4 text-accent" /> {EVENT.dateLabel}
        </li>
        <li className="inline-flex items-center gap-2 rounded-full border border-gold/60 bg-white/80 px-4 py-2">
          <IconClock className="h-4 w-4 text-accent" /> {EVENT.timeLabel}
        </li>
        <li>
          <a href={EVENT.mapsUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-gold/60 bg-white/80 px-4 py-2 hover:border-royal">
            <IconPin className="h-4 w-4 text-accent" /> {EVENT.venueShort}
          </a>
        </li>
      </ul>

      <p className="fade-up delay-3 mt-6 font-serif text-xl italic text-accent">&ldquo;{EVENT.tagline}&rdquo;</p>

      <div className="fade-up delay-3 mx-auto mt-6 grid max-w-2xl grid-cols-3 gap-2 sm:gap-3">
        {EVENT.dealTypes.map((d) => (
          <div key={d.name} className="rounded-2xl border border-gold/50 bg-white/85 px-2 py-4 shadow-sm">
            <p className="font-serif text-[15px] font-bold leading-tight text-navy sm:text-lg">{d.name}</p>
            <div className="mx-auto my-2 h-px w-8 bg-gold" />
            <p className="text-[11px] leading-snug text-slate-600 sm:text-xs">{d.line.split(" | ").join(" · ")}</p>
          </div>
        ))}
      </div>
    </header>
  );
}
