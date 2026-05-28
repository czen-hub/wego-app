import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, MapPin, Clock, Check, Calendar, ChevronRight, Shield, Info, AlertCircle } from "lucide-react";
import { createReservedRide } from "@/lib/db";
import { useAuth } from "@/context/AuthContext";

// ── Fare constants (mirrors RideRequest) ──────────────────────────────────────
const WEGO_FEE_PCT  = 0.12;
const WEGO_DISCOUNT = 0.85;
const MIN_FARE      = 10.00;
const MINS_PER_MILE = 1.35;
const ADVANCE_FEE   = 8.00;  // 100% to driver — commitment guarantee

const UBER_BASE     = 1.35;
const UBER_BOOKING  = 3.50;
const UBER_PER_MILE = 1.25;
const UBER_PER_MIN  = 0.22;
const UBER_MIN_FARE = 7.00;

const LOCATION_COORDS: Record<string, [number, number]> = {
  "Current Location":              [37.3541, -121.9552],
  "SFO Airport":                   [37.6213, -122.3790],
  "Downtown SF":                   [37.7880, -122.4074],
  "Oakland":                       [37.8044, -122.2712],
  "Jack London Square":            [37.7952, -122.2752],
  "Google Campus":                 [37.4220, -122.0841],
  "San Jose Airport (SJC)":        [37.3626, -121.9290],
  "San Jose Downtown":             [37.3382, -121.8863],
  "Berkeley BART Station":         [37.8699, -122.2680],
  "Stanford University":           [37.4275, -122.1697],
  "Apple Park":                    [37.3349, -122.0090],
  "Union Square":                  [37.7880, -122.4074],
  "Chase Center":                  [37.7680, -122.3877],
  "Downtown Oakland":              [37.8044, -122.2712],
  "Palo Alto Caltrain":            [37.4432, -122.1630],
};

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  const straight = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const roadFactor = straight > 60 ? 1.38 : straight > 25 ? 1.25 : 1.15;
  return straight * roadFactor;
}

async function geocode(query: string): Promise<{ label: string; sublabel: string; coords: [number, number] }[]> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + " CA")}&format=json&limit=5&countrycodes=us&bounded=1&viewbox=-124.0,39.8,-119.5,36.5`;
    const res = await fetch(url, { headers: { "Accept-Language": "en" } });
    const data = await res.json();
    return data.map((r: { display_name: string; lat: string; lon: string }) => {
      const parts = r.display_name.split(", ");
      return {
        label:    parts.slice(0, 2).join(", "),
        sublabel: parts.slice(2, 5).join(", "),
        coords:   [parseFloat(r.lat), parseFloat(r.lon)] as [number, number],
      };
    });
  } catch { return []; }
}

function calcFare(
  from: string,
  to: string,
  fromCoords?: [number, number] | null,
  toCoords?:   [number, number] | null,
): { miles: number; mins: number; wegoBase: number; uberX: number; total: number } {
  const c1 = fromCoords ?? LOCATION_COORDS[from] ?? LOCATION_COORDS["Current Location"];
  const c2 = toCoords   ?? LOCATION_COORDS[to]   ?? LOCATION_COORDS["Current Location"];
  const rawMiles = haversineDistance(c1[0], c1[1], c2[0], c2[1]);
  const miles = Math.max(1, Math.round(rawMiles * 10) / 10);
  const minsPerMile = miles > 60 ? 1.05 : MINS_PER_MILE;
  const perMile     = miles > 60 ? 0.92 : UBER_PER_MILE;
  const mins  = Math.round(5 + miles * minsPerMile);
  const uberX    = Math.max(UBER_MIN_FARE, Math.round((UBER_BASE + UBER_BOOKING + miles * perMile + mins * UBER_PER_MIN) * 100) / 100);
  const wegoBase = Math.max(MIN_FARE, Math.round(uberX * WEGO_DISCOUNT * 100) / 100);
  const total    = Math.round((wegoBase + ADVANCE_FEE) * 100) / 100;
  return { miles, mins, wegoBase, uberX, total };
}

// ── Date / time helpers ───────────────────────────────────────────────────────
const DAY_NAMES   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function generateDates() {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return {
      dayLabel:  i === 0 ? "Today" : i === 1 ? "Tomorrow" : DAY_NAMES[d.getDay()],
      dateLabel: `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`,
      value:     d.toISOString().split("T")[0],
    };
  });
}

const HOURS = Array.from({ length: 24 }, (_, h) => ({
  value: h,
  label: `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`,
}));
const MINUTES = [0, 15, 30, 45];

function formatTime(hour: number, minute: number) {
  const h = hour % 12 || 12;
  const ampm = hour < 12 ? "AM" : "PM";
  const m = minute.toString().padStart(2, "0");
  return `${h}:${m} ${ampm}`;
}

// Demand multiplier based on pickup hour — mirrors how Corp prices advance reservations
function demandMultiplier(hour: number): number {
  if (hour >= 0  && hour < 5)  return 0.78; // overnight — very low demand
  if (hour >= 5  && hour < 7)  return 0.88; // early morning
  if (hour >= 7  && hour < 10) return 1.00; // morning rush (base)
  if (hour >= 10 && hour < 16) return 0.93; // mid-day
  if (hour >= 16 && hour < 19) return 1.02; // evening rush
  if (hour >= 19 && hour < 22) return 0.95; // evening
  return 0.85;                               // late night (10pm–midnight)
}

const DATES = generateDates();

const QUICK_DESTINATIONS = [
  { label: "SFO Airport",       sublabel: "San Francisco Intl",   emoji: "✈️" },
  { label: "Downtown SF",       sublabel: "Market & 5th St",       emoji: "🏙️" },
  { label: "Oakland",           sublabel: "Jack London Square",    emoji: "🌉" },
  { label: "Google Campus",     sublabel: "Mountain View",         emoji: "🏢" },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function ReserveRide() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [selectedDate, setSelectedDate] = useState(DATES[0].value);
  const [selectedHour,   setSelectedHour]   = useState(8);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [pickup,        setPickup]        = useState("Current Location");
  const [destination,   setDestination]   = useState("");
  const [destCoords,    setDestCoords]    = useState<[number, number] | null>(null);
  const [destSuggestions, setDestSuggestions] = useState<{ label: string; sublabel: string; coords: [number, number] }[]>([]);
  const [destFocused,   setDestFocused]   = useState(false);
  const destBlurRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [confirmed,     setConfirmed]     = useState(false);
  const [submitError,   setSubmitError]   = useState<string | null>(null);
  const [submitting,    setSubmitting]    = useState(false);
  const [timeOpen,      setTimeOpen]      = useState(false);
  const [policyOpen,    setPolicyOpen]    = useState(false);
  const [bookingRef,    setBookingRef]    = useState("");

  // Live geocoding for destination
  useEffect(() => {
    if (destination.trim().length < 2) { setDestSuggestions([]); return; }
    if (LOCATION_COORDS[destination]) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      geocode(destination).then((results) => { if (!cancelled) setDestSuggestions(results); });
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [destination]);

  const selectedDateObj = DATES.find((d) => d.value === selectedDate)!;

  const { miles, mins, wegoBase, uberX, total } = useMemo(
    () => calcFare(pickup, destination || pickup, null, destCoords),
    [pickup, destination, destCoords],
  );

  const tod          = demandMultiplier(selectedHour);
  const adjWegoBase  = Math.round(wegoBase * tod * 100) / 100;
  const adjTotal     = Math.round((adjWegoBase + ADVANCE_FEE) * 100) / 100;
  const driverTake   = Math.round((adjWegoBase * (1 - WEGO_FEE_PCT) + ADVANCE_FEE) * 100) / 100;
  const coopFee      = Math.round(adjWegoBase * WEGO_FEE_PCT * 100) / 100;
  const uberPriority = Math.round(uberX * tod * 1.04 * 100) / 100;
  const uberSaver    = Math.round(uberX * tod * 0.835 * 100) / 100;

  const handleConfirm = async () => {
    if (!destination.trim() || !user) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const docRef = await createReservedRide({
        passengerId: user.uid,
        passengerName: profile?.name || user.displayName || "Passenger",
        pickupAddress: pickup,
        dropoffAddress: destination,
        fare: adjTotal,
        scheduledDate: selectedDate,
        scheduledHour: selectedHour,
        scheduledMinute: selectedMinute,
        pickupCoords: LOCATION_COORDS[pickup] ?? null,
        dropoffCoords: destCoords,
      });
      setBookingRef(docRef.id.slice(0, 8).toUpperCase());
      setConfirmed(true);
    } catch {
      setSubmitError("Failed to reserve ride. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Confirmation screen ──────────────────────────────────────────────────────
  if (confirmed) {
    return (
      <div className="min-h-full bg-background flex flex-col items-center justify-center px-4 py-10 space-y-5">
        <div className="w-20 h-20 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center">
          <Check size={36} className="text-primary" />
        </div>
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Ride Reserved!</h1>
          <p className="text-muted-foreground text-sm">Your driver will be notified in advance</p>
        </div>

        <div className="w-full bg-card border border-border rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Booking Confirmation</p>
          <div className="space-y-2.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Reference</span>
              <span className="font-bold text-primary font-mono tracking-wider">{bookingRef}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Date</span>
              <span className="font-semibold text-foreground">{selectedDateObj.dayLabel}, {selectedDateObj.dateLabel}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Pickup time</span>
              <span className="font-semibold text-foreground">{formatTime(selectedHour, selectedMinute)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">From</span>
              <span className="font-semibold text-foreground text-right max-w-[55%] truncate">{pickup}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">To</span>
              <span className="font-semibold text-foreground text-right max-w-[55%] truncate">{destination}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-border/50 pt-2">
              <span className="text-muted-foreground">Base fare</span>
              <span className="font-semibold text-foreground">${wegoBase.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Advance booking fee</span>
              <span className="font-semibold text-foreground">${ADVANCE_FEE.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-border/50 pt-2">
              <span className="text-muted-foreground font-semibold">Total charged</span>
              <span className="font-bold text-foreground">${adjTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Post-booking policy reminder */}
        <div className="w-full bg-primary/5 border border-primary/15 rounded-xl px-4 py-3 space-y-1.5 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground text-[11px] uppercase tracking-wide flex items-center gap-1.5">
            <Shield size={11} className="text-primary" /> Your booking is protected
          </p>
          <p>• Free cancellation up to <span className="text-foreground font-semibold">1 hour before pickup</span> — full refund.</p>
          <p>• Driver matched and confirmed <span className="text-foreground font-semibold">1 hour before</span> your pickup time.</p>
          <p>• Price locked at <span className="text-foreground font-semibold">${adjTotal.toFixed(2)}</span> — no surge, no changes.</p>
          <p>• Late cancellation fees go <span className="text-foreground font-semibold">100% to your driver</span>, never to WeGo.</p>
        </div>

        <button type="button" onClick={() => navigate("/")}
          className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-lg active:scale-95 transition-transform">
          Back to Home
        </button>
      </div>
    );
  }

  // ── Booking screen ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-full bg-background flex flex-col">
      <div className="px-4 pt-4 pb-2 flex items-center gap-3 flex-shrink-0">
        <button type="button" onClick={() => navigate("/")} aria-label="Back"
          className="w-9 h-9 rounded-xl bg-secondary border border-border flex items-center justify-center flex-shrink-0">
          <ChevronLeft size={18} className="text-foreground" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reserve a Ride</h1>
          <p className="text-xs text-muted-foreground">Schedule up to 7 days in advance</p>
        </div>
      </div>

      <div className="flex-1 px-4 pb-6 space-y-5 pt-2 overflow-y-auto">

        {/* Date selector */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Calendar size={13} className="text-muted-foreground" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pickup Date</p>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {DATES.map((d) => (
              <button key={d.value} type="button" onClick={() => setSelectedDate(d.value)}
                className={`flex-shrink-0 flex flex-col items-center px-4 py-3 rounded-xl border transition-colors active:scale-95 min-w-[72px] ${selectedDate === d.value ? "bg-primary border-primary text-white" : "bg-card border-border text-foreground"}`}>
                <span className={`text-[10px] font-semibold uppercase tracking-wide ${selectedDate === d.value ? "text-white/70" : "text-muted-foreground"}`}>{d.dayLabel}</span>
                <span className="text-sm font-bold mt-0.5">{d.dateLabel}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Time selector */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <button type="button" onClick={() => setTimeOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3.5 text-left">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-primary flex-shrink-0" />
              <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Pickup Time</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-foreground">{formatTime(selectedHour, selectedMinute)}</span>
              <ChevronRight size={14} className={`text-muted-foreground transition-transform flex-shrink-0 ${timeOpen ? "rotate-90" : ""}`} />
            </div>
          </button>

          {timeOpen && (
            <div className="px-4 pb-4 space-y-5 border-t border-border/50 pt-4">
              {/* Big live display */}
              <div className="flex items-baseline justify-center gap-2">
                <span className="text-5xl font-bold text-foreground tabular-nums tracking-tight">
                  {(selectedHour % 12 || 12).toString().padStart(2, "0")}:{selectedMinute.toString().padStart(2, "0")}
                </span>
                <span className="text-xl font-bold text-primary">{selectedHour < 12 ? "AM" : "PM"}</span>
              </div>

              {/* Hour slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Hour</span>
                  <span className="text-sm font-bold text-primary">{selectedHour % 12 || 12} {selectedHour < 12 ? "AM" : "PM"}</span>
                </div>
                <input
                  type="range"
                  aria-label="Pickup hour"
                  min={0}
                  max={23}
                  step={1}
                  value={selectedHour}
                  onChange={(e) => setSelectedHour(Number(e.target.value))}
                  className="w-full h-2 rounded-full accent-primary cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground select-none">
                  <span>12 AM</span>
                  <span>6 AM</span>
                  <span>12 PM</span>
                  <span>6 PM</span>
                  <span>11 PM</span>
                </div>
              </div>

              {/* Minute slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Minute</span>
                  <span className="text-sm font-bold text-primary">:{selectedMinute.toString().padStart(2, "0")}</span>
                </div>
                <input
                  type="range"
                  aria-label="Pickup minute"
                  min={0}
                  max={55}
                  step={5}
                  value={selectedMinute}
                  onChange={(e) => setSelectedMinute(Number(e.target.value))}
                  className="w-full h-2 rounded-full accent-primary cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground select-none">
                  <span>:00</span>
                  <span>:15</span>
                  <span>:30</span>
                  <span>:45</span>
                  <span>:55</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Destination */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <MapPin size={13} className="text-muted-foreground" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Destination</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex gap-3 items-start">
              <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-1">
                <div className="w-3 h-3 rounded-full bg-primary" />
                <div className="w-px h-8 bg-border" />
                <div className="w-3 h-3 rounded-full border-2 border-foreground" />
              </div>
              <div className="space-y-3 flex-1 min-w-0">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Pickup</p>
                  <input type="text" placeholder="Current Location" value={pickup}
                    onChange={(e) => setPickup(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary" />
                </div>
                <div className="relative">
                  <p className="text-xs text-muted-foreground mb-1">Dropoff</p>
                  <input
                    type="text"
                    placeholder="Where to?"
                    value={destination}
                    onChange={(e) => { setDestination(e.target.value); setDestCoords(null); }}
                    onFocus={() => { if (destBlurRef.current) clearTimeout(destBlurRef.current); setDestFocused(true); }}
                    onBlur={() => { destBlurRef.current = setTimeout(() => setDestFocused(false), 150); }}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                  {/* Autocomplete dropdown */}
                  {destFocused && (destination.trim().length >= 2 || !destination) && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-xl z-30 overflow-hidden">
                      {/* Quick picks when empty */}
                      {!destination.trim() && QUICK_DESTINATIONS.map((dest) => (
                        <button key={dest.label} type="button"
                          onMouseDown={() => { setDestination(dest.label); setDestCoords(LOCATION_COORDS[dest.label] ?? null); setDestFocused(false); }}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 text-left border-b border-border/30 last:border-0">
                          <span className="text-base">{dest.emoji}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{dest.label}</p>
                            <p className="text-xs text-muted-foreground truncate">{dest.sublabel}</p>
                          </div>
                        </button>
                      ))}
                      {/* Live geocode results */}
                      {destination.trim().length >= 2 && destSuggestions.map((s, i) => (
                        <button key={i} type="button"
                          onMouseDown={() => { setDestination(s.label); setDestCoords(s.coords); setDestFocused(false); }}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 text-left border-b border-border/30 last:border-0">
                          <div className="w-8 h-8 rounded-xl bg-secondary border border-border flex items-center justify-center flex-shrink-0">
                            <MapPin size={13} className="text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{s.label}</p>
                            <p className="text-xs text-muted-foreground truncate">{s.sublabel}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Fare card */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3">
          <div className="flex items-start justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estimated Fare</p>
            <div className="flex items-center gap-1 text-xs text-primary font-semibold">
              <Shield size={11} /> No surge — ever
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-4xl font-bold text-foreground whitespace-nowrap">${adjTotal.toFixed(2)}</p>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">{miles} mi · ~{mins} min ride</p>
              {tod < 0.90 && (
                <span className="text-[10px] font-semibold text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">
                  Off-peak rate
                </span>
              )}
              {tod > 1.00 && (
                <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  Peak rate
                </span>
              )}
            </div>
          </div>

          {/* Competitor comparison */}
          {destination.trim() && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="bg-background/60 border border-border rounded-lg px-3 py-2 text-center">
                <p className="text-[10px] text-muted-foreground font-semibold">Corp Priority</p>
                <p className="text-base font-bold text-muted-foreground line-through">${uberPriority.toFixed(2)}</p>
                <p className="text-[9px] text-muted-foreground/60">Fixed · cancel &lt;1hr</p>
              </div>
              <div className="bg-background/60 border border-border rounded-lg px-3 py-2 text-center">
                <p className="text-[10px] text-muted-foreground font-semibold">Corp Saver</p>
                <p className="text-base font-bold text-muted-foreground line-through">${uberSaver.toFixed(2)}</p>
                <p className="text-[9px] text-muted-foreground/60">Non-refundable · 10-min window</p>
              </div>
            </div>
          )}

          {/* Fare breakdown */}
          <div className="space-y-1.5 pt-2 border-t border-border/40">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Base fare</span>
              <span>${adjWegoBase.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Advance booking fee <span className="text-primary font-semibold">(100% to driver)</span></span>
              <span>${ADVANCE_FEE.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-xs border-t border-border/30 pt-1.5">
              <span className="text-foreground font-semibold">Driver earns <span className="text-primary">${driverTake.toFixed(2)}</span></span>
              <span className="text-muted-foreground">WeGo coop ${coopFee.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Policy / disclaimer */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <button type="button" onClick={() => setPolicyOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-left">
            <div className="flex items-center gap-2">
              <AlertCircle size={14} className="text-primary flex-shrink-0" />
              <span className="text-sm font-semibold text-foreground">WeGo Reserve — cancellation policy</span>
            </div>
            <ChevronRight size={14} className={`text-muted-foreground transition-transform flex-shrink-0 ${policyOpen ? "rotate-90" : ""}`} />
          </button>

          {policyOpen && (
            <div className="px-4 pb-4 space-y-3 border-t border-border/50">
              {/* Free window */}
              <div className="space-y-1 pt-3">
                <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Free cancellation — up to 1 hour before pickup
                </p>
                <p className="text-xs text-muted-foreground pl-3.5">Full refund, no questions asked. Cancel in the app any time before the 1-hour window closes.</p>
              </div>

              {/* Late cancel fees */}
              <div className="space-y-1">
                <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground inline-block" /> Late cancellation — inside 1-hour window
                </p>
                <div className="pl-3.5 space-y-1 text-xs text-muted-foreground">
                  <div className="flex justify-between"><span>Driver nearby (&lt;5 mi en route)</span><span className="text-foreground font-medium">$5.00</span></div>
                  <div className="flex justify-between"><span>Driver 5–10 mi en route</span><span className="text-foreground font-medium">$9.00</span></div>
                  <div className="flex justify-between"><span>Driver 10+ mi en route</span><span className="text-foreground font-medium">$14.00</span></div>
                  <div className="flex justify-between"><span>Driver arrived at pickup</span><span className="text-foreground font-medium">$14 + $0.50/min waiting</span></div>
                  <p className="text-primary font-semibold pt-1">100% of cancellation fees go to your driver. WeGo keeps none of it.</p>
                </div>
              </div>

              {/* vs Corp */}
              <div className="bg-muted/20 rounded-lg p-3 space-y-1.5 text-xs">
                <p className="font-semibold text-foreground text-[11px] uppercase tracking-wide flex items-center gap-1">
                  <Info size={10} /> How WeGo compares
                </p>
                <div className="space-y-1 text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Corp Priority</span>
                    <span className="text-right">Fixed price · free cancel &lt;1hr · <span className="text-red-400">~38% more expensive</span></span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span>Corp Saver</span>
                    <span className="text-right"><span className="text-red-400">Non-refundable</span> · 10-min pickup window</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-primary font-semibold">WeGo Reserve</span>
                    <span className="text-right text-primary font-semibold">Fixed price · free cancel &lt;1hr · lowest fare</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Booking summary */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Booking Summary</p>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date</span>
              <span className="font-semibold text-foreground">{selectedDateObj.dayLabel}, {selectedDateObj.dateLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Time</span>
              <span className="font-semibold text-foreground">{formatTime(selectedHour, selectedMinute)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">To</span>
              <span className="font-semibold text-foreground truncate max-w-[55%] text-right">{destination || "—"}</span>
            </div>
            {destination && (
              <div className="flex justify-between border-t border-border/50 pt-1.5">
                <span className="text-muted-foreground">Total</span>
                <span className="font-bold text-foreground">${adjTotal.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>

        {submitError && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 text-sm text-destructive font-medium">
            {submitError}
          </div>
        )}
        <button type="button" onClick={handleConfirm} disabled={!destination.trim() || submitting}
          className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-lg active:scale-95 transition-transform shadow-lg shadow-primary/30 disabled:opacity-40">
          {submitting ? "Booking…" : `Book for ${selectedDateObj.dayLabel} at ${formatTime(selectedHour, selectedMinute)}`}
        </button>
        <p className="text-xs text-center text-muted-foreground">Free cancellation up to 1 hour before pickup</p>
      </div>
    </div>
  );
}
