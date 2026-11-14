import "server-only";
import { getMe } from "@/lib/api";
import type { Me } from "@/types/api";

/** The signed-in customer, or null. Never throws. */
export async function getViewer(): Promise<Me | null> {
  try {
    return await getMe();
  } catch {
    return null;
  }
}
