import { NextResponse, type NextRequest } from "next/server";
import { mockUserId } from "@/mocks/session";
import { exportLeadsCsv } from "@/mocks/store";
import type { LeadStageFilter } from "@/types/api";

// TODO(api): replace with the real export once GET /api/leads/export.csv exists in the backend module.
// Mirrors the contract: same filters as GET /api/leads, text/csv, scoped to the signed-in customer.
const STAGES = new Set(["new", "contacted", "viewing", "won", "lost", "reported"]);

export async function GET(request: NextRequest) {
  const uid = await mockUserId();
  if (!uid) return NextResponse.json({ success: false, message: "Please log in.", errors: null }, { status: 401 });
  const sp = request.nextUrl.searchParams;
  const stage = sp.get("stage");
  const csv = exportLeadsCsv(uid, {
    stage: stage && STAGES.has(stage) ? (stage as LeadStageFilter) : undefined,
    listing: sp.get("listing") ?? undefined,
    q: sp.get("q") ?? undefined,
  });
  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="leads.csv"', "Cache-Control": "no-store" },
  });
}
