export const WEGO_FEE_PCT  = 0.12;
export const WEGO_DISCOUNT = 0.85;
export const MIN_FARE      = 10.00;
export const BASE_STOP_FEE = 3.50;

export const UBER_BASE     = 1.35;
export const UBER_BOOKING  = 3.50;
export const UBER_PER_MILE = 1.25;
export const UBER_PER_MIN  = 0.22;
export const UBER_MIN_FARE = 7.00;

export type Region = "sf" | "peninsula" | "east_bay" | "south_bay" | "marin" | "north_bay" | "valley";

export const MINS_PER_MILE_BY_REGION: Record<Region, number> = {
  sf:        2.50,
  peninsula: 1.80,
  marin:     1.60,
  east_bay:  1.55,
  north_bay: 1.40,
  south_bay: 1.35,
  valley:    1.10,
};

const DEFAULT_MPM = 1.35; // south_bay default

export function classifyRegion(lat: number, lon: number): Region {
  if (lon > -121.55) return "valley";
  if (lat > 38.00) return "north_bay";
  if (lat > 37.85 && lon < -122.42) return "marin";
  if (lat > 37.85) return "east_bay";
  if (lat > 37.70 && lon < -122.35) return "sf";
  if (lat > 37.65 && lon > -122.28) return "east_bay";
  if (lat > 37.45 && lon > -122.18) return "east_bay";
  if (lat > 37.25 && lon < -122.05) return "peninsula";
  return "south_bay";
}

export interface BridgeToll { name: string; toll: number }

export function detectBridgeTolls(c1: [number, number], c2: [number, number]): BridgeToll[] {
  const r1 = classifyRegion(c1[0], c1[1]);
  const r2 = classifyRegion(c2[0], c2[1]);
  if (r1 === r2) return [];
  const pair = [r1, r2].sort().join("|");
  switch (pair) {
    case "east_bay|sf":        return [{ name: "Bay Bridge", toll: 7.00 }];
    case "marin|sf":
    case "north_bay|sf":       return [{ name: "Golden Gate Bridge", toll: 9.75 }];
    case "east_bay|marin":
    case "east_bay|north_bay": return [{ name: "Richmond–San Rafael Bridge", toll: 7.00 }];
    case "east_bay|valley":
    case "north_bay|valley":   return [{ name: "Carquinez Bridge", toll: 7.00 }];
    case "east_bay|peninsula": {
      const avgLat = (c1[0] + c2[0]) / 2;
      return [avgLat > 37.54 ? { name: "San Mateo Bridge", toll: 7.00 } : { name: "Dumbarton Bridge", toll: 7.00 }];
    }
    case "marin|peninsula":
    case "marin|south_bay":
    case "north_bay|peninsula":
    case "north_bay|south_bay": return [{ name: "Golden Gate Bridge", toll: 9.75 }];
    case "sf|valley":           return [{ name: "Bay Bridge", toll: 7.00 }, { name: "Carquinez Bridge", toll: 7.00 }];
    case "peninsula|valley":    return [{ name: "San Mateo Bridge", toll: 7.00 }, { name: "Carquinez Bridge", toll: 7.00 }];
    case "marin|valley":        return [{ name: "Golden Gate Bridge", toll: 9.75 }, { name: "Carquinez Bridge", toll: 7.00 }];
    default: return [];
  }
}

export function haversineStraight(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const straight = haversineStraight(lat1, lon1, lat2, lon2);
  const roadFactor = straight > 60 ? 1.38 : straight > 25 ? 1.25 : 1.15;
  return straight * roadFactor;
}

export function segmentMinsPerMile(p1: [number, number], p2: [number, number]): number {
  const r1 = MINS_PER_MILE_BY_REGION[classifyRegion(p1[0], p1[1])];
  const r2 = MINS_PER_MILE_BY_REGION[classifyRegion(p2[0], p2[1])];
  return (r1 + r2) / 2;
}

export function calcSegment(miles: number, minsPerMile = DEFAULT_MPM): { mins: number; uberX: number; fare: number } {
  const effectiveMpm = miles > 60 ? 1.05 : minsPerMile;
  const perMile      = miles > 60 ? 0.92 : UBER_PER_MILE;
  const mins  = Math.round(5 + miles * effectiveMpm);
  const uberX = Math.max(UBER_MIN_FARE, Math.round((UBER_BASE + UBER_BOOKING + miles * perMile + mins * UBER_PER_MIN) * 100) / 100);
  const fare  = Math.max(MIN_FARE, Math.round(uberX * WEGO_DISCOUNT * 100) / 100);
  return { mins, uberX, fare };
}

export function calcMultiRoute(points: [number, number][]): { miles: number; fare: number; mins: number; uberX: number; bridgeTolls: BridgeToll[] } {
  if (points.length < 2) return { miles: 0, fare: MIN_FARE, mins: 0, uberX: UBER_MIN_FARE, bridgeTolls: [] };

  let totalStraight = 0;
  let weightedMpm = 0;
  const seen = new Set<string>();
  const bridgeTolls: BridgeToll[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const segDist = haversineStraight(points[i][0], points[i][1], points[i+1][0], points[i+1][1]);
    totalStraight += segDist;
    weightedMpm   += segDist * segmentMinsPerMile(points[i], points[i + 1]);
    for (const t of detectBridgeTolls(points[i], points[i+1])) {
      if (!seen.has(t.name)) { seen.add(t.name); bridgeTolls.push(t); }
    }
  }

  const roadFactor  = totalStraight > 60 ? 1.38 : totalStraight > 25 ? 1.25 : 1.15;
  const miles       = Math.max(1, Math.round(totalStraight * roadFactor * 10) / 10);
  const minsPerMile = totalStraight > 0 ? weightedMpm / totalStraight : DEFAULT_MPM;
  const { mins, uberX, fare } = calcSegment(miles, minsPerMile);
  return { miles, fare, mins, uberX, bridgeTolls };
}
