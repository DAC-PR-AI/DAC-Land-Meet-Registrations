"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState } from "react";
import { EVENT, FRIENDLY_ERROR, isRegistrationClosed } from "@/lib/event";
import { passPath } from "@/lib/links";
import { FieldErrors, RegistrationInput, validateRegistration } from "@/lib/validate";
import ClosedScreen from "./ClosedScreen";
import SuccessCheck from "./SuccessCheck";

type FormState = Omit<RegistrationInput, "persons"> & { persons: number };

const INITIAL: FormState = {
  participantType: "",
  name: "",
  mobile: "",
  email: "",
  firm: "",
  persons: 1,
  interestedIn: [],
  landLocation: [],
  landSize: "",
  consent: false,
};

const ORDER: (keyof FormState)[] = ["participantType", "name", "mobile", "persons", "consent"];

export default function RsvpForm() {
  const router = useRouter();
  const [f, setF] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof FormState, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<null | "new" | "duplicate">(null);
  const [serverError, setServerError] = useState("");
  const [closed, setClosed] = useState(false);
  const inFlight = useRef(false);
  const honeypot = useRef<HTMLInputElement>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    const next = { ...f, [k]: v };
    setF(next);
    if (touched[k] || errors[k]) setErrors(validateRegistration(next).errors);
  };
  const blur = (k: keyof FormState) => {
    setTouched((t) => ({ ...t, [k]: true }));
    setErrors(validateRegistration(f).errors);
  };

  const err = (k: keyof FormState) => (touched[k] ? errors[k] : undefined);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (inFlight.current) return; // prevent double submit
    setServerError("");

    if (isRegistrationClosed()) return setClosed(true);

    const { errors: errs } = validateRegistration(f);
    setErrors(errs);
    setTouched(Object.fromEntries(ORDER.map((k) => [k, true])));
    const first = ORDER.find((k) => errs[k]);
    if (first) {
      const el = document.getElementById(`f-${first}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      (el as HTMLElement | null)?.focus?.({ preventScroll: true });
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, website: honeypot.current?.value || "" }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.closed) return setClosed(true);
      if (!res.ok || !data?.ok) {
        if (data?.errors) setErrors(data.errors);
        throw new Error(data?.error || FRIENDLY_ERROR);
      }
      const dest = passPath(data.passId, data.key);
      router.prefetch(dest);
      setDone(data.duplicate ? "duplicate" : "new");
      window.scrollTo({ top: 0, behavior: "smooth" });
      setTimeout(() => router.push(dest), data.duplicate ? 2200 : 1500);
    } catch (e) {
      setServerError((e as Error).message || FRIENDLY_ERROR);
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  if (closed) return <ClosedScreen />;

  if (done) {
    return (
      <div className="glass fade-up mx-auto max-w-md p-8 text-center" role="status" aria-live="polite">
        <SuccessCheck />
        <h2 className="mt-5 font-serif text-2xl font-bold text-navy">
          {done === "duplicate" ? "You're already registered!" : "You're registered!"}
        </h2>
        <p className="mt-2 text-slate-600">
          {done === "duplicate" ? "Taking you to your existing Entry Pass…" : "Preparing your Entry Pass…"}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="glass fade-up mx-auto max-w-xl p-5 sm:p-8">
      <h2 className="text-center font-serif text-2xl font-bold text-navy">Register for your Entry Pass</h2>
      <p className="mx-auto mt-2 max-w-md text-center text-[15px] leading-relaxed text-slate-600">
        Fill in your details to receive your Entry Pass instantly.{" "}
        <span className="font-semibold text-navy">Only pass holders will be allowed entry.</span>
      </p>
      <div className="gold-rule my-6" />

      {/* Honeypot (hidden from people) */}
      <input ref={honeypot} type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true"
        className="absolute left-[-9999px] h-0 w-0 opacity-0" />

      <div className="space-y-4 sm:space-y-5">
        {/* I am a */}
        <fieldset>
          <legend className="field-label">I am a <Req /></legend>
          <div id="f-participantType" role="radiogroup" aria-label="I am a" tabIndex={-1} className="grid grid-cols-2 gap-2 outline-none">
            {EVENT.participantTypes.map((t) => (
              <button key={t} type="button" role="radio" aria-checked={f.participantType === t}
                onClick={() => { set("participantType", t); setTouched((x) => ({ ...x, participantType: true })); }}
                className="chip w-full">
                {t}
              </button>
            ))}
          </div>
          {err("participantType") && <p className="field-error">{err("participantType")}</p>}
        </fieldset>

        {/* Name */}
        <div>
          <label htmlFor="f-name" className="field-label">Full Name <Req /></label>
          <input id="f-name" className="field-input" type="text" autoComplete="name" autoCapitalize="words"
            placeholder="Your full name" value={f.name} maxLength={80}
            onChange={(e) => set("name", e.target.value)} onBlur={() => blur("name")}
            aria-invalid={!!err("name")} aria-describedby={err("name") ? "e-name" : undefined} />
          {err("name") && <p id="e-name" className="field-error">{err("name")}</p>}
        </div>

        {/* Mobile */}
        <div>
          <label htmlFor="f-mobile" className="field-label">Mobile Number <Req /></label>
          <div className="flex">
            <span className="flex h-[52px] sm:h-14 items-center rounded-l-xl border border-r-0 border-slate-300 bg-slate-50 px-3.5 sm:px-4 text-[16px] font-medium text-slate-600">
              +91
            </span>
            <input id="f-mobile" className="field-input rounded-l-none" type="tel" inputMode="numeric" autoComplete="tel-national"
              placeholder="10-digit mobile number" value={f.mobile} maxLength={10}
              onChange={(e) => set("mobile", e.target.value.replace(/\D/g, "").slice(0, 10))} onBlur={() => blur("mobile")}
              aria-invalid={!!err("mobile")} aria-describedby={err("mobile") ? "e-mobile" : "h-mobile"} />
          </div>
          {err("mobile") ? <p id="e-mobile" className="field-error">{err("mobile")}</p>
            : <p id="h-mobile" className="mt-1 text-xs sm:text-sm text-slate-500">Your pass will be linked to this number.</p>}
        </div>

        {/* Email */}
        <div>
          <label htmlFor="f-email" className="field-label">Email ID <Opt /></label>
          <input id="f-email" className="field-input" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false}
            placeholder="name@example.com (optional)" value={f.email} maxLength={120}
            onChange={(e) => set("email", e.target.value.trim())} onBlur={() => blur("email")}
            aria-invalid={!!err("email")} aria-describedby={err("email") ? "e-email" : "h-email"} />
          {err("email") ? <p id="e-email" className="field-error">{err("email")}</p>
            : <p id="h-email" className="mt-1 text-xs sm:text-sm text-slate-500">Optional. If provided, we will email your Entry Pass.</p>}
        </div>

        {/* Firm */}
        <div>
          <label htmlFor="f-firm" className="field-label">Firm / Company Name <Opt /></label>
          <input id="f-firm" className="field-input" type="text" autoComplete="organization"
            placeholder="Leave blank if individual" value={f.firm} maxLength={100}
            onChange={(e) => set("firm", e.target.value)} />
        </div>

        {/* Persons */}
        <div>
          <span className="field-label" id="l-persons">No. of Persons <Req /></span>
          <div id="f-persons" tabIndex={-1} className="flex items-center gap-3 outline-none" role="group" aria-labelledby="l-persons">
            <button type="button" className="btn-outline h-12 w-12 text-xl" aria-label="Decrease"
              disabled={f.persons <= 1} onClick={() => set("persons", Math.max(1, f.persons - 1))}>−</button>
            <output aria-live="polite" className="w-12 text-center text-xl font-bold text-navy">{f.persons}</output>
            <button type="button" className="btn-outline h-12 w-12 text-xl" aria-label="Increase"
              disabled={f.persons >= EVENT.maxPersons} onClick={() => set("persons", Math.min(EVENT.maxPersons, f.persons + 1))}>+</button>
            <span className="text-xs sm:text-sm text-slate-500">Including you (max {EVENT.maxPersons})</span>
          </div>
          {errors.persons && <p className="field-error">{errors.persons}</p>}
        </div>

        {/* Consent */}
        <div className="pt-1">
          <label htmlFor="f-consent" className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 sm:p-4 ${err("consent") ? "border-red-500 bg-red-50/50" : "border-slate-200 bg-white/70"}`}>
            <input id="f-consent" type="checkbox" checked={f.consent}
              onChange={(e) => { set("consent", e.target.checked); setTouched((x) => ({ ...x, consent: true })); }}
              className="mt-0.5 h-5 w-5 shrink-0 accent-royal" aria-invalid={!!err("consent")} />
            <span className="text-[14px] sm:text-[15px] leading-snug text-navy">
              I agree to receive event updates from DAC Developers on WhatsApp &amp; Email <Req />
            </span>
          </label>
          {err("consent") && <p className="field-error">{err("consent")}</p>}
        </div>

        {serverError && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-[14px] sm:text-[15px] text-red-700">
            {serverError}{" "}
            <a href={`tel:${EVENT.phoneTel}`} className="font-semibold underline">Call {EVENT.phoneShort}</a>
          </div>
        )}

        {/* Clean inline submit button - no sticky overlay */}
        <div className="pt-2 sm:pt-3">
          <button type="submit" disabled={submitting} className="btn-primary h-[52px] sm:h-14 w-full text-[16px] sm:text-[17px] font-semibold shadow-md">
            {submitting ? (<><span className="spinner" aria-hidden="true" /> Please wait…</>) : "Get My Entry Pass"}
          </button>
        </div>
      </div>
    </form>
  );
}

const Req = () => <span className="text-accent" aria-label="required">*</span>;
const Opt = () => <span className="text-sm font-normal text-slate-400">(optional)</span>;
