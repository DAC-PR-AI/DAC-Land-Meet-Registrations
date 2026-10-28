export default function SuccessCheck({ size = 88 }: { size?: number }) {
  return (
    <div className="check-wrap mx-auto" style={{ width: size, height: size }}>
      <svg viewBox="0 0 56 56" width={size} height={size} aria-hidden="true">
        <circle className="check-circle" cx="28" cy="28" r="26" fill="none" stroke="#1FA855" strokeWidth="3" />
        <path className="check-tick" d="M16 29l8 8 16-17" fill="none" stroke="#1FA855" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
