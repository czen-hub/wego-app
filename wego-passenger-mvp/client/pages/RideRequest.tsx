import { useState, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { MapPin, ChevronLeft, Clock, Shield, Info, Navigation } from "lucide-react";
import ClientMap from "@/components/ClientMap";
import { useCurrentLocation } from "@/hooks/useCurrentLocation";
import { requestRide } from "@/lib/db";
import { useAuth } from "@/context/AuthContext";

const WEGO_FEE_PCT = 0.12;
const BASE_FARE = 2.50;
const BOOKING_FEE = 2.00;
const RATE_PER_MILE = 1.25;
const RATE_PER_MIN = 0.20;
const MIN_FARE = 10.00;
const MINS_PER_MILE = 1.35;

// Approximate lat/lng for known Bay Area locations
const LOCATION_COORDS: Record<string, [number, number]> = {
  "Current Location":              [37.7749, -122.4194],
  "San Jose Airport (SJC)":        [37.3626, -121.9290],
  "San Jose Downtown":             [37.3382, -121.8863],
  "San Jose Diridon Station":      [37.3297, -121.9024],
  "SFO Airport":                   [37.6213, -122.3790],
  "SFO Terminal 2":                [37.6213, -122.3790],
  "San Francisco Caltrain":        [37.7764, -122.3947],
  "Oakland International Airport": [37.7213, -122.2208],
  "Berkeley BART Station":         [37.8699, -122.2680],
  "Stanford University":           [37.4275, -122.1697],
  "Google Campus":                 [37.4220, -122.0841],
  "Apple Park":                    [37.3349, -122.0090],
  "Union Square":                  [37.7880, -122.4074],
  "Fisherman's Wharf":             [37.8087, -122.4098],
  "Chase Center":                  [37.7680, -122.3877],
  "Caltrain Station":              [37.7764, -122.3947],
  "Downtown Oakland":              [37.8044, -122.2712],
  "Palo Alto Caltrain":            [37.4432, -122.1630],
  "Santa Clara Convention Center": [37.4053, -121.9758],
  "456 Valencia St, San Francisco":[37.7614, -122.4215],
  "555 California St, SF":         [37.7929, -122.4035],
};

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1.15; // road-distance factor
}

function formatPinnedAddress(label: string, coords: [number, number] | null) {
  if (!coords) return label;
  return `${label} (${coords[0].toFixed(5)}, ${coords[1].toFixed(5)})`;
}

// Uber X Bay Area rate card (calibrated against real fares)
const UBER_BASE = 2.20;
const UBER_BOOKING = 3.75;
const UBER_PER_MILE = 1.65;
const UBER_PER_MIN = 0.32;
const UBER_MIN_FARE = 8.00;

function calcRoute(
  from: string,
  to: string,
  fromOverride?: [number, number] | null,
  toOverride?: [number, number] | null,
) {
  const c1 = fromOverride ?? LOCATION_COORDS[from] ?? LOCATION_COORDS["Current Location"];
  const c2 = toOverride ?? LOCATION_COORDS[to] ?? LOCATION_COORDS["Current Location"];
  const rawMiles = haversineDistance(c1[0], c1[1], c2[0], c2[1]);
  const miles = Math.max(1, Math.round(rawMiles * 10) / 10);
  const mins = Math.round(5 + miles * MINS_PER_MILE);
  const fare = Math.max(MIN_FARE, Math.round((BASE_FARE + BOOKING_FEE + miles * RATE_PER_MILE + mins * RATE_PER_MIN) * 100) / 100);
  const uberX = Math.max(UBER_MIN_FARE, Math.round((UBER_BASE + UBER_BOOKING + miles * UBER_PER_MILE + mins * UBER_PER_MIN) * 100) / 100);
  return { miles, fare, mins, uberX };
}

const LOCATION_SUGGESTIONS = [
  { label: "San Jose Airport (SJC)",        sublabel: "1701 Airport Blvd, San Jose" },
  { label: "San Jose Downtown",              sublabel: "S 1st St, San Jose" },
  { label: "San Jose Diridon Station",       sublabel: "65 Cahill St, San Jose" },
  { label: "SFO Airport",                    sublabel: "San Francisco Intl Terminal" },
  { label: "SFO Terminal 2",                sublabel: "San Francisco Intl" },
  { label: "San Francisco Caltrain",         sublabel: "700 4th St, San Francisco" },
  { label: "Oakland International Airport",  sublabel: "1 Airport Dr, Oakland" },
  { label: "Berkeley BART Station",          sublabel: "2160 Shattuck Ave, Berkeley" },
  { label: "Stanford University",            sublabel: "450 Serra Mall, Stanford" },
  { label: "Google Campus",                  sublabel: "1600 Amphitheatre Pkwy, Mountain View" },
  { label: "Apple Park",                     sublabel: "One Apple Park Way, Cupertino" },
  { label: "Union Square",                   sublabel: "333 Post St, San Francisco" },
  { label: "Fisherman's Wharf",              sublabel: "Jefferson St, San Francisco" },
  { label: "Chase Center",                   sublabel: "1 Warriors Way, San Francisco" },
  { label: "Caltrain Station",               sublabel: "700 4th St, San Francisco" },
  { label: "Downtown Oakland",               sublabel: "Broadway & 14th St, Oakland" },
  { label: "Palo Alto Caltrain",             sublabel: "95 University Ave, Palo Alto" },
  { label: "Santa Clara Convention Center",  sublabel: "5001 Great America Pkwy, Santa Clara" },
];

export default function RideRequest() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();
  const { coords: currentCoords, error: currentLocationError } = useCurrentLocation();
  const routeState = (location.state as {
    destination?: string;
    pickup?: string;
    pickupCoords?: [number, number];
    destinationCoords?: [number, number];
  }) ?? {};
  const destination = routeState.destination ?? "456 Valencia St, San Francisco";

  const [pickup, setPickup] = useState(routeState.pickup ?? "Current Location");
  const [pinnedPickupCoords, setPinnedPickupCoords] = useState<[number, number] | null>(routeState.pickupCoords ?? null);
  const [pinnedDestinationCoords] = useState<[number, number] | null>(routeState.destinationCoords ?? null);
  const [confirming, setConfirming] = useState(false);
  const [pickupFocused, setPickupFocused] = useState(false);
  const pickupRef = useRef<HTMLInputElement>(null);
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const effectivePickupCoords =
    pinnedPickupCoords ?? (pickup === "Current Location" ? currentCoords : null);
  const effectiveDestinationCoords = pinnedDestinationCoords;

  const { miles, fare, mins, uberX } = useMemo(
    () => calcRoute(pickup, destination, effectivePickupCoords, effectiveDestinationCoords),
    [destination, effectiveDestinationCoords, effectivePickupCoords, pickup],
  );
  const driverTake = fare * (1 - WEGO_FEE_PCT);
  const coopFee = fare * WEGO_FEE_PCT;

  const fromCoords =
    effectivePickupCoords ??
    (pickup === "Current Location"
      ? currentCoords ?? LOCATION_COORDS["Current Location"]
      : LOCATION_COORDS[pickup] ?? currentCoords ?? LOCATION_COORDS["Current Location"]);
  const toCoords = effectiveDestinationCoords ?? LOCATION_COORDS[destination] ?? LOCATION_COORDS["Current Location"];

  const suggestions = pickup.trim().length >= 1 && pickup !== "Current Location"
    ? LOCATION_SUGGESTIONS.filter((s) =>
        s.label.toLowerCase().includes(pickup.toLowerCase()) ||
        s.sublabel.toLowerCase().includes(pickup.toLowerCase())
      ).slice(0, 5)
    : [];

  const showDropdown = pickupFocused && (suggestions.length > 0 || pickup === "Current Location" || pickup.trim().length === 0);

  const selectPickup = (label: string) => {
    setPickup(label);
    setPinnedPickupCoords(null);
    setPickupFocused(false);
    pickupRef.current?.blur();
  };

  const handleBlur = () => {
    blurTimeout.current = setTimeout(() => setPickupFocused(false), 150);
  };

  const handleFocus = () => {
    if (blurTimeout.current) clearTimeout(blurTimeout.current);
    setPickupFocused(true);
    if (pickup === "Current Location") {
      pickupRef.current?.select();
    }
  };

  const handleConfirm = async () => {
    if (confirming) return;
    setConfirming(true);
    try {
      if (user) {
        await requestRide({
          passengerId: user.uid,
          passengerName: profile?.name || "Passenger",
          pickupAddress: formatPinnedAddress(pickup, pinnedPickupCoords),
          dropoffAddress: formatPinnedAddress(destination, pinnedDestinationCoords),
          fare,
        });
      }
    } catch {
      // Firebase not configured yet — still navigate to ride screen
    }
    navigate("/ride", {
      state: { destination, fare, driverTake, coopFee },
    });
  };

  return (
    <div className="min-h-full bg-background flex flex-col">
      {/* Map header */}
      <div className="relative h-44 flex-shrink-0">
        <ClientMap from={fromCoords} to={toCoords} className="absolute inset-0" />
        <button type="button" onClick={() => navigate("/")} aria-label="Back"
          className="absolute top-4 left-4 z-20 w-9 h-9 rounded-full bg-card/80 backdrop-blur-sm border border-border flex items-center justify-center">
          <ChevronLeft size={18} className="text-foreground" />
        </button>
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-b from-transparent to-background pointer-events-none z-10" />
      </div>

      {/* Content */}
      <div className="flex-1 px-4 pt-2 pb-4 space-y-4">

        {/* Route card */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex gap-3 items-start">
            <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-2">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <div className="w-px h-10 bg-border" />
              <div className="w-3 h-3 rounded-full border-2 border-foreground" />
            </div>

            <div className="space-y-1 flex-1 min-w-0">
              {/* Pickup input */}
              <div className="relative">
                <p className="text-xs text-muted-foreground mb-0.5">Pickup</p>
                <input
                  ref={pickupRef}
                  type="text"
                  value={pickup}
                  title="Pickup location"
                  placeholder="Enter pickup address"
                  onChange={(e) => {
                    setPickup(e.target.value);
                    setPinnedPickupCoords(null);
                  }}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  className={`w-full bg-transparent text-sm font-semibold text-foreground focus:outline-none pb-1 border-b transition-colors ${pickupFocused ? "border-primary" : "border-transparent"}`}
                />

                {/* Dropdown */}
                {showDropdown && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-xl z-30 overflow-hidden">
                    {/* Use current location option */}
                    <button
                      type="button"
                      onMouseDown={() => selectPickup("Current Location")}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 active:bg-muted/50 text-left border-b border-border/50"
                    >
                      <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                        <Navigation size={13} className="text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-primary">Use Current Location</p>
                        <p className="text-xs text-muted-foreground">
                          {currentLocationError ?? "GPS detected location"}
                        </p>
                      </div>
                    </button>

                    {/* Filtered suggestions */}
                    {suggestions.map((s) => (
                      <button
                        key={s.label}
                        type="button"
                        onMouseDown={() => selectPickup(s.label)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 active:bg-muted/50 text-left border-b border-border/30 last:border-0"
                      >
                        <div className="w-7 h-7 rounded-full bg-muted/20 border border-border flex items-center justify-center flex-shrink-0">
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

              {/* Dropoff */}
              <div className="pt-2">
                <p className="text-xs text-muted-foreground">Dropoff</p>
                <p className="text-sm font-semibold text-foreground truncate mt-0.5">{destination}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-1 border-t border-border/50">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock size={12} /><span>~{mins} min ride</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin size={12} /><span>{miles} miles</span>
            </div>
          </div>
        </div>

        {/* Fare card */}
        <div className="bg-card border border-primary/20 rounded-xl p-4 space-y-4 bg-primary/5">
          <div className="flex items-start justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Your Fare</p>
            <div className="flex items-center gap-1 text-xs text-primary">
              <Shield size={11} /><span className="font-semibold">No Surge</span>
            </div>
          </div>
          <div className="flex items-end gap-3">
            <p className="text-4xl font-bold text-foreground">${fare.toFixed(2)}</p>
            <div className="pb-1 flex items-center gap-2">
              <span className="text-sm text-muted-foreground line-through">${uberX.toFixed(2)}</span>
              <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                Save ${(uberX - fare).toFixed(2)} vs Uber X
              </span>
            </div>
          </div>
          <div className="space-y-2 border-t border-border/40 pt-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Info size={10} /> Where your money goes
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                  <span className="text-sm text-foreground font-medium">Driver earns</span>
                  <span className="text-xs text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded">88%</span>
                </div>
                <span className="text-sm font-bold text-primary">${driverTake.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-muted-foreground flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">WeGo Cooperative</span>
                  <span className="text-xs text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded">12%</span>
                </div>
                <span className="text-sm font-medium text-muted-foreground">${coopFee.toFixed(2)}</span>
              </div>
            </div>
            <div className="w-full h-2 bg-muted/30 rounded-full overflow-hidden mt-1">
              <div className="h-full w-[88%] bg-primary rounded-full" />
            </div>
            <p className="text-xs text-muted-foreground">The 12% cooperative fee funds driver pensions, insurance & AV fleet.</p>
          </div>
        </div>

        {/* ETA */}
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
            <Clock size={18} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Driver ~6 min away</p>
            <p className="text-xs text-muted-foreground">Nearest WeGo driver is close by</p>
          </div>
        </div>

        <button type="button" onClick={handleConfirm} disabled={confirming}
          className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-lg active:scale-95 transition-transform shadow-lg shadow-primary/30 disabled:opacity-70">
          {confirming ? "Requesting…" : `Confirm Ride — $${fare.toFixed(2)}`}
        </button>
        <p className="text-xs text-center text-muted-foreground">No cancellation fee if cancelled within 2 minutes</p>
      </div>
    </div>
  );
}
