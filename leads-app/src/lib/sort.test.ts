import { describe, expect, it } from "vitest";
import { ariaSort, formatSort, nextSort, orderFor, parseSort } from "./sort";

describe("sort", () => {
  it("reads only whitelisted keys", () => {
    expect(parseSort("price.desc", ["price"])).toEqual({ key: "price", dir: "desc" });
    expect(parseSort("price.up", ["price"])).toBeNull();
    expect(parseSort("password.asc", ["price"])).toBeNull();
    expect(parseSort("price;drop.asc", ["price"])).toBeNull();
    expect(parseSort(undefined, ["price"])).toBeNull();
  });

  it("cycles asc → desc → off, and restarts on a new column", () => {
    const a = nextSort(null, "price");
    expect(a).toEqual({ key: "price", dir: "asc" });
    const d = nextSort(a, "price");
    expect(d).toEqual({ key: "price", dir: "desc" });
    expect(nextSort(d, "price")).toBeNull();
    expect(nextSort(d, "name")).toEqual({ key: "name", dir: "asc" });
  });

  it("formats for the URL and for aria-sort", () => {
    expect(formatSort({ key: "name", dir: "asc" })).toBe("name.asc");
    expect(formatSort(null)).toBeNull();
    expect(ariaSort({ key: "name", dir: "desc" }, "name")).toBe("descending");
    expect(ariaSort({ key: "name", dir: "desc" }, "price")).toBe("none");
  });

  it("maps to the query ordering with a tie-breaker", () => {
    type Order = Record<string, "asc" | "desc">;
    const map: Record<string, (dir: "asc" | "desc") => Order> = { price: (dir) => ({ price: dir }) };
    expect(orderFor("price.desc", map, { created: "desc" }, { id: "asc" })).toEqual([{ price: "desc" }, { id: "asc" }]);
    expect(orderFor("nope.asc", map, { created: "desc" }, { id: "asc" })).toEqual([{ created: "desc" }, { id: "asc" }]);
  });
});
