import { describe, expect, it } from "vitest";
import { listQuery, parseListParams } from "./resource";

describe("list params", () => {
  it("reads the URL and falls back on bad values", () => {
    expect(parseListParams({ q: "  g-13 ", tab: "archived", filter: "agency", sort: "price.desc", page: "3" })).toEqual({ q: "g-13", tab: "archived", filter: "agency", sort: "price.desc", page: 3 });
    expect(parseListParams({ tab: "<script>", filter: "a b", sort: "price;drop", page: "-2" })).toEqual({ q: "", tab: "all", filter: "all", sort: undefined, page: 1 });
    expect(parseListParams({ q: ["a", "b"] }).q).toBe("a");
  });

  it("writes only what differs from the defaults", () => {
    expect(listQuery({ q: "", tab: "all", filter: "all", page: 1 })).toBe("");
    expect(listQuery({ q: "dha", tab: "archived", sort: "name.asc", page: 2 })).toBe("q=dha&tab=archived&sort=name.asc&page=2");
  });
});
