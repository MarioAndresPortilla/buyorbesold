import type { Metadata } from "next";
import SiteNav from "@/components/SiteNav";
import TraderProfile from "@/components/TraderProfile";

interface PageProps {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params;
  return {
    title: `@${username}`,
    description: `Trade performance and stats for @${username} on BuyOrBeSold.`,
  };
}

export default async function TraderPage({ params }: PageProps) {
  const { username } = await params;

  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-[1200px] px-3 py-6 xs:px-4">
        <TraderProfile username={username} />
      </main>
    </>
  );
}
