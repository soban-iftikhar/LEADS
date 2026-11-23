import type { ResourceConfig } from "@/lib/admin/resource";

export const reviewConfig: ResourceConfig = {
  resource: "review",
  title: "Review queue",
  sub: "Approve within 24 hours",
  noun: "listing",
  columns: [
    { key: "property", label: "Property", type: "title", sort: "property" },
    { key: "customer", label: "Customer", type: "text", sort: "customer" },
    { key: "price", label: "Price", type: "money", sort: "price", right: true },
    { key: "waiting", label: "Waiting", type: "text", sort: "waiting" },
  ],
  rowAction: { bulk: true },
  emptyHint: "Nothing waiting. New listings show up here when customers submit them.",
};
