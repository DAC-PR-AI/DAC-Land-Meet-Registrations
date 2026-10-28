import type { Metadata } from "next";
import CheckinApp from "@/components/CheckinApp";

export const metadata: Metadata = {
  title: "Check-in – DAC Developers",
  robots: { index: false, follow: false },
};

export default function CheckinPage() {
  return (
    <main className="min-h-dvh">
      <CheckinApp />
    </main>
  );
}
