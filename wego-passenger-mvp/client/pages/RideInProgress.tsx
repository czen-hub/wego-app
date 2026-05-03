import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { MapPin, CheckCircle, Clock, ChevronLeft, Star, Phone, MessageSquare } from "lucide-react";

type RidePhase = "matching" | "en_route" | "arrived" | "in_progress" | "complete";

interface RideData {
  destination: string;
  fare: number;
  driverTake: number;
  coopFee: number;
}

const DEFAULT_RIDE: RideData = {
  destination: "SFO Airport",
  fare: 50.00,
  driverTake: 44.00,
  coopFee: 6.00,
};

const MOCK_DRIVER = {
  name: "Marcus T.",
  initial: "M",
  rating: 4.94,
  trips: 847,
  car: "2021 Toyota Camry",
  color: "Silver",
  plate: "ABC-1234",
  yearsWithWeGo: 3,
};

const PHASE_SEQUENCE: RidePhase[] = ["matching", "en_route", "arrived", "in_progress", "complete"];

export default function RideInProgress() {
  const navigate = useNavigate();
  const location = useLocation();
  const ride: RideData = (location.state as RideData) ?? DEFAULT_RIDE;

  const [phase, setPhase] = useState<RidePhase>("matching");
  const [elapsed, setElapsed] = useState(0);
  const [rating, setRating] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const matchingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-advance from matching → en_route after 3 seconds (demo)
  useEffect(() => {
    if (phase === "matching") {
      matchingTimerRef.current = setTimeout(() => setPhase("en_route"), 3000);
    }
    return () => {
      if (matchingTimerRef.current) clearTimeout(matchingTimerRef.current);
    };
  }, [phase]);

  // Timer during in_progress phase
  useEffect(() => {
    if (phase !== "in_progress") return;
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const advance = () => {
    const idx = PHASE_SEQUENCE.indexOf(phase);
    if (idx < PHASE_SEQUENCE.length - 1) setPhase(PHASE_SEQUENCE[idx + 1]);
  };

  // ── COMPLETE VIEW ──────────────────────────────────────────────────────────
  if (phase === "complete") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-10">
        <div className="max-w-md w-full space-y-5">

          {/* Success */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-20 h-20 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center">
              <CheckCircle size={40} className="text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">You've arrived!</h1>
            <p className="text-muted-foreground text-center text-sm">Thanks for riding with WeGo</p>
          </div>

          {/* Receipt */}
          <div className="bg-card border border-primary/20 rounded-2xl p-5 space-y-4 bg-primary/5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Receipt</p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Fare</span>
                <span className="text-foreground font-semibold">${ride.fare.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Driver earned</span>
                  <span className="text-xs bg-primary/15 text-primary px-1.5 py-0.5 rounded font-semibold">88%</span>
                </div>
                <span className="text-primary font-semibold">${ride.driverTake.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">WeGo Cooperative</span>
                  <span className="text-xs bg-muted/30 text-muted-foreground px-1.5 py-0.5 rounded font-semibold">12%</span>
                </div>
                <span className="text-muted-foreground font-medium">${ride.coopFee.toFixed(2)}</span>
              </div>
              <div className="h-px bg-border/50 my-1" />
              <p className="text-xs text-muted-foreground">
                The 12% coop fee funds driver pensions, group insurance, and the autonomous vehicle fleet.
              </p>
            </div>
          </div>

          {/* Rate your driver */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                {MOCK_DRIVER.initial}
              </div>
              <div>
                <p className="font-semibold text-foreground">{MOCK_DRIVER.name}</p>
                <p className="text-xs text-muted-foreground">{MOCK_DRIVER.car} · {MOCK_DRIVER.plate}</p>
              </div>
            </div>

            {!ratingSubmitted ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground text-center">How was your ride?</p>
                <div className="flex justify-center gap-3">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className={`transition-transform active:scale-90 ${star <= rating ? "text-yellow-400" : "text-muted-foreground/30"}`}
                    >
                      <Star size={32} fill={star <= rating ? "currentColor" : "none"} />
                    </button>
                  ))}
                </div>
                {rating > 0 && (
                  <button
                    type="button"
                    onClick={() => setRatingSubmitted(true)}
                    className="w-full py-2.5 rounded-xl bg-primary/10 border border-primary/25 text-primary font-semibold text-sm active:scale-95 transition-transform"
                  >
                    Submit Rating
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 py-2 text-primary">
                <CheckCircle size={16} />
                <span className="text-sm font-semibold">Thanks for rating!</span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => navigate("/")}
            className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-lg active:scale-95 transition-transform"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // ── ACTIVE TRIP VIEW ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col pb-6">
      {/* Map */}
      <div className="relative flex-1 bg-gradient-to-br from-blue-950 via-slate-900 to-slate-950 min-h-64">
        <div className="absolute inset-0 opacity-15">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(0deg, transparent 24%, rgba(0,71,255,0.07) 25%, rgba(0,71,255,0.07) 26%, transparent 27%), linear-gradient(90deg, transparent 24%, rgba(0,71,255,0.07) 25%, rgba(0,71,255,0.07) 26%, transparent 27%)",
              backgroundSize: "50px 50px",
            }}
          />
        </div>

        <button
          type="button"
          onClick={() => navigate("/")}
          className="absolute top-4 left-4 z-10 w-10 h-10 rounded-full bg-card/80 backdrop-blur-sm border border-border flex items-center justify-center"
        >
          <ChevronLeft size={20} className="text-foreground" />
        </button>

        {/* Phase badge */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
          <div className="px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border backdrop-blur-sm bg-primary/20 border-primary/40 text-primary">
            {phase === "matching" && "Finding Driver"}
            {phase === "en_route" && "Driver En Route"}
            {phase === "arrived" && "Driver Arrived"}
            {phase === "in_progress" && "Trip in Progress"}
          </div>
        </div>

        {/* Animated dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative">
            {phase === "matching" ? (
              <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            ) : (
              <>
                <div className="w-5 h-5 bg-primary rounded-full animate-pulse shadow-lg shadow-primary/50" />
                <div className="absolute inset-0 w-5 h-5 border-2 border-primary rounded-full animate-ping opacity-60" />
              </>
            )}
          </div>
        </div>

        {/* Timer */}
        {phase === "in_progress" && (
          <div className="absolute bottom-4 right-4 bg-card/80 backdrop-blur-sm border border-border rounded-xl px-3 py-2 flex items-center gap-2">
            <Clock size={14} className="text-primary" />
            <span className="text-sm font-bold text-primary font-mono">{formatTime(elapsed)}</span>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-b from-transparent to-background" />
      </div>

      {/* Bottom Panel */}
      <div className="px-4 pt-2 space-y-3">

        {/* Matching state */}
        {phase === "matching" && (
          <div className="glass-card p-5 border border-border rounded-xl text-center space-y-2">
            <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin mx-auto" />
            <p className="font-semibold text-foreground">Finding your driver...</p>
            <p className="text-xs text-muted-foreground">Usually takes 2–5 minutes in your area</p>
          </div>
        )}

        {/* Driver card — shown for en_route, arrived, in_progress */}
        {(phase === "en_route" || phase === "arrived" || phase === "in_progress") && (
          <div className="glass-card p-4 border border-border rounded-xl space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                {MOCK_DRIVER.initial}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground">{MOCK_DRIVER.name}</p>
                <div className="flex items-center gap-1">
                  <Star size={11} fill="currentColor" className="text-yellow-400" />
                  <span className="text-xs text-muted-foreground">{MOCK_DRIVER.rating} · {MOCK_DRIVER.trips} trips · {MOCK_DRIVER.yearsWithWeGo} yrs WeGo</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Phone size={14} className="text-primary" />
                </button>
                <button type="button" className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <MessageSquare size={14} className="text-primary" />
                </button>
              </div>
            </div>

            <div className="bg-background border border-border/50 rounded-lg px-3 py-2 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{MOCK_DRIVER.color} {MOCK_DRIVER.car}</p>
                <p className="text-sm font-bold text-foreground tracking-widest">{MOCK_DRIVER.plate}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Member since</p>
                <p className="text-xs font-semibold text-primary">Year 3 WeGo</p>
              </div>
            </div>
          </div>
        )}

        {/* Destination card */}
        {phase !== "matching" && (
          <div className="glass-card p-4 border border-border rounded-xl">
            <div className="flex gap-3 items-start">
              <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <MapPin size={14} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">
                  {phase === "in_progress" ? "Dropoff" : phase === "arrived" ? "Pickup — Driver Here" : "Heading to you"}
                </p>
                <p className="text-sm font-semibold text-foreground mt-0.5 truncate">
                  {phase === "in_progress" ? ride.destination : "Your Current Location"}
                </p>
                {phase === "en_route" && (
                  <p className="text-xs text-muted-foreground mt-1">6 min away</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Action button */}
        {phase === "en_route" && (
          <button
            type="button"
            onClick={advance}
            className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-lg active:scale-95 transition-transform shadow-lg shadow-primary/30"
          >
            Driver Has Arrived
          </button>
        )}
        {phase === "arrived" && (
          <button
            type="button"
            onClick={advance}
            className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-lg active:scale-95 transition-transform shadow-lg shadow-primary/30"
          >
            Start Ride
          </button>
        )}
        {phase === "in_progress" && (
          <button
            type="button"
            onClick={advance}
            className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-lg active:scale-95 transition-transform shadow-lg shadow-primary/30"
          >
            End Ride
          </button>
        )}
      </div>
    </div>
  );
}
