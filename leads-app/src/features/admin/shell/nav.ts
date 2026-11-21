import type { IconName } from "@/components/ui/icons";

/** Counters shown on sub-menu items, from one query (getAdminBadges). */
export type BadgeKey = "review" | "replies" | "reports";
export type AdminBadges = Record<BadgeKey, number>;

export type NavItem = { href: string; label: string; badge?: BadgeKey };
export type NavGroup = { label: string; icon: IconName; items: NavItem[] };

export const ADMIN_NAV: NavGroup[] = [
  { label: "Dashboards", icon: "tiles", items: [{ href: "/admin", label: "Overview" }, { href: "/admin/market", label: "Market intelligence" }] },
  { label: "Properties", icon: "plot", items: [{ href: "/admin/properties/selection", label: "Selection" }, { href: "/admin/properties/areas", label: "Areas" }] },
  { label: "Listings", icon: "house", items: [{ href: "/admin/listings/review", label: "Review queue", badge: "review" }, { href: "/admin/listings", label: "All listings" }] },
  {
    label: "Outreach",
    icon: "send",
    items: [
      { href: "/admin/outreach/campaigns", label: "Campaigns" },
      { href: "/admin/outreach/replies", label: "Replies", badge: "replies" },
      { href: "/admin/outreach/templates", label: "Templates" },
      { href: "/admin/outreach/contacts", label: "Contacts" },
    ],
  },
  { label: "Leads", icon: "tray", items: [{ href: "/admin/leads", label: "All leads" }, { href: "/admin/leads/reports", label: "Reports", badge: "reports" }] },
  {
    label: "Customers",
    icon: "users",
    items: [
      { href: "/admin/customers/accounts", label: "Accounts" },
      { href: "/admin/customers/orders", label: "Orders" },
      { href: "/admin/customers/payments", label: "Payments" },
    ],
  },
  { label: "Crawlers", icon: "globe", items: [{ href: "/admin/crawlers/sources", label: "Sources" }, { href: "/admin/crawlers/schedules", label: "Schedules" }] },
  {
    label: "Settings",
    icon: "sliders",
    items: [
      { href: "/admin/settings", label: "General" },
      { href: "/admin/settings/packages", label: "Packages" },
      { href: "/admin/settings/keys", label: "API keys" },
      { href: "/admin/settings/team", label: "Team" },
      { href: "/admin/settings/health", label: "Site health" },
      { href: "/admin/settings/activity", label: "Activity log" },
    ],
  },
];

/**
 * The menu item a path belongs to: the longest href that is the path itself or a parent of it,
 * so /admin/listings/review wins over /admin/listings, and /admin only matches itself.
 */
export function activeItem(path: string): { group: number; item: NavItem } | null {
  let best: { group: number; item: NavItem } | null = null;
  ADMIN_NAV.forEach((g, gi) =>
    g.items.forEach((item) => {
      const hit = path === item.href || (item.href !== "/admin" && path.startsWith(item.href + "/"));
      if (hit && (!best || item.href.length > best.item.href.length)) best = { group: gi, item };
    }),
  );
  return best;
}

/** Header breadcrumb: group small, page bold. */
export function crumbFor(path: string): { group: string; page: string } {
  const a = activeItem(path);
  return a ? { group: ADMIN_NAV[a.group].label, page: a.item.label } : { group: "Admin", page: "" };
}
