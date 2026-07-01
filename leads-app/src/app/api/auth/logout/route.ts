import { NextRequest } from "next/server";
import { successResponse } from "@/lib/api-response";

export async function POST(request: NextRequest) {
  const response = successResponse({ message: "Logged out successfully" });
  
  // Clear the token cookie
  response.cookies.set("token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0, // expires immediately
    path: "/",
  });

  return response;
}