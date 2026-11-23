import "server-only";
import { prisma } from "@/server/db";
import { notArchived } from "@/server/db/soft-delete";
import { listSelection, selectionKpis } from "@/server/modules/admin/selection";

export { listSelection as getSelection };
export const getSelectionKpis = selectionKpis;

/** Area filter: active localities in active cities. */
export async function getAreaOptions() {
  const rows = await prisma.locality.findMany({ where: { ...notArchived(), active: true, region: { active: true } }, orderBy: [{ region: { name: "asc" } }, { name: "asc" }], select: { slug: true, name: true } });
  return rows.map((r) => ({ value: r.slug, label: r.name }));
}
