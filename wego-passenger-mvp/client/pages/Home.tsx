import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, MapPin, ChevronUp, ChevronDown, Clock, Building2, X, Home as HomeIcon, Briefcase, Navigation } from "lucide-react";
import ClientMap from "@/components/ClientMap";
import { useCurrentLocation } from "@/hooks/useCurrentLocation";
import { useAuth } from "@/context/AuthContext";
import { listenToRideHistory, listenToPassengerRide, type Ride } from "@/lib/db";

function formatRelativeDate(d: Date): string {
  const diff = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff} days ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const DEFAULT_COORDS: [number, number] = [37.3541, -121.9552]; // Santa Clara fallback

function useSavedPlace(key: "home" | "work") {
  const [value, setValue] = useState<string>(() => localStorage.getItem(`wego_${key}`) ?? "");
  const save = (address: string) => {
    localStorage.setItem(`wego_${key}`, address);
    setValue(address);
  };
  const clear = () => {
    localStorage.removeItem(`wego_${key}`);
    setValue("");
  };
  return { value, save, clear };
}

const SERVICES = [
  { id: "ride",    label: "Ride",    emoji: "🚗", path: null },
  { id: "courier", label: "Courier", emoji: "📦", path: "/courier" },
  { id: "food",    label: "Food",    emoji: "🍔", path: "/food" },
  { id: "reserve", label: "Reserve", emoji: "📅", path: "/reserve" },
] as const;

const QUICK_PICKS = [
  { id: "airport",  label: "SFO Airport",   sublabel: "San Francisco Intl", icon: "✈" },
  { id: "downtown", label: "Downtown SF",   sublabel: "Market & 5th St",    icon: "🏙" },
  { id: "oakland",  label: "Oakland",       sublabel: "Jack London Square",  icon: "🌉" },
];


// Location suggestions pool for search hints
const LOCATION_SUGGESTIONS = [
  { label: "San Jose Airport (SJC)",       sublabel: "1701 Airport Blvd, San Jose" },
  { label: "San Jose Downtown",             sublabel: "S 1st St, San Jose" },
  { label: "San Jose Diridon Station",      sublabel: "65 Cahill St, San Jose" },
  { label: "SFO Airport",                   sublabel: "San Francisco Intl Terminal" },
  { label: "SFO Terminal 2",               sublabel: "San Francisco Intl" },
  { label: "San Francisco Caltrain",        sublabel: "700 4th St, San Francisco" },
  { label: "Oakland International Airport", sublabel: "1 Airport Dr, Oakland" },
  { label: "Berkeley BART Station",         sublabel: "2160 Shattuck Ave, Berkeley" },
  { label: "Stanford University",           sublabel: "450 Serra Mall, Stanford" },
  { label: "Google Campus",                 sublabel: "1600 Amphitheatre Pkwy, Mountain View" },
  { label: "Apple Park",                    sublabel: "One Apple Park Way, Cupertino" },
  { label: "Union Square",                  sublabel: "333 Post St, San Francisco" },
  { label: "Fisherman's Wharf",             sublabel: "Jefferson St, San Francisco" },
  { label: "Chase Center",                  sublabel: "1 Warriors Way, San Francisco" },
  { label: "Oracle Park",                   sublabel: "24 Willie Mays Plaza, San Francisco" },
  { label: "Caltrain Station",              sublabel: "700 4th St, San Francisco" },
  { label: "Downtown Oakland",              sublabel: "Broadway & 14th St, Oakland" },
  { label: "Palo Alto Caltrain",            sublabel: "95 University Ave, Palo Alto" },
  { label: "Santa Clara Convention Center", sublabel: "5001 Great America Pkwy, Santa Clara" },
  { label: "Santa Clara Downtown",          sublabel: "El Camino Real, Santa Clara" },
  { label: "Japantown",                     sublabel: "Post St, San Francisco" },
];

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { coords: currentCoords, loading: locationLoading } = useCurrentLocation();
  const [recentRides, setRecentRides] = useState<Ride[]>([]);
  const [ridesLoaded, setRidesLoaded] = useState(false);
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [mapResetToken, setMapResetToken] = useState(0);
  const lastMapMoveRef = useRef<number>(0);

  useEffect(() => {
    if (!user) return;
    const unsub = listenToRideHistory(user.uid, (rides) => {
      setRecentRides(rides.slice(0, 3));
      setRidesLoaded(true);
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsub = listenToPassengerRide(user.uid, (ride) => setActiveRide(ride));
    return unsub;
  }, [user]);

  // After 5 seconds of map idle, trigger ClientMap to fly back to GPS location
  useEffect(() => {
    const interval = setInterval(() => {
      const t = lastMapMoveRef.current;
      if (t > 0 && Date.now() - t >= 10000) {
        lastMapMoveRef.current = 0;
        setMapResetToken((n) => n + 1);
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);
  const [pickupPin, setPickupPin] = useState<[number, number] | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const touchStartY = useRef(0);
  const home = useSavedPlace("home");
  const work = useSavedPlace("work");
  const [editingPlace, setEditingPlace] = useState<"home" | "work" | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  const openEditPlace = (which: "home" | "work") => {
    const current = which === "home" ? home.value : work.value;
    setEditDraft(current);
    setEditingPlace(which);
    setTimeout(() => editInputRef.current?.focus(), 50);
  };

  const saveEditPlace = () => {
    if (!editingPlace) return;
    const val = editDraft.trim();
    if (val) {
      if (editingPlace === "home") home.save(val);
      else work.save(val);
    }
    setEditingPlace(null);
    setEditDraft("");
  };

  const [geocodeResults, setGeocodeResults] = useState<{ label: string; sublabel: string; coords: [number, number] }[]>([]);
  const [geocoding, setGeocoding] = useState(false);

  const staticSuggestions = query.trim().length >= 2
    ? LOCATION_SUGGESTIONS.filter((s) =>
        s.label.toLowerCase().includes(query.toLowerCase()) ||
        s.sublabel.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 4)
    : [];

  // Live Nominatim geocoding bounded to Bay Area
  useEffect(() => {
    if (query.trim().length < 2) { setGeocodeResults([]); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setGeocoding(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + " CA")}&format=json&limit=5&countrycodes=us&bounded=1&viewbox=-124.0,39.8,-119.5,36.5`;
        const res = await fetch(url, { headers: { "Accept-Language": "en" } });
        const data = await res.json();
        if (!cancelled) {
          setGeocodeResults(
            data
              .filter((r: { display_name: string }) =>
                !staticSuggestions.some((s) => s.label.toLowerCase() === r.display_name.split(",")[0].toLowerCase())
              )
              .map((r: { display_name: string; lat: string; lon: string }) => ({
                label: r.display_name.split(",")[0],
                sublabel: r.display_name.split(",").slice(1, 3).join(",").trim(),
                coords: [parseFloat(r.lat), parseFloat(r.lon)] as [number, number],
              }))
          );
        }
      } catch { if (!cancelled) setGeocodeResults([]); }
      if (!cancelled) setGeocoding(false);
    }, 500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query]);

  const selectedPickupCoords = pickupPin ?? currentCoords ?? DEFAULT_COORDS;
  const pickupState = {
    pickup: pickupPin ? "Pinned Location" : "Current Location",
    pickupCoords: selectedPickupCoords,
  };

  const handleSearchFocus = () => setDrawerOpen(true);

  const handleSelectDestination = (destination: string, coords?: [number, number]) => {
    navigate("/request", { state: { destination, destinationCoords: coords, ...pickupState } });
  };

const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const delta = touchStartY.current - e.changedTouches[0].clientY;
    if (delta > 40) setDrawerOpen(true);
    if (delta < -40) setDrawerOpen(false);
  };

  return (
    <div className="relative h-full overflow-hidden">

      {/* ── MAP BACKGROUND ── */}
      <div className="absolute inset-0 z-0">
        {locationLoading ? (
          <div className="absolute inset-0 bg-slate-900 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
        ) : (
          <ClientMap
            center={selectedPickupCoords}
            zoom={14}
            interactive
            forceResetToken={mapResetToken}
            onCenterChange={() => { lastMapMoveRef.current = Date.now(); }}
            onClickLocation={(coords) => { setPickupPin(coords); setDrawerOpen(false); }}
            className="absolute inset-0"
          />
        )}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="relative -mt-9">
            <MapPin size={38} className="text-primary drop-shadow-[0_8px_18px_rgba(0,71,255,0.45)]" />
            <div className="absolute left-1/2 top-[31px] h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-primary/30 blur-[1px]" />
          </div>
        </div>
        {pickupPin && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
            <button
              type="button"
              onClick={() => setPickupPin(null)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/90 backdrop-blur-sm border border-primary/30 shadow-lg text-xs font-semibold text-primary active:scale-95 transition-transform"
            >
              <MapPin size={11} />
              Pickup pinned · Tap to reset
            </button>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-b from-transparent via-background/40 to-background/90 pointer-events-none z-10" />
      </div>

      {/* ── TOP BRAND BAR ── */}
      <div className="relative z-20 pt-4 px-4 space-y-2">
        <div className="flex justify-center">
          <div className="glass-card px-6 py-2.5 inline-flex items-center justify-center">
            <p className="text-sm font-bold text-primary tracking-widest uppercase">WeGo</p>
          </div>
        </div>

        {/* Active ride banner */}
        {activeRide && (
          <button
            type="button"
            onClick={() => navigate("/ride")}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-primary text-white shadow-lg shadow-primary/30 active:scale-95 transition-transform"
          >
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <Navigation size={16} className="text-white" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-bold leading-tight">Ride in Progress</p>
              <p className="text-xs text-white/80 truncate">
                {activeRide.status === "pending" ? "Finding driver…" :
                 activeRide.status === "accepted" ? `${activeRide.driverName || "Driver"} is on the way` :
                 activeRide.status === "arrived" ? "Driver has arrived" :
                 "Trip in progress"}
              </p>
            </div>
            <p className="text-xs font-semibold text-white/90 flex-shrink-0">Track →</p>
          </button>
        )}
      </div>

      {/* ── BOTTOM SHEET ── */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-20 bg-card border-t border-border rounded-t-2xl shadow-2xl flex flex-col transition-transform duration-300 ease-out max-h-[78%] ${
          drawerOpen ? "translate-y-0" : "translate-y-[calc(100%-104px)]"
        }`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Handle + search — tap anywhere to toggle */}
        <div
          className="flex-shrink-0 pt-2.5 pb-3 px-4 cursor-pointer"
          onClick={() => { setDrawerOpen((o) => !o); if (drawerOpen === false) setTimeout(() => inputRef.current?.focus(), 300); }}
        >
          <div className="w-10 h-1 bg-muted-foreground/25 rounded-full mx-auto mb-3" />

          {/* Search bar */}
          <div className="flex items-center gap-3 bg-background border border-border rounded-xl px-4 py-3">
            <Search size={18} className="text-primary flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={handleSearchFocus}
              onClick={(e) => e.stopPropagation()}
              placeholder="Where to?"
              className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground text-base font-medium focus:outline-none"
            />
            {query.length > 0 && (
              <button type="button" aria-label="Clear search" onClick={(e) => { e.stopPropagation(); setQuery(""); }} className="text-muted-foreground">
                <X size={15} />
              </button>
            )}
            {!drawerOpen && !query && (
              <div className="flex items-center gap-1 text-muted-foreground pointer-events-none">
                <span className="text-[11px]">Open</span>
                <ChevronUp size={14} />
              </div>
            )}
            {drawerOpen && !query && (
              <div className="flex items-center gap-1 text-muted-foreground pointer-events-none">
                <span className="text-[11px]">Close</span>
                <ChevronDown size={14} />
              </div>
            )}
          </div>

          {/* Service tabs */}
          <div className="flex gap-2 mt-3 overflow-x-auto pb-0.5 scrollbar-hide">
            {SERVICES.map((svc) => (
              <button
                key={svc.id}
                type="button"
                onClick={() => { if (svc.path) navigate(svc.path); }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold whitespace-nowrap border flex-shrink-0 transition-colors active:scale-95 ${svc.path === null ? "bg-primary text-white border-primary" : "bg-background border-border text-foreground"}`}
              >
                <span>{svc.emoji}</span>
                {svc.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-4 pb-6 space-y-5">

          {/* ── Search suggestions ── */}
          {query.trim().length >= 2 && (
            <div className="space-y-1">
              {/* Static matches */}
              {staticSuggestions.map((s) => (
                <div key={s.label} className="flex items-stretch gap-1.5">
                  <button
                    type="button"
                    onClick={() => { handleSelectDestination(s.label); setQuery(""); }}
                    className="flex-1 flex items-center gap-3 p-3 bg-background border border-border rounded-xl hover:border-primary/40 active:scale-[0.99] transition-all text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                      <MapPin size={14} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {s.label.split(new RegExp(`(${query})`, "gi")).map((part, i) =>
                          part.toLowerCase() === query.toLowerCase()
                            ? <span key={i} className="text-primary">{part}</span>
                            : part
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{s.sublabel}</p>
                    </div>
                  </button>
                  <div className="flex flex-col gap-1">
                    <button type="button" title="Save as Home" onClick={() => { home.save(s.label); setQuery(""); }}
                      className="flex-1 w-9 flex items-center justify-center bg-background border border-border rounded-xl text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
                      <HomeIcon size={13} />
                    </button>
                    <button type="button" title="Save as Work" onClick={() => { work.save(s.label); setQuery(""); }}
                      className="flex-1 w-9 flex items-center justify-center bg-background border border-border rounded-xl text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
                      <Briefcase size={13} />
                    </button>
                  </div>
                </div>
              ))}

              {/* Live geocoded results */}
              {geocodeResults.map((r) => (
                <div key={r.label + r.sublabel} className="flex items-stretch gap-1.5">
                  <button
                    type="button"
                    onClick={() => { handleSelectDestination(r.label, r.coords); setQuery(""); }}
                    className="flex-1 flex items-center gap-3 p-3 bg-background border border-border rounded-xl hover:border-primary/40 active:scale-[0.99] transition-all text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-muted/30 border border-border flex items-center justify-center flex-shrink-0">
                      <MapPin size={14} className="text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{r.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.sublabel}</p>
                    </div>
                  </button>
                  <div className="flex flex-col gap-1">
                    <button type="button" title="Save as Home" onClick={() => { home.save(r.label); setQuery(""); }}
                      className="flex-1 w-9 flex items-center justify-center bg-background border border-border rounded-xl text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
                      <HomeIcon size={13} />
                    </button>
                    <button type="button" title="Save as Work" onClick={() => { work.save(r.label); setQuery(""); }}
                      className="flex-1 w-9 flex items-center justify-center bg-background border border-border rounded-xl text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
                      <Briefcase size={13} />
                    </button>
                  </div>
                </div>
              ))}

              {/* Loading indicator */}
              {geocoding && geocodeResults.length === 0 && staticSuggestions.length === 0 && (
                <div className="flex items-center gap-3 p-3 text-muted-foreground">
                  <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin flex-shrink-0" />
                  <span className="text-sm">Searching Bay Area…</span>
                </div>
              )}

              {/* No results at all */}
              {!geocoding && geocodeResults.length === 0 && staticSuggestions.length === 0 && (
              <div className="space-y-2">
              <button
                type="button"
                onClick={() => { handleSelectDestination(query.trim()); setQuery(""); }}
                className="w-full flex items-center gap-3 p-3 bg-background border border-primary/30 rounded-xl active:scale-[0.99] transition-all text-left"
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                  <MapPin size={14} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{query.trim()}</p>
                  <p className="text-xs text-muted-foreground">Use this address</p>
                </div>
              </button>
              {/* Save as Home / Work */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { home.save(query.trim()); setQuery(""); }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-background border border-border rounded-xl text-xs font-medium text-foreground active:scale-95 transition-all"
                >
                  <HomeIcon size={13} className="text-primary" />
                  Save as Home
                </button>
                <button
                  type="button"
                  onClick={() => { work.save(query.trim()); setQuery(""); }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-background border border-border rounded-xl text-xs font-medium text-foreground active:scale-95 transition-all"
                >
                  <Briefcase size={13} className="text-primary" />
                  Save as Work
                </button>
              </div>
            </div>
              )}
            </div>
          )}

          {/* Saved places — always shown when not searching */}
          {!query && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Saved Places</p>
              <div className="space-y-2">
                {/* Home */}
                {editingPlace === "home" ? (
                  <div className="flex items-center gap-2 p-3 bg-background border border-primary rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                      <HomeIcon size={16} className="text-primary" />
                    </div>
                    <input
                      ref={editInputRef}
                      type="text"
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveEditPlace(); if (e.key === "Escape") setEditingPlace(null); }}
                      placeholder="Enter home address"
                      className="flex-1 bg-transparent text-sm text-foreground focus:outline-none placeholder:text-muted-foreground"
                    />
                    <button type="button" onClick={saveEditPlace} className="text-xs font-bold text-primary px-2">Save</button>
                    <button type="button" aria-label="Cancel" onClick={() => setEditingPlace(null)} className="text-muted-foreground"><X size={13} /></button>
                  </div>
                ) : (
                  <div className="w-full flex items-center gap-3 p-3 bg-background border border-border rounded-xl hover:border-primary/40 transition-all">
                    <button type="button" onClick={() => home.value ? handleSelectDestination(home.value) : openEditPlace("home")}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left">
                      <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                        <HomeIcon size={16} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">Home</p>
                        {home.value
                          ? <p className="text-xs text-muted-foreground truncate">{home.value}</p>
                          : <p className="text-xs text-primary font-medium">Tap to set home address</p>
                        }
                      </div>
                    </button>
                    <button type="button" aria-label="Edit home" onClick={() => openEditPlace("home")}
                      className="text-xs text-muted-foreground hover:text-primary px-1 flex-shrink-0">Edit</button>
                    {home.value && (
                      <button type="button" aria-label="Clear home" onClick={() => home.clear()} className="text-muted-foreground p-1 flex-shrink-0">
                        <X size={13} />
                      </button>
                    )}
                  </div>
                )}
                {/* Work */}
                {editingPlace === "work" ? (
                  <div className="flex items-center gap-2 p-3 bg-background border border-primary rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                      <Briefcase size={16} className="text-primary" />
                    </div>
                    <input
                      ref={editInputRef}
                      type="text"
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveEditPlace(); if (e.key === "Escape") setEditingPlace(null); }}
                      placeholder="Enter work address"
                      className="flex-1 bg-transparent text-sm text-foreground focus:outline-none placeholder:text-muted-foreground"
                    />
                    <button type="button" onClick={saveEditPlace} className="text-xs font-bold text-primary px-2">Save</button>
                    <button type="button" aria-label="Cancel" onClick={() => setEditingPlace(null)} className="text-muted-foreground"><X size={13} /></button>
                  </div>
                ) : (
                  <div className="w-full flex items-center gap-3 p-3 bg-background border border-border rounded-xl hover:border-primary/40 transition-all">
                    <button type="button" onClick={() => work.value ? handleSelectDestination(work.value) : openEditPlace("work")}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left">
                      <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                        <Briefcase size={16} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">Work</p>
                        {work.value
                          ? <p className="text-xs text-muted-foreground truncate">{work.value}</p>
                          : <p className="text-xs text-primary font-medium">Tap to set work address</p>
                        }
                      </div>
                    </button>
                    <button type="button" aria-label="Edit work" onClick={() => openEditPlace("work")}
                      className="text-xs text-muted-foreground hover:text-primary px-1 flex-shrink-0">Edit</button>
                    {work.value && (
                      <button type="button" aria-label="Clear work" onClick={() => work.clear()} className="text-muted-foreground p-1 flex-shrink-0">
                        <X size={13} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quick picks — hide while searching */}
          {!query && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quick Picks</p>
              <div className="space-y-2">
                {QUICK_PICKS.map((pick) => (
                  <button
                    key={pick.id}
                    type="button"
                    onClick={() => handleSelectDestination(pick.label)}
                    className="w-full flex items-center gap-3 p-3 bg-background border border-border rounded-xl hover:border-primary/40 active:scale-[0.99] transition-all text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-base flex-shrink-0">
                      {pick.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{pick.label}</p>
                      <p className="text-xs text-muted-foreground">{pick.sublabel}</p>
                    </div>
                    <MapPin size={14} className="text-muted-foreground flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Recent rides — hide while searching */}
          {!query && ridesLoaded && recentRides.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recent</p>
              <div className="space-y-2">
                {recentRides.map((ride) => (
                  <button
                    key={ride.id}
                    type="button"
                    onClick={() => handleSelectDestination(ride.dropoffAddress)}
                    className="w-full flex items-center gap-3 p-3 bg-background border border-border rounded-xl hover:border-primary/40 active:scale-[0.99] transition-all text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-muted/20 border border-border flex items-center justify-center flex-shrink-0">
                      <Clock size={16} className="text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {ride.dropoffAddress}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {ride.completedAt ? formatRelativeDate(ride.completedAt) : "Recently"} · ${ride.fare.toFixed(2)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* WeGo tagline */}
          {!query && (
            <div className="bg-primary/5 border border-primary/15 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Building2 size={14} className="text-primary" />
                <p className="text-xs font-semibold text-primary uppercase tracking-wide">Why WeGo</p>
              </div>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <p>• <span className="text-foreground font-medium">88% goes to your driver</span> — not to shareholders</p>
                <p>• <span className="text-foreground font-medium">No surge pricing</span> — ever, guaranteed</p>
                <p>• <span className="text-foreground font-medium">Driver-owned</span> — your ride supports the cooperative</p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
