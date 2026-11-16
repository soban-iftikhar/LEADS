import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Checkout } from "@/components/app/Checkout";
import { ApiError, getOrder } from "@/lib/api";

export const metadata: Metadata = { title: "Payment", robots: { index: false } };

export default async function CheckoutPage({ params, searchParams }: { params: Promise<{ orderId: string }>; searchParams: Promise<{ cancelled?: string }> }) {
  const [{ orderId }, sp] = await Promise.all([params, searchParams]);
  const order = await getOrder(orderId).catch((e) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  if (order.status !== "PENDING_PAYMENT") redirect("/packages");
  return <Checkout order={order} cancelled={sp.cancelled === "1"} now={new Date().toISOString()} />;
}
