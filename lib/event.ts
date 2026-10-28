// =====================================================================
//  SINGLE SOURCE OF TRUTH for all event details.
//  Edit here only — every page, button and message reads from this file.
//  (The Apps Script email has its own copy at the top of Code.gs.)
// =====================================================================

export const EVENT = {
  organiser: "DAC Developers Pvt Ltd",
  organiserShort: "DAC Developers",
  orgTagline: "DREAM · ASCEND · CONQUER",

  title: "An Exclusive Invitation for Landowners, Mediators & Property Consultants",
  subtitle: "Land Acquisition Opportunities with DAC Developers",
  shortName: "DAC Land Acquisition Meet",
  tagline: "Land In Your Hand! Let's Make it Grand!",

  dateLabel: "Thursday, 29 October 2026",
  dateShort: "29 Oct 2026",
  timeLabel: "6:00 PM onwards",
  startISO: "2026-10-29T18:00:00+05:30",
  endISO: "2026-10-29T21:00:00+05:30",
  // Google Calendar needs UTC: 18:00–21:00 IST = 12:30–15:30 UTC
  gcalDates: "20261029T123000Z/20261029T153000Z",

  registrationClosesISO: "2026-10-29T17:00:00+05:30",

  venueName: "Ramada Plaza by Wyndham",
  venueAddress: "36, Sardar Patel Rd, Little Mount, Guindy, Chennai – 600015",
  venueShort: "Ramada Plaza, Guindy, Chennai",
  mapsUrl: "https://maps.google.com/?q=Ramada+Plaza+by+Wyndham+Guindy+Chennai",

  phoneDisplay: "+91 89259 24488",
  phoneShort: "89259 24488",
  phoneTel: "+918925924488",
  email: "land@dacdevelopers.com",

  dealTypes: [
    { name: "Outright", line: "Better Value | Greater Returns" },
    { name: "Joint Venture", line: "Together | Stronger | Bigger" },
    { name: "Redevelopment Projects", line: "Reimagine | Rebuild | Create Value" },
  ],

  participantTypes: ["Landowner (Vendor)", "Mediator", "Property Consultant"],
  interestOptions: ["Outright", "Joint Venture", "Redevelopment"],
  locationOptions: ["OMR", "GST", "Avadi", "Redhill", "Poonamallee", "Porur", "Sunguvarchatram", "Other"],
  maxPersons: 3,
} as const;

export function isRegistrationClosed(now: number = Date.now()): boolean {
  return now >= new Date(EVENT.registrationClosesISO).getTime();
}

export const FRIENDLY_ERROR = `Something went wrong. Please try again, or call ${EVENT.phoneShort} for help.`;
