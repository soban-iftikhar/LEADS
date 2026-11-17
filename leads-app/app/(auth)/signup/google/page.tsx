import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { GoogleComplete } from "@/components/auth/GoogleComplete";
import { requireGuest } from "@/server/pages";
import { PENDING_COOKIE, unsign, type GoogleClaims } from "@/server/auth/google";

export const metadata: Metadata = { title: "Finish signing up", robots: { index: false } };

/** First Google sign-in (DR-43): pick Owner or Agency, then the account is created. */
export default async function GoogleSignupPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  await requireGuest();
  const g = unsign<GoogleClaims>((await cookies()).get(PENDING_COOKIE)?.value);
  if (!g) redirect("/signup");
  const { type } = await searchParams;
  return <GoogleComplete email={g.email} name={g.name} initial={type === "agency" ? "AGENCY" : "SELLER"} />;
}
