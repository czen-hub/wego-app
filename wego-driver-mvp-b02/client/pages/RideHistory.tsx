import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Clock, TrendingUp, Car, Package, Utensils, Star, DollarSign } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { listenToCompletedRides, type Ride } from "@/lib/db";

function formatDate(d: Date | null) {
  if (!d) return "Unknown";
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  const timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (diff === 0) return `Today · ${timeStr}`;
  if (diff === 1) return `Yesterday · ${timeStr}`;
  if (diff < 7) return `${diff} days ago · ${timeStr}`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + ` · ${timeStr}`;
}

function TypeBadge({ type }: { type: Ride["type"] }) {
  const map: Record<string, { label: string; Icon: typeof Car }> = {
    ride: { label: "Ride", Icon: Car },
    courier: { label: "Courier", Icon: Package },
    food: { label: "Food", Icon: Utensils },
  };
  const { label, Icon } = map[type ?? "ride"] ?? map["ride"];
  return (
    <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground uppercase tracking-wide">
      <Icon size={9} />
      {label}
    </span>
  );
}

function stripCoords(s: string) {
  return s.replace(/\s*\([+-]?\d+\.\d+,\s*[+-]?\d+\.\d+\)\s*$/, "").trim();
}

export default function RideHistory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const unsub = listenToCompletedRides(user.uid, (r) => {
      setRides(r);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  const totalEarned = rides.reduce((s, r) => s + r.driverTake, 0);
  const totalGross = rides.reduce((s, r) => s + r.fare, 0);
  const avgFare = rides.length > 0 ? totalEarned / rides.length : 0;

  return (
    <div className="bg-background min-h-screen pb-8">

      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="w-9 h-9 rounded-xl bg-secondary border border-border flex items-center justify-center active:scale-95 transition-transform flex-shrink-0"
        >
          <ArrowLeft size={17} className="text-foreground" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Trip History</h1>
          <p className="text-xs text-muted-foreground">{rides.length} completed trip{rides.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      <div className="px-4 space-y-4">

        {/* Stats hero */}
        {rides.length > 0 && (
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp size={13} className="text-primary" />
              <p className="text-[10px] font-bold text-primary uppercase tracking-widest">All-Time Earnings</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-card border border-border rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-foreground">{rides.length}</p>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mt-0.5">Trips</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-primary">${totalEarned.toFixed(0)}</p>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mt-0.5">Your Take</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-foreground">${avgFare.toFixed(0)}</p>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mt-0.5">Avg/Trip</p>
              </div>
            </div>
            <div className="flex items-center justify-between px-1 pt-1 border-t border-border/30">
              <p className="text-xs text-muted-foreground">Gross collected</p>
              <p className="text-xs font-semibold text-foreground">${totalGross.toFixed(2)}</p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 rounded-full border-[3px] border-primary border-t-transparent animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!loading && rides.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-secondary border border-border flex items-center justify-center">
              <Clock size={28} className="text-muted-foreground" />
            </div>
            <div>
              <p className="text-foreground font-semibold">No completed trips yet</p>
              <p className="text-xs text-muted-foreground mt-1">Go online and complete your first trip</p>
            </div>
          </div>
        )}

        {/* Trip list */}
        <div className="space-y-3">
          {rides.map((ride) => (
            <div key={ride.id} className="bg-card border border-border rounded-2xl overflow-hidden">
              {/* Card header */}
              <div className="flex items-center justify-between px-4 pt-4 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-sm font-bold text-primary-foreground flex-shrink-0">
                    {(ride.passengerName ?? "?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-foreground">{ride.passengerName || "Passenger"}</p>
                      <TypeBadge type={ride.type} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDate(ride.completedAt)}</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-bold text-primary">${ride.driverTake.toFixed(2)}</p>
                  {ride.passengerRatingGiven > 0 && (
                    <div className="flex items-center justify-end gap-0.5 mt-0.5">
                      <Star size={10} className="text-yellow-400 fill-yellow-400" />
                      <span className="text-[11px] text-muted-foreground">{ride.passengerRatingGiven.toFixed(1)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Route */}
              <div className="mx-4 mb-3 space-y-1.5 bg-background border border-border rounded-xl px-3 py-2.5">
                <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                  <MapPin size={11} className="text-primary flex-shrink-0" />
                  <span className="truncate">{stripCoords(ride.pickupAddress)}</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                  <MapPin size={11} className="flex-shrink-0 opacity-40" />
                  <span className="truncate">{stripCoords(ride.dropoffAddress)}</span>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 pb-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <DollarSign size={11} className="text-muted-foreground" />
                  <span>Rider paid ${ride.fare.toFixed(2)}</span>
                </div>
                <span className="text-muted-foreground/60">WeGo fee −${ride.coopFee.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
