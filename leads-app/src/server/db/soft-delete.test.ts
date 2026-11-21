import type { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { archive, archiveScope, notArchived, restore } from "./soft-delete";

type Call = { where: unknown; data: unknown };

function fakeTx(count = 2) {
  const calls: Call[] = [];
  const tx = { listing: { updateMany: async (args: Call) => (calls.push(args), { count }) } } as unknown as Prisma.TransactionClient;
  return { tx, calls };
}

describe("soft delete", () => {
  it("scopes lists to live rows unless the Archived tab is open", () => {
    expect(notArchived()).toEqual({ archivedAt: null });
    expect(archiveScope(undefined)).toEqual({ archivedAt: null });
    expect(archiveScope("all")).toEqual({ archivedAt: null });
    expect(archiveScope("archived")).toEqual({ archivedAt: { not: null } });
  });

  it("archives only rows that are still live", async () => {
    const { tx, calls } = fakeTx();
    const at = new Date("2026-11-23T10:00:00Z");
    expect(await archive(tx, "listing", ["a", "b"], at)).toBe(2);
    expect(calls[0]).toEqual({ where: { id: { in: ["a", "b"] }, archivedAt: null }, data: { archivedAt: at } });
  });

  it("restores only archived rows", async () => {
    const { tx, calls } = fakeTx(1);
    expect(await restore(tx, "listing", ["a"])).toBe(1);
    expect(calls[0]).toEqual({ where: { id: { in: ["a"] }, archivedAt: { not: null } }, data: { archivedAt: null } });
  });

  it("does nothing for an empty selection", async () => {
    const { tx, calls } = fakeTx();
    expect(await archive(tx, "listing", [])).toBe(0);
    expect(await restore(tx, "listing", [])).toBe(0);
    expect(calls).toHaveLength(0);
  });
});
