import type { ResourceConfig } from "@/lib/admin/resource";

const KINDS = [
  { value: "SECTOR", label: "Sector" },
  { value: "SOCIETY", label: "Society" },
  { value: "AREA", label: "Area" },
];

export const areasConfig: ResourceConfig = {
  resource: "areas",
  title: "Areas",
  sub: "Where we crawl and run campaigns",
  noun: "area",
  columns: [
    { key: "area", label: "Area", type: "title", sort: "area" },
    { key: "kind", label: "Type", type: "pill" },
    { key: "price", label: "Price / marla (Lac)", type: "text", right: true },
    { key: "listings", label: "Listings", type: "num", sort: "listings", right: true },
    { key: "status", label: "Status", type: "pill" },
  ],
  tabs: [
    { value: "all", label: "All" },
    { value: "active", label: "Active" },
    { value: "off", label: "Off" },
  ],
  filter: { label: "Type", options: KINDS.map((k) => ({ value: k.value.toLowerCase(), label: k.label })) },
  fields: [
    { key: "name", label: "Area name", kind: "text", required: true },
    { key: "regionId", label: "City", kind: "select", required: true },
    { key: "kind", label: "Type", kind: "select", options: KINDS },
    { key: "status", label: "Status", kind: "select", options: [{ value: "active", label: "Active" }, { value: "off", label: "Off" }], hint: "Off: no crawling or campaigns here." },
  ],
  addLabel: "Add area",
  canEdit: true,
  canArchive: true,
};
