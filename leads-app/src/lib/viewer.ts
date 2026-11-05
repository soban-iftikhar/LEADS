import "server-only";
import { unstable_rethrow } from "next/navigation";
import { getMe } from "@/lib/api";
import type { Me } from "@/types/api";

/** The signed-in customer, or null. Never throws. */
export async function getViewer(): Promise<Me | null> {
  try {
    return await getMe();
  } catch (e) {
    unstable_rethrow(e);
    return null;
  }
}
