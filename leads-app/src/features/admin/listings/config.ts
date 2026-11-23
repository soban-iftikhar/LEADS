import type { ResourceConfig } from "@/lib/admin/resource";

export const listingsConfig: ResourceConfig = {
  resource: "listings",
  title: "All listings",
  sub: "Properties customers want leads for",
  noun: "listing",
  columns: [
    { key: "property", label: "Property", type: "title", sort: "property" },
    { key: "customer", label: "Customer", type: "text", sort: "customer" },
    { key: "price", label: "Price", type: "money", sort: "price", right: true },
    { key: "status", label: "Status", type: "pill" },
  ],
  tabs: [
    { value: "all", label: "All" },
    { value: "live", label: "Live" },
    { value: "waiting", label: "Waiting" },
    { value: "info", label: "Needs info" },
    { value: "paused", label: "Paused" },
    { value: "closed", label: "Sold or rejected" },
  ],
  filter: {
    label: "Type",
    options: [
      { value: "house", label: "House" },
      { value: "plot", label: "Plot" },
      { value: "flat", label: "Flat" },
      { value: "commercial", label: "Commercial" },
    ],
  },
  canArchive: true,
  emptyHint: "Listings appear here when customers add them.",
};
