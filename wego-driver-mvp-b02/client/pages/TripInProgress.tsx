import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { MapPin, CheckCircle, Clock, Navigation, User, ChevronLeft } from "lucide-react";

type TripPhase = "to-pickup" | "in-progress" | "complete";

interface TripData {
  riderName: string;
  pickupLocation: string;
  dropoffLocation: string;
  riderPayment: number;
  coopFee: number;
  driverTake: number;
  estimatedTime: number;
}

const DEFAULT_TRIP: TripData = {
  riderName: "Sarah M.",
  pickupLocation: "San Jose Airport (SJC)",
  dropoffLocation: "SFO Airport",
  riderPayment: 50,
  coopFee: 6.00,
  driverTake: 44.00,
  estimatedTime: 8,
};

export default function TripInProgress() {
  const navigate = useNavigate();
  const location = useLocation();
  const trip: TripData = (location.state as TripData) ?? DEFAULT_TRIP;

  const [phase, setPhase] = useState<TripPhase>("to-pickup");
  const [elapsed, setElapsed] = useState(0);

  // Timer during in-progress phase
  useEffect(() => {
    if (phase !== "in-progress") return;
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  if (phase === "complete") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
        <div className="max-w-md w-full space-y-6">
          {/* Success Icon */}
          <div className="flex flex-col items-center gap-3 pt-8">
            <div className="w-20 h-20 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center">
              <CheckCircle size={40} className="text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">Trip Complete</h1>
            <p className="text-muted-foreground text-center">Great ride, {trip.riderName.split(" ")[0]} has been dropped off.</p>
          </div>

          {/* Earnings Card */}
          <div className="glass-card p-5 border border-primary/20 rounded-2xl space-y-4 bg-gradient-to-br from-primary/8 to-transparent">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Your Earnings</p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Rider Paid</span>
                <span className="text-foreground font-medium">${trip.riderPayment.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">WeGo Fee (12%)</span>
                <span className="text-destructive font-medium">-${trip.coopFee.toFixed(2)}</span>
              </div>
              <div className="h-px bg-border/50" />
              <div className="flex justify-between">
                <span className="text-primary font-semibold">Your Take</span>
                <span className="text-2xl font-bold text-primary">${trip.driverTake.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Trip Summary */}
          <div className="glass-card p-4 border border-border rounded-xl space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Trip Summary</p>
            <div className="space-y-2">
              <div className="flex gap-3 items-start">
                <MapPin size={16} className="text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Pickup</p>
                  <p className="text-sm text-foreground">{trip.pickupLocation}</p>
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <MapPin size={16} className="text-primary/60 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Dropoff</p>
                  <p className="text-sm text-foreground">{trip.dropoffLocation}</p>
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <Clock size={16} className="text-muted-foreground flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Duration</p>
                  <p className="text-sm text-foreground">{formatTime(elapsed)}</p>
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate("/")}
            className="w-full py-4 rounded-2xl bg-primary text-foreground font-bold text-lg flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            Back to Command
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col pb-6">
      {/* Map Placeholder */}
      <div className="relative flex-1 bg-gradient-to-br from-blue-950 via-slate-900 to-slate-950 min-h-64">
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-20">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(0deg, transparent 24%, rgba(0,71,255,0.05) 25%, rgba(0,71,255,0.05) 26%, transparent 27%), linear-gradient(90deg, transparent 24%, rgba(0,71,255,0.05) 25%, rgba(0,71,255,0.05) 26%, transparent 27%)",
              backgroundSize: "50px 50px",
            }}
          />
        </div>

        {/* Back button */}
        <button
          type="button"
          onClick={() => navigate("/")}
          className="absolute top-4 left-4 z-10 w-10 h-10 rounded-full bg-card/80 backdrop-blur-sm border border-border flex items-center justify-center"
        >
          <ChevronLeft size={20} className="text-foreground" />
        </button>

        {/* Phase badge */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
          <div
            className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border backdrop-blur-sm ${
              phase === "to-pickup"
                ? "bg-primary/20 border-primary/40 text-primary"
                : "bg-primary/20 border-primary/40 text-primary"
            }`}
          >
            {phase === "to-pickup" ? "Heading to Pickup" : "Trip in Progress"}
          </div>
        </div>

        {/* Animated location dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative">
            <div className="w-5 h-5 bg-primary rounded-full animate-pulse shadow-lg shadow-primary/50" />
            <div className="absolute inset-0 w-5 h-5 border-2 border-primary rounded-full animate-ping opacity-60" />
          </div>
        </div>

        {/* Timer — only during in-progress */}
        {phase === "in-progress" && (
          <div className="absolute bottom-4 right-4 bg-card/80 backdrop-blur-sm border border-border rounded-xl px-3 py-2 flex items-center gap-2">
            <Clock size={14} className="text-primary" />
            <span className="text-sm font-bold text-primary font-mono">{formatTime(elapsed)}</span>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-b from-transparent to-background" />
      </div>

      {/* Bottom Panel */}
      <div className="px-4 pt-2 space-y-4">
        {/* Rider Info */}
        <div className="glass-card p-4 border border-border rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
            {trip.riderName.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground">{trip.riderName}</p>
            <p className="text-xs text-muted-foreground">Your Take: <span className="text-primary font-semibold">${trip.driverTake.toFixed(2)}</span></p>
          </div>
          <User size={18} className="text-muted-foreground flex-shrink-0" />
        </div>

        {/* Destination Card */}
        <div className="glass-card p-4 border border-border rounded-xl space-y-3">
          {phase === "to-pickup" ? (
            <div className="flex gap-3 items-start">
              <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Navigation size={14} className="text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Pickup Location</p>
                <p className="text-base font-semibold text-foreground mt-0.5">{trip.pickupLocation}</p>
                <p className="text-xs text-muted-foreground mt-1">{trip.estimatedTime} min away</p>
              </div>
            </div>
          ) : (
            <div className="flex gap-3 items-start">
              <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <MapPin size={14} className="text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Dropoff Location</p>
                <p className="text-base font-semibold text-foreground mt-0.5">{trip.dropoffLocation}</p>
              </div>
            </div>
          )}
        </div>

        {/* Action Button */}
        {phase === "to-pickup" ? (
          <button
            type="button"
            onClick={() => setPhase("in-progress")}
            className="w-full py-4 rounded-2xl bg-primary text-foreground font-bold text-lg flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-xl shadow-primary/30"
          >
            <CheckCircle size={22} />
            Arrived at Pickup
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setPhase("complete")}
            className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-lg flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-xl shadow-primary/30"
          >
            <CheckCircle size={22} />
            Complete Trip
          </button>
        )}
      </div>
    </div>
  );
}
