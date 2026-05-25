import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, MapPin, Clock, TrendingUp } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { listenToCompletedRides, type Ride } from "@/lib/db";

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

  const formatDate = (d: Date | null) => {
    if (!d) return "Unknown";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  };

  const typeLabel = (r: Ride) =>
    r.type === "food" ? "Food" : r.type === "courier" ? "Courier" : "Ride";

  return (
    <div className="bg-background pt-4 px-4 pb-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-card border border-border flex items-center justify-center active:scale-95 transition-transform"
        >
          <ChevronLeft size={18} className="text-foreground" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Trip History</h1>
          <p className="text-xs text-muted-foreground">{rides.length} completed trips</p>
        </div>
      </div>

      {/* Summary card */}
      {rides.length > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp size={14} className="text-primary" />
            <p className="text-xs font-semibold text-primary uppercase tracking-wide">All Time</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Trips</p>
              <p className="text-2xl font-bold text-foreground">{rides.length}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Your Take</p>
              <p className="text-2xl font-bold text-primary">${totalEarned.toFixed(0)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Gross</p>
              <p className="text-2xl font-bold text-foreground">${totalGross.toFixed(0)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && rides.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <div className="w-16 h-16 rounded-full bg-muted/20 border border-border flex items-center justify-center">
            <Clock size={28} className="text-muted-foreground" />
          </div>
          <p className="text-foreground font-semibold">No completed trips yet</p>
          <p className="text-xs text-muted-foreground">Trips will appear here once you complete them</p>
        </div>
      )}

      {/* Trip list */}
      <div className="space-y-3">
        {rides.map((ride) => (
          <div key={ride.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                  {ride.passengerName.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{ride.passengerName}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(ride.completedAt)}</p>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-lg font-bold text-primary">${ride.driverTake.toFixed(2)}</p>
                <span className="text-[10px] font-semibold text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded">
                  {typeLabel(ride)}
                </span>
              </div>
            </div>

            <div className="space-y-1.5 border-t border-border/50 pt-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin size={11} className="text-primary flex-shrink-0" />
                <span className="truncate">{ride.pickupAddress}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin size={11} className="flex-shrink-0" />
                <span className="truncate">{ride.dropoffAddress}</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/30 pt-2">
              <span>Rider paid ${ride.fare.toFixed(2)}</span>
              <span>WeGo fee −${ride.coopFee.toFixed(2)}</span>
              {ride.passengerRatingGiven > 0
                ? <span>⭐ {ride.passengerRatingGiven.toFixed(1)}</span>
                : <span className="text-muted-foreground/50">Not rated</span>
              }
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
