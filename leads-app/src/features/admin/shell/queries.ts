import "server-only";
import { adminBadges } from "@/server/modules/admin/badges";
import type { AdminBadges } from "./nav";

export const getAdminBadges = (): Promise<AdminBadges> => adminBadges();
