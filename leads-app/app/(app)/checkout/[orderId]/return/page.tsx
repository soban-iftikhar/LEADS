import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PaymentReturn } from "@/components/app/PaymentReturn";
import { ApiError, getOrder } from "@/lib/api";

export const metadata: Metadata = { title: "Confirming payment", robots: { index: false } };

/** Callback from the payment provider. Never trusts query params; it polls the order instead. */
export default async function ReturnPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  await getOrder(orderId).catch((e) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  return <PaymentReturn orderId={orderId} />;
}
