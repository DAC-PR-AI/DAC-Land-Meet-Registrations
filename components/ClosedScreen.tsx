import { EVENT } from "@/lib/event";
import Logo from "./Logo";

export default function ClosedScreen() {
  return (
    <div className="glass fade-up mx-auto max-w-md p-8 text-center">
      <Logo className="mx-auto" />
      <div className="gold-rule my-6" />
      <h2 className="font-serif text-2xl font-bold text-navy">Registrations are closed</h2>
      <p className="mt-3 text-[16px] leading-relaxed text-slate-600">
        Thank you for your interest. For assistance, please call{" "}
        <a href={`tel:${EVENT.phoneTel}`} className="font-semibold text-royal">{EVENT.phoneShort}</a>.
      </p>
      <a href={`tel:${EVENT.phoneTel}`} className="btn-primary mt-6 w-full">Call {EVENT.phoneShort}</a>
      <p className="mt-4 text-sm text-slate-500">Already registered? Please show your Entry Pass at the venue.</p>
    </div>
  );
}
