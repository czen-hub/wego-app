/**
 * FARE CALCULATION TESTS
 *
 * What is a test?
 *   A function that checks whether real code produces the expected output.
 *   If it does  → ✓ PASS (green)
 *   If it doesn't → ✗ FAIL (red) — something broke
 *
 * Structure of every test:
 *   describe("what we're testing")          ← groups related tests
 *     it("what it should do")               ← one specific scenario
 *       expect(actualValue).toBe(expected)  ← the assertion
 */

import { describe, it, expect } from "vitest";
import { estimateFare, calcSplit, formatDistance, MINIMUM_FARE } from "../fare";

// ─────────────────────────────────────────────
// estimateFare
// ─────────────────────────────────────────────
describe("estimateFare", () => {

  it("never goes below the $7 minimum fare", () => {
    // A 0.1 mile trip would be $2.50 + 0.185 = $2.685 — below minimum
    // estimateFare must return $7, not $2.685
    expect(estimateFare(0.1)).toBe(MINIMUM_FARE);
    expect(estimateFare(0)).toBe(MINIMUM_FARE);
  });

  it("calculates a standard ride correctly", () => {
    // 5 miles: base $2.50 + (5 × $1.85) = $2.50 + $9.25 = $11.75
    expect(estimateFare(5, "ride")).toBe(11.75);
  });

  it("calculates a food delivery correctly", () => {
    // Food has higher base ($3.00) but lower per-mile ($1.65)
    // 5 miles: $3.00 + (5 × $1.65) = $3.00 + $8.25 = $11.25
    expect(estimateFare(5, "food")).toBe(11.25);
  });

  it("courier and food have the same per-mile rate but different base fares", () => {
    // food base = $3.00, courier base = $2.50 — per-mile is the same ($1.65)
    // So the difference between any two distances is identical for both types
    const diff_food    = estimateFare(10, "food")    - estimateFare(5, "food");
    const diff_courier = estimateFare(10, "courier") - estimateFare(5, "courier");
    expect(diff_food).toBe(diff_courier); // same per-mile rate = same delta
  });

  it("defaults to ride type when none specified", () => {
    expect(estimateFare(5)).toBe(estimateFare(5, "ride"));
  });

  it("longer trips cost more", () => {
    expect(estimateFare(10)).toBeGreaterThan(estimateFare(5));
    expect(estimateFare(20)).toBeGreaterThan(estimateFare(10));
  });

});

// ─────────────────────────────────────────────
// calcSplit — the 88/12 split between driver and coop
// ─────────────────────────────────────────────
describe("calcSplit", () => {

  it("driver gets 88% and coop gets 12% of a $10 fare", () => {
    const { coopFee, driverTake } = calcSplit(10);
    expect(coopFee).toBe(1.20);
    expect(driverTake).toBe(8.80);
  });

  it("the two parts always add back to the original fare", () => {
    // This is the most important invariant — no money disappears or is created
    const fare = 15.50;
    const { coopFee, driverTake } = calcSplit(fare);
    expect(coopFee + driverTake).toBe(fare);
  });

  it("works correctly on the minimum fare", () => {
    const { coopFee, driverTake } = calcSplit(7);
    expect(coopFee).toBe(0.84);
    expect(driverTake).toBe(6.16);
    expect(coopFee + driverTake).toBe(7);
  });

  it("driver always earns more than the coop", () => {
    const { coopFee, driverTake } = calcSplit(25);
    expect(driverTake).toBeGreaterThan(coopFee);
  });

});

// ─────────────────────────────────────────────
// formatDistance — display helper
// ─────────────────────────────────────────────
describe("formatDistance", () => {

  it("shows '< 0.1 mi' for very short distances", () => {
    expect(formatDistance(0.05)).toBe("< 0.1 mi");
  });

  it("rounds to 1 decimal place", () => {
    expect(formatDistance(5.2567)).toBe("5.3 mi");
    expect(formatDistance(1.0)).toBe("1.0 mi");
  });

});
