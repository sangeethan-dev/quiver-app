import { describe, expect, it, vi } from "vitest";
import { localTimestamp } from "@/lib/time";

function withOffset(date: Date, offsetMinutes: number): Date {
  vi.spyOn(date, "getTimezoneOffset").mockReturnValue(offsetMinutes);
  return date;
}

describe("localTimestamp", () => {
  it("matches the format in the brief", () => {
    expect(localTimestamp()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
  });

  it("describes the same moment when parsed back", () => {
    const date = new Date("2026-11-03T08:42:13.000Z");
    expect(new Date(localTimestamp(date)).getTime()).toBe(date.getTime());
  });

  it("formats offsets ahead of UTC, including half hours", () => {
    expect(localTimestamp(withOffset(new Date(), -330))).toMatch(/\+05:30$/);
  });

  it("formats offsets behind UTC", () => {
    expect(localTimestamp(withOffset(new Date(), 210))).toMatch(/-03:30$/);
  });

  it("writes UTC as +00:00", () => {
    expect(localTimestamp(withOffset(new Date(), 0))).toMatch(/\+00:00$/);
  });
});
