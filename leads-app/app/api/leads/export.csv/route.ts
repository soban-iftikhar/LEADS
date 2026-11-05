import { NextResponse, type NextRequest } from "next/server";
import { mockCounts } from "@/mocks/bridge";
import { exportLeadsCsv } from "@/mocks/store";
import { loadSession, SESSION_COOKIE } from "@/server/auth/sessions";
import type { LeadStageFilter } from "@/types/api";

// TODO(api): replace with the real export once GET /api/leads/export.csv exists in the backend module.
// Mirrors the contract: same filters as GET /api/leads, text/csv, scoped to the signed-in customer.
const STAGES = new Set(["new", "contacted", "viewing", "won", "lost", "reported"]);

export async function GET(request: NextRequest) {
  const s = await loadSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (s) mockCounts(s.user);
  const uid = s?.user.id;
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
