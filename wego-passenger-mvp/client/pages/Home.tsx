import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, MapPin, ChevronUp, ChevronDown, Clock, Building2, X, Home as HomeIcon, Briefcase, Navigation, Compass, Car, Package, Utensils, CalendarDays } from "lucide-react";
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
  { id: "ride",    label: "Ride",    Icon: Car,          path: null },
  { id: "courier", label: "Courier", Icon: Package,      path: "/courier" },
  { id: "food",    label: "Food",    Icon: Utensils,     path: "/food" },
  { id: "reserve", label: "Reserve", Icon: CalendarDays, path: "/reserve" },
] as const;

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { coords: currentCoords, accuracy, loading: locationLoading } = useCurrentLocation();
  const [recentRides, setRecentRides] = useState<Ride[]>([]);
  const [ridesLoaded, setRidesLoaded] = useState(false);
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [mapResetToken, setMapResetToken] = useState(0);
  const [headingUp, setHeadingUp] = useState(false);
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

  // After 10 seconds of map idle, trigger ClientMap to fly back to GPS location
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const touchStartY = useRef(0);
  const home = useSavedPlace("home");
  const work = useSavedPlace("work");
  const [editingPlace, setEditingPlace] = useState<"home" | "work" | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const searchSessionRef = useRef<string>(crypto.randomUUID());

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
    setPlaceResults([]);
  };

  const [geocodeResults, setGeocodeResults] = useState<{ label: string; sublabel: string; fullAddress: string; mapboxId: string; isBusiness: boolean }[]>([]);
  const [geocoding, setGeocoding] = useState(false);
  const [placeResults, setPlaceResults] = useState<{ label: string; sublabel: string; fullAddress: string }[]>([]);

  // ±1.5° bbox around GPS (~150 mile box) keeps results within the user's state
  const gpsBbox = currentCoords
    ? `&bbox=${(currentCoords[1] - 1.5).toFixed(4)},${(currentCoords[0] - 1.5).toFixed(4)},${(currentCoords[1] + 1.5).toFixed(4)},${(currentCoords[0] + 1.5).toFixed(4)}`
    : "";

  // Main search — Mapbox SearchBox suggest (finds businesses, airports, addresses)
  useEffect(() => {
    if (query.trim().length < 2) { setGeocodeResults([]); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setGeocoding(true);
      try {
        const prox = currentCoords ? `&proximity=${currentCoords[1]},${currentCoords[0]}` : "";
        const url = `https://api.mapbox.com/search/searchbox/v1/suggest?q=${encodeURIComponent(query.trim())}&session_token=${searchSessionRef.current}&language=en&country=us&limit=6${prox}&access_token=${MAPBOX_TOKEN}`;
        const res = await fetch(url);
        const data = await res.json();
        if (!cancelled) {
          setGeocodeResults(
            (data.suggestions ?? []).map((s: { name: string; place_formatted: string; full_address: string; mapbox_id: string; feature_type: string }) => ({
              label: s.name,
              sublabel: s.place_formatted,
              fullAddress: s.full_address,
              mapboxId: s.mapbox_id,
              isBusiness: s.feature_type === "poi",
            }))
          );
        }
      } catch { if (!cancelled) setGeocodeResults([]); }
      if (!cancelled) setGeocoding(false);
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, currentCoords]);

  // Saved-place edit — Mapbox SearchBox suggest (saves full_address for geocodability)
  useEffect(() => {
    if (!editingPlace || editDraft.trim().length < 2) { setPlaceResults([]); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const prox = currentCoords ? `&proximity=${currentCoords[1]},${currentCoords[0]}` : "";
        const url = `https://api.mapbox.com/search/searchbox/v1/suggest?q=${encodeURIComponent(editDraft.trim())}&session_token=${searchSessionRef.current}&language=en&country=us&limit=5${prox}&access_token=${MAPBOX_TOKEN}`;
        const res = await fetch(url);
        const data = await res.json();
        if (!cancelled) {
          setPlaceResults(
            (data.suggestions ?? []).map((s: { name: string; place_formatted: string; full_address: string }) => ({
              label: s.name,
              sublabel: s.place_formatted,
              fullAddress: s.full_address,
            }))
          );
        }
      } catch { if (!cancelled) setPlaceResults([]); }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [editDraft, editingPlace, currentCoords]);

  const selectedPickupCoords = currentCoords ?? DEFAULT_COORDS;
  const pickupState = {
    pickup: "Current Location",
    pickupCoords: selectedPickupCoords,
  };

  const handleSearchFocus = () => setDrawerOpen(true);

  const handleSelectDestination = async (destination: string, mapboxId?: string) => {
    let coords: [number, number] | undefined;
    if (mapboxId) {
      try {
        const res = await fetch(`https://api.mapbox.com/search/searchbox/v1/retrieve/${mapboxId}?session_token=${searchSessionRef.current}&access_token=${MAPBOX_TOKEN}`);
        const data = await res.json();
        const center = data.features?.[0]?.geometry?.coordinates as [number, number] | undefined;
        if (center) coords = [center[1], center[0]];
      } catch {}
      searchSessionRef.current = crypto.randomUUID();
    }
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
            driverPos={currentCoords ?? undefined}
            accuracy={accuracy ?? undefined}
            forceResetToken={mapResetToken}
            followBearing={headingUp}
            onCenterChange={() => { lastMapMoveRef.current = Date.now(); }}
            className="absolute inset-0"
          />
        )}
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-b from-transparent via-background/40 to-background/90 pointer-events-none z-10" />
      </div>

      {/* ── MAP BUTTONS ── */}
      <div className="absolute bottom-[160px] right-4 z-10 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => {
            lastMapMoveRef.current = 0;
            setMapResetToken((n) => n + 1);
          }}
          aria-label="Recenter map"
          className="w-[42px] h-[42px] bg-card/90 backdrop-blur-sm border border-border rounded-xl shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        >
          <Navigation size={18} className="text-primary" />
        </button>
        <button
          type="button"
          onClick={() => {
            setHeadingUp((h) => !h);
            const oe = (window as any).DeviceOrientationEvent;
            if (typeof oe?.requestPermission === "function") oe.requestPermission().catch(() => {});
          }}
          aria-label="Toggle heading-up mode"
          className={`w-[42px] h-[42px] rounded-xl shadow-lg flex items-center justify-center active:scale-95 transition-all ${headingUp ? "bg-primary" : "bg-card/90 backdrop-blur-sm border border-border"}`}
        >
          <Compass size={18} className={headingUp ? "text-background" : "text-primary"} />
        </button>
      </div>

      {/* ── TOP BRAND BAR ── */}
      <div className="relative z-20 pt-4 px-4 space-y-2">
        <div className="flex justify-center">
          <div className="flex items-center gap-2 px-4 py-2 bg-card/90 backdrop-blur-sm border border-border rounded-full shadow-lg">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <p className="text-xs font-bold text-primary tracking-widest uppercase">WeGo</p>
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
                <svc.Icon size={14} strokeWidth={2} />
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
              {/* Live geocoded results */}
              {geocodeResults.map((r) => (
                <div key={r.label + r.sublabel} className="flex items-stretch gap-1.5">
                  <button
                    type="button"
                    onClick={() => { handleSelectDestination(r.label, r.mapboxId); setQuery(""); }}
                    className="flex-1 flex items-center gap-3 p-3 bg-background border border-border rounded-xl hover:border-primary/40 active:scale-[0.99] transition-all text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-muted/30 border border-border flex items-center justify-center flex-shrink-0">
                      {r.isBusiness
                        ? <Building2 size={14} className="text-muted-foreground" />
                        : <MapPin size={14} className="text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{r.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.sublabel}</p>
                    </div>
                  </button>
                  <div className="flex flex-col gap-1">
                    <button type="button" title="Save as Home" onClick={() => { home.save(r.fullAddress || r.label); setQuery(""); }}
                      className="flex-1 w-9 flex items-center justify-center bg-background border border-border rounded-xl text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
                      <HomeIcon size={13} />
                    </button>
                    <button type="button" title="Save as Work" onClick={() => { work.save(r.fullAddress || r.label); setQuery(""); }}
                      className="flex-1 w-9 flex items-center justify-center bg-background border border-border rounded-xl text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
                      <Briefcase size={13} />
                    </button>
                  </div>
                </div>
              ))}

              {/* Loading indicator */}
              {geocoding && geocodeResults.length === 0 && (
                <div className="flex items-center gap-3 p-3 text-muted-foreground">
                  <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin flex-shrink-0" />
                  <span className="text-sm">Searching…</span>
                </div>
              )}

              {/* No results at all */}
              {!geocoding && geocodeResults.length === 0 && (
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
                  <div className="space-y-1">
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
                    {placeResults.length > 0 && (
                      <div className="bg-background border border-border rounded-xl overflow-hidden">
                        {placeResults.map((r) => (
                          <button key={r.label + r.sublabel} type="button"
                            onClick={() => { setEditDraft(r.fullAddress || r.label); home.save(r.fullAddress || r.label); setEditingPlace(null); setPlaceResults([]); }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-primary/5 active:bg-primary/10 transition-colors text-left border-b border-border last:border-0">
                            <MapPin size={13} className="text-muted-foreground flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{r.label}</p>
                              <p className="text-xs text-muted-foreground truncate">{r.sublabel}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
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
                  <div className="space-y-1">
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
                    {placeResults.length > 0 && (
                      <div className="bg-background border border-border rounded-xl overflow-hidden">
                        {placeResults.map((r) => (
                          <button key={r.label + r.sublabel} type="button"
                            onClick={() => { setEditDraft(r.fullAddress || r.label); work.save(r.fullAddress || r.label); setEditingPlace(null); setPlaceResults([]); }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-primary/5 active:bg-primary/10 transition-colors text-left border-b border-border last:border-0">
                            <MapPin size={13} className="text-muted-foreground flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{r.label}</p>
                              <p className="text-xs text-muted-foreground truncate">{r.sublabel}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
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
