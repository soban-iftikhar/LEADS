import { describe, expect, it } from "vitest";
import { activeItem, ADMIN_NAV, crumbFor } from "./nav";

describe("admin nav", () => {
  it("picks the most specific item", () => {
    expect(activeItem("/admin/listings/review")?.item.label).toBe("Review queue");
    expect(activeItem("/admin/listings")?.item.label).toBe("All listings");
    expect(activeItem("/admin/settings/team")?.item.label).toBe("Team");
    expect(activeItem("/admin/settings")?.item.label).toBe("General");
  });

  it("matches the overview only on /admin itself", () => {
    expect(activeItem("/admin")?.item.label).toBe("Overview");
    expect(activeItem("/admin/unknown")).toBeNull();
  });

  it("names the group and page for the breadcrumb", () => {
    expect(crumbFor("/admin/crawlers/sources")).toEqual({ group: "Crawlers", page: "Sources" });
  });

  it("has eight groups with unique links", () => {
    expect(ADMIN_NAV).toHaveLength(8);
    const hrefs = ADMIN_NAV.flatMap((g) => g.items.map((i) => i.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs).toHaveLength(23);
  });
});
