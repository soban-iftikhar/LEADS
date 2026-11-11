import { successResponse } from "@/server/http/response";
import { endSession } from "@/server/auth/session";

export async function POST() {
  const response = successResponse({ message: "Logged out successfully" });
  endSession(response);
  return response;
}
