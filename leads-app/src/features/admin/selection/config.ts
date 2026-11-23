import type { ResourceConfig } from "@/lib/admin/resource";

export const selectionConfig: ResourceConfig = {
  resource: "selection",
  title: "Selection",
  sub: "Scraped properties ranked for outreach",
  noun: "property",
  columns: [
    { key: "property", label: "Property", type: "title", sort: "property" },
    { key: "price", label: "Price", type: "money", sort: "price", right: true },
    { key: "vs", label: "vs median", type: "text", sort: "vs", right: true },
    { key: "score", label: "Score", type: "num", sort: "score", right: true },
    { key: "status", label: "Status", type: "pill" },
  ],
  tabs: [
    { value: "all", label: "All" },
    { value: "new", label: "New" },
    { value: "invited", label: "Invited" },
  ],
  filter: { label: "Area", options: [] },
  canArchive: true,
  rowAction: { bulk: true },
  emptyHint: "Properties appear here after the next crawl.",
};
