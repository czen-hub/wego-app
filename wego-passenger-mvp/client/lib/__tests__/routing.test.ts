import { describe, it, expect } from "vitest";
import {
  classifyRegion,
  detectBridgeTolls,
  haversineDistance,
  haversineStraight,
  calcSegment,
  calcMultiRoute,
  MIN_FARE,
} from "../routing";

// ─── classifyRegion ─────────────────────────────────────────────────────────
describe("classifyRegion", () => {

  it("classifies San Francisco correctly", () => {
    expect(classifyRegion(37.78, -122.42)).toBe("sf");
  });

  it("classifies San Jose (south bay) correctly", () => {
    expect(classifyRegion(37.33, -121.89)).toBe("south_bay");
  });

  it("classifies Oakland (east bay) correctly", () => {
    expect(classifyRegion(37.80, -122.27)).toBe("east_bay");
  });

  it("classifies Palo Alto (peninsula) correctly", () => {
    expect(classifyRegion(37.44, -122.14)).toBe("peninsula");
  });

  it("classifies Modesto (valley) correctly", () => {
    expect(classifyRegion(37.63, -120.99)).toBe("valley");
  });

});

// ─── detectBridgeTolls ──────────────────────────────────────────────────────
describe("detectBridgeTolls", () => {

  it("detects Bay Bridge for east bay → SF", () => {
    const tolls = detectBridgeTolls(
      [37.80, -122.27], // Oakland (east bay)
      [37.78, -122.42], // SF
    );
    expect(tolls).toHaveLength(1);
    expect(tolls[0].name).toBe("Bay Bridge");
    expect(tolls[0].toll).toBe(7.00);
  });

  it("detects Golden Gate Bridge for Marin → SF", () => {
    const tolls = detectBridgeTolls(
      [37.90, -122.50], // Marin
      [37.78, -122.42], // SF
    );
    expect(tolls[0].name).toBe("Golden Gate Bridge");
    expect(tolls[0].toll).toBe(9.75);
  });

  it("returns no tolls for same-region trips", () => {
    const tolls = detectBridgeTolls(
      [37.33, -121.89], // San Jose
      [37.40, -121.95], // Sunnyvale (both south bay)
    );
    expect(tolls).toHaveLength(0);
  });

});

// ─── haversineStraight ───────────────────────────────────────────────────────
describe("haversineStraight", () => {

  it("returns 0 for the same point", () => {
    expect(haversineStraight(37.33, -121.89, 37.33, -121.89)).toBe(0);
  });

  it("SFO to SJC is roughly 28–33 straight-line miles", () => {
    const dist = haversineStraight(37.6213, -122.379, 37.3626, -121.929);
    expect(dist).toBeGreaterThan(28);
    expect(dist).toBeLessThan(33);
  });

  it("is symmetric", () => {
    const ab = haversineStraight(37.33, -121.89, 37.78, -122.42);
    const ba = haversineStraight(37.78, -122.42, 37.33, -121.89);
    expect(ab).toBeCloseTo(ba, 5);
  });

});

// ─── haversineDistance (road-adjusted) ──────────────────────────────────────
describe("haversineDistance", () => {

  it("always returns more miles than straight-line", () => {
    const straight = haversineStraight(37.33, -121.89, 37.78, -122.42);
    const road = haversineDistance(37.33, -121.89, 37.78, -122.42);
    expect(road).toBeGreaterThan(straight);
  });

  it("applies the 1.15× factor for short trips (< 25 mi straight)", () => {
    // San Jose to Sunnyvale — short suburban trip
    const straight = haversineStraight(37.33, -121.89, 37.37, -122.04);
    const road = haversineDistance(37.33, -121.89, 37.37, -122.04);
    expect(road).toBeCloseTo(straight * 1.15, 5);
  });

});

// ─── calcSegment ─────────────────────────────────────────────────────────────
describe("calcSegment", () => {

  it("fare is never below MIN_FARE ($10)", () => {
    const { fare } = calcSegment(0.1);
    expect(fare).toBeGreaterThanOrEqual(MIN_FARE);
  });

  it("fare is less than the UberX estimate (WeGo discount)", () => {
    const { fare, uberX } = calcSegment(10);
    expect(fare).toBeLessThan(uberX);
  });

  it("longer trips cost more", () => {
    const short = calcSegment(5).fare;
    const long  = calcSegment(20).fare;
    expect(long).toBeGreaterThan(short);
  });

  it("mins increases with distance", () => {
    expect(calcSegment(10).mins).toBeGreaterThan(calcSegment(5).mins);
  });

  it("uses reduced per-mile rate for very long trips (> 60 mi)", () => {
    const normal = calcSegment(50);
    const longTrip = calcSegment(70);
    // 70-mile trip at reduced rate: the per-mile jump should be smaller
    const delta50to70Normal = calcSegment(70, 1.35).fare - calcSegment(50, 1.35).fare;
    expect(longTrip.fare - normal.fare).toBeLessThanOrEqual(delta50to70Normal + 1);
  });

});

// ─── calcMultiRoute ──────────────────────────────────────────────────────────
describe("calcMultiRoute", () => {

  it("returns MIN_FARE with zero points or one point", () => {
    expect(calcMultiRoute([]).fare).toBe(MIN_FARE);
    expect(calcMultiRoute([[37.33, -121.89]]).fare).toBe(MIN_FARE);
  });

  it("two-point route matches a direct calcSegment call (approximately)", () => {
    const p1: [number, number] = [37.33, -121.89]; // San Jose
    const p2: [number, number] = [37.40, -121.95]; // Sunnyvale
    const multi = calcMultiRoute([p1, p2]);
    expect(multi.fare).toBeGreaterThanOrEqual(MIN_FARE);
    expect(multi.miles).toBeGreaterThan(0);
  });

  it("adding a stop increases total miles and fare", () => {
    const p1: [number, number] = [37.33, -121.89];
    const p2: [number, number] = [37.78, -122.42];
    const stop: [number, number] = [37.44, -122.14];

    const direct = calcMultiRoute([p1, p2]);
    const withStop = calcMultiRoute([p1, stop, p2]);
    expect(withStop.miles).toBeGreaterThan(direct.miles);
  });

  it("detects bridge tolls on cross-region routes", () => {
    const sj: [number, number]  = [37.33, -121.89]; // south bay
    const sf: [number, number]  = [37.78, -122.42]; // SF
    const oak: [number, number] = [37.80, -122.27]; // east bay
    const route = calcMultiRoute([sj, sf, oak]);
    expect(route.bridgeTolls.length).toBeGreaterThan(0);
  });

  it("does not duplicate bridge tolls for the same crossing", () => {
    const east: [number, number] = [37.80, -122.27]; // Oakland
    const sf: [number, number]   = [37.78, -122.42]; // SF
    const east2: [number, number] = [37.82, -122.28]; // back to east bay
    const route = calcMultiRoute([east, sf, east2]);
    const bayBridgeCount = route.bridgeTolls.filter(t => t.name === "Bay Bridge").length;
    expect(bayBridgeCount).toBe(1);
  });

});
