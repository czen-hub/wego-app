import { useState, useRef, useMemo, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { MapPin, ChevronLeft, Clock, Shield, Info, Navigation, ExternalLink } from "lucide-react";
import ClientMap from "@/components/ClientMap";
import { useCurrentLocation } from "@/hooks/useCurrentLocation";
import { requestRide } from "@/lib/db";
import { useAuth } from "@/context/AuthContext";

const WEGO_FEE_PCT = 0.12;
const WEGO_DISCOUNT = 0.85;
const MIN_FARE = 10.00;
const MINS_PER_MILE = 1.35;

const LOCATION_COORDS: Record<string, [number, number]> = {
  "Current Location":              [37.3541, -121.9552],
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
  const straight = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const roadFactor = straight > 60 ? 1.38 : straight > 25 ? 1.25 : 1.15;
  return straight * roadFactor;
}

function formatPinnedAddress(label: string, coords: [number, number] | null) {
  if (!coords) return label;
  return `${label} (${coords[0].toFixed(5)}, ${coords[1].toFixed(5)})`;
}

async function geocode(address: string): Promise<[number, number] | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=us`;
    const res = await fetch(url, { headers: { "Accept-Language": "en" } });
    const data = await res.json();
    if (data.length > 0) return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
  } catch {}
  return null;
}

type Region = "sf" | "peninsula" | "east_bay" | "south_bay" | "marin" | "north_bay" | "valley";

function classifyRegion(lat: number, lon: number): Region {
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

interface BridgeToll { name: string; toll: number }

function detectBridgeTolls(c1: [number, number], c2: [number, number]): BridgeToll[] {
  const r1 = classifyRegion(c1[0], c1[1]);
  const r2 = classifyRegion(c2[0], c2[1]);
  if (r1 === r2) return [];
  const pair = [r1, r2].sort().join("|");
  switch (pair) {
    case "east_bay|sf":
      return [{ name: "Bay Bridge", toll: 7.00 }];
    case "marin|sf":
    case "north_bay|sf":
      return [{ name: "Golden Gate Bridge", toll: 9.75 }];
    case "east_bay|marin":
    case "east_bay|north_bay":
      return [{ name: "Richmond–San Rafael Bridge", toll: 7.00 }];
    case "east_bay|valley":
      return [{ name: "Carquinez Bridge", toll: 7.00 }];
    case "north_bay|valley":
      return [{ name: "Carquinez Bridge", toll: 7.00 }];
    case "east_bay|peninsula": {
      const avgLat = (c1[0] + c2[0]) / 2;
      return [avgLat > 37.54
        ? { name: "San Mateo Bridge", toll: 7.00 }
        : { name: "Dumbarton Bridge", toll: 7.00 }];
    }
    case "marin|peninsula":
    case "marin|south_bay":
    case "north_bay|peninsula":
    case "north_bay|south_bay":
      return [{ name: "Golden Gate Bridge", toll: 9.75 }];
    case "sf|valley":
      return [{ name: "Bay Bridge", toll: 7.00 }, { name: "Carquinez Bridge", toll: 7.00 }];
    case "peninsula|valley":
      return [{ name: "San Mateo Bridge", toll: 7.00 }, { name: "Carquinez Bridge", toll: 7.00 }];
    case "marin|valley":
      return [{ name: "Golden Gate Bridge", toll: 9.75 }, { name: "Carquinez Bridge", toll: 7.00 }];
    default:
      return [];
  }
}

const UBER_BASE = 1.35;
const UBER_BOOKING = 3.50;
const UBER_PER_MILE = 1.25;
const UBER_PER_MIN = 0.22;
const UBER_MIN_FARE = 7.00;

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
  const minsPerMile = miles > 60 ? 1.05 : MINS_PER_MILE;
  const perMile = miles > 60 ? 0.92 : UBER_PER_MILE;
  const mins = Math.round(5 + miles * minsPerMile);
  const uberX = Math.max(UBER_MIN_FARE, Math.round((UBER_BASE + UBER_BOOKING + miles * perMile + mins * UBER_PER_MIN) * 100) / 100);
  const fare = Math.max(MIN_FARE, Math.round(uberX * WEGO_DISCOUNT * 100) / 100);
  const bridgeTolls = detectBridgeTolls(c1, c2);
  return { miles, fare, mins, uberX, bridgeTolls };
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
  const [destination, setDestination] = useState(routeState.destination ?? "");
  const [pickup, setPickup] = useState(routeState.pickup ?? "Current Location");
  const [pinnedPickupCoords, setPinnedPickupCoords] = useState<[number, number] | null>(routeState.pickupCoords ?? null);
  const [pinnedDestinationCoords, setPinnedDestinationCoords] = useState<[number, number] | null>(routeState.destinationCoords ?? null);
  const [confirming, setConfirming] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [pickupFocused, setPickupFocused] = useState(false);
  const [destFocused, setDestFocused] = useState(!routeState.destination);

  const pickupRef = useRef<HTMLInputElement>(null);
  const destRef = useRef<HTMLInputElement>(null);
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const destBlurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const effectivePickupCoords =
    pinnedPickupCoords ?? (pickup === "Current Location" ? currentCoords : null);
  const effectiveDestinationCoords = pinnedDestinationCoords;

  useEffect(() => {
    if (!destination.trim() || LOCATION_COORDS[destination]) {
      if (!LOCATION_COORDS[destination]) setPinnedDestinationCoords(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      geocode(destination).then((coords) => {
        if (!cancelled && coords) setPinnedDestinationCoords(coords);
      });
    }, 600);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [destination]);

  useEffect(() => {
    if (!pickup.trim() || pickup === "Current Location" || LOCATION_COORDS[pickup]) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      geocode(pickup).then((coords) => {
        if (!cancelled && coords) setPinnedPickupCoords(coords);
      });
    }, 600);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [pickup]);

  const destSuggestions = destination.trim().length >= 1
    ? LOCATION_SUGGESTIONS.filter((s) =>
        s.label.toLowerCase().includes(destination.toLowerCase()) ||
        s.sublabel.toLowerCase().includes(destination.toLowerCase())
      ).slice(0, 5)
    : LOCATION_SUGGESTIONS.slice(0, 5);

  const showDestDropdown = destFocused;

  const selectDestination = (label: string) => {
    setDestination(label);
    setPinnedDestinationCoords(null);
    setDestFocused(false);
    destRef.current?.blur();
  };

  const handleDestBlur = () => {
    destBlurTimeout.current = setTimeout(() => setDestFocused(false), 150);
  };

  const handleDestFocus = () => {
    if (destBlurTimeout.current) clearTimeout(destBlurTimeout.current);
    setDestFocused(true);
  };

  const { miles, fare, mins, uberX, bridgeTolls } = useMemo(
    () => calcRoute(pickup, destination, effectivePickupCoords, effectiveDestinationCoords),
    [destination, effectiveDestinationCoords, effectivePickupCoords, pickup],
  );
  const tollTotal = bridgeTolls.reduce((sum, t) => sum + t.toll, 0);
  const driverTake = Math.round(fare * (1 - WEGO_FEE_PCT) * 100) / 100;
  const coopFee = Math.round(fare * WEGO_FEE_PCT * 100) / 100;

  const FALLBACK: [number, number] = currentCoords ?? [37.3541, -121.9552];
  const fromCoords =
    effectivePickupCoords ??
    (pickup === "Current Location" ? FALLBACK : LOCATION_COORDS[pickup] ?? FALLBACK);
  const toCoords = effectiveDestinationCoords ?? LOCATION_COORDS[destination] ?? FALLBACK;

  const suggestions = pickup.trim().length >= 1 && pickup !== "Current Location"
    ? LOCATION_SUGGESTIONS.filter((s) =>
        s.label.toLowerCase().includes(pickup.toLowerCase()) ||
        s.sublabel.toLowerCase().includes(pickup.toLowerCase())
      ).slice(0, 5)
    : [];

  const showDropdown = pickupFocused && (suggestions.length > 0 || pickup === "Current Location" || pickup.trim().length === 0);

  const selectPickup = (label: string) => {
    setPickup(label);
    setPinnedPickupCoords(LOCATION_COORDS[label] ?? null);
    setPickupFocused(false);
    pickupRef.current?.blur();
  };

  const handleBlur = () => {
    blurTimeout.current = setTimeout(() => setPickupFocused(false), 150);
  };

  const handleFocus = () => {
    if (blurTimeout.current) clearTimeout(blurTimeout.current);
    setPickupFocused(true);
    if (pickup === "Current Location") pickupRef.current?.select();
  };

  const handleConfirm = async () => {
    if (confirming) return;
    setConfirming(true);
    setRequestError(null);
    try {
      if (user) {
        await requestRide({
          passengerId: user.uid,
          passengerName: profile?.name || "Passenger",
          pickupAddress: formatPinnedAddress(pickup, pinnedPickupCoords),
          dropoffAddress: formatPinnedAddress(destination, pinnedDestinationCoords),
          fare: fare + tollTotal,
          pickupCoords: effectivePickupCoords ?? LOCATION_COORDS[pickup] ?? null,
          dropoffCoords: effectiveDestinationCoords ?? LOCATION_COORDS[destination] ?? null,
          estimatedMinutes: mins,
          pinEnabled: localStorage.getItem("wego_pin_required") === "true",
        });
      }
    } catch {
      setConfirming(false);
      setRequestError("Could not submit ride request. Check your connection and try again.");
      return;
    }
    navigate("/ride", {
      state: { destination, fare: fare + tollTotal, driverTake: driverTake + tollTotal, coopFee, fromCoords, toCoords, estimatedMinutes: mins },
    });
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">

      {/* ── MAP — top 40% ── */}
      <div className="relative flex-none" style={{ height: "40%" }}>
        <ClientMap from={fromCoords} to={toCoords} className="absolute inset-0" />

        {/* Back button */}
        <button
          type="button"
          onClick={() => navigate("/")}
          aria-label="Back"
          className="absolute top-4 left-4 z-20 w-9 h-9 rounded-full bg-card/80 backdrop-blur-sm border border-border flex items-center justify-center"
        >
          <ChevronLeft size={18} className="text-foreground" />
        </button>

        {/* Google Maps link */}
        {destination.trim() && (
          <a
            href={`https://www.google.com/maps/dir/?api=1&origin=${fromCoords[0]},${fromCoords[1]}&destination=${toCoords[0]},${toCoords[1]}&travelmode=driving`}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-4 right-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card/80 backdrop-blur-sm border border-border text-xs font-medium text-foreground"
          >
            <ExternalLink size={12} />
            Google Maps
          </a>
        )}

        {/* Fade into content panel */}
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-b from-transparent to-background pointer-events-none z-10" />
      </div>

      {/* ── CONTENT PANEL — scrollable bottom 60% ── */}
      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-6 space-y-4">

        {/* Route card */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex gap-3 items-start">
            <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-2">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <div className="w-px h-10 bg-border" />
              <div className="w-3 h-3 rounded-full border-2 border-foreground" />
            </div>

            <div className="space-y-1 flex-1 min-w-0">
              {/* Pickup */}
              <div className="relative">
                <p className="text-xs text-muted-foreground mb-0.5">Pickup</p>
                <input
                  ref={pickupRef}
                  type="text"
                  value={pickup}
                  title="Pickup location"
                  placeholder="Enter pickup address"
                  onChange={(e) => { setPickup(e.target.value); setPinnedPickupCoords(null); }}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  className={`w-full bg-transparent text-sm font-semibold text-foreground focus:outline-none pb-1 border-b transition-colors ${pickupFocused ? "border-primary" : "border-transparent"}`}
                />
                {showDropdown && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-xl z-30 overflow-hidden">
                    <button type="button" onMouseDown={() => selectPickup("Current Location")}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 active:bg-muted/50 text-left border-b border-border/50">
                      <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                        <Navigation size={13} className="text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-primary">Use Current Location</p>
                        <p className="text-xs text-muted-foreground">{currentLocationError ?? "GPS detected location"}</p>
                      </div>
                    </button>
                    {suggestions.map((s) => (
                      <button key={s.label} type="button" onMouseDown={() => selectPickup(s.label)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 active:bg-muted/50 text-left border-b border-border/30 last:border-0">
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
              <div className="pt-2 relative">
                <p className="text-xs text-muted-foreground mb-0.5">Dropoff</p>
                <input
                  ref={destRef}
                  type="text"
                  value={destination}
                  placeholder="Where to?"
                  onChange={(e) => { setDestination(e.target.value); setPinnedDestinationCoords(null); }}
                  onFocus={handleDestFocus}
                  onBlur={handleDestBlur}
                  className={`w-full bg-transparent text-sm font-semibold text-foreground focus:outline-none pb-1 border-b transition-colors ${destFocused ? "border-primary" : "border-transparent"}`}
                />
                {showDestDropdown && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-xl z-30 overflow-hidden">
                    {destSuggestions.map((s) => (
                      <button key={s.label} type="button" onMouseDown={() => selectDestination(s.label)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 active:bg-muted/50 text-left border-b border-border/30 last:border-0">
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

        {/* Fare card — only when destination is entered */}
        {destination.trim() && <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-4">
          <div className="flex items-start justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Your Fare</p>
            <div className="flex items-center gap-1 text-xs text-primary">
              <Shield size={11} /><span className="font-semibold">No Surge</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-4xl font-bold text-foreground whitespace-nowrap">${(fare + tollTotal).toFixed(2)}</p>
            <div className="flex items-center gap-2">
              {uberX > fare ? (
                <>
                  <span className="text-sm text-muted-foreground line-through">${(uberX + tollTotal).toFixed(2)}</span>
                  <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                    Save ${(uberX - fare).toFixed(2)} vs Corp 1 X
                  </span>
                </>
              ) : (
                <span className="text-xs font-medium text-muted-foreground">Minimum fare applies</span>
              )}
            </div>
          </div>

          {bridgeTolls.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2.5 space-y-1.5">
              <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wide">Bridge Tolls Included</p>
              {bridgeTolls.map((t) => (
                <div key={t.name} className="flex items-center justify-between">
                  <span className="text-xs text-amber-700 dark:text-amber-400">{t.name}</span>
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">+${t.toll.toFixed(2)}</span>
                </div>
              ))}
              <p className="text-[10px] text-amber-600/70">Tolls passed 100% to your driver</p>
            </div>
          )}

          <div className="space-y-2 border-t border-border/40 pt-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Info size={10} /> Where your money goes
            </p>
            {tollTotal > 0 && (
              <div className="flex items-center justify-between pb-1 border-b border-border/30">
                <span className="text-xs text-muted-foreground">Base ride fare</span>
                <span className="text-xs text-muted-foreground">${fare.toFixed(2)}</span>
              </div>
            )}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                  <span className="text-sm text-foreground font-medium">Driver earns</span>
                  <span className="text-xs text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded">
                    {tollTotal > 0 ? "88% + tolls" : "88%"}
                  </span>
                </div>
                <span className="text-sm font-bold text-primary">${(driverTake + tollTotal).toFixed(2)}</span>
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
        </div>}

        {/* ETA */}
        {destination.trim() && <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
            <Clock size={18} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Ride ~{mins} min · drivers nearby</p>
            <p className="text-xs text-muted-foreground">Nearest WeGo driver is close by</p>
          </div>
        </div>}

        {requestError && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 text-sm text-destructive font-medium">
            {requestError}
          </div>
        )}

        <button
          type="button"
          onClick={handleConfirm}
          disabled={confirming || !destination.trim()}
          className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-lg active:scale-95 transition-transform shadow-lg shadow-primary/30 disabled:opacity-50"
        >
          {confirming ? "Requesting…" : destination.trim() ? `Confirm Ride — $${(fare + tollTotal).toFixed(2)}` : "Enter a destination"}
        </button>
        <p className="text-xs text-center text-muted-foreground pb-2">No cancellation fee if cancelled within 2 minutes</p>
      </div>

    </div>
  );
}
