import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plane, Music, Target, Clock, ChevronUp, ChevronDown,
  Package, UtensilsCrossed, MapPin, CheckCircle, X,
  SlidersHorizontal, Car, PawPrint, Eye, EyeOff, Wifi,
} from "lucide-react";
import RideCard from "@/components/RideCard";
import { useDispatch } from "@/hooks/useDispatch";
import { type Ride } from "@/lib/db";

const OPPORTUNITIES = [
  { id: "airport", icon: Plane,  iconColor: "text-primary", iconBg: "bg-primary/10", title: "Airport Bonus",  detail: "SFO Terminal 2",      bonus: "+$8/trip",    bonusColor: "text-primary", tag: "Active now", tagColor: "bg-primary/15 text-primary" },
  { id: "event",   icon: Music,  iconColor: "text-primary", iconBg: "bg-primary/10", title: "Warriors Game", detail: "Chase Center · 7 PM", bonus: "+$6/trip",  bonusColor: "text-primary", tag: "Tonight",    tagColor: "bg-primary/15 text-primary" },
];

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

function CourierCard({ ride, onAccept, onDecline }: { ride: Ride; onAccept: () => void; onDecline: () => void }) {
  return (
    <div className="glass-card p-5 space-y-4 border border-primary/20">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Package size={18} className="text-primary" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Package Delivery</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock size={12} /> {ride.estimatedMinutes} min to pickup</p>
          </div>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary uppercase tracking-wide">Courier</span>
      </div>
      <div className="space-y-3">
        <div className="flex gap-3">
          <MapPin size={16} className="text-primary flex-shrink-0 mt-1" />
          <div className="flex-1 min-w-0"><p className="text-xs text-muted-foreground">Pickup</p><p className="text-sm font-medium text-foreground truncate">{ride.pickupAddress}</p></div>
        </div>
        <div className="flex gap-3">
          <MapPin size={16} className="text-primary/60 flex-shrink-0 mt-1" />
          <div className="flex-1 min-w-0"><p className="text-xs text-muted-foreground">Dropoff</p><p className="text-sm font-medium text-foreground truncate">{ride.dropoffAddress}</p></div>
        </div>
      </div>
      <div className="bg-card/50 p-3 rounded-lg space-y-2 border border-border/50">
        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Customer Pays:</span><span className="font-semibold text-foreground">${ride.fare.toFixed(2)}</span></div>
        <div className="flex justify-between text-sm"><span className="text-muted-foreground">WeGo Fee (12%):</span><span className="font-semibold text-destructive">-${ride.coopFee.toFixed(2)}</span></div>
        <div className="border-t border-border/50 pt-2 flex justify-between text-sm"><span className="text-primary font-semibold">Your Take:</span><span className="text-lg font-bold text-primary">${ride.driverTake.toFixed(2)}</span></div>
      </div>
      <div className="grid grid-cols-2 gap-3 pt-2">
        <button type="button" onClick={onDecline} className="py-3 px-4 rounded-lg border border-border text-muted-foreground hover:border-destructive transition-all flex items-center justify-center gap-2"><X size={18} /><span className="font-semibold">Decline</span></button>
        <button type="button" onClick={onAccept} className="py-3 px-4 rounded-lg bg-gradient-to-r from-primary to-blue-600 text-white font-semibold flex items-center justify-center gap-2"><CheckCircle size={18} /><span>Accept</span></button>
      </div>
    </div>
  );
}

function FoodCard({ ride, onAccept, onDecline }: { ride: Ride; onAccept: () => void; onDecline: () => void }) {
  return (
    <div className="glass-card p-5 space-y-4 border border-primary/20">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
            <UtensilsCrossed size={18} className="text-primary" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Food Delivery</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock size={12} /> {ride.estimatedMinutes} min to restaurant</p>
          </div>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary uppercase tracking-wide">Food</span>
      </div>
      <div className="space-y-3">
        <div className="flex gap-3">
          <MapPin size={16} className="text-primary flex-shrink-0 mt-1" />
          <div className="flex-1 min-w-0"><p className="text-xs text-muted-foreground">Pickup</p><p className="text-sm font-medium text-foreground truncate">{ride.pickupAddress}</p></div>
        </div>
        <div className="flex gap-3">
          <MapPin size={16} className="text-primary/60 flex-shrink-0 mt-1" />
          <div className="flex-1 min-w-0"><p className="text-xs text-muted-foreground">Dropoff — {ride.passengerName}</p><p className="text-sm font-medium text-foreground truncate">{ride.dropoffAddress}</p></div>
        </div>
      </div>
      <div className="bg-card/50 p-3 rounded-lg space-y-2 border border-border/50">
        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Delivery Fee:</span><span className="font-semibold text-foreground">${ride.fare.toFixed(2)}</span></div>
        <div className="flex justify-between text-sm"><span className="text-muted-foreground">WeGo Fee (12%):</span><span className="font-semibold text-destructive">-${ride.coopFee.toFixed(2)}</span></div>
        <div className="border-t border-border/50 pt-2 flex justify-between text-sm"><span className="text-primary font-semibold">Your Take:</span><span className="text-lg font-bold text-primary">${ride.driverTake.toFixed(2)}</span></div>
      </div>
      <div className="grid grid-cols-2 gap-3 pt-2">
        <button type="button" onClick={onDecline} className="py-3 px-4 rounded-lg border border-border text-muted-foreground hover:border-destructive transition-all flex items-center justify-center gap-2"><X size={18} /><span className="font-semibold">Decline</span></button>
        <button type="button" onClick={onAccept} className="py-3 px-4 rounded-lg bg-gradient-to-r from-primary to-blue-600 text-white font-semibold flex items-center justify-center gap-2"><CheckCircle size={18} /><span>Accept</span></button>
      </div>
    </div>
  );
}

export default function Command() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isOnline, setOnline, incomingRides, accept, activeRide, locationError } = dispatch;

  const [declinedRideId, setDeclinedRideId] = useState<string | null>(null);
  const pendingRide = incomingRides.find((r) => r.id !== declinedRideId) ?? null;
  const hasRequest = pendingRide !== null;

  const [acceptRides, setAcceptRides] = useState(true);
  const [acceptCourier, setAcceptCourier] = useState(false);
  const [acceptFood, setAcceptFood] = useState(false);
  const [acceptPets, setAcceptPets] = useState(false);
  const weeklyGoal = 20;
  const weeklyDone = 12;
  const [earningsVisible, setEarningsVisible] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const declineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartY = useRef(0);
  const navigatedRef = useRef(false);

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
          type: activeRide.type,
          rideId: activeRide.id,
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
    await setOnline(!isOnline);
    if (isOnline) setDeclinedRideId(null);
  };

  const handleAccept = async () => {
    if (!pendingRide) return;
    navigatedRef.current = true;
    await accept(pendingRide.id);
    navigate("/trip", {
      state: {
        riderName: pendingRide.passengerName,
        pickupLocation: pendingRide.pickupAddress,
        dropoffLocation: pendingRide.dropoffAddress,
        riderPayment: pendingRide.fare,
        coopFee: pendingRide.coopFee,
        driverTake: pendingRide.driverTake,
        estimatedTime: pendingRide.estimatedMinutes,
        type: pendingRide.type,
        rideId: pendingRide.id,
      },
    });
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

  return (
    <div className="relative h-full overflow-hidden">

      {/* ── MAP BACKGROUND ── */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-950 via-slate-900 to-slate-950">
        <div className="absolute inset-0 opacity-15 map-grid" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative">
            <div className={`w-5 h-5 rounded-full transition-colors duration-500 ${isOnline ? "bg-primary" : "bg-slate-500"} animate-pulse`} />
            <div className={`absolute inset-0 w-5 h-5 border-2 rounded-full animate-ping opacity-60 transition-colors duration-500 ${isOnline ? "border-primary" : "border-slate-500"}`} />
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-56 bg-gradient-to-b from-transparent via-background/40 to-background/95" />
      </div>

      {/* ── ONLINE / OFFLINE BADGE — top center, always visible, tappable ── */}
      <div className="absolute top-4 left-0 right-0 z-20 flex justify-center">
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

      {/* ── WAITING FOR RIDES indicator ── */}
      {isOnline && !hasRequest && (
        <div className="absolute top-16 left-0 right-0 z-10 flex justify-center">
          {locationError ? (
            <div className="bg-destructive/10 border border-destructive/30 rounded-full px-4 py-2 flex items-center gap-2">
              <span className="text-xs font-medium text-destructive">{locationError}</span>
            </div>
          ) : (
            <div className="bg-card/80 backdrop-blur-sm border border-border rounded-full px-4 py-2 flex items-center gap-2">
              <Wifi size={13} className="text-primary animate-pulse" />
              <span className="text-xs font-medium text-muted-foreground">Waiting for rides nearby…</span>
            </div>
          )}
        </div>
      )}

      {/* ── BOTTOM SHEET ── */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-20 bg-card border-t border-border rounded-t-2xl shadow-2xl flex flex-col transition-transform duration-300 ease-out max-h-[72%] ${
          drawerOpen ? "translate-y-0" : "translate-y-[calc(100%-76px)]"
        }`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Handle area */}
        <div className="flex-shrink-0 pt-2.5 pb-3 px-4">
          <div className="w-10 h-1 bg-muted-foreground/25 rounded-full mx-auto mb-3" />

          <div className="flex items-center bg-background border border-border rounded-full px-1 py-1 gap-0">
            {/* Left: Preferences icon */}
            <button
              type="button"
              onClick={() => setPrefsOpen(true)}
              className="p-2 rounded-full active:scale-95 transition-transform flex-shrink-0 hover:bg-muted/30"
              aria-label="Open preferences"
            >
              <SlidersHorizontal size={15} className="text-primary" />
            </button>

            {/* Divider */}
            <div className="w-px h-4 bg-border flex-shrink-0" />

            {/* Right: expand/close toggle */}
            <button
              type="button"
              onClick={() => { if (!hasRequest) setDrawerOpen((o) => !o); }}
              className="flex-1 flex items-center justify-end px-3 py-1 rounded-full hover:bg-muted/30 active:scale-95 transition-transform"
            >
              {drawerOpen ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronUp size={14} className="text-muted-foreground" />}
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-4 pb-6 space-y-4">

          {/* Daily Opportunities */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Daily Opportunities</p>
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground"><Clock size={11} /><span>Updated hourly</span></div>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4">
              {OPPORTUNITIES.map((opp) => {
                const Icon = opp.icon;
                return (
                  <button key={opp.id} type="button" className="flex-1 min-w-[140px] bg-background border border-border rounded-xl p-3 text-left space-y-2 hover:border-primary/40 active:scale-95 transition-all duration-150">
                    <div className="flex items-start justify-between">
                      <div className={`p-1.5 rounded-lg ${opp.iconBg}`}><Icon size={16} className={opp.iconColor} /></div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${opp.tagColor}`}>{opp.tag}</span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">{opp.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{opp.detail}</p>
                    </div>
                    <p className={`text-base font-bold ${opp.bonusColor}`}>{opp.bonus}</p>
                  </button>
                );
              })}
            </div>
            <div className="bg-background border border-border rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5"><Target size={13} className="text-primary" />Weekly Ride Goal</p>
                <span className="text-xs text-muted-foreground">{weeklyDone} / {weeklyGoal} rides</span>
              </div>
              <div className="w-full h-2 bg-muted/30 rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full w-[60%]" />
              </div>
              <p className="text-xs text-muted-foreground">{Math.max(weeklyGoal - weeklyDone, 0)} more rides unlocks your <span className="text-primary font-semibold">$25 bonus</span></p>
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
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Rides</p>
                  <p className="text-2xl font-bold text-foreground">12</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Gross</p>
                  <p className={`text-2xl font-bold text-foreground transition-all duration-200 ${!earningsVisible ? "blur-sm select-none" : ""}`}>$420</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Net (88%)</p>
                  <p className={`text-2xl font-bold text-primary transition-all duration-200 ${!earningsVisible ? "blur-sm select-none" : ""}`}>$369.60</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

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
                { icon: Car,             label: "Rides",         sublabel: "Standard passenger rides",    on: acceptRides,   toggle: () => setAcceptRides((v)   => !v) },
                { icon: Package,         label: "Courier",       sublabel: "Package delivery jobs",       on: acceptCourier, toggle: () => setAcceptCourier((v) => !v) },
                { icon: UtensilsCrossed, label: "Food Delivery", sublabel: "Restaurant pickup & dropoff", on: acceptFood,    toggle: () => setAcceptFood((v)    => !v) },
                { icon: PawPrint,        label: "Pet-Friendly",  sublabel: "Accept riders with pets",     on: acceptPets,    toggle: () => setAcceptPets((v)    => !v) },
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
