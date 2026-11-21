import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/auth/AdminLoginForm";
import { safeNext } from "@/lib/redirects";
import { currentAuth } from "@/server/auth/current";

export const metadata: Metadata = { title: "Admin sign-in", robots: { index: false, follow: false } };

type SP = Promise<{ next?: string }>;

export default async function AdminLoginPage({ searchParams }: { searchParams: SP }) {
  const next = safeNext((await searchParams).next, "/admin");
  const auth = await currentAuth();
  if (auth?.user.role === "ADMIN" && auth.session.twoFactorPassed) redirect(next);
  // password already accepted in this browser: go straight to the code
  const startAt = auth?.user.role === "ADMIN" ? "code" : "password";
  return <AdminLoginForm next={next} startAt={startAt} />;
}
