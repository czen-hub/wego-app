import { useState, useRef, useMemo, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { MapPin, ChevronLeft, Clock, Shield, Info, Navigation, ExternalLink, Plus, X } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import ClientMap from "@/components/ClientMap";
import { useCurrentLocation } from "@/hooks/useCurrentLocation";
import { requestRide } from "@/lib/db";
import { useAuth } from "@/context/AuthContext";

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;

const WEGO_FEE_PCT = 0.12;
const WEGO_DISCOUNT = 0.85;
const MIN_FARE = 10.00;
const MINS_PER_MILE = 1.35; // default (south bay / open suburban)
const MAX_STOPS = 10;
const BASE_STOP_FEE = 3.50; // per stop — covers driver time/inconvenience, 100% to driver

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

interface StopEntry {
  id: string;
  address: string;
  coords: [number, number] | null;
}

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
    case "east_bay|sf":      return [{ name: "Bay Bridge", toll: 7.00 }];
    case "marin|sf":
    case "north_bay|sf":     return [{ name: "Golden Gate Bridge", toll: 9.75 }];
    case "east_bay|marin":
    case "east_bay|north_bay": return [{ name: "Richmond–San Rafael Bridge", toll: 7.00 }];
    case "east_bay|valley":
    case "north_bay|valley": return [{ name: "Carquinez Bridge", toll: 7.00 }];
    case "east_bay|peninsula": {
      const avgLat = (c1[0] + c2[0]) / 2;
      return [avgLat > 37.54 ? { name: "San Mateo Bridge", toll: 7.00 } : { name: "Dumbarton Bridge", toll: 7.00 }];
    }
    case "marin|peninsula":
    case "marin|south_bay":
    case "north_bay|peninsula":
    case "north_bay|south_bay": return [{ name: "Golden Gate Bridge", toll: 9.75 }];
    case "sf|valley":        return [{ name: "Bay Bridge", toll: 7.00 }, { name: "Carquinez Bridge", toll: 7.00 }];
    case "peninsula|valley": return [{ name: "San Mateo Bridge", toll: 7.00 }, { name: "Carquinez Bridge", toll: 7.00 }];
    case "marin|valley":     return [{ name: "Golden Gate Bridge", toll: 9.75 }, { name: "Carquinez Bridge", toll: 7.00 }];
    default: return [];
  }
}

const UBER_BASE = 1.35;
const UBER_BOOKING = 3.50;
const UBER_PER_MILE = 1.25;
const UBER_PER_MIN = 0.22;
const UBER_MIN_FARE = 7.00;

// Minutes per mile by region — reflects real average speeds incl. congestion
const MINS_PER_MILE_BY_REGION: Record<Region, number> = {
  sf:        2.50, // ~24 mph — heavy urban congestion
  peninsula: 1.80, // ~33 mph — suburban/university traffic (Stanford, Palo Alto)
  marin:     1.60, // ~37 mph — mixed local/highway
  east_bay:  1.55, // ~39 mph — mixed urban/freeway
  north_bay: 1.40, // ~43 mph — lighter traffic
  south_bay: 1.35, // ~44 mph — default
  valley:    1.10, // ~55 mph — open roads
};

function segmentMinsPerMile(p1: [number, number], p2: [number, number]): number {
  const r1 = MINS_PER_MILE_BY_REGION[classifyRegion(p1[0], p1[1])];
  const r2 = MINS_PER_MILE_BY_REGION[classifyRegion(p2[0], p2[1])];
  return (r1 + r2) / 2;
}

function calcSegment(miles: number, minsPerMile = MINS_PER_MILE): { mins: number; uberX: number; fare: number } {
  const effectiveMpm = miles > 60 ? 1.05 : minsPerMile;
  const perMile      = miles > 60 ? 0.92 : UBER_PER_MILE;
  const mins   = Math.round(5 + miles * effectiveMpm);
  const uberX  = Math.max(UBER_MIN_FARE, Math.round((UBER_BASE + UBER_BOOKING + miles * perMile + mins * UBER_PER_MIN) * 100) / 100);
  const fare   = Math.max(MIN_FARE, Math.round(uberX * WEGO_DISCOUNT * 100) / 100);
  return { mins, uberX, fare };
}

function haversineStraight(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcMultiRoute(points: [number, number][]): { miles: number; fare: number; mins: number; uberX: number; bridgeTolls: BridgeToll[] } {
  if (points.length < 2) return { miles: 0, fare: MIN_FARE, mins: 0, uberX: UBER_MIN_FARE, bridgeTolls: [] };

  // Sum raw straight-line distances, then apply ONE road factor to the total.
  // Per-segment road factors would shrink short detour legs (1.15×) vs the
  // direct route (1.25×), making the fare drop when a stop is added — wrong.
  // Separately compute a distance-weighted minsPerMile so urban/congested
  // segments (SF, Peninsula) raise the time component of the fare appropriately.
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

  const roadFactor = totalStraight > 60 ? 1.38 : totalStraight > 25 ? 1.25 : 1.15;
  const miles      = Math.max(1, Math.round(totalStraight * roadFactor * 10) / 10);
  const minsPerMile = totalStraight > 0 ? weightedMpm / totalStraight : MINS_PER_MILE;
  const { mins, uberX, fare } = calcSegment(miles, minsPerMile);
  return { miles, fare, mins, uberX, bridgeTolls };
}

function calcRoute(
  from: string,
  to: string,
  fromOverride?: [number, number] | null,
  toOverride?: [number, number] | null,
): { miles: number; fare: number; mins: number; uberX: number; bridgeTolls: BridgeToll[] } {
  const c1 = fromOverride ?? LOCATION_COORDS[from] ?? LOCATION_COORDS["Current Location"];
  const c2 = toOverride ?? LOCATION_COORDS[to] ?? LOCATION_COORDS["Current Location"];
  const rawMiles = haversineDistance(c1[0], c1[1], c2[0], c2[1]);
  const miles = Math.max(1, Math.round(rawMiles * 10) / 10);
  const mpm = segmentMinsPerMile(c1, c2);
  const { mins, uberX, fare } = calcSegment(miles, mpm);
  return { miles, fare, mins, uberX, bridgeTolls: detectBridgeTolls(c1, c2) };
}

// ── Sortable stop row ────────────────────────────────────────────────────────
// Self-contained row: amber diamond acts as drag handle (no separate grip icon).
// The parent does NOT render a left-column connector for stops — this component
// owns its own indicator so the dnd transform applies to the whole row.

interface GeoResult { name: string; sublabel: string; coords: [number, number] }

interface SortableStopProps {
  stop: StopEntry;
  index: number;
  focused: boolean;
  onFocus: (id: string) => void;
  onBlur: (id: string) => void;
  onChange: (id: string, val: string) => void;
  onSelect: (id: string, label: string, coords?: [number, number]) => void;
  onRemove: (id: string) => void;
  inputRef: (el: HTMLInputElement | null) => void;
  geoResults: GeoResult[];
}

function SortableStop({ stop, index, focused, onFocus, onBlur, onChange, onSelect, onRemove, inputRef, geoResults }: SortableStopProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stop.id });

  const staticSuggestions = stop.address.trim().length >= 1
    ? LOCATION_SUGGESTIONS.filter(s =>
        s.label.toLowerCase().includes(stop.address.toLowerCase()) ||
        s.sublabel.toLowerCase().includes(stop.address.toLowerCase())
      ).slice(0, 4)
    : LOCATION_SUGGESTIONS.slice(0, 4);

  const displayResults: { label: string; sublabel: string; coords?: [number, number] }[] =
    geoResults.length > 0
      ? geoResults.map(r => ({ label: r.name, sublabel: r.sublabel, coords: r.coords }))
      : staticSuggestions.map(s => ({ label: s.label, sublabel: s.sublabel }));

  return (
    // eslint-disable-next-line react/forbid-component-props
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`flex gap-3 items-start ${isDragging ? "opacity-50 z-50" : ""}`}>

      {/* Left column: amber diamond = drag handle, plus connector line below */}
      <div className="flex flex-col items-center flex-shrink-0 pt-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder stop"
          className="w-3 h-3 bg-amber-400 rotate-45 touch-none cursor-grab active:cursor-grabbing flex-shrink-0 active:scale-110 transition-transform"
        />
        <div className="w-px flex-1 min-h-[2.5rem] bg-border flex-shrink-0" />
      </div>

      {/* Right: label + input + remove */}
      <div className="flex-1 min-w-0 pb-1">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-amber-500 mb-0.5">Stop {index + 1}</p>
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={stop.address}
                placeholder="Where to stop?"
                onChange={e => onChange(stop.id, e.target.value)}
                onFocus={() => onFocus(stop.id)}
                onBlur={() => onBlur(stop.id)}
                className={`w-full bg-transparent text-sm font-semibold text-foreground focus:outline-none pb-1 border-b transition-colors ${focused ? "border-amber-400" : "border-transparent"}`}
              />
              {focused && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-xl z-30 overflow-hidden">
                  {displayResults.map(s => (
                    <button key={s.label + s.sublabel} type="button" onMouseDown={() => onSelect(stop.id, s.label, s.coords)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 active:bg-muted/50 text-left border-b border-border/30 last:border-0">
                      <div className="w-6 h-6 rounded-full bg-amber-400/10 border border-amber-400/30 flex items-center justify-center flex-shrink-0">
                        <MapPin size={11} className="text-amber-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{s.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{s.sublabel}</p>
                      </div>
                    </button>
                  ))}
                  {geoResults.length === 0 && stop.address.trim().length >= 2 && (
                    <p className="text-xs text-muted-foreground text-center py-3">Searching…</p>
                  )}
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onRemove(stop.id)}
            aria-label="Remove stop"
            className="flex-shrink-0 mt-4 p-1 rounded-full text-muted-foreground hover:text-destructive active:scale-90 transition-all"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

const LOCATION_SUGGESTIONS = [
  { label: "San Jose Airport (SJC)",        sublabel: "1701 Airport Blvd, San Jose" },
  { label: "San Jose Downtown",             sublabel: "S 1st St, San Jose" },
  { label: "San Jose Diridon Station",      sublabel: "65 Cahill St, San Jose" },
  { label: "SFO Airport",                   sublabel: "San Francisco Intl Terminal" },
  { label: "SFO Terminal 2",                sublabel: "San Francisco Intl" },
  { label: "San Francisco Caltrain",        sublabel: "700 4th St, San Francisco" },
  { label: "Oakland International Airport", sublabel: "1 Airport Dr, Oakland" },
  { label: "Berkeley BART Station",         sublabel: "2160 Shattuck Ave, Berkeley" },
  { label: "Stanford University",           sublabel: "450 Serra Mall, Stanford" },
  { label: "Google Campus",                 sublabel: "1600 Amphitheatre Pkwy, Mountain View" },
  { label: "Apple Park",                    sublabel: "One Apple Park Way, Cupertino" },
  { label: "Union Square",                  sublabel: "333 Post St, San Francisco" },
  { label: "Fisherman's Wharf",             sublabel: "Jefferson St, San Francisco" },
  { label: "Chase Center",                  sublabel: "1 Warriors Way, San Francisco" },
  { label: "Caltrain Station",              sublabel: "700 4th St, San Francisco" },
  { label: "Downtown Oakland",              sublabel: "Broadway & 14th St, Oakland" },
  { label: "Palo Alto Caltrain",            sublabel: "95 University Ave, Palo Alto" },
  { label: "Santa Clara Convention Center", sublabel: "5001 Great America Pkwy, Santa Clara" },
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
  const [stops, setStops] = useState<StopEntry[]>([]);
  const [focusedStopId, setFocusedStopId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [pickupSearchOpen, setPickupSearchOpen] = useState(false);
  const [destSearchOpen, setDestSearchOpen] = useState(false);
  const [pickupQuery, setPickupQuery] = useState("");
  const [destQuery, setDestQuery] = useState("");

  const [pickupGeoResults, setPickupGeoResults] = useState<{ name: string; sublabel: string; coords: [number, number] }[]>([]);
  const [destGeoResults, setDestGeoResults] = useState<{ name: string; sublabel: string; coords: [number, number] }[]>([]);

  const pickupSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const destSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopGeocodeTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const stopBlurTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const stopInputRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());
  const [stopGeoResults, setStopGeoResults] = useState<Map<string, GeoResult[]>>(new Map());
  const stopSearchTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const effectivePickupCoords =
    pinnedPickupCoords ?? (pickup === "Current Location" ? currentCoords : null);
  const effectiveDestinationCoords = pinnedDestinationCoords;

  const FALLBACK: [number, number] = currentCoords ?? [37.3541, -121.9552];

  // Geocode destination on type
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

  // Geocode pickup on type
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

  // ── Stop handlers ────────────────────────────────────────────────────────

  const addStop = () => {
    if (stops.length >= MAX_STOPS) return;
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setStops(prev => [...prev, { id, address: "", coords: null }]);
    setFocusedStopId(id);
  };

  const searchStop = (id: string, q: string) => {
    const existing = stopSearchTimers.current.get(id);
    if (existing) clearTimeout(existing);
    if (q.trim().length < 2) {
      setStopGeoResults(prev => { const m = new Map(prev); m.delete(id); return m; });
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const loc = currentCoords ?? FALLBACK;
        const prox = `&proximity=${loc[1]},${loc[0]}`;
        const bbox = `&bbox=${(loc[1] - 1.5).toFixed(4)},${(loc[0] - 1.5).toFixed(4)},${(loc[1] + 1.5).toFixed(4)},${(loc[0] + 1.5).toFixed(4)}`;
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?types=poi,address,place,neighborhood&language=en&country=us${prox}${bbox}&access_token=${TOKEN}`
        );
        const data = await res.json();
        setStopGeoResults(prev => {
          const m = new Map(prev);
          m.set(id, (data.features ?? []).slice(0, 5).map((f: any) => ({
            name: f.address ? `${f.address} ${f.text}` : (f.place_name as string).split(",")[0],
            sublabel: f.place_name as string,
            coords: [f.center[1], f.center[0]] as [number, number],
          })));
          return m;
        });
      } catch {
        setStopGeoResults(prev => { const m = new Map(prev); m.delete(id); return m; });
      }
      stopSearchTimers.current.delete(id);
    }, 350);
    stopSearchTimers.current.set(id, timer);
  };

  const removeStop = (id: string) => {
    const t = stopGeocodeTimers.current.get(id);
    if (t) { clearTimeout(t); stopGeocodeTimers.current.delete(id); }
    const st = stopSearchTimers.current.get(id);
    if (st) { clearTimeout(st); stopSearchTimers.current.delete(id); }
    setStopGeoResults(prev => { const m = new Map(prev); m.delete(id); return m; });
    setStops(prev => prev.filter(s => s.id !== id));
    if (focusedStopId === id) setFocusedStopId(null);
  };

  const updateStopAddress = (id: string, address: string) => {
    const presetCoords = LOCATION_COORDS[address] ?? null;
    setStops(prev => prev.map(s => s.id === id ? { ...s, address, coords: presetCoords } : s));
    searchStop(id, address);
    if (!presetCoords && address.trim().length > 3) {
      const existing = stopGeocodeTimers.current.get(id);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(async () => {
        const coords = await geocode(address);
        if (coords) setStops(prev => prev.map(s => s.id === id ? { ...s, coords } : s));
        stopGeocodeTimers.current.delete(id);
      }, 600);
      stopGeocodeTimers.current.set(id, timer);
    }
  };

  const selectStop = (id: string, label: string, coords?: [number, number]) => {
    const resolvedCoords = coords ?? LOCATION_COORDS[label] ?? null;
    setStops(prev => prev.map(s => s.id === id ? { ...s, address: label, coords: resolvedCoords } : s));
    setFocusedStopId(null);
    setStopGeoResults(prev => { const m = new Map(prev); m.delete(id); return m; });
  };

  const handleStopFocus = (id: string) => {
    const bt = stopBlurTimers.current.get(id);
    if (bt) { clearTimeout(bt); stopBlurTimers.current.delete(id); }
    setFocusedStopId(id);
  };

  const handleStopBlur = (id: string) => {
    const timer = setTimeout(() => {
      setFocusedStopId(prev => prev === id ? null : prev);
      stopBlurTimers.current.delete(id);
    }, 150);
    stopBlurTimers.current.set(id, timer);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setStops(prev => {
      const oldIdx = prev.findIndex(s => s.id === active.id);
      const newIdx = prev.findIndex(s => s.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  };

  // ── Route points & fare calc ─────────────────────────────────────────────

  const allRoutePoints = useMemo((): [number, number][] => {
    const pts: [number, number][] = [];
    const pickupPt = effectivePickupCoords ?? (pickup === "Current Location" ? FALLBACK : LOCATION_COORDS[pickup] ?? null);
    if (pickupPt) pts.push(pickupPt);
    for (const stop of stops) {
      const pt = stop.coords ?? LOCATION_COORDS[stop.address] ?? null;
      if (pt) pts.push(pt);
    }
    const destPt = effectiveDestinationCoords ?? LOCATION_COORDS[destination] ?? null;
    if (destPt) pts.push(destPt);
    return pts;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectivePickupCoords, pickup, FALLBACK[0], FALLBACK[1], stops, effectiveDestinationCoords, destination]);

  const { miles, fare, mins, uberX, bridgeTolls } = useMemo(
    () => allRoutePoints.length >= 2
      ? calcMultiRoute(allRoutePoints)
      : calcRoute(pickup, destination, effectivePickupCoords, effectiveDestinationCoords),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allRoutePoints],
  );

  const tollTotal        = bridgeTolls.reduce((s, t) => s + t.toll, 0);
  const resolvedStops    = stops.filter(s => s.coords !== null);
  const plannedStopFee   = resolvedStops.length * BASE_STOP_FEE; // 100% to driver
  const driverTake       = Math.round(fare * (1 - WEGO_FEE_PCT) * 100) / 100;
  const coopFee          = Math.round(fare * WEGO_FEE_PCT * 100) / 100;
  const totalCharged     = parseFloat((fare + tollTotal + plannedStopFee).toFixed(2));
  const totalDriverEarns = parseFloat((driverTake + tollTotal + plannedStopFee).toFixed(2));

  const fromCoords = effectivePickupCoords ?? (pickup === "Current Location" ? FALLBACK : LOCATION_COORDS[pickup] ?? FALLBACK);
  const toCoords   = effectiveDestinationCoords ?? LOCATION_COORDS[destination] ?? FALLBACK;
  const viaPoints  = stops.map(s => s.coords).filter((c): c is [number, number] => c !== null);

  // Auto-open destination search when landing with no pre-filled destination
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (!routeState.destination) setDestSearchOpen(true); }, []);

  // ── Dropdowns ────────────────────────────────────────────────────────────

  const selectDestination = (label: string, coords?: [number, number]) => {
    setDestination(label);
    setPinnedDestinationCoords(coords ?? LOCATION_COORDS[label] ?? null);
    setDestGeoResults([]);
    setDestSearchOpen(false);
  };

  const geoSearch = (
    q: string,
    timerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>,
    setter: React.Dispatch<React.SetStateAction<{ name: string; sublabel: string; coords: [number, number] }[]>>,
  ) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (q.trim().length < 2) { setter([]); return; }
    timerRef.current = setTimeout(async () => {
      try {
        const loc = currentCoords ?? FALLBACK;
        const prox = `&proximity=${loc[1]},${loc[0]}`;
        const bbox = `&bbox=${(loc[1] - 1.5).toFixed(4)},${(loc[0] - 1.5).toFixed(4)},${(loc[1] + 1.5).toFixed(4)},${(loc[0] + 1.5).toFixed(4)}`;
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?types=address,place,poi,neighborhood&language=en&country=us${prox}${bbox}&access_token=${TOKEN}`
        );
        const data = await res.json();
        setter(
          (data.features ?? []).slice(0, 5).map((f: any) => ({
            name: f.address ? `${f.address} ${f.text}` : (f.place_name as string).split(",")[0],
            sublabel: f.place_name as string,
            coords: [f.center[1], f.center[0]] as [number, number],
          }))
        );
      } catch {
        setter([]);
      }
    }, 350);
  };

  const selectPickup = (label: string, coords?: [number, number]) => {
    setPickup(label);
    setPinnedPickupCoords(coords ?? LOCATION_COORDS[label] ?? null);
    setPickupGeoResults([]);
    setPickupSearchOpen(false);
  };

  // ── Submit ───────────────────────────────────────────────────────────────

  const handleConfirm = async () => {
    if (confirming) return;
    setConfirming(true);
    setRequestError(null);
    try {
      if (user) {
        const plannedStops = stops
          .filter(s => s.coords !== null)
          .map(s => ({ address: s.address, lat: s.coords![0], lng: s.coords![1] }));
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
          plannedStops,
          initialStopCount: resolvedStops.length,
          initialStopFeeTotal: plannedStopFee,
        });
      }
    } catch {
      setConfirming(false);
      setRequestError("Could not submit ride request. Check your connection and try again.");
      return;
    }
    navigate("/ride", {
      state: { destination, fare: totalCharged, driverTake: totalDriverEarns, coopFee, fromCoords, toCoords, estimatedMinutes: mins },
    });
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="relative h-full flex flex-col overflow-hidden bg-background">

      {/* MAP */}
      <div className="request-map-panel relative">
        <ClientMap from={fromCoords} to={toCoords} viaPoints={viaPoints.length > 0 ? viaPoints : undefined} className="absolute inset-0" />

        <button
          type="button"
          onClick={() => navigate("/")}
          aria-label="Back"
          className="absolute top-4 left-4 z-20 w-9 h-9 rounded-full bg-card/80 backdrop-blur-sm border border-border flex items-center justify-center"
        >
          <ChevronLeft size={18} className="text-foreground" />
        </button>

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

        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-b from-transparent to-background pointer-events-none z-10" />
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-6 space-y-4">

        {/* Route card */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">

          {/* Pickup row */}
          <div className="flex gap-3 items-start">
            <div className="flex flex-col items-center flex-shrink-0 pt-2">
              <div className="w-3 h-3 rounded-full bg-primary flex-shrink-0" />
              <div className="w-px flex-1 min-h-[2.5rem] bg-border flex-shrink-0" />
            </div>
            <div className="flex-1 min-w-0 pb-3">
              <p className="text-xs text-muted-foreground mb-0.5">Pickup</p>
              <button
                type="button"
                onClick={() => {
                  setPickupQuery(pickup === "Current Location" ? "" : pickup);
                  setPickupGeoResults([]);
                  setPickupSearchOpen(true);
                  if (pickup && pickup !== "Current Location") geoSearch(pickup, pickupSearchTimerRef, setPickupGeoResults);
                }}
                className="w-full text-left text-sm font-semibold text-foreground pb-1 border-b border-transparent truncate active:opacity-70"
              >
                {pickup || "Enter pickup address"}
              </button>
            </div>
          </div>

          {/* Draggable stops — SortableStop owns its own indicator, no parent left column */}
          {stops.length > 0 && (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={stops.map(s => s.id)} strategy={verticalListSortingStrategy}>
                {stops.map((stop, i) => (
                  <SortableStop
                    key={stop.id}
                    stop={stop}
                    index={i}
                    focused={focusedStopId === stop.id}
                    onFocus={handleStopFocus}
                    onBlur={handleStopBlur}
                    onChange={updateStopAddress}
                    onSelect={selectStop}
                    onRemove={removeStop}
                    inputRef={el => { stopInputRefs.current.set(stop.id, el); }}
                    geoResults={stopGeoResults.get(stop.id) ?? []}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}

          {/* Dropoff row */}
          <div className="flex gap-3 items-start">
            <div className="flex flex-col items-center flex-shrink-0 pt-2">
              <div className="w-3 h-3 rounded-full border-2 border-foreground flex-shrink-0" />
            </div>
            <div className="flex-1 min-w-0 pb-1">
              <div className="pt-0">
                <p className="text-xs text-muted-foreground mb-0.5">Dropoff</p>
                <button
                  type="button"
                  onClick={() => {
                    setDestQuery(destination);
                    setDestGeoResults([]);
                    setDestSearchOpen(true);
                    if (destination) geoSearch(destination, destSearchTimerRef, setDestGeoResults);
                  }}
                  className="w-full text-left text-sm font-semibold pb-1 border-b border-transparent truncate active:opacity-70"
                >
                  {destination
                    ? <span className="text-foreground">{destination}</span>
                    : <span className="text-muted-foreground font-normal">Where to?</span>}
                </button>
              </div>
            </div>
          </div>

          {/* Add Stop button — sits below the full route, outside the dropoff row */}

          {destination.trim() && stops.length < MAX_STOPS && (
            <button
              type="button"
              onClick={addStop}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-amber-400/40 bg-amber-400/5 text-amber-500 text-xs font-semibold hover:bg-amber-400/10 active:scale-95 transition-all w-full justify-center mt-1"
            >
              <Plus size={14} />
              Add Stop {stops.length > 0 ? `(${stops.length}/${MAX_STOPS})` : ""}
            </button>
          )}

          {/* Distance row */}
          <div className="flex items-center gap-4 pt-1 border-t border-border/50">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock size={12} /><span>~{mins} min ride</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin size={12} /><span>{miles} miles</span>
            </div>
            {stops.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-amber-500">
                <span>{stops.length} stop{stops.length > 1 ? "s" : ""} included</span>
              </div>
            )}
          </div>
        </div>

        {/* Fare card */}
        {destination.trim() && (
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-4">
            <div className="flex items-start justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Your Fare</p>
              <div className="flex items-center gap-1 text-xs text-primary">
                <Shield size={11} /><span className="font-semibold">No Surge</span>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-4xl font-bold text-foreground whitespace-nowrap">${totalCharged.toFixed(2)}</p>
              <div className="flex items-center gap-2">
                {uberX > fare ? (
                  <>
                    <span className="text-sm text-muted-foreground line-through">${(uberX + tollTotal + plannedStopFee).toFixed(2)}</span>
                    <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      Save ${(uberX - fare).toFixed(2)} vs Corp X
                    </span>
                  </>
                ) : (
                  <span className="text-xs font-medium text-muted-foreground">Minimum fare applies</span>
                )}
              </div>
            </div>

            {/* Stop fee breakdown */}
            {resolvedStops.length > 0 && (
              <div className="bg-amber-500/8 border border-amber-400/20 rounded-lg px-3 py-2 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Base ride fare</span>
                  <span className="text-xs text-muted-foreground">${(fare + tollTotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-amber-500 font-medium">
                    Stop fee × {resolvedStops.length} stop{resolvedStops.length > 1 ? "s" : ""} (100% to driver)
                  </span>
                  <span className="text-xs font-semibold text-amber-500">+${plannedStopFee.toFixed(2)}</span>
                </div>
                <div className="h-px bg-border/40" />
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-foreground">Total</span>
                  <span className="text-xs font-bold text-foreground">${totalCharged.toFixed(2)}</span>
                </div>
              </div>
            )}

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
                      {tollTotal > 0 || plannedStopFee > 0 ? "88%+" : "88%"}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-primary">${totalDriverEarns.toFixed(2)}</span>
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
        )}

        {/* ETA */}
        {destination.trim() && (
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
              <Clock size={18} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Ride ~{mins} min · drivers nearby</p>
              <p className="text-xs text-muted-foreground">Nearest WeGo driver is close by</p>
            </div>
          </div>
        )}

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
          {confirming ? "Requesting…" : destination.trim() ? `Confirm Ride — $${totalCharged.toFixed(2)}` : "Enter a destination"}
        </button>
        <p className="text-xs text-center text-muted-foreground pb-2">No cancellation fee if cancelled within 2 minutes</p>
      </div>

      {/* ── PICKUP SEARCH OVERLAY ── */}
      {pickupSearchOpen && (
        <div className="absolute inset-0 z-[9999] bg-background flex flex-col">
          <div className="flex items-center gap-3 px-4 py-4 border-b border-border">
            <button type="button" aria-label="Close" onClick={() => setPickupSearchOpen(false)}>
              <ChevronLeft size={22} className="text-foreground" />
            </button>
            <input
              autoFocus
              type="text"
              value={pickupQuery}
              onChange={(e) => {
                setPickupQuery(e.target.value);
                geoSearch(e.target.value, pickupSearchTimerRef, setPickupGeoResults);
              }}
              placeholder="Search pickup location…"
              className="flex-1 bg-transparent text-base font-medium text-foreground focus:outline-none"
            />
            {pickupQuery.length > 0 && (
              <button type="button" aria-label="Clear search" onClick={() => { setPickupQuery(""); setPickupGeoResults([]); }}>
                <X size={18} className="text-muted-foreground" />
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            <button type="button" onClick={() => selectPickup("Current Location")}
              className="w-full flex items-center gap-3 px-4 py-4 hover:bg-muted/30 active:bg-muted/50 text-left border-b border-border">
              <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                <Navigation size={18} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-primary">Use Current Location</p>
                <p className="text-xs text-muted-foreground">{currentLocationError ?? "GPS detected location"}</p>
              </div>
            </button>
            {pickupGeoResults.map((r) => (
              <button key={r.sublabel} type="button" onClick={() => selectPickup(r.name, r.coords)}
                className="w-full flex items-center gap-3 px-4 py-4 hover:bg-muted/30 active:bg-muted/50 text-left border-b border-border/50">
                <div className="w-10 h-10 rounded-full bg-muted/20 border border-border flex items-center justify-center flex-shrink-0">
                  <MapPin size={18} className="text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{r.name}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{r.sublabel}</p>
                </div>
              </button>
            ))}
            {pickupGeoResults.length === 0 && pickupQuery.length >= 2 && (
              <p className="text-sm text-muted-foreground text-center py-10">Searching…</p>
            )}
            {pickupQuery.length < 2 && pickupGeoResults.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-10">Type to search for a pickup location</p>
            )}
          </div>
        </div>
      )}

      {/* ── DESTINATION SEARCH OVERLAY ── */}
      {destSearchOpen && (
        <div className="absolute inset-0 z-[9999] bg-background flex flex-col">
          <div className="flex items-center gap-3 px-4 py-4 border-b border-border">
            <button type="button" aria-label="Close" onClick={() => setDestSearchOpen(false)}>
              <ChevronLeft size={22} className="text-foreground" />
            </button>
            <input
              autoFocus
              type="text"
              value={destQuery}
              onChange={(e) => {
                setDestQuery(e.target.value);
                geoSearch(e.target.value, destSearchTimerRef, setDestGeoResults);
              }}
              placeholder="Where to?"
              className="flex-1 bg-transparent text-base font-medium text-foreground focus:outline-none"
            />
            {destQuery.length > 0 && (
              <button type="button" aria-label="Clear search" onClick={() => { setDestQuery(""); setDestGeoResults([]); }}>
                <X size={18} className="text-muted-foreground" />
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {destGeoResults.map((r) => (
              <button key={r.sublabel} type="button" onClick={() => selectDestination(r.name, r.coords)}
                className="w-full flex items-center gap-3 px-4 py-4 hover:bg-muted/30 active:bg-muted/50 text-left border-b border-border/50">
                <div className="w-10 h-10 rounded-full bg-muted/20 border border-border flex items-center justify-center flex-shrink-0">
                  <MapPin size={18} className="text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{r.name}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{r.sublabel}</p>
                </div>
              </button>
            ))}
            {destGeoResults.length === 0 && destQuery.length >= 2 && (
              <p className="text-sm text-muted-foreground text-center py-10">Searching…</p>
            )}
            {destQuery.length < 2 && (
              <p className="text-sm text-muted-foreground text-center py-10">Type your destination</p>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
