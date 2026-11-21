import { NextResponse } from "next/server";
import { route } from "@/server/http/route";
import { leadsQuerySchema } from "@/server/modules/leads/schema";
import { exportLeadsCsv } from "@/server/modules/leads/service";

const exportQuery = leadsQuerySchema.pick({ stage: true, listing: true, q: true });

// GET /api/leads/export.csv?stage&listing&q -> text/csv, the same filters as GET /api/leads
export const GET = route({
  auth: "lead:read:own",
  query: exportQuery,
  limits: [{ key: "leads-export", limit: 20, windowSeconds: 3600 }],
  handler: async ({ auth, query }) =>
    new NextResponse(await exportLeadsCsv(auth.user.id, query), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="leads.csv"' },
    }),
});
