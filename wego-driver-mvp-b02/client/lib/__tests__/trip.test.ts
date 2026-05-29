import { describe, it, expect } from "vitest";
import { haversineMeters, formatTime, calcWaitCharge } from "../trip";

describe("haversineMeters", () => {

  it("returns 0 for the same point", () => {
    expect(haversineMeters(37.354, -121.955, 37.354, -121.955)).toBe(0);
  });

  it("approximates 1 km within 5% (San Jose to ~1 km north)", () => {
    // Moving ~0.009° north ≈ 1 km
    const dist = haversineMeters(37.354, -121.955, 37.363, -121.955);
    expect(dist).toBeGreaterThan(950);
    expect(dist).toBeLessThan(1050);
  });

  it("SFO to SJC is roughly 45–55 km", () => {
    const dist = haversineMeters(37.6213, -122.3790, 37.3626, -121.9290);
    expect(dist).toBeGreaterThan(45_000);
    expect(dist).toBeLessThan(55_000);
  });

  it("is symmetric (A→B equals B→A)", () => {
    const ab = haversineMeters(37.354, -121.955, 37.620, -122.379);
    const ba = haversineMeters(37.620, -122.379, 37.354, -121.955);
    expect(ab).toBeCloseTo(ba, 5);
  });

});

describe("formatTime", () => {

  it("formats 0 seconds as 00:00", () => {
    expect(formatTime(0)).toBe("00:00");
  });

  it("formats 65 seconds as 01:05", () => {
    expect(formatTime(65)).toBe("01:05");
  });

  it("formats 3600 seconds (1 hour) as 60:00", () => {
    expect(formatTime(3600)).toBe("60:00");
  });

  it("pads single-digit seconds with a leading zero", () => {
    expect(formatTime(61)).toBe("01:01");
  });

});

describe("calcWaitCharge", () => {

  it("always returns 0 for a standard (non-advanced) booking", () => {
    expect(calcWaitCharge(0, false)).toBe(0);
    expect(calcWaitCharge(600, false)).toBe(0);
    expect(calcWaitCharge(9999, false)).toBe(0);
  });

  it("returns 0 while still within the 8-minute free window", () => {
    expect(calcWaitCharge(479, true)).toBe(0);
    expect(calcWaitCharge(480, true)).toBe(0);
  });

  it("charges $0.50/min after the free window", () => {
    // 2 minutes on meter = $1.00 (but capped at $1.00)
    expect(calcWaitCharge(480 + 60, true)).toBeCloseTo(0.50, 2);  // 1 min = $0.50
    expect(calcWaitCharge(480 + 120, true)).toBeCloseTo(1.00, 2); // 2 min = $1.00 (cap)
  });

  it("never exceeds the $1.00 cap regardless of wait time", () => {
    expect(calcWaitCharge(480 + 600, true)).toBe(1.00);
    expect(calcWaitCharge(9999, true)).toBe(1.00);
  });

});
