"use client";
import { useEffect, useRef, useState } from "react";

/** Shows /dac-logo.png; falls back to a styled "DAC" wordmark if the file is missing. */
export default function Logo({ variant = "dark", className = "" }: { variant?: "dark" | "light"; className?: string }) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // Catches errors that fired before React hydrated
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);

  if (failed) {
    const light = variant === "light";
    return (
      <div className={`inline-flex flex-col items-center leading-none ${className}`} aria-label="DAC Developers">
        <span className={`font-serif text-3xl font-bold tracking-[0.3em] ${light ? "text-white" : "text-navy"}`}>DAC</span>
        <span className="mt-1 h-[3px] w-10 rounded-full bg-accent" />
      </div>
    );
  }
  const hasHeight = /\bh-/.test(className);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src="/dac-logo.png"
      alt="DAC Developers"
      className={`${hasHeight ? "" : "h-12"} w-auto object-contain ${className}`.trim()}
      onError={() => setFailed(true)}
    />
  );
}
