import { notFound } from "@/server/http/errors";
import { route } from "@/server/http/route";
import { cellText, csvLine } from "@/lib/admin/csv";
import { EXPORT_BATCH } from "@/lib/admin/constants";
import { parseListParams, type ListFn, type ResourceConfig } from "@/lib/admin/resource";

// Lists that can be downloaded: the same config and query the screen uses.
const EXPORTS: Record<string, { config: ResourceConfig; list: ListFn }> = {};

// GET /api/admin/export/<resource>?<same params as the screen> -> CSV, streamed page by page
export const GET = route<"admin:access", undefined, undefined, { resource: string }>({
  auth: "admin:access",
  handler: async ({ request, params }) => {
    const entry = Object.hasOwn(EXPORTS, params.resource) ? EXPORTS[params.resource] : undefined;
    if (!entry) throw notFound();
    const { config, list } = entry;
    const base = parseListParams(Object.fromEntries(request.nextUrl.searchParams));
    const enc = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(ctl) {
        try {
          ctl.enqueue(enc.encode(csvLine(["Sr.", ...config.columns.map((c) => c.label)])));
          let sr = 0;
          for (let page = 1; ; page++) {
            const { rows, total } = await list({ ...base, page }, EXPORT_BATCH);
            for (const r of rows) ctl.enqueue(enc.encode(csvLine([String(++sr), ...config.columns.map((c) => cellText(c, r.cells[c.key] ?? null))])));
            if (rows.length < EXPORT_BATCH || sr >= total) break;
          }
          ctl.close();
        } catch (e) {
          console.error("[admin] export failed:", e);
          ctl.error(e);
        }
      },
    });
    const day = new Date().toISOString().slice(0, 10);
    return new Response(stream, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="leads-${params.resource}-${day}.csv"` },
    });
  },
});
