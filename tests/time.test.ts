import { describe, expect, it, vi } from "vitest";
import { formatDate, formatRelative, localTimestamp } from "@/lib/time";

describe("formatRelative", () => {
  const now = Date.parse("2026-11-20T12:00:00Z");
  const minutes = (count: number) => now - count * 60_000;

  it.each([
    [0, "just now"],
    [0.9, "just now"],
    [1, "1 min ago"],
    [2.9, "2 min ago"],
    [59, "59 min ago"],
    [60, "1 hr ago"],
    [23 * 60, "23 hr ago"],
    [24 * 60, "yesterday"],
    [3 * 24 * 60, "3 days ago"],
  ])("describes %s minutes", (count, expected) => {
    expect(formatRelative(minutes(count), now)).toBe(expected);
  });

  it("uses a date after a month", () => {
    expect(formatRelative(minutes(40 * 24 * 60), now)).toContain("2026");
  });

  it("calls a slightly future time just now, for clock differences", () => {
    expect(formatRelative(now + 5000, now)).toBe("just now");
  });
});

describe("formatDate", () => {
  it("formats a timestamp from a prompt file", () => {
    expect(formatDate("2026-11-03T14:12:00+05:30")).toContain("2026");
  });

  it("formats a file time", () => {
    expect(formatDate(Date.parse("2026-11-03T14:12:00Z"))).toContain("2026");
  });

  it("is empty for anything that isn't a date", () => {
    expect(formatDate("next tuesday")).toBe("");
    expect(formatDate("")).toBe("");
    expect(formatDate(undefined)).toBe("");
  });
});

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
