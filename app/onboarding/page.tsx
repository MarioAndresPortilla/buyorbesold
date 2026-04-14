import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SiteNav from "@/components/SiteNav";
import OnboardingForm from "@/components/OnboardingForm";
import { getUser } from "@/lib/auth";
import { getTraderByEmail, suggestUsername } from "@/lib/traders";

export const metadata: Metadata = {
  title: "Create your profile",
  description: "Pick a username and display name to finish signing up.",
};

export default async function OnboardingPage() {
  const email = await getUser();
  if (!email) redirect("/login");

  // If they already have a profile, send them to it.
  const existing = await getTraderByEmail(email);
  if (existing) redirect(`/trader/${existing.username}`);

  const suggested = suggestUsername(email);

  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-[520px] px-3 py-10 xs:px-4">
        <div className="mb-6">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[color:var(--accent)] mb-2">
            One more step
          </div>
          <h1 className="font-bebas text-3xl tracking-wider">Create your profile</h1>
          <p className="mt-2 text-[13px] text-[color:var(--muted)] leading-relaxed">
            Pick a public username and display name. This is how you&apos;ll
            appear on the rankings and in the trade feed.
          </p>
        </div>

        <OnboardingForm email={email} suggestedUsername={suggested} />

        <p className="mt-8 font-mono text-[9px] text-[color:var(--muted)] text-center">
          By continuing, you agree that trade information you post is for
          educational purposes only. Not financial advice.
        </p>
      </main>
    </>
  );
}
