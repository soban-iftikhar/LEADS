import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Checkout } from "@/components/app/Checkout";
import { getOrder } from "@/server/modules/orders/service";
import { orNotFound, pageId, requireCustomer } from "@/server/pages";

export const metadata: Metadata = { title: "Payment", robots: { index: false } };

export default async function CheckoutPage({ params, searchParams }: { params: Promise<{ orderId: string }>; searchParams: Promise<{ cancelled?: string }> }) {
  const [{ orderId: raw }, sp] = await Promise.all([params, searchParams]);
  const orderId = pageId(raw);
  const { me } = await requireCustomer(`/checkout/${orderId}`);
  const order = await orNotFound(getOrder(me.user.id, orderId));
  if (order.status !== "PENDING_PAYMENT") redirect("/packages");
  return <Checkout order={order} cancelled={sp.cancelled === "1"} now={new Date().toISOString()} />;
}
