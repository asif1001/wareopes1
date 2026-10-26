import { describe, expect, it } from "vitest";
import { parseContractorSheet, toLocalDate } from "@/lib/attendance/sheet";

describe("contractor sheet parsing", () => {
  it("reads common date formats", () => {
    expect(toLocalDate("2026-11-02")).toBe("2026-11-02");
    expect(toLocalDate("02/11/2026")).toBe("2026-11-02");
    expect(toLocalDate("2-Nov-2026")).toBe("2026-11-02");
    expect(toLocalDate(46328)).toBe("2026-11-02");
    expect(toLocalDate(new Date(2026, 10, 2))).toBe("2026-11-02");
    expect(toLocalDate("rubbish")).toBeNull();
  });

  it("reads a long sheet with flexible headers", () => {
    const result = parseContractorSheet(
      [
        { "Emp Code": "AC-1", Date: "02/11/2026", Status: "P", "Normal Hours": "9", "OT Hours": "2:30" },
        { "Emp Code": "AC-1", Date: "03/11/2026", Status: "A", "Normal Hours": "0", "OT Hours": "" },
        { "Emp Code": "", Date: "03/11/2026", Status: "P" },
      ],
      "2026-11",
    );
    expect(result.layout).toBe("long");
    expect(result.skipped).toBe(1);
    expect(result.rows).toEqual([
      { staffCode: "AC-1", date: "2026-11-02", status: "P", hours: 9, otHours: 2.5 },
      { staffCode: "AC-1", date: "2026-11-03", status: "A", hours: 0, otHours: null },
    ]);
  });

  it("reads a grid sheet with one column per day", () => {
    const result = parseContractorSheet([{ "Staff ID": "AC-2", Name: "Sara", "1": "P", "2": 8, "3": "A", "4": "" }], "2026-11");
    expect(result.layout).toBe("grid");
    expect(result.rows).toEqual([
      { staffCode: "AC-2", date: "2026-11-01", status: "P" },
      { staffCode: "AC-2", date: "2026-11-02", hours: 8, status: "P" },
      { staffCode: "AC-2", date: "2026-11-03", status: "A" },
    ]);
  });

  it("reports an unknown layout", () => {
    expect(parseContractorSheet([{ foo: 1 }], "2026-11").layout).toBe("unknown");
  });
});
