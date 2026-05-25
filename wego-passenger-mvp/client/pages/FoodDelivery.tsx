import { useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { UtensilsCrossed, ChevronLeft, MapPin, Clock, Check, X } from "lucide-react";
import { requestRide } from "@/lib/db";
import { useAuth } from "@/context/AuthContext";

// ── Pricing constants ────────────────────────────────────────────────────────
const WEGO_FEE_PCT = 0.12;
const WEGO_DISCOUNT = 0.85;
const MIN_DELIVERY_FEE = 9.00;
const UBER_BASE = 1.35;
const UBER_BOOKING = 2.50;
const UBER_PER_MILE = 1.25;
const UBER_PER_MIN = 0.22;
const MINS_PER_MILE = 1.35;

// ── Known coords ─────────────────────────────────────────────────────────────
const KNOWN_COORDS: Record<string, [number, number]> = {
  "Current Location":              [37.3541, -121.9552],
  "San Jose Downtown":             [37.3382, -121.8863],
  "SFO Airport":                   [37.6213, -122.3790],
  "Union Square":                  [37.7880, -122.4074],
  "Stanford University":           [37.4275, -122.1697],
  "Google Campus":                 [37.4220, -122.0841],
  "Apple Park":                    [37.3349, -122.0090],
  "Fisherman's Wharf":             [37.8087, -122.4098],
  "Downtown Oakland":              [37.8044, -122.2712],
  "Palo Alto Caltrain":            [37.4432, -122.1630],
  "Santa Clara Convention Center": [37.4053, -121.9758],
  // Restaurants
  "The Mission Burrito Co.":       [37.7575, -122.4195],
  "Tony's Pizza Napoletana":       [37.7993, -122.4077],
  "Burma Superstar":               [37.7829, -122.4679],
  "Gracias Madre":                 [37.7624, -122.4195],
  "In-N-Out Burger SJ":            [37.3218, -121.9579],
  "Din Tai Fung Campbell":         [37.2877, -121.9325],
  "Cheesecake Factory SJ":         [37.2459, -121.8819],
  "The Counter San Jose":          [37.2965, -121.9192],
};

const RESTAURANT_SUGGESTIONS = [
  { label: "The Mission Burrito Co.",  sublabel: "2801 Mission St, San Francisco" },
  { label: "Tony's Pizza Napoletana",  sublabel: "1570 Stockton St, San Francisco" },
  { label: "Burma Superstar",          sublabel: "309 Clement St, San Francisco" },
  { label: "Gracias Madre",            sublabel: "2211 Mission St, San Francisco" },
  { label: "In-N-Out Burger SJ",       sublabel: "4040 Stevens Creek Blvd, San Jose" },
  { label: "Din Tai Fung Campbell",    sublabel: "1875 S Bascom Ave, Campbell" },
  { label: "Cheesecake Factory SJ",    sublabel: "925 Blossom Hill Rd, San Jose" },
  { label: "The Counter San Jose",     sublabel: "2869 Meridian Ave, San Jose" },
];

const ADDRESS_SUGGESTIONS = [
  { label: "San Jose Downtown",             sublabel: "S 1st St, San Jose" },
  { label: "Union Square",                  sublabel: "333 Post St, San Francisco" },
  { label: "Stanford University",           sublabel: "450 Serra Mall, Stanford" },
  { label: "Google Campus",                 sublabel: "1600 Amphitheatre Pkwy, Mountain View" },
  { label: "Apple Park",                    sublabel: "One Apple Park Way, Cupertino" },
  { label: "Fisherman's Wharf",             sublabel: "Jefferson St, San Francisco" },
  { label: "Downtown Oakland",              sublabel: "Broadway & 14th St, Oakland" },
  { label: "Palo Alto Caltrain",            sublabel: "95 University Ave, Palo Alto" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

async function geocode(address: string): Promise<[number, number] | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=us`;
    const res = await fetch(url, { headers: { "Accept-Language": "en" } });
    const data = await res.json();
    if (data.length > 0) return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
  } catch { /* ignored */ }
  return null;
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

function calcDeliveryFare(c1: [number, number], c2: [number, number]): { fare: number; miles: number; mins: number } {
  const miles = Math.max(1, Math.round(haversineDistance(c1[0], c1[1], c2[0], c2[1]) * 10) / 10);
  const mins = Math.round(5 + miles * MINS_PER_MILE);
  const uberX = Math.max(7, UBER_BASE + UBER_BOOKING + miles * UBER_PER_MILE + mins * UBER_PER_MIN);
  const fare = Math.max(MIN_DELIVERY_FEE, Math.round(uberX * WEGO_DISCOUNT * 100) / 100);
  return { fare, miles, mins };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FoodDelivery() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [restaurantAddress, setRestaurantAddress] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [restaurantCoords, setRestaurantCoords] = useState<[number, number] | null>(null);
  const [deliveryCoords, setDeliveryCoords] = useState<[number, number] | null>(null);
  const [restaurantFocused, setRestaurantFocused] = useState(false);
  const [deliveryFocused, setDeliveryFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const restaurantBlurRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deliveryBlurRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const route = useMemo(() => {
    if (!restaurantCoords || !deliveryCoords) return null;
    return calcDeliveryFare(restaurantCoords, deliveryCoords);
  }, [restaurantCoords, deliveryCoords]);

  const coopFee = route ? Math.round(route.fare * WEGO_FEE_PCT * 100) / 100 : 0;
  const driverTake = route ? Math.round((route.fare - coopFee) * 100) / 100 : 0;

  const restaurantSuggestions = restaurantAddress.trim().length > 0
    ? RESTAURANT_SUGGESTIONS.filter(s =>
        s.label.toLowerCase().includes(restaurantAddress.toLowerCase()) ||
        s.sublabel.toLowerCase().includes(restaurantAddress.toLowerCase())
      ).slice(0, 5)
    : RESTAURANT_SUGGESTIONS.slice(0, 5);

  const deliverySuggestions = deliveryAddress.trim().length > 0
    ? ADDRESS_SUGGESTIONS.filter(s =>
        s.label.toLowerCase().includes(deliveryAddress.toLowerCase()) ||
        s.sublabel.toLowerCase().includes(deliveryAddress.toLowerCase())
      ).slice(0, 4)
    : ADDRESS_SUGGESTIONS.slice(0, 4);

  const selectRestaurant = (label: string) => {
    setRestaurantAddress(label);
    const coords = KNOWN_COORDS[label] ?? null;
    setRestaurantCoords(coords);
    setRestaurantFocused(false);
    if (!coords) geocode(label).then(c => { if (c) setRestaurantCoords(c); });
  };

  const selectDelivery = (label: string) => {
    setDeliveryAddress(label);
    const coords = KNOWN_COORDS[label] ?? null;
    setDeliveryCoords(coords);
    setDeliveryFocused(false);
    if (!coords) geocode(label).then(c => { if (c) setDeliveryCoords(c); });
  };

  const handleRestaurantChange = (val: string) => {
    setRestaurantAddress(val);
    setRestaurantCoords(null);
    const coords = KNOWN_COORDS[val];
    if (coords) setRestaurantCoords(coords);
  };

  const handleDeliveryChange = (val: string) => {
    setDeliveryAddress(val);
    setDeliveryCoords(null);
    const coords = KNOWN_COORDS[val];
    if (coords) setDeliveryCoords(coords);
  };

  const handleSubmit = async () => {
    if (submitting || !restaurantAddress.trim() || !deliveryAddress.trim()) return;
    setSubmitting(true);
    setError(null);

    let rCoords = restaurantCoords;
    let dCoords = deliveryCoords;
    if (!rCoords) rCoords = await geocode(restaurantAddress);
    if (!dCoords) dCoords = await geocode(deliveryAddress);

    const finalRoute = (rCoords && dCoords)
      ? calcDeliveryFare(rCoords, dCoords)
      : { fare: MIN_DELIVERY_FEE, miles: 1, mins: 8 };

    const finalFare = finalRoute.fare;
    const finalCoopFee = Math.round(finalFare * WEGO_FEE_PCT * 100) / 100;
    const finalDriverTake = Math.round((finalFare - finalCoopFee) * 100) / 100;

    try {
      if (user) {
        await requestRide({
          passengerId: user.uid,
          passengerName: profile?.name || "Passenger",
          pickupAddress: restaurantAddress,
          dropoffAddress: deliveryAddress,
          fare: finalFare,
          type: "food",
          pickupCoords: rCoords,
          dropoffCoords: dCoords,
          estimatedMinutes: finalRoute.mins,
        });
      }
    } catch {
      setSubmitting(false);
      setError("Could not place delivery request. Check your connection and try again.");
      return;
    }

    navigate("/ride", {
      state: {
        destination: deliveryAddress,
        fare: finalFare,
        driverTake: finalDriverTake,
        coopFee: finalCoopFee,
        fromCoords: rCoords,
        toCoords: dCoords,
        estimatedMinutes: finalRoute.mins,
      },
    });
  };

  const canSubmit = restaurantAddress.trim().length > 2 && deliveryAddress.trim().length > 2 && !submitting;

  return (
    <div className="bg-background min-h-screen pb-8">

      {/* Header */}
      <div className="pt-4 px-4 flex items-center gap-3 mb-6">
        <button
          type="button"
          aria-label="Back"
          onClick={() => navigate("/")}
          className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center active:scale-95 transition-transform"
        >
          <ChevronLeft size={20} className="text-foreground" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Food Delivery</h1>
          <p className="text-xs text-muted-foreground">88% of delivery fee goes directly to your driver</p>
        </div>
      </div>

      <div className="px-4 max-w-2xl mx-auto space-y-4">

        {/* Address form */}
        <div className="bg-card border border-border rounded-xl overflow-visible">

          {/* Restaurant address */}
          <div className="relative px-4 py-3.5 border-b border-border">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Restaurant Address</p>
            <div className="flex items-center gap-2">
              <UtensilsCrossed size={14} className="text-primary flex-shrink-0" />
              <input
                type="text"
                placeholder="Which restaurant?"
                value={restaurantAddress}
                onChange={e => handleRestaurantChange(e.target.value)}
                onFocus={() => {
                  if (restaurantBlurRef.current) clearTimeout(restaurantBlurRef.current);
                  setRestaurantFocused(true);
                }}
                onBlur={() => {
                  restaurantBlurRef.current = setTimeout(() => setRestaurantFocused(false), 150);
                }}
                className="flex-1 bg-transparent text-sm font-semibold text-foreground focus:outline-none placeholder:text-muted-foreground/50"
              />
              {restaurantAddress && (
                <button
                  type="button"
                  aria-label="Clear restaurant"
                  onClick={() => { setRestaurantAddress(""); setRestaurantCoords(null); }}
                  className="text-muted-foreground"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            {restaurantFocused && restaurantSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                {restaurantSuggestions.map(s => (
                  <button
                    key={s.label}
                    type="button"
                    onMouseDown={() => selectRestaurant(s.label)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 active:bg-muted/50 text-left border-b border-border/30 last:border-0"
                  >
                    <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                      <UtensilsCrossed size={10} className="text-primary" />
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

          {/* Delivery address */}
          <div className="relative px-4 py-3.5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Deliver To</p>
            <div className="flex items-center gap-2">
              <MapPin size={14} className="text-primary/60 flex-shrink-0" />
              <input
                type="text"
                placeholder="Your delivery address"
                value={deliveryAddress}
                onChange={e => handleDeliveryChange(e.target.value)}
                onFocus={() => {
                  if (deliveryBlurRef.current) clearTimeout(deliveryBlurRef.current);
                  setDeliveryFocused(true);
                }}
                onBlur={() => {
                  deliveryBlurRef.current = setTimeout(() => setDeliveryFocused(false), 150);
                }}
                className="flex-1 bg-transparent text-sm font-semibold text-foreground focus:outline-none placeholder:text-muted-foreground/50"
              />
              {deliveryAddress && (
                <button
                  type="button"
                  aria-label="Clear delivery address"
                  onClick={() => { setDeliveryAddress(""); setDeliveryCoords(null); }}
                  className="text-muted-foreground"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            {deliveryFocused && deliverySuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                {deliverySuggestions.map(s => (
                  <button
                    key={s.label}
                    type="button"
                    onMouseDown={() => selectDelivery(s.label)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 active:bg-muted/50 text-left border-b border-border/30 last:border-0"
                  >
                    <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
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

        {/* Fare card */}
        {route ? (
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Delivery Fee</p>
                <p className="text-3xl font-bold text-foreground mt-0.5">${route.fare.toFixed(2)}</p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-muted-foreground justify-end">
                  <Clock size={12} />
                  <span className="text-xs">~{route.mins} min</span>
                </div>
                <p className="text-xs text-muted-foreground">{route.miles} mi</p>
              </div>
            </div>
            <div className="space-y-1.5 text-xs text-muted-foreground border-t border-border pt-3">
              <div className="flex justify-between">
                <span>Driver earns (88%)</span>
                <span className="font-semibold text-primary">${driverTake.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>WeGo cooperative (12%)</span>
                <span>${coopFee.toFixed(2)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-primary/5 border border-primary/15 rounded-lg px-3 py-2">
              <Check size={12} className="text-primary flex-shrink-0" />
              <p className="text-xs text-primary font-medium">No surge pricing — ever. This is your final price.</p>
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground text-center py-2">
              Enter restaurant and delivery address to see your delivery fee.
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
          className="w-full py-4 rounded-xl bg-primary text-white font-bold text-base flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg shadow-primary/30 disabled:opacity-40"
        >
          {submitting ? "Placing order…" : "Request Delivery"}
        </button>

        {/* How it works */}
        <div className="bg-card border border-border rounded-xl px-4 py-3 space-y-2">
          <p className="text-xs font-semibold text-foreground">How it works</p>
          <div className="space-y-1.5 text-xs text-muted-foreground">
            <p>1. Enter the restaurant address and your delivery address.</p>
            <p>2. A nearby WeGo driver picks up your order and delivers it directly to you.</p>
            <p>3. 88% of the delivery fee goes directly to your driver — no gig worker cuts.</p>
          </div>
        </div>

      </div>
    </div>
  );
}
