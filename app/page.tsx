import ClosedScreen from "@/components/ClosedScreen";
import Footer from "@/components/Footer";
import Hero from "@/components/Hero";
import RsvpForm from "@/components/RsvpForm";
import { isRegistrationClosed } from "@/lib/event";

// Re-check the closing time at least every minute
export const revalidate = 60;

export default function Home() {
  const closed = isRegistrationClosed();
  return (
    <>
      <main className="mx-auto max-w-3xl">
        <Hero />
        <section className="px-3.5 sm:px-4 pb-12 sm:pb-16" aria-label="Registration">
          {closed ? <ClosedScreen /> : <RsvpForm />}
        </section>
      </main>
      <Footer />
    </>
  );
}
