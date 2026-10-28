import { EVENT } from "./event";

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");
}

/** Pass page URL. `k` is a private key so passes can't be guessed by ID. */
export function passPath(passId: string, key: string): string {
  return `/pass/${encodeURIComponent(passId)}?k=${encodeURIComponent(key)}`;
}

export function passMessage(p: { name: string; passId: string; persons: number }, passUrl: string): string {
  return [
    `Hello ${p.name},`,
    ``,
    `Your Entry Pass for the *${EVENT.shortName}* is confirmed.`,
    ``,
    `*Pass ID:* ${p.passId}`,
    `*Admit:* ${p.persons}`,
    `*Date:* ${EVENT.dateLabel}, ${EVENT.timeLabel}`,
    `*Venue:* ${EVENT.venueName}, ${EVENT.venueAddress}`,
    `*Directions:* ${EVENT.mapsUrl}`,
    ``,
    `*View your pass:* ${passUrl}`,
    ``,
    `Please show this pass at the entry.`,
    `– ${EVENT.organiserShort} | ${EVENT.phoneDisplay}`,
  ].join("\n");
}

export const waToNumber = (mobile10: string, text: string) =>
  `https://wa.me/91${mobile10}?text=${encodeURIComponent(text)}`;

export const waShare = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;

export function gcalUrl(passUrl?: string): string {
  const details = `${EVENT.subtitle}\n\nPlease carry your Entry Pass.${passUrl ? `\nYour pass: ${passUrl}` : ""}\n\nContact: ${EVENT.phoneDisplay} | ${EVENT.email}`;
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: `${EVENT.shortName} – ${EVENT.organiserShort}`,
    dates: EVENT.gcalDates,
    ctz: "Asia/Kolkata",
    location: `${EVENT.venueName}, ${EVENT.venueAddress}`,
    details,
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}
