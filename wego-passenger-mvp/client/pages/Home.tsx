import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, MapPin, Building2, X, Home as HomeIcon, Briefcase,
  Navigation, Compass, Car, Package, Utensils, CalendarDays,
  ArrowLeft, Clock,
} from "lucide-react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
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

const DEFAULT_COORDS: [number, number] = [37.3541, -121.9552];

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=address,poi&language=en&access_token=${MAPBOX_TOKEN}`
    );
    const data = await res.json();
    const feat = data.features?.[0];
    if (feat) return (feat.place_name ?? feat.text) as string;
  } catch {}
  return null;
}

function useSavedPlace(key: "home" | "work", userId: string | null) {
  const firestoreField = key === "home" ? "savedHome" : "savedWork";
  const [value, setValue] = useState<string>(() => localStorage.getItem(`wego_${key}`) ?? "");
  const userIdRef = useRef(userId);
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  useEffect(() => {
    if (!userId) return;
    getDoc(doc(db, "passengers", userId)).then((snap) => {
      if (!snap.exists()) return;
      const val = snap.data()[firestoreField];
      if (typeof val === "string" && val) {
        setValue(val);
        localStorage.setItem(`wego_${key}`, val);
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const save = (address: string) => {
    localStorage.setItem(`wego_${key}`, address);
    setValue(address);
    const uid = userIdRef.current;
    if (uid) setDoc(doc(db, "passengers", uid), { [firestoreField]: address }, { merge: true }).catch(() => {});
  };
  const clear = () => {
    localStorage.removeItem(`wego_${key}`);
    setValue("");
    const uid = userIdRef.current;
    if (uid) setDoc(doc(db, "passengers", uid), { [firestoreField]: "" }, { merge: true }).catch(() => {});
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
  const [pinDropMode, setPinDropMode] = useState(false);
  const [pinDropCenter, setPinDropCenter] = useState<[number, number]>(DEFAULT_COORDS);
  const [pinDropAddress, setPinDropAddress] = useState("");
  const [pinDropGeocoding, setPinDropGeocoding] = useState(false);
  const pinDropTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinDropModeRef = useRef(false);

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

  useEffect(() => { pinDropModeRef.current = pinDropMode; }, [pinDropMode]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (pinDropModeRef.current) return;
      const t = lastMapMoveRef.current;
      if (t > 0 && Date.now() - t >= 10000) {
        lastMapMoveRef.current = 0;
        setMapResetToken((n) => n + 1);
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const home = useSavedPlace("home", user?.uid ?? null);
  const work = useSavedPlace("work", user?.uid ?? null);
  const [editingPlace, setEditingPlace] = useState<"home" | "work" | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const searchSessionRef = useRef<string>(crypto.randomUUID());

  useEffect(() => {
    if (searchOpen) setTimeout(() => inputRef.current?.focus(), 80);
    else setQuery("");
  }, [searchOpen]);

  const openEditPlace = (which: "home" | "work") => {
    setEditDraft(which === "home" ? home.value : work.value);
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

  useEffect(() => {
    if (query.trim().length < 2) { setGeocodeResults([]); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setGeocoding(true);
      try {
        const proxCoords = currentCoords ?? DEFAULT_COORDS;
        const prox = `&proximity=${proxCoords[1]},${proxCoords[0]}`;
        const bbox = "&bbox=-124.5,32.5,-114.1,42.0";
        const url = `https://api.mapbox.com/search/searchbox/v1/suggest?q=${encodeURIComponent(query.trim())}&session_token=${searchSessionRef.current}&language=en&country=us&limit=6${prox}${bbox}&access_token=${MAPBOX_TOKEN}`;
        const res = await fetch(url);
        const data = await res.json();
        if (!cancelled) {
          setGeocodeResults(
            (data.suggestions ?? []).map((s: { name: string; place_formatted: string; full_address: string; mapbox_id: string; feature_type: string }) => ({
              label: s.name, sublabel: s.place_formatted, fullAddress: s.full_address,
              mapboxId: s.mapbox_id, isBusiness: s.feature_type === "poi",
            }))
          );
        }
      } catch { if (!cancelled) setGeocodeResults([]); }
      if (!cancelled) setGeocoding(false);
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, currentCoords]);

  useEffect(() => {
    if (!editingPlace || editDraft.trim().length < 2) { setPlaceResults([]); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const proxCoords2 = currentCoords ?? DEFAULT_COORDS;
        const prox2 = `&proximity=${proxCoords2[1]},${proxCoords2[0]}`;
        const bbox2 = "&bbox=-124.5,32.5,-114.1,42.0";
        const url = `https://api.mapbox.com/search/searchbox/v1/suggest?q=${encodeURIComponent(editDraft.trim())}&session_token=${searchSessionRef.current}&language=en&country=us&limit=5${prox2}${bbox2}&access_token=${MAPBOX_TOKEN}`;
        const res = await fetch(url);
        const data = await res.json();
        if (!cancelled) setPlaceResults((data.suggestions ?? []).map((s: { name: string; place_formatted: string; full_address: string }) => ({ label: s.name, sublabel: s.place_formatted, fullAddress: s.full_address })));
      } catch { if (!cancelled) setPlaceResults([]); }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [editDraft, editingPlace, currentCoords]);

  const selectedPickupCoords = currentCoords ?? DEFAULT_COORDS;
  const pickupState = { pickup: "Current Location", pickupCoords: selectedPickupCoords };

  const enterPinDrop = async () => {
    const center = currentCoords ?? DEFAULT_COORDS;
    setPinDropCenter(center);
    setPinDropAddress("");
    setPinDropGeocoding(true);
    setSearchOpen(false);
    setPinDropMode(true);
    const label = await reverseGeocode(center[0], center[1]);
    setPinDropAddress(label ?? "");
    setPinDropGeocoding(false);
  };

  const handleConfirmPin = () => {
    setPinDropMode(false);
    const label = pinDropAddress || `${pinDropCenter[0].toFixed(5)}, ${pinDropCenter[1].toFixed(5)}`;
    navigate("/request", { state: { destination: label, destinationCoords: pinDropCenter, ...pickupState } });
  };

  const handleSelectDestination = async (destination: string, mapboxId?: string, presetCoords?: [number, number]) => {
    let coords: [number, number] | undefined = presetCoords;
    if (!coords && mapboxId) {
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


  return (
    <div className="relative h-full overflow-hidden">

      {/* ── MAP ── */}
      <div className="absolute inset-0 z-0">
        {locationLoading ? (
          <div className="absolute inset-0 bg-background flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-[3px] border-primary border-t-transparent animate-spin" />
          </div>
        ) : (
          <ClientMap
            center={pinDropMode ? pinDropCenter : selectedPickupCoords}
            zoom={14}
            interactive
            driverPos={currentCoords ?? undefined}
            accuracy={accuracy ?? undefined}
            forceResetToken={pinDropMode ? undefined : mapResetToken}
            followBearing={pinDropMode ? false : headingUp}
            onCenterChange={(coords) => {
              lastMapMoveRef.current = Date.now();
              if (!pinDropModeRef.current) return;
              setPinDropCenter(coords);
              if (pinDropTimerRef.current) clearTimeout(pinDropTimerRef.current);
              setPinDropGeocoding(true);
              pinDropTimerRef.current = setTimeout(async () => {
                const label = await reverseGeocode(coords[0], coords[1]);
                setPinDropAddress(label ?? "");
                setPinDropGeocoding(false);
              }, 500);
            }}
            className="absolute inset-0"
          />
        )}
        {/* Bottom fade */}
        <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-b from-transparent to-background/85 pointer-events-none z-10" />
      </div>

      {/* ── PIN DROP OVERLAY ── */}
      {pinDropMode && (
        <>
          {/* Back */}
          <button
            type="button"
            onClick={() => setPinDropMode(false)}
            aria-label="Cancel pin drop"
            className="absolute top-4 left-4 z-30 w-9 h-9 rounded-xl bg-card/90 backdrop-blur-sm border border-border flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          >
            <ArrowLeft size={17} className="text-foreground" />
          </button>

          {/* Instruction pill */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 whitespace-nowrap pointer-events-none">
            <div className="flex items-center gap-2 bg-card/90 backdrop-blur-sm border border-border rounded-full px-3 py-1.5 shadow-lg">
              <MapPin size={11} className="text-primary flex-shrink-0" />
              <span className="text-xs font-semibold text-foreground">Move map to position pin</span>
            </div>
          </div>

          {/* Crosshair pin — tip at exact map center */}
          <div className="absolute top-1/2 left-1/2 z-20 pointer-events-none -translate-x-1/2 -translate-y-full">
            <svg width="38" height="48" viewBox="0 0 38 48" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 0C8.51 0 0 8.51 0 19c0 12.67 19 29 19 29S38 31.67 38 19C38 8.51 29.49 0 19 0z" fill="#F59E0B" stroke="white" strokeWidth="1.5"/>
              <circle cx="19" cy="19" r="7" fill="white"/>
            </svg>
          </div>
          {/* Shadow dot at exact center */}
          <div className="absolute top-1/2 left-1/2 z-20 pointer-events-none -translate-x-1/2 -translate-y-1/2">
            <div className="w-2 h-2 rounded-full bg-black/20" />
          </div>

          {/* Bottom confirm panel */}
          <div className="absolute bottom-0 inset-x-0 z-30 px-4 pb-8 pt-4 bg-background/97 backdrop-blur-sm border-t border-border">
            <div className="flex items-start gap-2.5 mb-3 min-h-[38px]">
              <MapPin size={15} className="text-primary flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                {pinDropGeocoding ? (
                  <p className="text-sm text-muted-foreground">Finding address…</p>
                ) : pinDropAddress ? (
                  <p className="text-sm font-semibold text-foreground leading-snug">{pinDropAddress}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Move the map to position the pin</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={handleConfirmPin}
              className="w-full py-3.5 rounded-2xl bg-primary text-white font-bold text-base active:scale-95 transition-transform btn-glow"
            >
              Confirm Location
            </button>
          </div>
        </>
      )}

      {/* ── TOP SEARCH BAR ── */}
      <div className="absolute top-0 inset-x-0 z-20 px-4 pt-3">
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="w-full flex items-center gap-3 bg-card/92 backdrop-blur-md border border-border rounded-2xl px-4 py-3.5 shadow-float active:scale-[0.98] transition-transform"
        >
          <Search size={17} className="text-primary flex-shrink-0" />
          <span className="flex-1 text-left text-sm font-medium text-muted-foreground">
            Where to?
          </span>
          {activeRide && (
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse flex-shrink-0" />
          )}
        </button>
      </div>

      {/* ── MAP CONTROLS ── */}
      <div
        className={`absolute right-4 z-20 flex flex-col gap-2 transition-all duration-300 ${
          activeRide ? "bottom-[176px]" : "bottom-[102px]"
        }`}
      >
        <button
          type="button"
          onClick={() => { lastMapMoveRef.current = 0; setMapResetToken((n) => n + 1); }}
          aria-label="Recenter map"
          className="w-10 h-10 bg-card/90 backdrop-blur-sm border border-border rounded-xl shadow-card flex items-center justify-center active:scale-95 transition-transform"
        >
          <Navigation size={17} className="text-primary" />
        </button>
        <button
          type="button"
          onClick={() => {
            setHeadingUp((h) => !h);
            const oe = (window as any).DeviceOrientationEvent;
            if (typeof oe?.requestPermission === "function") oe.requestPermission().catch(() => {});
          }}
          aria-label="Toggle heading-up mode"
          className={`w-10 h-10 rounded-xl shadow-card flex items-center justify-center active:scale-95 transition-all ${
            headingUp ? "bg-primary" : "bg-card/90 backdrop-blur-sm border border-border"
          }`}
        >
          <Compass size={17} className={headingUp ? "text-white" : "text-primary"} />
        </button>
      </div>

      {/* ── ACTIVE RIDE BANNER ── */}
      {activeRide && (
        <div
          className="absolute inset-x-4 z-20 bottom-[102px] transition-all duration-300"
        >
          <button
            type="button"
            onClick={() => navigate("/ride")}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-primary text-white shadow-lg active:scale-[0.98] transition-transform"
          >
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <Navigation size={15} className="text-white" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-bold leading-tight">
                {activeRide.status === "reserved" ? "Scheduled Ride" : "Ride in Progress"}
              </p>
              <p className="text-xs text-white/75 truncate">
                {activeRide.status === "reserved" ? "Scheduled — tap to view" :
                 activeRide.status === "pending" ? "Finding driver…" :
                 activeRide.status === "accepted" ? `${activeRide.driverName || "Driver"} on the way` :
                 activeRide.status === "arrived" ? "Driver has arrived" :
                 "Trip in progress"}
              </p>
            </div>
            <span className="text-xs font-semibold text-white/90 flex-shrink-0">View →</span>
          </button>
        </div>
      )}

      {/* ── SERVICE GRID ── */}
      <div className="absolute bottom-0 inset-x-0 z-20 px-4 pb-3">
        <div className="grid grid-cols-4 gap-2.5">
          {SERVICES.map((svc) => (
            <button
              key={svc.id}
              type="button"
              onClick={() => svc.path ? navigate(svc.path) : setSearchOpen(true)}
              className="flex flex-col items-center gap-1.5 py-3 bg-card/95 backdrop-blur-sm border border-border rounded-2xl active:scale-95 transition-transform shadow-card"
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                svc.path === null ? "bg-primary" : "bg-secondary"
              }`}>
                <svc.Icon
                  size={17}
                  strokeWidth={1.75}
                  className={svc.path === null ? "text-white" : "text-foreground"}
                />
              </div>
              <span className="text-[11px] font-semibold text-foreground leading-none">
                {svc.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── SEARCH OVERLAY ── */}
      {searchOpen && (
        <div className="absolute inset-0 z-50 bg-background flex flex-col">

          {/* Header */}
          <div className="flex items-center gap-3 px-4 pt-4 pb-3 flex-shrink-0">
            <button
              type="button"
              onClick={() => setSearchOpen(false)}
              aria-label="Close search"
              className="w-9 h-9 rounded-xl bg-secondary border border-border flex items-center justify-center flex-shrink-0"
            >
              <ArrowLeft size={17} className="text-foreground" />
            </button>
            <div className="flex-1 flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
              <Search size={15} className="text-primary flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search destination..."
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              {query.length > 0 && (
                <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
                  <X size={14} className="text-muted-foreground" />
                </button>
              )}
            </div>
          </div>

          {/* Scrollable results */}
          <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-6">

            {/* ── Live search results ── */}
            {query.trim().length >= 2 && (
              <div className="space-y-1.5">
                {geocodeResults.map((r) => (
                  <button
                    key={r.label + r.sublabel}
                    type="button"
                    onClick={() => { handleSelectDestination(r.label, r.mapboxId); setQuery(""); }}
                    className="w-full flex items-center gap-3 p-3 bg-card border border-border rounded-xl hover:border-primary/40 active:scale-[0.99] transition-all text-left"
                  >
                    <div className="w-9 h-9 rounded-xl bg-secondary border border-border flex items-center justify-center flex-shrink-0">
                      {r.isBusiness
                        ? <Building2 size={15} className="text-muted-foreground" />
                        : <MapPin size={15} className="text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{r.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.sublabel}</p>
                    </div>
                  </button>
                ))}

                {geocoding && geocodeResults.length === 0 && (
                  <div className="flex items-center gap-3 p-3 text-muted-foreground">
                    <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin flex-shrink-0" />
                    <span className="text-sm">Searching…</span>
                  </div>
                )}

                {!geocoding && geocodeResults.length === 0 && (
                  <button
                    type="button"
                    onClick={() => { handleSelectDestination(query.trim()); setQuery(""); }}
                    className="w-full flex items-center gap-3 p-3 bg-card border border-primary/25 rounded-xl active:scale-[0.99] transition-all text-left"
                  >
                    <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                      <MapPin size={15} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{query.trim()}</p>
                      <p className="text-xs text-muted-foreground">Use this address</p>
                    </div>
                  </button>
                )}
              </div>
            )}

            {/* ── Saved places ── */}
            {!query && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Saved Places</p>

                {/* Home */}
                {editingPlace === "home" ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-3 p-3 bg-card border border-primary rounded-xl">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <HomeIcon size={15} className="text-primary" />
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
                      <div className="bg-card border border-border rounded-xl overflow-hidden">
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
                  <div className="w-full flex items-center gap-3 p-3 bg-card border border-border rounded-xl transition-all">
                    <button type="button" onClick={() => home.value ? handleSelectDestination(home.value) : openEditPlace("home")} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                      <div className="w-9 h-9 rounded-xl bg-secondary border border-border flex items-center justify-center flex-shrink-0">
                        <HomeIcon size={15} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">Home</p>
                        {home.value
                          ? <p className="text-xs text-muted-foreground truncate">{home.value}</p>
                          : <p className="text-xs text-primary font-medium">Add home address</p>}
                      </div>
                    </button>
                    <button type="button" aria-label="Edit home" onClick={() => openEditPlace("home")} className="text-xs text-muted-foreground hover:text-primary px-1 flex-shrink-0">Edit</button>
                    {home.value && (
                      <button type="button" aria-label="Clear home" onClick={() => home.clear()} className="text-muted-foreground w-8 h-8 flex items-center justify-center flex-shrink-0">
                        <X size={13} />
                      </button>
                    )}
                  </div>
                )}

                {/* Work */}
                {editingPlace === "work" ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-3 p-3 bg-card border border-primary rounded-xl">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Briefcase size={15} className="text-primary" />
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
                      <div className="bg-card border border-border rounded-xl overflow-hidden">
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
                  <div className="w-full flex items-center gap-3 p-3 bg-card border border-border rounded-xl transition-all">
                    <button type="button" onClick={() => work.value ? handleSelectDestination(work.value) : openEditPlace("work")} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                      <div className="w-9 h-9 rounded-xl bg-secondary border border-border flex items-center justify-center flex-shrink-0">
                        <Briefcase size={15} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">Work</p>
                        {work.value
                          ? <p className="text-xs text-muted-foreground truncate">{work.value}</p>
                          : <p className="text-xs text-primary font-medium">Add work address</p>}
                      </div>
                    </button>
                    <button type="button" aria-label="Edit work" onClick={() => openEditPlace("work")} className="text-xs text-muted-foreground hover:text-primary px-1 flex-shrink-0">Edit</button>
                    {work.value && (
                      <button type="button" aria-label="Clear work" onClick={() => work.clear()} className="text-muted-foreground w-8 h-8 flex items-center justify-center flex-shrink-0">
                        <X size={13} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Recent rides ── */}
            {!query && ridesLoaded && recentRides.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recent</p>
                <div className="space-y-1.5">
                  {recentRides.map((ride) => {
                    const label = ride.dropoffAddress.replace(/\s*\(\d+\.\d+,\s*-?\d+\.\d+\)$/, "").trim();
                    const coords: [number, number] | undefined = ride.dropoffLocation
                      ? [ride.dropoffLocation.latitude, ride.dropoffLocation.longitude]
                      : undefined;
                    return (
                      <button
                        key={ride.id}
                        type="button"
                        onClick={() => handleSelectDestination(label, undefined, coords)}
                        className="w-full flex items-center gap-3 p-3 bg-card border border-border rounded-xl hover:border-primary/40 active:scale-[0.99] transition-all text-left"
                      >
                        <div className="w-9 h-9 rounded-xl bg-secondary border border-border flex items-center justify-center flex-shrink-0">
                          <Clock size={15} className="text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{label}</p>
                          <p className="text-xs text-muted-foreground">
                            {ride.completedAt ? formatRelativeDate(ride.completedAt) : "Recently"} · ${ride.fare.toFixed(2)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Drop a Pin ── */}
            {!query && (
              <button
                type="button"
                onClick={enterPinDrop}
                className="w-full flex items-center gap-3 p-3 bg-card border border-border rounded-xl hover:border-primary/40 active:scale-[0.99] transition-all text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-secondary border border-border flex items-center justify-center flex-shrink-0">
                  <MapPin size={15} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">Drop a Pin</p>
                  <p className="text-xs text-muted-foreground">Pan the map to any location</p>
                </div>
              </button>
            )}

            {/* ── Idle state hint ── */}
            {!query && (
              <div className="flex items-center gap-3 px-3 py-3 bg-card border border-border rounded-xl">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <MapPin size={14} className="text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">No surge pricing — ever</p>
                  <p className="text-xs text-muted-foreground">88% of your fare goes directly to your driver</p>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
