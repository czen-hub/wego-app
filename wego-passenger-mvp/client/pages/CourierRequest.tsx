import { useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Package, PackageOpen, Layers, Gem, ChevronLeft, MapPin, Clock, Check, X, Navigation, Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { requestRide } from "@/lib/db";
import { useAuth } from "@/context/AuthContext";

// ── Pricing ──────────────────────────────────────────────────────────────────
const WEGO_FEE_PCT = 0.12;
const WEGO_DISCOUNT = 0.85;
const UBER_BASE = 1.35;
const UBER_BOOKING = 2.50;
const UBER_PER_MILE = 1.25;
const UBER_PER_MIN = 0.22;
const MINS_PER_MILE = 1.35;

// Package types are based on how the package fits in the car, not weight.
// extraFee is added on top of the distance fare.
const PACKAGE_TYPES: {
  id: string;
  label: string;
  desc: string;
  Icon: LucideIcon;
  extraFee: number;
  minFare: number;
}[] = [
  {
    id: "standard",
    label: "Fits in Trunk",
    desc: "Any item that fits in the car trunk",
    Icon: Package,
    extraFee: 0,
    minFare: 8.00,
  },
  {
    id: "backseat",
    label: "Back Seat Needed",
    desc: "1–2 large items that won't fit in trunk",
    Icon: PackageOpen,
    extraFee: 8.00,
    minFare: 14.00,
  },
  {
    id: "fullseat",
    label: "Full Back Seat",
    desc: "3+ large items filling the whole back",
    Icon: Layers,
    extraFee: 15.00,
    minFare: 20.00,
  },
  {
    id: "fragile",
    label: "Fragile / Delicate",
    desc: "Breakables, art, electronics — extra care",
    Icon: Gem,
    extraFee: 6.00,
    minFare: 12.00,
  },
];

type PackageId = "standard" | "backseat" | "fullseat" | "fragile";

// ── Types ─────────────────────────────────────────────────────────────────────
interface AddressSuggestion {
  label: string;
  sublabel: string;
  coords: [number, number];
}

// ── Known static coords ───────────────────────────────────────────────────────
const KNOWN_COORDS: Record<string, [number, number]> = {
  "Current Location":              [37.3541, -121.9552],
  "San Jose Airport (SJC)":        [37.3626, -121.9290],
  "San Jose Downtown":             [37.3382, -121.8863],
  "San Jose Diridon Station":      [37.3297, -121.9024],
  "SFO Airport":                   [37.6213, -122.3790],
  "San Francisco Caltrain":        [37.7764, -122.3947],
  "Oakland International Airport": [37.7213, -122.2208],
  "Berkeley BART Station":         [37.8699, -122.2680],
  "Stanford University":           [37.4275, -122.1697],
  "Google Campus":                 [37.4220, -122.0841],
  "Apple Park":                    [37.3349, -122.0090],
  "Union Square":                  [37.7880, -122.4074],
  "Fisherman's Wharf":             [37.8087, -122.4098],
  "Downtown Oakland":              [37.8044, -122.2712],
  "Palo Alto Caltrain":            [37.4432, -122.1630],
  "Santa Clara Convention Center": [37.4053, -121.9758],
};

const PICKUP_SUGGESTIONS = [
  { label: "Current Location",              sublabel: "Use your GPS location" },
  { label: "San Jose Airport (SJC)",        sublabel: "1701 Airport Blvd, San Jose" },
  { label: "San Jose Downtown",             sublabel: "S 1st St, San Jose" },
  { label: "SFO Airport",                   sublabel: "San Francisco Intl Terminal" },
  { label: "San Francisco Caltrain",        sublabel: "700 4th St, San Francisco" },
  { label: "Stanford University",           sublabel: "450 Serra Mall, Stanford" },
  { label: "Google Campus",                 sublabel: "1600 Amphitheatre Pkwy, Mountain View" },
  { label: "Apple Park",                    sublabel: "One Apple Park Way, Cupertino" },
  { label: "Downtown Oakland",              sublabel: "Broadway & 14th St, Oakland" },
  { label: "Palo Alto Caltrain",            sublabel: "95 University Ave, Palo Alto" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function geocode(address: string): Promise<[number, number] | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=us`;
    const res = await fetch(url, { headers: { "Accept-Language": "en" } });
    const data = await res.json();
    if (data.length > 0) return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
  } catch { /* ignored */ }
  return null;
}

async function searchAddresses(query: string): Promise<AddressSuggestion[]> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=us&addressdetails=1`;
    const res = await fetch(url, { headers: { "Accept-Language": "en" } });
    const data: Array<{
      display_name: string;
      lat: string;
      lon: string;
      address?: { road?: string; city?: string; state?: string; house_number?: string };
    }> = await res.json();
    return data.map(item => {
      const addr = item.address ?? {};
      const road = [addr.house_number, addr.road].filter(Boolean).join(" ");
      const label = road
        ? `${road}, ${addr.city || ""}`
        : item.display_name.split(",").slice(0, 2).join(",");
      const sublabel = [addr.city, addr.state].filter(Boolean).join(", ");
      return {
        label: label.trim().replace(/,\s*$/, ""),
        sublabel: sublabel || item.display_name.split(",").slice(2, 4).join(",").trim(),
        coords: [parseFloat(item.lat), parseFloat(item.lon)] as [number, number],
      };
    });
  } catch { /* ignored */ }
  return [];
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
    * Math.sin(dLon / 2) ** 2;
  const straight = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return straight * (straight > 25 ? 1.25 : 1.15);
}

function calcCourierFare(
  c1: [number, number],
  c2: [number, number],
  extraFee: number,
  minFare: number,
): { fare: number; miles: number; mins: number } {
  const miles = Math.max(1, Math.round(haversineDistance(c1[0], c1[1], c2[0], c2[1]) * 10) / 10);
  const mins = Math.round(5 + miles * MINS_PER_MILE);
  const uberX = Math.max(7, UBER_BASE + UBER_BOOKING + miles * UBER_PER_MILE + mins * UBER_PER_MIN);
  const distanceFare = Math.round(uberX * WEGO_DISCOUNT * 100) / 100;
  const fare = Math.round((Math.max(minFare, distanceFare) + extraFee) * 100) / 100;
  return { fare, miles, mins };
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function CourierRequest() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [pickupAddress, setPickupAddress] = useState("Current Location");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [pickupCoords, setPickupCoords] = useState<[number, number] | null>(
    KNOWN_COORDS["Current Location"]
  );
  const [dropoffCoords, setDropoffCoords] = useState<[number, number] | null>(null);
  const [pickupFocused, setPickupFocused] = useState(false);
  const [dropoffFocused, setDropoffFocused] = useState(false);
  const [packageId, setPackageId] = useState<PackageId>("standard");
  const [instructions, setInstructions] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Delivery address geocoding state
  const [geocodingDropoff, setGeocodingDropoff] = useState(false);
  const [dropoffGeoFailed, setDropoffGeoFailed] = useState(false);
  const [liveSuggestions, setLiveSuggestions] = useState<AddressSuggestion[]>([]);
  const [searchingDropoff, setSearchingDropoff] = useState(false);

  const pickupBlurRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropoffBlurRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedPackage = PACKAGE_TYPES.find(p => p.id === packageId)!;

  const route = useMemo(() => {
    if (!pickupCoords || !dropoffCoords) return null;
    return calcCourierFare(pickupCoords, dropoffCoords, selectedPackage.extraFee, selectedPackage.minFare);
  }, [pickupCoords, dropoffCoords, selectedPackage]);

  const coopFee = route ? Math.round(route.fare * WEGO_FEE_PCT * 100) / 100 : 0;
  const driverTake = route ? Math.round((route.fare - coopFee) * 100) / 100 : 0;

  const pickupSuggestions = pickupAddress.trim().length > 0
    ? PICKUP_SUGGESTIONS.filter(s =>
        s.label.toLowerCase().includes(pickupAddress.toLowerCase()) ||
        s.sublabel.toLowerCase().includes(pickupAddress.toLowerCase())
      ).slice(0, 5)
    : PICKUP_SUGGESTIONS.slice(0, 5);

  const selectPickup = (label: string) => {
    setPickupAddress(label);
    const coords = KNOWN_COORDS[label] ?? null;
    setPickupCoords(coords);
    setPickupFocused(false);
    if (!coords) geocode(label).then(c => { if (c) setPickupCoords(c); });
  };

  const selectDropoff = (s: AddressSuggestion) => {
    if (dropoffBlurRef.current) clearTimeout(dropoffBlurRef.current);
    if (searchRef.current) clearTimeout(searchRef.current);
    setDropoffAddress(s.label);
    setDropoffCoords(s.coords);
    setDropoffFocused(false);
    setDropoffGeoFailed(false);
    setLiveSuggestions([]);
    setSearchingDropoff(false);
  };

  const handlePickupChange = (val: string) => {
    setPickupAddress(val);
    setPickupCoords(KNOWN_COORDS[val] ?? null);
  };

  const handleDropoffChange = (val: string) => {
    setDropoffAddress(val);
    setDropoffCoords(KNOWN_COORDS[val] ?? null);
    setDropoffGeoFailed(false);

    if (searchRef.current) clearTimeout(searchRef.current);
    if (val.trim().length >= 3) {
      setSearchingDropoff(true);
      searchRef.current = setTimeout(async () => {
        const results = await searchAddresses(val);
        setLiveSuggestions(results);
        setSearchingDropoff(false);
      }, 400);
    } else {
      setLiveSuggestions([]);
      setSearchingDropoff(false);
    }
  };

  const handleDropoffBlur = () => {
    dropoffBlurRef.current = setTimeout(async () => {
      setDropoffFocused(false);
      setLiveSuggestions([]);
      if (dropoffAddress.trim().length > 2 && !dropoffCoords) {
        setGeocodingDropoff(true);
        const coords = await geocode(dropoffAddress);
        if (coords) {
          setDropoffCoords(coords);
          setDropoffGeoFailed(false);
        } else {
          setDropoffGeoFailed(true);
        }
        setGeocodingDropoff(false);
      }
    }, 200);
  };

  const handleSubmit = async () => {
    if (submitting || !pickupAddress.trim() || !dropoffAddress.trim()) return;
    setSubmitting(true);
    setError(null);

    let pCoords = pickupCoords;
    let dCoords = dropoffCoords;
    if (!pCoords) pCoords = await geocode(pickupAddress);
    if (!dCoords) dCoords = await geocode(dropoffAddress);

    if (!dCoords) {
      setSubmitting(false);
      setError("Could not locate the delivery address. Select from the suggestions or enter a more specific address.");
      setDropoffGeoFailed(true);
      return;
    }

    const finalRoute = (pCoords && dCoords)
      ? calcCourierFare(pCoords, dCoords, selectedPackage.extraFee, selectedPackage.minFare)
      : { fare: selectedPackage.minFare + selectedPackage.extraFee, miles: 1, mins: 10 };

    const finalFare = finalRoute.fare;
    const finalCoopFee = Math.round(finalFare * WEGO_FEE_PCT * 100) / 100;
    const finalDriverTake = Math.round((finalFare - finalCoopFee) * 100) / 100;

    const deliveryNotes = instructions.trim()
      ? `${selectedPackage.label} — ${instructions.trim()}`
      : selectedPackage.label;

    try {
      if (user) {
        await requestRide({
          passengerId: user.uid,
          passengerName: profile?.name || "Passenger",
          pickupAddress,
          dropoffAddress: `${dropoffAddress} [${deliveryNotes}]`,
          fare: finalFare,
          type: "courier",
          pickupCoords: pCoords,
          dropoffCoords: dCoords,
          estimatedMinutes: finalRoute.mins,
        });
      }
    } catch {
      setSubmitting(false);
      setError("Could not place courier request. Check your connection and try again.");
      return;
    }

    navigate("/ride", {
      state: {
        destination: dropoffAddress,
        fare: finalFare,
        driverTake: finalDriverTake,
        coopFee: finalCoopFee,
        fromCoords: pCoords,
        toCoords: dCoords,
        estimatedMinutes: finalRoute.mins,
      },
    });
  };

  const canSubmit =
    pickupAddress.trim().length > 2 &&
    dropoffAddress.trim().length > 2 &&
    dropoffCoords !== null &&
    !geocodingDropoff &&
    !submitting;

  return (
    <div className="bg-background min-h-screen pb-8">

      {/* Header */}
      <div className="pt-4 px-4 flex items-center gap-3 mb-6">
        <button
          type="button"
          aria-label="Back"
          onClick={() => navigate("/")}
          className="w-9 h-9 rounded-xl bg-secondary border border-border flex items-center justify-center active:scale-95 transition-transform"
        >
          <ChevronLeft size={20} className="text-foreground" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Courier Delivery</h1>
          <p className="text-xs text-muted-foreground">Send a package with a WeGo driver</p>
        </div>
      </div>

      <div className="px-4 max-w-2xl mx-auto space-y-4">

        {/* Package type */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-2">How does it fit?</p>
          <div className="grid grid-cols-2 gap-2">
            {PACKAGE_TYPES.map(pkg => (
              <button
                key={pkg.id}
                type="button"
                onClick={() => setPackageId(pkg.id)}
                className={`flex items-start gap-3 px-3 py-3 rounded-xl border text-left transition-all active:scale-95 ${
                  packageId === pkg.id
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  packageId === pkg.id ? "bg-primary/10" : "bg-secondary border border-border"
                }`}>
                  <pkg.Icon size={17} className={packageId === pkg.id ? "text-primary" : "text-muted-foreground"} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-xs font-semibold text-foreground truncate">{pkg.label}</p>
                    {pkg.extraFee > 0 && (
                      <span className="text-[10px] font-bold text-muted-foreground flex-shrink-0">+${pkg.extraFee.toFixed(0)}</span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5">{pkg.desc}</p>
                </div>
                {packageId === pkg.id && (
                  <Check size={13} className="text-primary flex-shrink-0 mt-0.5" />
                )}
              </button>
            ))}
          </div>
          {selectedPackage.extraFee > 0 && (
            <p className="text-[10px] text-primary px-1 mt-1.5">
              +${selectedPackage.extraFee.toFixed(2)} size fee added to your delivery rate.
            </p>
          )}
        </div>

        {/* Address form */}
        <div className="bg-card border border-border rounded-xl overflow-visible">

          {/* Pickup */}
          <div className="relative px-4 py-3.5 border-b border-border">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Pickup Address</p>
            <div className="flex items-center gap-2">
              <Navigation size={14} className="text-primary flex-shrink-0" />
              <input
                type="text"
                placeholder="Where should the driver pick up?"
                value={pickupAddress}
                onChange={e => handlePickupChange(e.target.value)}
                onFocus={() => {
                  if (pickupBlurRef.current) clearTimeout(pickupBlurRef.current);
                  setPickupFocused(true);
                  if (pickupAddress === "Current Location") setPickupAddress("");
                }}
                onBlur={() => {
                  pickupBlurRef.current = setTimeout(() => {
                    setPickupFocused(false);
                    if (!pickupAddress.trim()) {
                      setPickupAddress("Current Location");
                      setPickupCoords(KNOWN_COORDS["Current Location"]);
                    }
                  }, 150);
                }}
                className="flex-1 bg-transparent text-sm font-semibold text-foreground focus:outline-none placeholder:text-muted-foreground/50"
              />
              {pickupAddress && pickupAddress !== "Current Location" && (
                <button
                  type="button"
                  aria-label="Clear pickup"
                  onClick={() => { setPickupAddress("Current Location"); setPickupCoords(KNOWN_COORDS["Current Location"]); }}
                  className="text-muted-foreground"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            {pickupFocused && pickupSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                {pickupSuggestions.map(s => (
                  <button
                    key={s.label}
                    type="button"
                    onMouseDown={() => selectPickup(s.label)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 active:bg-muted/50 text-left border-b border-border/30 last:border-0"
                  >
                    <div className="w-8 h-8 rounded-xl bg-secondary border border-border flex items-center justify-center flex-shrink-0">
                      <MapPin size={10} className="text-primary" />
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
          <div className="relative px-4 py-3.5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Delivery Address</p>
            <div className="flex items-center gap-2">
              {geocodingDropoff || searchingDropoff ? (
                <Loader2 size={14} className="text-primary flex-shrink-0 animate-spin" />
              ) : dropoffCoords ? (
                <Check size={14} className="text-green-500 flex-shrink-0" />
              ) : (
                <MapPin size={14} className={dropoffGeoFailed ? "text-destructive flex-shrink-0" : "text-primary/60 flex-shrink-0"} />
              )}
              <input
                type="text"
                placeholder="Start typing a delivery address…"
                value={dropoffAddress}
                onChange={e => handleDropoffChange(e.target.value)}
                onFocus={() => {
                  if (dropoffBlurRef.current) clearTimeout(dropoffBlurRef.current);
                  setDropoffFocused(true);
                }}
                onBlur={handleDropoffBlur}
                className="flex-1 bg-transparent text-sm font-semibold text-foreground focus:outline-none placeholder:text-muted-foreground/50"
              />
              {dropoffAddress && (
                <button
                  type="button"
                  aria-label="Clear delivery address"
                  onClick={() => {
                    setDropoffAddress("");
                    setDropoffCoords(null);
                    setDropoffGeoFailed(false);
                    setLiveSuggestions([]);
                  }}
                  className="text-muted-foreground"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Geocode failed hint */}
            {dropoffGeoFailed && !dropoffFocused && (
              <p className="text-[10px] text-destructive mt-1.5">
                Address not found. Try selecting from the suggestions below.
              </p>
            )}

            {/* Confirmed hint */}
            {dropoffCoords && !dropoffFocused && !geocodingDropoff && (
              <p className="text-[10px] text-green-600 mt-1">Address confirmed.</p>
            )}

            {/* Live search suggestions */}
            {dropoffFocused && (liveSuggestions.length > 0 || searchingDropoff) && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                {searchingDropoff && liveSuggestions.length === 0 && (
                  <div className="flex items-center gap-2 px-4 py-3 text-muted-foreground">
                    <Loader2 size={12} className="animate-spin" />
                    <span className="text-xs">Searching addresses…</span>
                  </div>
                )}
                {liveSuggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onMouseDown={() => selectDropoff(s)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 active:bg-muted/50 text-left border-b border-border/30 last:border-0"
                  >
                    <div className="w-8 h-8 rounded-xl bg-secondary border border-border flex items-center justify-center flex-shrink-0">
                      <MapPin size={10} className="text-primary/70" />
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

        {/* Special instructions */}
        <div>
          <label
            htmlFor="courier-instructions"
            className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 block mb-1.5"
          >
            Delivery Instructions <span className="text-muted-foreground/50 normal-case">(optional)</span>
          </label>
          <textarea
            id="courier-instructions"
            rows={2}
            value={instructions}
            onChange={e => setInstructions(e.target.value)}
            placeholder="e.g. Leave at front door, ring doorbell, fragile — handle with care"
            className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary resize-none placeholder:text-muted-foreground/50"
          />
        </div>

        {/* Fare card */}
        {route ? (
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Courier Fee</p>
                <p className="text-3xl font-bold text-foreground mt-0.5">${route.fare.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{selectedPackage.label}</p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-muted-foreground justify-end">
                  <Clock size={12} />
                  <span className="text-xs">~{route.mins} min</span>
                </div>
                <p className="text-xs text-muted-foreground">{route.miles} mi</p>
              </div>
            </div>
            <div className="space-y-1 border-t border-border pt-2">
              {selectedPackage.extraFee > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Size fee ({selectedPackage.label})</span>
                  <span>+${selectedPackage.extraFee.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Driver earns (88%)</span>
                <span className="font-semibold text-primary">${driverTake.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>WeGo Cooperative (12%)</span>
                <span>${coopFee.toFixed(2)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground text-center py-2">
              {dropoffAddress.trim().length > 2 && !dropoffCoords
                ? geocodingDropoff
                  ? "Locating delivery address…"
                  : "Enter and confirm a delivery address to see your courier fee."
                : "Enter pickup and delivery addresses to see your courier fee."}
            </p>
          </div>
        )}

        {error && (
          <div className="bg-destructive/10 border border-destructive/25 rounded-xl px-4 py-3">
            <p className="text-sm text-destructive font-medium">{error}</p>
          </div>
        )}

        {/* Submit */}
        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleSubmit}
          className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-base flex items-center justify-center gap-2 active:scale-95 transition-transform btn-glow disabled:opacity-40"
        >
          <Package size={18} />
          {submitting
            ? "Placing request…"
            : geocodingDropoff
              ? "Locating address…"
              : !dropoffCoords && dropoffAddress.trim().length > 2
                ? "Confirm delivery address"
                : "Request Courier"}
        </button>

        {/* Info */}
        <div className="bg-card border border-border rounded-xl px-4 py-3 space-y-2">
          <p className="text-xs font-semibold text-foreground">Size guide</p>
          <div className="space-y-1.5 text-xs text-muted-foreground">
            <p><span className="font-medium text-foreground">Fits in Trunk</span> — any box or bag that fits in a standard car trunk.</p>
            <p><span className="font-medium text-foreground">Back Seat Needed</span> — 1–2 large items that won't fit in the trunk (+$8).</p>
            <p><span className="font-medium text-foreground">Full Back Seat</span> — 3+ large boxes or items filling the whole back (+$15).</p>
            <p><span className="font-medium text-foreground">Fragile</span> — breakables, artwork, or electronics needing extra care (+$6).</p>
          </div>
        </div>

      </div>
    </div>
  );
}
