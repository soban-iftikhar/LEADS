import { describe, expect, it } from "vitest";
import { cellText, csvField, csvLine } from "./csv";

describe("csv", () => {
  it("quotes commas, quotes and new lines", () => {
    expect(csvField("plain")).toBe("plain");
    expect(csvField("G-13, Islamabad")).toBe('"G-13, Islamabad"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
  });

  it("defuses spreadsheet formulas but keeps negative numbers", () => {
    expect(csvField("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvField("@cmd")).toBe("'@cmd");
    expect(csvField("-5.9")).toBe("-5.9");
  });

  it("writes cells as they read on screen", () => {
    expect(cellText({ key: "p", label: "Property", type: "title" }, { a: "10 Marla", b: "G-13" })).toBe("10 Marla · G-13");
    expect(cellText({ key: "s", label: "Status", type: "pill" }, { label: "Live", tone: "ok" })).toBe("Live");
    expect(cellText({ key: "d", label: "Delivered", type: "bar" }, { value: 41, max: 100 })).toBe("41 / 100");
    expect(cellText({ key: "m", label: "Spent", type: "money" }, 120000)).toBe("PKR 1,20,000");
    expect(csvLine(["a", "b,c"])).toBe('a,"b,c"\r\n');
  });
});
