import { EVENT } from "./event";

export type RegistrationInput = {
  participantType: string;
  name: string;
  mobile: string;
  email: string;
  firm: string;
  persons: number;
  interestedIn: string[];
  landLocation: string[];
  landSize: string;
  consent: boolean;
};

export type FieldErrors = Partial<Record<keyof RegistrationInput, string>>;

/** Strip spaces, dashes, +91 / 91 / 0 prefixes → 10 digits */
export function normalizeMobile(raw: unknown): string {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const clip = (v: unknown, max: number) =>
  String(v ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const pick = (v: unknown, allowed: readonly string[]) =>
  Array.isArray(v) ? Array.from(new Set(v.map(String).filter((x) => allowed.includes(x)))) : [];

/** Shared by the browser (inline errors) and the server (trust boundary). */
export function validateRegistration(raw: Record<string, unknown>): {
  data: RegistrationInput;
  errors: FieldErrors;
} {
  const persons = Math.round(Number(raw.persons));
  const data: RegistrationInput = {
    participantType: clip(raw.participantType, 40),
    name: clip(raw.name, 80),
    mobile: normalizeMobile(raw.mobile),
    email: clip(raw.email, 120).toLowerCase(),
    firm: clip(raw.firm, 100),
    persons: Number.isFinite(persons) ? persons : 0,
    interestedIn: pick(raw.interestedIn, EVENT.interestOptions),
    landLocation: pick(raw.landLocation, EVENT.locationOptions),
    landSize: clip(raw.landSize, 60),
    consent: raw.consent === true,
  };

  const errors: FieldErrors = {};
  if (!(EVENT.participantTypes as readonly string[]).includes(data.participantType))
    errors.participantType = "Please choose who you are.";
  if (data.name.length < 2) errors.name = "Please enter your full name.";
  if (!/^[6-9]\d{9}$/.test(data.mobile)) errors.mobile = "Please enter a valid 10-digit mobile number.";
  if (!EMAIL_RE.test(data.email)) errors.email = "Please enter a valid email ID.";
  if (data.persons < 1 || data.persons > EVENT.maxPersons)
    errors.persons = `Choose between 1 and ${EVENT.maxPersons} persons.`;
  if (!data.consent) errors.consent = "Please tick this box to continue.";

  return { data, errors };
}
