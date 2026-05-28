import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Plane, Music, Target, Clock, ChevronUp, ChevronDown,
  Package, UtensilsCrossed, MapPin, CheckCircle, X, Search,
  SlidersHorizontal, Car, PawPrint, Eye, EyeOff, Navigation,
  CornerUpRight, CornerUpLeft, CornerDownLeft, ArrowUp,
  AlertTriangle, Compass, Volume2, VolumeX, Camera,
  type LucideIcon,
} from "lucide-react";
import RideCard from "@/components/RideCard";
import { CourierCard, FoodCard } from "@/components/RideRequestCards";
import ClientMap, { type RouteStep } from "@/components/ClientMap";
import { useDispatchContext } from "@/context/DispatchContext";
import { useCurrentLocation } from "@/hooks/useCurrentLocation";
import { useAuth } from "@/context/AuthContext";
import { type Ride, type EarningsEntry, type Opportunity, type RoadIssueType, listenToWeeklyEarnings, listenToOpportunities, getDriverGoal, updateDriverPreferences, getDriverPreferences, reportRoadIssue } from "@/lib/db";

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;

const ICON_MAP: Record<string, LucideIcon> = {
  Plane, Music, Target, Package, UtensilsCrossed, Car,
};


function Toggle({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      className={`relative rounded-full transition-colors duration-300 flex-shrink-0 h-[22px] w-10 ${on ? "bg-primary" : "bg-muted"}`}
    >
      <span className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${on ? "translate-x-[20px]" : "translate-x-[3px]"}`} />
    </button>
  );
}


export default function Command() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();
  const dispatch = useDispatchContext();
  const { isOnline, setOnline, incomingRides, activeRide, locationError, rideListenerError } = dispatch;
  const { coords: currentCoords, accuracy, loading: locationLoading } = useCurrentLocation();
  const mapCenter: [number, number] = currentCoords ?? [37.3541, -121.9552];

  const [mapResetToken, setMapResetToken] = useState(0);
  const lastMapMoveRef = useRef<number>(0);
  const [declinedRideId, setDeclinedRideId] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const [offlineBlockOpen, setOfflineBlockOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [navQuery, setNavQuery] = useState("");
  const [navResults, setNavResults] = useState<{ name: string; sub: string; mapbox_id: string }[]>([]);
  const [navDest, setNavDest] = useState<{ coords: [number, number]; name: string } | null>(null);
  const [navStep, setNavStep] = useState<RouteStep | null>(null);
  const [navMode, setNavMode] = useState(false);
  const [navSearching, setNavSearching] = useState(false);
  const navSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navModeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navDestRef = useRef<{ coords: [number, number]; name: string } | null>(null);
  const sessionTokenRef = useRef(crypto.randomUUID());
  const [issueOpen, setIssueOpen] = useState(false);
  const [headingUp, setHeadingUp] = useState(false);
  const [issueSubmitting, setIssueSubmitting] = useState(false);
  const [issueDone, setIssueDone] = useState(false);
  const [acceptRides, setAcceptRides] = useState(true);
  const [acceptCourier, setAcceptCourier] = useState(false);
  const [acceptFood, setAcceptFood] = useState(false);
  const [acceptPets, setAcceptPets] = useState(false);

  const [weeklyGoal, setWeeklyGoal] = useState(20);
  const [bonusAmount, setBonusAmount] = useState(25);
  const [liveOpps, setLiveOpps] = useState<Opportunity[]>([]);
  const [earningsVisible, setEarningsVisible] = useState(true);
  const [todayEntries, setTodayEntries] = useState<EarningsEntry[]>([]);
  const [weeklyEntries, setWeeklyEntries] = useState<EarningsEntry[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(() => localStorage.getItem("wego_voice") !== "off");
  const [navDistM, setNavDistM] = useState<number | null>(null);
  const [speedLimit, setSpeedLimit] = useState<number | null>(null);
  const [speedMph, setSpeedMph] = useState<number | null>(null);
  const [rerouting, setRerouting] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ remainingM: number; remainingSecs: number } | null>(null);
  const [cameraWarning, setCameraWarning] = useState(false);
  const cameraWarnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const declineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartY = useRef(0);
  const spokenInstructionRef = useRef<string | null>(null);
  const navigatedRef = useRef(!!(location.state as { tripCompleted?: boolean } | null)?.tripCompleted);

  // Sync navDestRef so the interval below can read it without a stale closure
  useEffect(() => { navDestRef.current = navDest; }, [navDest]);

  // 3-second overview then switch to street-level nav mode
  useEffect(() => {
    if (navModeTimerRef.current) clearTimeout(navModeTimerRef.current);
    if (navDest) {
      navModeTimerRef.current = setTimeout(() => setNavMode(true), 3000);
    } else {
      setNavMode(false);
    }
    return () => { if (navModeTimerRef.current) clearTimeout(navModeTimerRef.current); };
  }, [navDest]);

  // Speak each new turn instruction aloud when in destination mode
  useEffect(() => {
    if (!navStep?.instruction || !navDest || !voiceEnabled) return;
    if (!("speechSynthesis" in window)) return;
    if (navStep.instruction === spokenInstructionRef.current) return;
    spokenInstructionRef.current = navStep.instruction;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(navStep.instruction);
    u.rate = 1.05;
    window.speechSynthesis.speak(u);
  }, [navStep, navDest, voiceEnabled]);

  // Cancel speech and reset distance when navigation ends or voice is muted
  useEffect(() => {
    if (!navDest || !voiceEnabled) {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    }
    if (!navDest) {
      spokenInstructionRef.current = null;
      setNavDistM(null);
      setSpeedMph(null);
      setRerouting(false);
      setRouteInfo(null);
    }
  }, [navDest, voiceEnabled]);

  // After 10 seconds of map idle, fly back to GPS — skip when route navigation is active
  useEffect(() => {
    const interval = setInterval(() => {
      if (navDestRef.current) return;
      const t = lastMapMoveRef.current;
      if (t > 0 && Date.now() - t >= 10000) {
        lastMapMoveRef.current = 0;
        setMapResetToken((n) => n + 1);
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const pendingRide = incomingRides.find((r) => {
    if (r.id === declinedRideId) return false;
    if (r.type === "ride" && !acceptRides) return false;
    if (r.type === "courier" && !acceptCourier) return false;
    if (r.type === "food" && !acceptFood) return false;
    return true;
  }) ?? null;
  const hasRequest = pendingRide !== null;

  // Load persisted preferences once on mount
  useEffect(() => {
    if (!user) return;
    getDriverPreferences(user.uid).then((prefs) => {
      if (!prefs) return;
      setAcceptRides(prefs.acceptRides);
      setAcceptCourier(prefs.acceptCourier);
      setAcceptFood(prefs.acceptFood);
      setAcceptPets(prefs.acceptPets);
    });
  }, [user]);

  const togglePref = (
    key: "acceptRides" | "acceptCourier" | "acceptFood" | "acceptPets",
    setter: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    setter((prev) => {
      const next = !prev;
      if (user) {
        updateDriverPreferences(user.uid, { [key]: next }).catch((e) => {
          console.warn("[Command] failed to save preference:", e);
          setter(prev);
        });
      }
      return next;
    });
  };


  useEffect(() => {
    if (!user) return;
    getDriverGoal(user.uid).then((g) => {
      setWeeklyGoal(g.weeklyGoal);
      setBonusAmount(g.bonusAmount);
    });
  }, [user]);

  useEffect(() => {
    return listenToOpportunities(setLiveOpps);
  }, []);


  const weeklyDone = weeklyEntries.length;

  useEffect(() => {
    if (!user) return;
    const unsub = listenToWeeklyEarnings(user.uid, (entries) => {
      setWeeklyEntries(entries);
      const todayStr = new Date().toDateString();
      setTodayEntries(entries.filter(e => e.completedAt?.toDateString() === todayStr));
    });
    return unsub;
  }, [user]);


  // If driver already has an active ride (e.g., app reopened mid-trip), redirect
  useEffect(() => {
    if (activeRide && !navigatedRef.current) {
      navigatedRef.current = true;
      navigate("/trip", {
        replace: true,
        state: {
          riderName: activeRide.passengerName,
          pickupLocation: activeRide.pickupAddress,
          dropoffLocation: activeRide.dropoffAddress,
          riderPayment: activeRide.fare,
          coopFee: activeRide.coopFee,
          driverTake: activeRide.driverTake,
          estimatedTime: activeRide.estimatedMinutes,
          isAdvanced: activeRide.isAdvanced,
          type: activeRide.type,
          rideId: activeRide.id,
          pickupCoords: activeRide.pickupLocation
            ? [activeRide.pickupLocation.latitude, activeRide.pickupLocation.longitude] as [number, number]
            : undefined,
          dropoffCoords: activeRide.dropoffLocation
            ? [activeRide.dropoffLocation.latitude, activeRide.dropoffLocation.longitude] as [number, number]
            : undefined,
          requestedAt: activeRide.requestedAt?.getTime() ?? Date.now(),
        },
      });
    }
  }, [activeRide, navigate]);

  useEffect(() => {
    if (!isOnline && declineTimerRef.current) {
      clearTimeout(declineTimerRef.current);
      declineTimerRef.current = null;
      setDeclinedRideId(null);
    }
  }, [isOnline]);

  useEffect(() => {
    if (hasRequest) setDrawerOpen(false);
  }, [hasRequest]);

  const handleToggleOnline = async () => {
    if (isOnline && activeRide) { setOfflineBlockOpen(true); return; }
    try {
      await setOnline(!isOnline);
      if (isOnline) setDeclinedRideId(null);
    } catch {
      setOnlineError("Failed to go online. Check your connection.");
      setTimeout(() => setOnlineError(null), 4000);
    }
  };

  const handleAccept = async () => {
    if (!pendingRide || accepting) return;
    setAccepting(true);
    try {
      await dispatch.accept(pendingRide.id);
      setAccepting(false);
      navigatedRef.current = true;
      navigate("/trip", {
        state: {
          riderName: pendingRide.passengerName,
          pickupLocation: pendingRide.pickupAddress,
          dropoffLocation: pendingRide.dropoffAddress,
          riderPayment: pendingRide.fare,
          coopFee: pendingRide.coopFee,
          driverTake: pendingRide.driverTake,
          estimatedTime: pendingRide.estimatedMinutes,
          isAdvanced: pendingRide.isAdvanced,
          type: pendingRide.type,
          rideId: pendingRide.id,
          pickupCoords: pendingRide.pickupLocation
            ? [pendingRide.pickupLocation.latitude, pendingRide.pickupLocation.longitude] as [number, number]
            : undefined,
          dropoffCoords: pendingRide.dropoffLocation
            ? [pendingRide.dropoffLocation.latitude, pendingRide.dropoffLocation.longitude] as [number, number]
            : undefined,
          requestedAt: pendingRide.requestedAt?.getTime() ?? Date.now(),
        },
      });
    } catch (e) {
      console.error("Accept ride failed:", e);
      setAccepting(false);
      setAcceptError("Ride was already taken by another driver");
      setTimeout(() => setAcceptError(null), 3500);
    }
  };

  const handleDecline = () => {
    if (!pendingRide) return;
    const rideId = pendingRide.id;
    setDeclinedRideId(rideId);
    if (declineTimerRef.current) clearTimeout(declineTimerRef.current);
    declineTimerRef.current = setTimeout(() => {
      setDeclinedRideId(null);
      declineTimerRef.current = null;
    }, 5000);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (hasRequest || prefsOpen) return;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (hasRequest || prefsOpen) return;
    const delta = touchStartY.current - e.changedTouches[0].clientY;
    if (delta > 40) setDrawerOpen(true);
    if (delta < -40) setDrawerOpen(false);
  };

  const searchPlaces = (q: string) => {
    setNavQuery(q);
    if (navSearchTimerRef.current) clearTimeout(navSearchTimerRef.current);
    if (q.trim().length < 2) { setNavResults([]); return; }
    navSearchTimerRef.current = setTimeout(async () => {
      setNavSearching(true);
      try {
        const loc = currentCoords ?? mapCenter;
        const res = await fetch(
          `https://api.mapbox.com/search/searchbox/v1/suggest?q=${encodeURIComponent(q)}&proximity=${loc[1]},${loc[0]}&session_token=${sessionTokenRef.current}&types=poi,place,address&language=en&limit=5&access_token=${TOKEN}`
        );
        const data = await res.json();
        setNavResults(
          (data.suggestions ?? []).slice(0, 5).map((s: any) => ({
            name: s.name ?? "",
            sub: s.place_formatted ?? s.address ?? "",
            mapbox_id: s.mapbox_id,
          }))
        );
      } catch {
        setNavResults([]);
      } finally {
        setNavSearching(false);
      }
    }, 350);
  };

  const selectPlace = async (r: { name: string; sub: string; mapbox_id: string }) => {
    try {
      const res = await fetch(
        `https://api.mapbox.com/search/searchbox/v1/retrieve/${r.mapbox_id}?session_token=${sessionTokenRef.current}&access_token=${TOKEN}`
      );
      const data = await res.json();
      const f = data.features?.[0];
      if (!f) return;
      const coords: [number, number] = [f.geometry.coordinates[1], f.geometry.coordinates[0]];
      const fullName = f.properties?.full_address ?? `${r.name}, ${r.sub}`;
      setNavDest({ coords, name: fullName });
      setNavStep(null);
      setNavOpen(false);
      setNavQuery("");
      setNavResults([]);
      sessionTokenRef.current = crypto.randomUUID();
    } catch { /* silently fail */ }
  };

  const handleCameraApproach = () => {
    if (cameraWarnTimerRef.current) clearTimeout(cameraWarnTimerRef.current);
    setCameraWarning(true);
    if (voiceEnabled && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(Object.assign(new SpeechSynthesisUtterance("Speed camera ahead"), { rate: 1.05 }));
    }
    cameraWarnTimerRef.current = setTimeout(() => setCameraWarning(false), 5000);
  };

  const handleRerouting = () => {
    setRerouting(true);
    setNavStep(null);
    setNavDistM(null);
    setRouteInfo(null);
    if (voiceEnabled && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(Object.assign(new SpeechSynthesisUtterance("Recalculating route"), { rate: 1.05 }));
    }
  };

  const handleNavStepChange = (step: RouteStep | null) => {
    setNavStep(step);
    if (step) setRerouting(false);
  };

  const formatDist = (m: number) => {
    const ft = m * 3.28084;
    if (ft < 1000) return `${Math.round(ft / 100) * 100} ft`;
    const mi = m / 1609.34;
    return mi < 10 ? `${mi.toFixed(1)} mi` : `${Math.round(mi)} mi`;
  };

  const TurnIcon = ({ type, modifier, size = 18, className = "text-white" }: { type: string; modifier?: string; size?: number; className?: string }) => {
    const mod = modifier ?? "";
    if (type === "arrive") return <MapPin size={size} className={className} />;
    if (mod === "uturn") return <CornerDownLeft size={size} className={className} />;
    if (mod.includes("right")) return <CornerUpRight size={size} className={className} />;
    if (mod.includes("left")) return <CornerUpLeft size={size} className={className} />;
    return <ArrowUp size={size} className={className} />;
  };

  const surgeZones = liveOpps
    .filter(o => o.lat != null && o.lng != null && o.radiusM != null)
    .map(o => ({ lat: o.lat!, lng: o.lng!, radiusM: o.radiusM!, label: o.title }));

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
            center={mapCenter}
            zoom={14}
            className="absolute inset-0"
            interactive
            driverPos={currentCoords ?? undefined}
            accuracy={accuracy ?? undefined}
            from={navDest && currentCoords ? currentCoords : undefined}
            to={navDest?.coords}
            forceResetToken={mapResetToken}
            followBearing={headingUp}
            navMode={navMode}
            onCenterChange={() => { lastMapMoveRef.current = Date.now(); }}
            onClickLocation={() => setDrawerOpen(false)}
            onStepChange={handleNavStepChange}
            onDistanceChange={setNavDistM}
            onSpeedLimitChange={navDest ? setSpeedLimit : undefined}
            onCameraApproach={navDest ? handleCameraApproach : undefined}
            onSpeedChange={navDest ? setSpeedMph : undefined}
            onRerouting={navDest ? handleRerouting : undefined}
            onRouteInfoChange={navDest ? setRouteInfo : undefined}
            surgeZones={surgeZones}
          />
        )}
        {/* Speed limit badge */}
        {speedLimit !== null && navDest && (
          <div className="absolute bottom-[168px] left-4 z-10 pointer-events-none">
            <div className="w-11 bg-white border-[2.5px] border-black rounded text-center shadow-xl leading-none">
              <p className="text-[6px] font-black text-black tracking-tight pt-0.5">SPEED</p>
              <p className="text-[6px] font-black text-black tracking-tight">LIMIT</p>
              <p className="text-[20px] font-black text-black leading-snug pb-0.5">{speedLimit}</p>
            </div>
          </div>
        )}

        {/* Camera warning toast */}
        {cameraWarning && (
          <div className="absolute bottom-[220px] left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-red-500/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-xl pointer-events-none whitespace-nowrap">
            <Camera size={13} className="text-white flex-shrink-0" />
            <span className="text-white text-xs font-bold tracking-wide">Speed camera ahead</span>
          </div>
        )}

        {/* Speedometer badge */}
        {speedMph !== null && navDest && (
          <div className="absolute bottom-[110px] right-4 z-10 pointer-events-none">
            <div className="w-11 h-11 bg-white border-[2.5px] border-black rounded-full flex flex-col items-center justify-center shadow-xl leading-none">
              <p className="text-[18px] font-black text-black">{speedMph}</p>
              <p className="text-[6px] font-bold text-black tracking-tight">mph</p>
            </div>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 h-56 bg-gradient-to-b from-transparent via-background/40 to-background/95 pointer-events-none" />

        {/* Left side map buttons: Audio · Destination · Preferences */}
        <div className="absolute bottom-[160px] left-4 z-10 flex flex-col gap-2">
          <button
            type="button"
            aria-label={voiceEnabled ? "Mute voice guidance" : "Unmute voice guidance"}
            onClick={() => {
              const next = !voiceEnabled;
              setVoiceEnabled(next);
              localStorage.setItem("wego_voice", next ? "on" : "off");
            }}
            className="w-[42px] h-[42px] bg-card/90 backdrop-blur-sm border border-border rounded-xl shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          >
            {voiceEnabled
              ? <Volume2 size={18} className="text-primary" />
              : <VolumeX size={18} className="text-muted-foreground" />}
          </button>
          <button
            type="button"
            onClick={() => navDest ? (setNavDest(null), setNavStep(null)) : setNavOpen(true)}
            aria-label={navDest ? "Cancel navigation" : "Navigate to destination"}
            className={`w-[42px] h-[42px] rounded-xl shadow-lg flex items-center justify-center active:scale-95 transition-all ${navDest ? "bg-destructive" : "bg-primary"}`}
          >
            {navDest ? <X size={20} strokeWidth={2.5} className="text-white" /> : <CornerUpRight size={20} strokeWidth={2.5} className="text-background" />}
          </button>
          <button
            type="button"
            onClick={() => setPrefsOpen(true)}
            aria-label="Open preferences"
            className="w-[42px] h-[42px] bg-card/90 backdrop-blur-sm border border-border rounded-xl shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          >
            <SlidersHorizontal size={18} className="text-primary" />
          </button>
        </div>

        {/* Right side map buttons: Recenter · Road Issue · Compass */}
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
            onClick={() => { setIssueDone(false); setIssueOpen(true); }}
            aria-label="Report road issue"
            className="w-[42px] h-[42px] bg-card/90 backdrop-blur-sm border border-border rounded-xl shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          >
            <AlertTriangle size={18} className="text-amber-500" />
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
      </div>

      {/* ── ONLINE / OFFLINE BADGE — top center, always visible, tappable ── */}
      <div className="absolute top-4 left-0 right-0 z-20 flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={handleToggleOnline}
          className="flex items-center gap-2 px-4 py-2 bg-card/90 backdrop-blur-sm border border-border rounded-full shadow-lg active:scale-95 transition-transform"
        >
          <div className={`w-2 h-2 rounded-full ${isOnline ? "bg-primary animate-pulse" : "bg-slate-400"}`} />
          <span className={`text-xs font-bold uppercase tracking-widest ${isOnline ? "text-primary" : "text-muted-foreground"}`}>
            {isOnline ? "Online" : "Offline"}
          </span>
        </button>
        {navDest && (
          rerouting ? (
            <div className="w-[calc(100%-32px)]">
              <div className="flex items-center gap-3 bg-card/95 backdrop-blur-sm border border-primary/20 rounded-xl shadow-lg px-4 py-3">
                <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin flex-shrink-0" />
                <p className="text-sm font-bold text-foreground flex-1 min-w-0">Recalculating route…</p>
                <button type="button" aria-label="Cancel navigation"
                  onClick={() => { setNavDest(null); setNavStep(null); setRerouting(false); }}
                  className="flex-shrink-0">
                  <X size={14} className="text-muted-foreground" />
                </button>
              </div>
            </div>
          ) : (
            <div className="w-[calc(100%-32px)] space-y-1">
              {/* Main turn card */}
              <div className="flex items-stretch bg-card/95 backdrop-blur-sm border border-primary/20 rounded-xl shadow-lg overflow-hidden">
                {/* Colored icon block */}
                <div className="w-12 bg-primary flex-shrink-0 flex items-center justify-center">
                  {navStep
                    ? <TurnIcon type={navStep.type} modifier={navStep.modifier} size={20} />
                    : <Navigation size={18} className="text-white" />}
                </div>
                {/* Text */}
                <div className="flex-1 min-w-0 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-foreground leading-snug flex-1 min-w-0 truncate">
                      {navStep?.instruction ?? "Calculating route…"}
                    </p>
                    {navDistM != null && (
                      <span className="text-sm font-bold text-primary flex-shrink-0 tabular-nums">
                        {formatDist(navDistM)}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                    {routeInfo
                      ? `${formatDist(routeInfo.remainingM)} remaining  ·  ${Math.ceil(routeInfo.remainingSecs / 60)} min`
                      : navStep?.name || navDest.name.split(",")[0]}
                  </p>
                </div>
                {/* Cancel */}
                <button type="button" aria-label="Cancel navigation"
                  onClick={() => { setNavDest(null); setNavStep(null); setRerouting(false); setRouteInfo(null); }}
                  className="px-2.5 flex items-center border-l border-border/40">
                  <X size={14} className="text-muted-foreground" />
                </button>
              </div>
              {/* Next step preview */}
              {navStep?.nextStep && (
                <div className="flex items-center gap-2 pl-2 pr-3 py-1.5 bg-card/80 backdrop-blur-sm border border-border/50 rounded-lg shadow">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex-shrink-0">then</span>
                  <TurnIcon type={navStep.nextStep.type} modifier={navStep.nextStep.modifier} size={13} className="text-muted-foreground flex-shrink-0" />
                  <p className="text-xs text-foreground font-medium truncate">{navStep.nextStep.instruction}</p>
                </div>
              )}
            </div>
          )
        )}
        {onlineError && (
          <div className="bg-destructive text-destructive-foreground text-xs font-semibold px-4 py-2 rounded-full shadow-lg">
            {onlineError}
          </div>
        )}
      </div>

      {/* ── INCOMING REQUEST CARD ── */}
      {isOnline && hasRequest && pendingRide && (
        <div className="absolute z-30 left-4 right-4 bottom-[88px] transition-all duration-300">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 drop-shadow">
            Incoming Request
          </p>
          {pendingRide.type === "ride" && (
            <RideCard
              riderName={pendingRide.passengerName}
              pickupLocation={pendingRide.pickupAddress}
              dropoffLocation={pendingRide.dropoffAddress}
              riderPayment={pendingRide.fare}
              coopFee={pendingRide.coopFee}
              driverTake={pendingRide.driverTake}
              estimatedTime={pendingRide.estimatedMinutes}
              onAccept={handleAccept}
              onDecline={handleDecline}
            />
          )}
          {pendingRide.type === "courier" && <CourierCard ride={pendingRide} onAccept={handleAccept} onDecline={handleDecline} />}
          {pendingRide.type === "food"    && <FoodCard ride={pendingRide} onAccept={handleAccept} onDecline={handleDecline} />}
        </div>
      )}

      {isOnline && !hasRequest && (locationError || rideListenerError) && (
        <div className="absolute top-20 left-0 right-0 z-10 flex flex-col items-center gap-1.5">
          {locationError && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-full px-4 py-2">
              <span className="text-xs font-medium text-destructive">{locationError}</span>
            </div>
          )}
          {rideListenerError && (
            <div className="bg-destructive/90 rounded-full px-4 py-2">
              <span className="text-xs font-bold text-white">{rideListenerError}</span>
            </div>
          )}
        </div>
      )}

      {/* ── BOTTOM SHEET ── */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-20 bg-card border-t border-border rounded-t-2xl shadow-2xl flex flex-col transition-transform duration-300 ease-out max-h-[72%] ${
          drawerOpen ? "translate-y-0" : "translate-y-[calc(100%-104px)]"
        }`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Handle area — tap anywhere to toggle */}
        <div
          className="flex-shrink-0 pt-2.5 pb-3 px-4 cursor-pointer"
          onClick={() => { if (!hasRequest) setDrawerOpen((o) => !o); }}
        >
          <div className="w-10 h-1 bg-muted-foreground/25 rounded-full mx-auto mb-3" />

          <div className="flex items-center gap-3 bg-background border border-border rounded-xl px-4 py-3">
            <span className="flex-1 text-base font-medium text-muted-foreground select-none">Daily Opportunities</span>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-4 pb-6 space-y-4">

          {/* Daily Opportunities */}
          <div className="space-y-3">
            {liveOpps.length === 0 ? (
              <div className="py-5 text-center">
                <p className="text-xs text-muted-foreground">No active bonus zones right now. Check back soon.</p>
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4">
                {liveOpps.map((opp) => {
                  const Icon = ICON_MAP[opp.iconName] ?? Target;
                  return (
                    <button key={opp.id} type="button" className="flex-1 min-w-[140px] bg-background border border-border rounded-xl p-3 text-left space-y-2 hover:border-primary/40 active:scale-95 transition-all duration-150">
                      <div className="flex items-start justify-between">
                        <div className="p-1.5 rounded-lg bg-primary/10"><Icon size={16} className="text-primary" /></div>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary">{opp.tag}</span>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground">{opp.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{opp.detail}</p>
                      </div>
                      <p className="text-base font-bold text-primary">{opp.bonus}</p>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="bg-background border border-border rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5"><Target size={13} className="text-primary" />Weekly Ride Goal</p>
                <span className="text-xs text-muted-foreground">{weeklyDone} / {weeklyGoal} rides</span>
              </div>
              <div className="w-full h-2 bg-muted/30 rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, weeklyGoal > 0 ? Math.round((weeklyDone / weeklyGoal) * 100) : 0)}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">{Math.max(weeklyGoal - weeklyDone, 0)} more rides unlocks your <span className="text-primary font-semibold">${bonusAmount} bonus</span></p>
            </div>
          </div>

          {/* Today's Earnings */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Today's Earnings</p>
              <button
                type="button"
                onClick={() => setEarningsVisible((v) => !v)}
                aria-label={earningsVisible ? "Hide earnings" : "Show earnings"}
                className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
              >
                {earningsVisible ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
            <div className="bg-background border border-border rounded-xl p-4">
              {(() => {
                const todayRides = todayEntries.length;
                const todayGross = todayEntries.reduce((s, e) => s + e.gross, 0);
                const todayNet   = todayEntries.reduce((s, e) => s + e.amount, 0);
                return (
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Rides</p>
                      <p className="text-2xl font-bold text-foreground">{todayRides}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Gross</p>
                      <p className={`text-2xl font-bold text-foreground transition-all duration-200 ${!earningsVisible ? "blur-sm select-none" : ""}`}>${todayGross.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Net (88%)</p>
                      <p className={`text-2xl font-bold text-primary transition-all duration-200 ${!earningsVisible ? "blur-sm select-none" : ""}`}>${todayNet.toFixed(2)}</p>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* ── ACCEPT ERROR TOAST ── */}
      {acceptError && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[99999] flex items-center gap-2 bg-destructive text-destructive-foreground text-sm font-semibold px-4 py-3 rounded-2xl shadow-xl pointer-events-none max-w-[90vw] text-center">
          {acceptError}
        </div>
      )}

      {/* ── ROAD ISSUE MODAL ── */}
      {issueOpen && (
        <div className="fixed inset-0 z-[9999] flex items-end justify-center px-4 pb-8 bg-black/60" onClick={() => setIssueOpen(false)}>
          <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={16} className="text-amber-500" />
              <p className="text-sm font-bold text-foreground">Report Road Issue</p>
            </div>
            {issueDone ? (
              <div className="flex items-center justify-center gap-2 py-4 text-primary">
                <CheckCircle size={18} />
                <span className="text-sm font-semibold">Report submitted — thanks!</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {([
                  { type: "closure",  label: "Road Closure",  emoji: "🚧" },
                  { type: "accident", label: "Accident",      emoji: "💥" },
                  { type: "traffic",  label: "Heavy Traffic", emoji: "🚗" },
                  { type: "hazard",   label: "Hazard",        emoji: "⚠️"  },
                  { type: "pothole",  label: "Pothole",       emoji: "🕳️"  },
                  { type: "other",    label: "Other",         emoji: "📍"  },
                ] as { type: RoadIssueType; label: string; emoji: string }[]).map(({ type, label, emoji }) => (
                  <button
                    key={type}
                    type="button"
                    disabled={issueSubmitting}
                    onClick={async () => {
                      if (!user || !currentCoords) return;
                      setIssueSubmitting(true);
                      try {
                        await reportRoadIssue({ driverId: user.uid, type, lat: currentCoords[0], lng: currentCoords[1] });
                        setIssueDone(true);
                        setTimeout(() => setIssueOpen(false), 1500);
                      } finally {
                        setIssueSubmitting(false);
                      }
                    }}
                    className="flex items-center gap-2 py-3 px-3 rounded-xl border border-border bg-muted/20 active:scale-95 transition-transform disabled:opacity-50"
                  >
                    <span className="text-lg">{emoji}</span>
                    <span className="text-xs font-semibold text-foreground">{label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── IN-APP NAVIGATION SEARCH ── */}
      {navOpen && (
        <div className="fixed inset-0 z-[9999] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setNavOpen(false); setNavQuery(""); setNavResults([]); }} />
          <div className="relative w-full max-w-[430px] mx-auto bg-card border-t border-border rounded-t-2xl shadow-2xl flex flex-col max-h-[80vh]">
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-border">
              <Search size={16} className="text-muted-foreground flex-shrink-0" />
              <input
                autoFocus
                type="text"
                value={navQuery}
                onChange={(e) => searchPlaces(e.target.value)}
                placeholder="Search destination..."
                className="flex-1 bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground outline-none"
              />
              {navSearching && <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin flex-shrink-0" />}
              <button
                type="button"
                aria-label="Close search"
                onClick={() => { setNavOpen(false); setNavQuery(""); setNavResults([]); }}
              >
                <X size={18} className="text-muted-foreground" />
              </button>
            </div>
            {/* Results */}
            <div className="overflow-y-auto flex-1 pb-8">
              {navResults.length === 0 && navQuery.length >= 2 && !navSearching && (
                <p className="text-center text-sm text-muted-foreground py-10">No results found</p>
              )}
              {navResults.length === 0 && navQuery.length < 2 && (
                <p className="text-center text-sm text-muted-foreground py-10">Type to search for a destination</p>
              )}
              {navResults.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectPlace(r)}
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-muted/30 active:bg-muted/50 border-b border-border/50 text-left"
                >
                  <MapPin size={16} className="text-primary mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{r.name}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{r.sub}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── OFFLINE BLOCK MODAL ── */}
      {offlineBlockOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4 bg-black/60">
          <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 space-y-4">
            <h2 className="text-base font-bold text-foreground">Complete your active trip first</h2>
            <p className="text-sm text-muted-foreground">You can't go offline while a ride is in progress. Complete or cancel the current trip before going offline.</p>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setOfflineBlockOpen(false)}
                className="py-3 rounded-xl bg-muted/30 border border-border text-foreground font-semibold text-sm active:scale-95 transition-transform">
                Stay Online
              </button>
              <button type="button" onClick={() => { setOfflineBlockOpen(false); navigate("/trip", { replace: true, state: { riderName: activeRide?.passengerName, pickupLocation: activeRide?.pickupAddress, dropoffLocation: activeRide?.dropoffAddress, riderPayment: activeRide?.fare, coopFee: activeRide?.coopFee, driverTake: activeRide?.driverTake, estimatedTime: activeRide?.estimatedMinutes, isAdvanced: activeRide?.isAdvanced, type: activeRide?.type, rideId: activeRide?.id, pickupCoords: activeRide?.pickupLocation ? [activeRide.pickupLocation.latitude, activeRide.pickupLocation.longitude] as [number,number] : undefined, dropoffCoords: activeRide?.dropoffLocation ? [activeRide.dropoffLocation.latitude, activeRide.dropoffLocation.longitude] as [number,number] : undefined } }); }}
                className="py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm active:scale-95 transition-transform btn-glow">
                Back to Trip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PREFERENCES PANEL ── */}
      {prefsOpen && (
        <>
          <div className="absolute inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => setPrefsOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 z-50 bg-card border-t border-border rounded-t-2xl shadow-2xl">
            <div className="pt-2.5 pb-2 px-4">
              <div className="w-10 h-1 bg-muted-foreground/25 rounded-full mx-auto mb-3" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base font-bold text-foreground">Preferences</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Request types &amp; availability</p>
                </div>
                <button type="button" onClick={() => setPrefsOpen(false)} aria-label="Close preferences" className="w-8 h-8 rounded-full bg-muted/30 flex items-center justify-center">
                  <X size={15} className="text-muted-foreground" />
                </button>
              </div>
            </div>

            <div className="px-4 pb-8 divide-y divide-border">
              {/* Online/Offline master switch */}
              <div className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isOnline ? "bg-primary/10 border border-primary/20" : "bg-muted/20 border border-border"}`}>
                    <div className={`w-3 h-3 rounded-full ${isOnline ? "bg-primary animate-pulse" : "bg-slate-400"}`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{isOnline ? "Online" : "Offline"}</p>
                    <p className="text-xs text-muted-foreground">{isOnline ? "Receiving requests" : "Not visible to riders"}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleToggleOnline}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 ${isOnline ? "bg-destructive/15 text-destructive border border-destructive/25" : "bg-primary/15 text-primary border border-primary/25"}`}
                >
                  {isOnline ? "Go Offline" : "Go Online"}
                </button>
              </div>

              {/* Service toggles */}
              {[
                { icon: Car,             label: "Rides",         sublabel: "Standard passenger rides",    on: acceptRides,   toggle: () => togglePref("acceptRides",   setAcceptRides)   },
                { icon: Package,         label: "Courier",       sublabel: "Package delivery jobs",       on: acceptCourier, toggle: () => togglePref("acceptCourier", setAcceptCourier) },
                { icon: UtensilsCrossed, label: "Food Delivery", sublabel: "Restaurant pickup & dropoff", on: acceptFood,    toggle: () => togglePref("acceptFood",    setAcceptFood)    },
                { icon: PawPrint,        label: "Pet-Friendly",  sublabel: "Accept riders with pets",     on: acceptPets,    toggle: () => togglePref("acceptPets",    setAcceptPets)    },
              ].map(({ icon: Icon, label, sublabel, on, toggle }) => (
                <div key={label} className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${on ? "bg-primary/10 border border-primary/20" : "bg-muted/20 border border-border"}`}>
                      <Icon size={18} className={on ? "text-primary" : "text-muted-foreground"} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{label}</p>
                      <p className="text-xs text-muted-foreground">{sublabel}</p>
                    </div>
                  </div>
                  <Toggle on={on} onToggle={toggle} label={`Toggle ${label}`} />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
