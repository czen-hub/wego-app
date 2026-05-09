import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, MapPin, ChevronUp, ChevronDown, Clock, Building2, X, Home as HomeIcon, Briefcase, Navigation } from "lucide-react";
import ClientMap from "@/components/ClientMap";
import { useCurrentLocation } from "@/hooks/useCurrentLocation";

const DEFAULT_COORDS: [number, number] = [37.7749, -122.4194];

function formatCoords(coords: [number, number]) {
  return `${coords[0].toFixed(5)}, ${coords[1].toFixed(5)}`;
}

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

const RECENT = [
  { id: "r1", to: "456 Valencia St, SF",       time: "Yesterday",  fare: "$38.00" },
  { id: "r2", to: "555 California St, SF",      time: "3 days ago", fare: "$52.00" },
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
  const { coords: currentCoords } = useCurrentLocation();
  const [pickupPin, setPickupPin] = useState<[number, number] | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
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

  const suggestions = query.trim().length >= 2
    ? LOCATION_SUGGESTIONS.filter((s) =>
        s.label.toLowerCase().includes(query.toLowerCase()) ||
        s.sublabel.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 5)
    : [];

  const selectedPickupCoords = pickupPin ?? currentCoords ?? DEFAULT_COORDS;
  const pickupState = {
    pickup: pickupPin ? "Pinned Pickup" : "Current Location",
    pickupCoords: selectedPickupCoords,
  };

  const handleSearchFocus = () => setDrawerOpen(true);

  const handleSelectDestination = (destination: string) => {
    navigate("/request", { state: { destination, ...pickupState } });
  };

  const handleUseGpsPickup = () => {
    setPickupPin(currentCoords ?? DEFAULT_COORDS);
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
        <ClientMap
          center={selectedPickupCoords}
          zoom={14}
          interactive
          onCenterChange={setPickupPin}
          onClickLocation={setPickupPin}
          className="absolute inset-0"
        />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="relative -mt-9">
            <MapPin size={38} className="text-primary drop-shadow-[0_8px_18px_rgba(0,71,255,0.45)]" />
            <div className="absolute left-1/2 top-[31px] h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-primary/30 blur-[1px]" />
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-b from-transparent via-background/40 to-background/90 pointer-events-none z-10" />
      </div>

      {/* ── TOP BRAND BAR ── */}
      <div className="relative z-20 pt-4 px-4">
        <div className="glass-card px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-primary tracking-widest uppercase">WeGo</p>
            <p className="text-xs text-muted-foreground">Driver-owned cooperative</p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span className="text-xs font-semibold text-primary">No Surge</span>
          </div>
        </div>
      </div>

      {/* ── BOTTOM SHEET ── */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-20 bg-card border-t border-border rounded-t-2xl shadow-2xl flex flex-col transition-transform duration-300 ease-out max-h-[78%] ${
          drawerOpen ? "translate-y-0" : "translate-y-[calc(100%-104px)]"
        }`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Handle + search */}
        <div className="flex-shrink-0 pt-2.5 pb-3 px-4">
          <button
            type="button"
            aria-label={drawerOpen ? "Collapse drawer" : "Expand drawer"}
            onClick={() => {
              setDrawerOpen((o) => !o);
              if (!drawerOpen) setTimeout(() => inputRef.current?.focus(), 350);
            }}
            className="w-full"
          >
            <div className="w-10 h-1 bg-muted-foreground/25 rounded-full mx-auto mb-3" />
          </button>

          {/* Search bar */}
          <div className="flex items-center gap-3 bg-background border border-border rounded-xl px-4 py-3">
            <Search size={18} className="text-primary flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={handleSearchFocus}
              placeholder="Where to?"
              className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground text-base font-medium focus:outline-none"
            />
            {query.length > 0 && (
              <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="text-muted-foreground">
                <X size={15} />
              </button>
            )}
            {!drawerOpen && !query && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <span className="text-[11px]">Open</span>
                <ChevronUp size={14} />
              </div>
            )}
            {drawerOpen && !query && (
              <button type="button" aria-label="Collapse drawer" onClick={() => setDrawerOpen(false)} className="text-muted-foreground">
                <ChevronDown size={14} />
              </button>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                <MapPin size={14} className="text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground">Pickup pin</p>
                <p className="text-[11px] text-muted-foreground truncate">{formatCoords(selectedPickupCoords)}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleUseGpsPickup}
              className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-background px-3 py-1.5 text-xs font-semibold text-primary active:scale-95"
            >
              <Navigation size={12} />
              GPS
            </button>
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
          {suggestions.length > 0 && (
            <div className="space-y-1">
              {suggestions.map((s) => (
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
                    <button
                      type="button"
                      title="Save as Home"
                      onClick={() => { home.save(s.label); setQuery(""); }}
                      className="flex-1 w-9 flex items-center justify-center bg-background border border-border rounded-xl text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
                    >
                      <HomeIcon size={13} />
                    </button>
                    <button
                      type="button"
                      title="Save as Work"
                      onClick={() => { work.save(s.label); setQuery(""); }}
                      className="flex-1 w-9 flex items-center justify-center bg-background border border-border rounded-xl text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
                    >
                      <Briefcase size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* No results — let them use whatever they typed */}
          {query.trim().length >= 2 && suggestions.length === 0 && (
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
          {!query && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recent</p>
              <div className="space-y-2">
                {RECENT.map((ride) => (
                  <button
                    key={ride.id}
                    type="button"
                    onClick={() => handleSelectDestination(ride.to)}
                    className="w-full flex items-center gap-3 p-3 bg-background border border-border rounded-xl hover:border-primary/40 active:scale-[0.99] transition-all text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-muted/20 border border-border flex items-center justify-center flex-shrink-0">
                      <Clock size={16} className="text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{ride.to}</p>
                      <p className="text-xs text-muted-foreground">{ride.time} · {ride.fare}</p>
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
