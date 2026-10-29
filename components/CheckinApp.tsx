"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { EVENT } from "@/lib/event";
import { extractPassId } from "@/lib/links";
import type { Pass, Stats } from "@/lib/types";
import Logo from "./Logo";

const PIN_KEY = "dac_checkin_pin";

function playSuccessBeep() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(880, now); // A5
    osc.frequency.setValueAtTime(1174.66, now + 0.08); // D6
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
    osc.start(now);
    osc.stop(now + 0.22);
  } catch { }
}

function playWarningBeep() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sawtooth";
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.setValueAtTime(200, now + 0.12);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.26);
    osc.start(now);
    osc.stop(now + 0.26);
  } catch { }
}

type Result =
  | { kind: "valid"; pass: Pass }
  | { kind: "done"; pass: Pass; time: string }
  | { kind: "already"; pass: Pass; time: string }
  | { kind: "notfound"; query: string };

export default function CheckinApp() {
  const [pin, setPin] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try { setPin(sessionStorage.getItem(PIN_KEY)); } catch { }
    setReady(true);
  }, []);

  const logout = useCallback(() => {
    try { sessionStorage.removeItem(PIN_KEY); } catch { }
    setPin(null);
  }, []);

  if (!ready) return null;
  if (!pin) return <PinGate onOk={(p) => { try { sessionStorage.setItem(PIN_KEY, p); } catch { } setPin(p); }} />;
  return <Desk pin={pin} onUnauthorized={logout} />;
}

/* ---------------- PIN gate ---------------- */

function PinGate({ onOk }: { onOk: (pin: string) => void }) {
  const [value, setValue] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!value || busy) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/checkin/verify-pin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: value }) });
      if (r.ok) onOk(value);
      else setErr("Incorrect PIN. Please try again.");
    } catch {
      setErr("Network error. Check your internet and retry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="glass fade-up mx-auto mt-10 max-w-sm p-8 text-center">
      <Logo className="mx-auto" />
      <h1 className="mt-5 font-serif text-2xl font-bold text-navy">Venue Check-in</h1>
      <p className="mt-1 text-sm text-slate-500">Staff only. Enter the check-in PIN.</p>
      <input
        type="password" inputMode="numeric" autoComplete="one-time-code" autoFocus value={value}
        onChange={(e) => setValue(e.target.value.replace(/\s/g, ""))}
        className="field-input mt-6 text-center text-2xl tracking-[0.5em]" placeholder="••••" aria-label="PIN"
      />
      {err && <p className="field-error">{err}</p>}
      <button className="btn-primary mt-5 w-full" disabled={busy || !value}>
        {busy ? <span className="spinner" /> : "Unlock"}
      </button>
    </form>
  );
}

/* ---------------- Main desk ---------------- */

function Desk({ pin, onUnauthorized }: { pin: string; onUnauthorized: () => void }) {
  const [mode, setMode] = useState<"scan" | "mobile" | "pass">("scan");
  const [stats, setStats] = useState<Stats | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const api = useCallback(
    async (path: string, body?: unknown) => {
      const r = await fetch(path, {
        method: body ? "POST" : "GET",
        headers: { "Content-Type": "application/json", "x-checkin-pin": pin },
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
      });
      if (r.status === 401) { onUnauthorized(); throw new Error("PIN expired"); }
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.ok) throw new Error(data.error || "Something went wrong");
      return data;
    },
    [pin, onUnauthorized]
  );

  const loadStats = useCallback(async () => {
    try { setStats((await api("/api/checkin/stats")).stats); } catch { }
  }, [api]);

  useEffect(() => {
    loadStats();
    const t = setInterval(loadStats, 20000);
    return () => clearInterval(t);
  }, [loadStats]);

  // Gate session cache: stores verified/checked-in passes in memory for 0ms duplicate detection
  const sessionCache = useRef<Map<string, { pass: Pass; time: string }>>(new Map());

  // Auto-reset back to camera scanning for next guest (only for completed scans or not found, NEVER for valid pending confirmation)
  useEffect(() => {
    if (!result || result.kind === "valid") return;
    const delay = result.kind === "done" ? 1800 : result.kind === "already" ? 2600 : 2200;
    const timer = setTimeout(() => {
      setResult(null);
      setError("");
    }, delay);
    return () => clearTimeout(timer);
  }, [result]);

  // Fast 1-step checkin on QR scan: single roundtrip, no manual confirm button needed
  const fastScanCheckin = useCallback(async (rawText: string) => {
    const passId = extractPassId(rawText);
    if (!passId) return;

    // Instant tactile feedback on detection
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(40);
    }

    // 0ms Local Check: if already checked-in at this gate during this session, flag immediately
    if (sessionCache.current.has(passId)) {
      const cached = sessionCache.current.get(passId)!;
      setResult({ kind: "already", pass: cached.pass, time: cached.time });
      playWarningBeep();
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([120, 60, 120]);
      }
      return;
    }

    setBusy(true);
    setError("");
    try {
      const d = await api("/api/checkin/mark", { passId });
      if (!d.found) {
        setResult({ kind: "notfound", query: passId });
        playWarningBeep();
        if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([100, 50, 100]);
      } else if (d.alreadyCheckedIn) {
        sessionCache.current.set(passId, { pass: d.pass, time: d.checkinTime });
        setResult({ kind: "already", pass: d.pass, time: d.checkinTime });
        playWarningBeep();
        if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([150, 100, 150]);
      } else {
        sessionCache.current.set(passId, { pass: d.pass, time: d.checkinTime });
        setResult({ kind: "done", pass: d.pass, time: d.checkinTime });
        playSuccessBeep();
        if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(70);
      }
      loadStats();
    } catch (e) {
      setError((e as Error).message + `. If this continues, call ${EVENT.phoneShort}.`);
    } finally {
      setBusy(false);
    }
  }, [api, loadStats]);

  // Manual search lookup (for typing mobile numbers or pass IDs)
  const lookup = useCallback(async (q: string) => {
    const clean = q.trim();
    if (!clean) return;
    setBusy(true);
    setError("");
    try {
      const d = await api("/api/checkin/lookup", { query: clean });
      if (!d.found) {
        setResult({ kind: "notfound", query: clean });
        playWarningBeep();
      } else if (d.pass.checkedIn) {
        setResult({ kind: "already", pass: d.pass, time: d.pass.checkinTime });
        playWarningBeep();
      } else {
        setResult({ kind: "valid", pass: d.pass });
        if (navigator.vibrate) navigator.vibrate(80);
      }
    } catch (e) {
      setError((e as Error).message + `. If this continues, call ${EVENT.phoneShort}.`);
    } finally {
      setBusy(false);
    }
  }, [api]);

  async function mark(passId: string) {
    setBusy(true);
    setError("");
    try {
      const d = await api("/api/checkin/mark", { passId });
      if (!d.found) {
        setResult({ kind: "notfound", query: passId });
        playWarningBeep();
      } else if (d.alreadyCheckedIn) {
        sessionCache.current.set(passId, { pass: d.pass, time: d.checkinTime });
        setResult({ kind: "already", pass: d.pass, time: d.checkinTime });
        playWarningBeep();
      } else {
        sessionCache.current.set(passId, { pass: d.pass, time: d.checkinTime });
        setResult({ kind: "done", pass: d.pass, time: d.checkinTime });
        playSuccessBeep();
      }
      loadStats();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const reset = () => { setResult(null); setError(""); setQuery(""); };

  return (
    <div className="mx-auto max-w-md px-4 pb-10 pt-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-serif text-xl font-bold text-navy">Venue Check-in</p>
          <p className="text-xs text-slate-500">{EVENT.shortName}</p>
        </div>
        <button onClick={onUnauthorized} className="text-sm font-medium text-royal underline-offset-4 hover:underline">Lock</button>
      </div>

      {/* Live counts */}
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <StatBox label="Registrations" value={stats?.registrations} />
        <StatBox label="Total persons" value={stats?.persons} />
        <StatBox label="Checked-in" value={stats?.checkedIn} sub={stats ? `${stats.checkedInPersons} persons` : undefined} accent />
      </div>

      {/* Mode tabs: 3 dedicated workflows */}
      <div className="mt-5 grid grid-cols-3 gap-1 rounded-xl bg-navy/5 p-1" role="tablist">
        {(
          [
            { id: "scan", label: "⚡ QR Scan" },
            { id: "mobile", label: "📱 Mobile" },
            { id: "pass", label: "🎫 Pass ID" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={mode === t.id}
            onClick={() => {
              setMode(t.id);
              reset();
            }}
            className={`h-12 rounded-lg text-xs sm:text-[14px] font-bold transition flex items-center justify-center gap-1 ${
              mode === t.id ? "bg-white text-navy shadow" : "text-slate-500 hover:text-navy"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {mode === "scan" && (
          <div>
            <Scanner paused={!!result || busy} onScan={fastScanCheckin} />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setMode("mobile");
                  reset();
                }}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-royal/20 bg-royal/5 py-3 text-xs font-bold text-royal transition hover:bg-royal/10 active:scale-98"
              >
                📱 Search by Mobile
              </button>
              <button
                onClick={() => {
                  setMode("pass");
                  reset();
                }}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-royal/20 bg-royal/5 py-3 text-xs font-bold text-royal transition hover:bg-royal/10 active:scale-98"
              >
                🎫 Search by Pass ID
              </button>
            </div>
          </div>
        )}

        {mode === "mobile" && (
          <div className="rounded-2xl border border-gold/40 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/20 text-base">📱</span>
              <div>
                <p className="text-base font-bold text-navy">Search by Mobile Number</p>
                <p className="text-xs text-slate-500">For guests who only registered with their mobile phone.</p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                lookup(query);
              }}
              className="mt-4"
            >
              <label className="text-xs font-semibold text-slate-600">Enter 10-Digit Mobile Number</label>
              <div className="relative mt-1 flex items-center">
                <span className="absolute left-3 text-sm font-bold text-slate-400 select-none">+91</span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value.replace(/[^\d\s+-]/g, ""))}
                  placeholder="98401 23456"
                  className="field-input pl-12 text-lg font-mono font-bold tracking-wider"
                  inputMode="tel"
                  autoFocus
                  maxLength={14}
                  aria-label="10-digit Mobile Number"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="absolute right-3 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-600 hover:bg-slate-300"
                  >
                    ✕
                  </button>
                )}
              </div>

              <button
                type="submit"
                className="btn-navy mt-4 flex h-12 w-full items-center justify-center gap-2 text-base font-bold shadow-md"
                disabled={busy || !query.trim()}
              >
                {busy ? <span className="spinner" /> : "🔍 Find by Mobile Number"}
              </button>
            </form>
          </div>
        )}

        {mode === "pass" && (
          <div className="rounded-2xl border border-gold/40 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-base">🎫</span>
              <div>
                <p className="text-base font-bold text-navy">Search by Pass ID</p>
                <p className="text-xs text-slate-500">Enter pass number (e.g. 42 or DAC-LE-0042).</p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                lookup(extractPassId(query));
              }}
              className="mt-4"
            >
              <label className="text-xs font-semibold text-slate-600">Pass Number or Full Pass ID</label>
              <div className="relative mt-1 flex items-center">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g. 42 or DAC-LE-0042"
                  className="field-input text-lg font-mono font-bold uppercase tracking-wider"
                  inputMode="text"
                  autoCapitalize="characters"
                  autoFocus
                  aria-label="Pass ID"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="absolute right-3 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-600 hover:bg-slate-300"
                  >
                    ✕
                  </button>
                )}
              </div>

              <button
                type="submit"
                className="btn-navy mt-4 flex h-12 w-full items-center justify-center gap-2 text-base font-bold shadow-md"
                disabled={busy || !query.trim()}
              >
                {busy ? <span className="spinner" /> : "🔍 Find by Pass ID"}
              </button>
            </form>

            <div className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-400">
              <span>Quick tests:</span>
              <button
                type="button"
                onClick={() => setQuery("1")}
                className="rounded bg-slate-100 px-2 py-1 font-mono font-semibold text-slate-600 hover:bg-slate-200"
              >
                1
              </button>
              <button
                type="button"
                onClick={() => setQuery("12")}
                className="rounded bg-slate-100 px-2 py-1 font-mono font-semibold text-slate-600 hover:bg-slate-200"
              >
                12
              </button>
              <button
                type="button"
                onClick={() => setQuery("DAC-LE-0001")}
                className="rounded bg-slate-100 px-2 py-1 font-mono font-semibold text-slate-600 hover:bg-slate-200"
              >
                DAC-LE-0001
              </button>
            </div>
          </div>
        )}
      </div>

      {busy && !result && <p className="mt-4 flex items-center justify-center gap-2 text-slate-500"><span className="spinner !border-slate-300 !border-t-navy" /> Checking…</p>}
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-center text-red-700">{error}</p>}

      {result && <ResultCard result={result} busy={busy} onMark={mark} onNext={reset} />}
    </div>
  );
}

function StatBox({ label, value, sub, accent }: { label: string; value?: number; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-3 ${accent ? "border-green-200 bg-green-50" : "border-gold/40 bg-white"}`}>
      <p className={`text-2xl font-bold ${accent ? "text-green-700" : "text-navy"}`}>{value ?? "–"}</p>
      <p className="text-[11px] leading-tight text-slate-500">{label}</p>
      {sub && <p className="text-[11px] text-green-700">{sub}</p>}
    </div>
  );
}

function ResultCard({ result, busy, onMark, onNext }: { result: Result; busy: boolean; onMark: (id: string) => void; onNext: () => void }) {
  if (result.kind === "notfound") {
    return (
      <div onClick={onNext} className="fade-up mt-5 cursor-pointer rounded-2xl border-4 border-red-500 bg-red-50 p-6 text-center shadow-lg" role="alert">
        <p className="text-3xl font-extrabold text-red-600">NO GUEST FOUND</p>
        <p className="mt-2 font-mono text-sm font-semibold text-slate-700">Searched: {result.query}</p>
        <p className="mt-1 text-sm text-slate-500">Check the 10-digit mobile number or register them as a walk-in at the front desk.</p>
        <p className="mt-4 text-xs font-medium text-slate-400">Auto-clearing in 2s · Tap anywhere to retry</p>
        <button onClick={(e) => { e.stopPropagation(); onNext(); }} className="btn-navy mt-3 w-full">Search Again</button>
      </div>
    );
  }

  const p = result.pass;
  const isPendingValid = result.kind === "valid";
  const tone =
    result.kind === "valid" ? "border-green-500 bg-white shadow-xl" :
      result.kind === "done" ? "border-green-500 bg-green-50/90" : "border-amber-500 bg-amber-50";

  return (
    <div
      onClick={!isPendingValid ? onNext : undefined}
      className={`fade-up mt-5 rounded-2xl border-4 p-5 ${!isPendingValid ? "cursor-pointer" : ""} ${tone}`}
      aria-live="polite"
    >
      {result.kind === "done" && (
        <div className="mb-4 rounded-xl bg-green-600 p-4 text-center text-xl font-black text-white shadow-md">
          ✓ CHECKED-IN
        </div>
      )}
      {result.kind === "already" && (
        <div className="mb-4 rounded-xl bg-amber-500 p-4 text-center text-lg font-black text-white shadow-md">
          ALREADY CHECKED-IN at {shortTime(result.time)}
        </div>
      )}

      {isPendingValid && (
        <div className="mb-4 rounded-xl bg-royal/10 border border-royal/20 p-3 text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-royal">Guest Found</p>
          <p className="text-sm font-medium text-navy">Verify details with the guest and confirm admission below.</p>
        </div>
      )}

      <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2.5 text-[15px]">
        <dt className="text-slate-500">Name</dt>
        <dd className="font-bold text-navy text-lg">{p.name}</dd>

        {p.mobile && (
          <>
            <dt className="text-slate-500">Mobile</dt>
            <dd className="font-mono font-bold text-navy text-base">+91 {p.mobile}</dd>
          </>
        )}

        <dt className="text-slate-500">Role</dt>
        <dd className="font-medium text-navy">{p.participantType}</dd>

        {p.firm && (
          <>
            <dt className="text-slate-500">Firm</dt>
            <dd className="text-navy">{p.firm}</dd>
          </>
        )}

        <dt className="text-slate-500">Pass ID</dt>
        <dd className="font-mono font-bold text-navy">{p.passId}</dd>

        <dt className="text-slate-500">Capacity</dt>
        <dd className="text-2xl font-black text-green-700">
          Admit {p.persons} {p.persons === 1 ? "Person" : "Persons"}
        </dd>
      </dl>

      {isPendingValid ? (
        <div className="mt-6 space-y-2.5">
          <button
            onClick={() => onMark(p.passId)}
            disabled={busy}
            className="btn flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-green-600 text-lg font-extrabold text-white shadow-lg hover:bg-green-700 active:scale-98 transition"
          >
            {busy ? <span className="spinner" /> : `✓ CONFIRM & ADMIT (${p.persons} ${p.persons === 1 ? "Person" : "Persons"})`}
          </button>
          <button
            onClick={onNext}
            className="flex h-10 w-full items-center justify-center rounded-xl bg-slate-100 text-sm font-semibold text-slate-600 hover:bg-slate-200"
          >
            Cancel / Back to Search
          </button>
        </div>
      ) : (
        <p className="mt-4 text-center text-xs font-medium text-slate-500">
          Auto-clearing in 2s · Tap card to scan next
        </p>
      )}
    </div>
  );
}

function shortTime(t: string) {
  // "29 Oct 2026, 06:42 PM" → "06:42 PM"
  const m = String(t || "").match(/(\d{1,2}:\d{2}\s?[AP]M)/i);
  return m ? m[1] : t || "";
}

/* ---------------- QR Scanner (html5-qrcode, loaded only here) ---------------- */

type ScannerInstance = {
  start: (...a: unknown[]) => Promise<unknown>;
  stop: () => Promise<void>;
  clear: () => void;
  pause: (v?: boolean) => void;
  resume: () => void;
  isScanning: boolean;
};

function Scanner({ paused, onScan }: { paused: boolean; onScan: (text: string) => void }) {
  const ref = useRef<ScannerInstance | null>(null);
  const pausedRef = useRef(paused);
  const onScanRef = useRef(onScan);
  const [err, setErr] = useState("");
  const [starting, setStarting] = useState(true);

  onScanRef.current = onScan;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        if (cancelled) return;
        const s = new Html5Qrcode("qr-reader", {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true,
          },
        }) as unknown as ScannerInstance;
        ref.current = s;
        await s.start(
          { facingMode: "environment" },
          {
            fps: 25,
            qrbox: (w: number, h: number) => {
              const min = Math.min(w, h);
              const n = Math.floor(min * 0.85);
              return { width: n, height: n };
            },
            aspectRatio: 1.0,
          },
          (text: string) => {
            if (pausedRef.current) return;
            pausedRef.current = true; // block repeats until result is cleared
            onScanRef.current(text);
          },
          () => { }
        );
        if (cancelled) { await s.stop().catch(() => { }); return; }
      } catch (e) {
        const msg = String((e as Error)?.message || e);
        setErr(/permission|NotAllowed/i.test(msg)
          ? "Camera permission denied. Allow camera access in browser settings, or use Search."
          : "Could not start camera. Use the Search tab instead.");
      } finally {
        setStarting(false);
      }
    })();
    return () => {
      cancelled = true;
      const s = ref.current;
      if (s?.isScanning) s.stop().then(() => s.clear()).catch(() => { });
    };
  }, []);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  return (
    <div>
      <div className={`relative overflow-hidden rounded-2xl bg-navy ${paused ? "opacity-40" : ""}`}>
        <div id="qr-reader" className="min-h-[280px] w-full [&_video]:!w-full [&_video]:object-cover" />
        {starting && !err && <p className="absolute inset-0 flex items-center justify-center text-white/80">Starting camera…</p>}
      </div>
      {err ? <p className="mt-3 rounded-xl bg-amber-50 p-3 text-center text-amber-800">{err}</p>
        : <p className="mt-2 text-center text-sm text-slate-500">Point the camera at the QR code on the guest&apos;s pass.</p>}
    </div>
  );
}
