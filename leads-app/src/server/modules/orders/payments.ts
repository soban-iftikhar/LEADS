import "server-only";
import crypto from "node:crypto";
import type { Order, Prisma } from "@prisma/client";
import { env } from "@/server/env";
import { AppError } from "@/server/http/errors";
import { setting } from "@/server/modules/settings/service";
import type { PaymentMethod, PayResult } from "@/types/api";

/**
 * Payment providers (DR-26). The provider is still open (OQ-16), so checkout talks to this
 * interface only. A new gateway (JazzCash, Easypaisa, card) is one more implementation.
 *
 * - manual: bank transfer. The order waits until an admin matches the transfer and confirms it.
 * - sandbox: local development only (env refuses it in production). Card and wallet payments are
 *   confirmed on the spot so the whole flow can be exercised without a gateway.
 */
export interface PaymentProvider {
  readonly methods: readonly PaymentMethod[];
  /** Records the attempt. `confirmNow` means the money is already in (sandbox). */
  start(tx: Prisma.TransactionClient, order: Order, method: PaymentMethod): Promise<{ result: PayResult; confirmNow: string | null }>;
}

const reference = (order: Order) => `LD-${order.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;

async function bankTransfer(tx: Prisma.TransactionClient, order: Order): Promise<{ result: PayResult; confirmNow: null }> {
  const account = await setting("payments.bank_transfer");
  if (!account) throw new AppError(503, "Bank transfer isn't set up yet. Please contact us to pay.");
  const ref = reference(order);
  const existing = await tx.payment.findFirst({ where: { orderId: order.id, provider: "BANK_TRANSFER", status: "PENDING" } });
  if (!existing) await tx.payment.create({ data: { orderId: order.id, provider: "BANK_TRANSFER", providerRef: ref, amountPkr: order.pricePkr, status: "PENDING" } });
  return { result: { instructions: { ...account, reference: ref } }, confirmNow: null };
}

const manual: PaymentProvider = {
  methods: ["BANK_TRANSFER"],
  async start(tx, order, method) {
    if (method !== "BANK_TRANSFER") throw new AppError(422, "Only bank transfer is available for now.", { method: "Only bank transfer is available for now." });
    return bankTransfer(tx, order);
  },
};

const sandbox: PaymentProvider = {
  methods: ["CARD", "JAZZCASH", "EASYPAISA", "BANK_TRANSFER"],
  async start(tx, order, method) {
    if (method === "BANK_TRANSFER") return bankTransfer(tx, order);
    const p = await tx.payment.create({
      data: { orderId: order.id, provider: method, providerRef: `sandbox_${crypto.randomUUID()}`, amountPkr: order.pricePkr, status: "PENDING", raw: { sandbox: true } },
    });
    return { result: { redirectUrl: `/checkout/${order.id}/return` }, confirmNow: p.id };
  },
};

export function paymentProvider(): PaymentProvider {
  return env().PAYMENT_PROVIDER === "sandbox" ? sandbox : manual;
}
