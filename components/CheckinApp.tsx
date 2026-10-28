"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { EVENT } from "@/lib/event";
import type { Pass, Stats } from "@/lib/types";
import Logo from "./Logo";

const PIN_KEY = "dac_checkin_pin";

type Result =
  | { kind: "valid"; pass: Pass }
  | { kind: "done"; pass: Pass; time: string }
  | { kind: "already"; pass: Pass; time: string }
  | { kind: "notfound"; query: string };

export default function CheckinApp() {
  const [pin, setPin] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try { setPin(sessionStorage.getItem(PIN_KEY)); } catch {}
    setReady(true);
  }, []);

  const logout = useCallback(() => {
    try { sessionStorage.removeItem(PIN_KEY); } catch {}
    setPin(null);
  }, []);

  if (!ready) return null;
  if (!pin) return <PinGate onOk={(p) => { try { sessionStorage.setItem(PIN_KEY, p); } catch {} setPin(p); }} />;
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
  const [mode, setMode] = useState<"scan" | "search">("scan");
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
    try { setStats((await api("/api/checkin/stats")).stats); } catch {}
  }, [api]);

  useEffect(() => {
    loadStats();
    const t = setInterval(loadStats, 20000);
    return () => clearInterval(t);
  }, [loadStats]);

  const lookup = useCallback(async (q: string) => {
    const clean = q.trim();
    if (!clean) return;
    setBusy(true);
    setError("");
    try {
      const d = await api("/api/checkin/lookup", { query: clean });
      if (!d.found) setResult({ kind: "notfound", query: clean });
      else if (d.pass.checkedIn) setResult({ kind: "already", pass: d.pass, time: d.pass.checkinTime });
      else setResult({ kind: "valid", pass: d.pass });
      if (navigator.vibrate) navigator.vibrate(d.found && !d.pass.checkedIn ? 80 : [60, 60, 60]);
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
      if (!d.found) setResult({ kind: "notfound", query: passId });
      else if (d.alreadyCheckedIn) setResult({ kind: "already", pass: d.pass, time: d.checkinTime });
      else setResult({ kind: "done", pass: d.pass, time: d.checkinTime });
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

      {/* Mode tabs */}
      <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl bg-navy/5 p-1" role="tablist">
        {(["scan", "search"] as const).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} onClick={() => { setMode(m); reset(); }}
            className={`h-12 rounded-lg text-[15px] font-semibold transition ${mode === m ? "bg-white text-navy shadow" : "text-slate-500"}`}>
            {m === "scan" ? "Scan QR" : "Search"}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {mode === "scan" ? (
          <Scanner paused={!!result || busy} onScan={lookup} />
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); lookup(query); }} className="flex gap-2">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Mobile no. or Pass ID (e.g. 12)"
              className="field-input" inputMode="text" autoCapitalize="characters" aria-label="Mobile number or Pass ID" />
            <button className="btn-navy shrink-0 px-5" disabled={busy || !query.trim()}>Find</button>
          </form>
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
      <div className="fade-up mt-5 rounded-2xl border-4 border-red-500 bg-red-50 p-6 text-center" role="alert">
        <p className="text-3xl font-extrabold text-red-600">NO PASS FOUND</p>
        <p className="mt-2 break-all text-slate-600">Searched: {result.query}</p>
        <p className="mt-1 text-sm text-slate-500">Try searching by mobile number, or direct the guest to the help desk.</p>
        <button onClick={onNext} className="btn-navy mt-5 w-full">Next guest</button>
      </div>
    );
  }

  const p = result.pass;
  const tone =
    result.kind === "valid" ? "border-green-500 bg-white" :
    result.kind === "done" ? "border-green-500 bg-green-50" : "border-amber-500 bg-amber-50";

  return (
    <div className={`fade-up mt-5 rounded-2xl border-4 p-5 ${tone}`} aria-live="polite">
      <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 text-[15px]">
        <dt className="text-slate-500">Name</dt><dd className="font-bold text-navy">{p.name}</dd>
        <dt className="text-slate-500">Type</dt><dd className="text-navy">{p.participantType}</dd>
        {p.firm && (<><dt className="text-slate-500">Firm</dt><dd className="text-navy">{p.firm}</dd></>)}
        <dt className="text-slate-500">Persons</dt><dd className="text-2xl font-extrabold text-accent">Admit {p.persons}</dd>
        <dt className="text-slate-500">Pass ID</dt><dd className="font-mono font-bold text-navy">{p.passId}</dd>
        <dt className="text-slate-500">Status</dt>
        <dd className="font-semibold">
          {result.kind === "valid" ? <span className="text-green-700">Valid – not yet checked-in</span>
            : <span className={result.kind === "done" ? "text-green-700" : "text-amber-700"}>Checked-in</span>}
        </dd>
      </dl>

      {result.kind === "valid" && (
        <button onClick={() => onMark(p.passId)} disabled={busy}
          className="btn mt-5 h-16 w-full bg-green-600 text-lg font-extrabold text-white hover:bg-green-700">
          {busy ? <span className="spinner" /> : "VALID – Mark Checked-in"}
        </button>
      )}
      {result.kind === "done" && (
        <div className="mt-5 rounded-xl bg-green-600 p-4 text-center text-lg font-extrabold text-white">
          ✓ CHECKED-IN at {shortTime(result.time)}
        </div>
      )}
      {result.kind === "already" && (
        <div className="mt-5 rounded-xl bg-amber-500 p-4 text-center text-lg font-extrabold text-white">
          ALREADY CHECKED-IN at {shortTime(result.time)}
        </div>
      )}
      <button onClick={onNext} className="btn-outline mt-3 w-full">{result.kind === "valid" ? "Cancel" : "Next guest"}</button>
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
        const s = new Html5Qrcode("qr-reader", { formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE], verbose: false }) as unknown as ScannerInstance;
        ref.current = s;
        await s.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: (w: number, h: number) => { const n = Math.floor(Math.min(w, h) * 0.7); return { width: n, height: n }; } },
          (text: string) => {
            if (pausedRef.current) return;
            pausedRef.current = true; // block repeats until result is cleared
            onScanRef.current(text);
          },
          () => {}
        );
        if (cancelled) { await s.stop().catch(() => {}); return; }
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
      if (s?.isScanning) s.stop().then(() => s.clear()).catch(() => {});
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
