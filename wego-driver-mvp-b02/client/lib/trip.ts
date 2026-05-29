export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatTime(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// Returns the meter charge accrued for an advanced booking wait.
// Cap is $1.00 at $0.50/min after the free window.
export function calcWaitCharge(waitSecs: number, isAdvanced: boolean): number {
  if (!isAdvanced) return 0;
  const freeWindow = 480; // 8 min
  const meterSecs = Math.max(0, waitSecs - freeWindow);
  return parseFloat(Math.min((meterSecs / 60) * 0.50, 1.00).toFixed(2));
}
