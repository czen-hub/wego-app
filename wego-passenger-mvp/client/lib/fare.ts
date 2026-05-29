// Pure fare calculation logic — no Firebase, no side effects.
// Keeping this separate means it can be tested without mocking anything.

export type RideType = "ride" | "courier" | "food";

export const COOP_FEE_PCT   = 0.12; // 12% goes to WeGo cooperative
export const DRIVER_TAKE_PCT = 0.88; // 88% goes to the driver
export const MINIMUM_FARE   = 7.00;

/**
 * Estimate fare from distance and ride type.
 * Always at least MINIMUM_FARE.
 */
export function estimateFare(distanceMiles: number, type: RideType = "ride"): number {
  const base    = type === "food" ? 3.0 : 2.5;
  const perMile = type === "ride" ? 1.85 : 1.65;
  const raw = base + distanceMiles * perMile;
  return Math.max(raw, MINIMUM_FARE);
}

/**
 * Split a fare into coop fee and driver take.
 * coopFee + driverTake === fare (rounded to cents).
 */
export function calcSplit(fare: number): { coopFee: number; driverTake: number } {
  const coopFee   = Math.round(fare * COOP_FEE_PCT * 100) / 100;
  const driverTake = Math.round((fare - coopFee) * 100) / 100;
  return { coopFee, driverTake };
}

/**
 * Format a distance in miles to a readable string.
 */
export function formatDistance(miles: number): string {
  if (miles < 0.1) return "< 0.1 mi";
  return `${miles.toFixed(1)} mi`;
}
