import type { Metadata } from "next";
import { PaymentReturn } from "@/components/app/PaymentReturn";
import { getOrder } from "@/server/modules/orders/service";
import { orNotFound, pageId, requireCustomer } from "@/server/pages";

export const metadata: Metadata = { title: "Confirming payment", robots: { index: false } };

/** Callback from the payment provider. Never trusts query params; it polls the order instead. */
export default async function ReturnPage({ params }: { params: Promise<{ orderId: string }> }) {
  const orderId = pageId((await params).orderId);
  const { me } = await requireCustomer(`/checkout/${orderId}/return`);
  await orNotFound(getOrder(me.user.id, orderId));
  return <PaymentReturn orderId={orderId} email={me.user.email} />;
}
