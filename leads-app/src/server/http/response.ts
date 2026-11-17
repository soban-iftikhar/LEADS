import "server-only";
import { NextResponse } from "next/server";

// Envelope of the customer UI contract (DR-44): { success, data } / { success: false, message, errors }.

export function ok(data: unknown, status = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status });
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

export function fail(message: string, status = 400, errors: Record<string, string> | null = null): NextResponse {
  return NextResponse.json({ success: false, message, errors }, { status });
}
