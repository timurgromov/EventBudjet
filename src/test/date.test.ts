import { describe, expect, it } from "vitest";

import { formatDateOnly, parseDateOnly } from "@/lib/date";

describe("date helpers", () => {
  it("formats selected calendar date as YYYY-MM-DD for backend", () => {
    const value = new Date(2026, 2, 25);

    expect(formatDateOnly(value)).toBe("2026-03-25");
  });

  it("parses backend YYYY-MM-DD without timezone shift", () => {
    const parsed = parseDateOnly("2026-03-25");

    expect(parsed).toBeDefined();
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(2);
    expect(parsed?.getDate()).toBe(25);
  });

  it("returns undefined for empty date", () => {
    expect(formatDateOnly(undefined)).toBe("");
    expect(parseDateOnly(undefined)).toBeUndefined();
  });
});
