import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarClock, MapPin, ChevronLeft, Clock, Check, X, User } from "lucide-react";
import { listenToReservedRides, acceptRide, type Ride } from "@/lib/db";
import { useAuth } from "@/context/AuthContext";

function formatScheduledTime(ride: Ride): string {
  if (!ride.scheduledDate) return "Reserved";
  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  const dateLabel =
    ride.scheduledDate === today
      ? "Today"
      : ride.scheduledDate === tomorrow
      ? "Tomorrow"
      : ride.scheduledDate;
  const hour = ride.scheduledHour ?? 0;
  const minute = ride.scheduledMinute ?? 0;
  const h = hour % 12 || 12;
  const ampm = hour < 12 ? "AM" : "PM";
  const m = minute.toString().padStart(2, "0");
  return `${dateLabel}, ${h}:${m} ${ampm}`;
}

export default function ScheduledRides() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [rides, setRides] = useState<Ride[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [accepted, setAccepted] = useState<string[]>([]);
  const [accepting, setAccepting] = useState<string | null>(null);

  useEffect(() => {
    const unsub = listenToReservedRides(setRides);
    return unsub;
  }, []);

  const visible = rides.filter((r) => !dismissed.includes(r.id) && !accepted.includes(r.id));

  const handleAccept = async (ride: Ride) => {
    if (!user || accepting) return;
    setAccepting(ride.id);
    try {
      await acceptRide(ride.id, user.uid, {
        name: profile?.name || "Driver",
        rating: profile?.rating || 5.0,
        car: profile?.vehicleMake
          ? `${profile.vehicleYear} ${profile.vehicleMake} ${profile.vehicleModel}`
          : "Standard Vehicle",
        plate: profile?.licensePlate || "WEGO-1",
      });
      setAccepted((a) => [...a, ride.id]);
      navigate("/trip", {
        state: {
          riderName: ride.passengerName,
          pickupLocation: ride.pickupAddress,
          dropoffLocation: ride.dropoffAddress,
          riderPayment: ride.fare,
          coopFee: ride.coopFee,
          driverTake: ride.driverTake,
          estimatedTime: ride.estimatedMinutes,
          type: ride.type,
          rideId: ride.id,
          isAdvanced: ride.isAdvanced ?? false,
          pickupCoords: ride.pickupLocation
            ? [ride.pickupLocation.latitude, ride.pickupLocation.longitude] as [number, number]
            : undefined,
          dropoffCoords: ride.dropoffLocation
            ? [ride.dropoffLocation.latitude, ride.dropoffLocation.longitude] as [number, number]
            : undefined,
        },
      });
    } catch {
      setAccepting(null);
    }
  };

  return (
    <div className="bg-background pt-3 px-4 pb-4 min-h-screen">
      <div className="max-w-2xl mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/")}
            aria-label="Back to command"
            className="w-9 h-9 rounded-full bg-card border border-border flex items-center justify-center"
          >
            <ChevronLeft size={18} className="text-foreground" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Scheduled Rides</h1>
            <p className="text-xs text-muted-foreground">Upcoming reserved ride requests</p>
          </div>
        </div>

        {accepted.length > 0 && (
          <div className="flex items-center gap-3 bg-primary/10 border border-primary/25 rounded-xl px-4 py-3">
            <Check size={16} className="text-primary flex-shrink-0" />
            <p className="text-sm font-semibold text-primary">{accepted.length} ride{accepted.length > 1 ? "s" : ""} confirmed in your schedule.</p>
          </div>
        )}

        {visible.length === 0 && accepted.length === 0 && (
          <div className="text-center py-16 space-y-2">
            <CalendarClock size={40} className="text-muted-foreground mx-auto" />
            <p className="text-sm font-semibold text-foreground">No scheduled rides available</p>
            <p className="text-xs text-muted-foreground">Reserved rides will appear here when passengers book in advance.</p>
          </div>
        )}

        {visible.map((ride) => (
          <div key={ride.id} className="glass-card border border-border rounded-xl p-4 space-y-4">
            {/* Time + fare header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <CalendarClock size={15} className="text-primary" />
                </div>
                <div>
                  <p className="text-xs font-bold text-primary">{formatScheduledTime(ride)}</p>
                  <p className="text-xs text-muted-foreground">~{ride.estimatedMinutes} min ride</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-primary">${ride.driverTake.toFixed(2)}</p>
                <p className="text-[10px] text-muted-foreground">your take (88%)</p>
              </div>
            </div>

            {/* Rider */}
            <div className="flex items-center gap-2 bg-background border border-border/50 rounded-xl px-3 py-2.5">
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {ride.passengerName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{ride.passengerName}</p>
                <p className="text-[10px] text-muted-foreground">Ref: {ride.id.slice(0, 8).toUpperCase()}</p>
              </div>
              <User size={14} className="text-muted-foreground" />
            </div>

            {/* Route */}
            <div className="space-y-2 bg-background border border-border/50 rounded-xl px-3 py-3">
              <div className="flex gap-2 items-start">
                <MapPin size={14} className="text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Pickup</p>
                  <p className="text-xs font-semibold text-foreground">{ride.pickupAddress}</p>
                </div>
              </div>
              <div className="ml-3.5 h-4 border-l border-dashed border-border/60" />
              <div className="flex gap-2 items-start">
                <MapPin size={14} className="text-primary/60 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Dropoff</p>
                  <p className="text-xs font-semibold text-foreground">{ride.dropoffAddress}</p>
                </div>
              </div>
            </div>

            {/* Fare breakdown */}
            <div className="flex justify-between text-xs text-muted-foreground px-1">
              <span>Rider pays ${ride.fare.toFixed(2)}</span>
              <span>WeGo fee ${ride.coopFee.toFixed(2)}</span>
              <span className="text-primary font-semibold">You keep ${ride.driverTake.toFixed(2)}</span>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDismissed((d) => [...d, ride.id])}
                className="flex-1 py-3 rounded-xl bg-muted/20 border border-border text-muted-foreground font-semibold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
              >
                <X size={15} /> Decline
              </button>
              <button
                type="button"
                disabled={accepting === ride.id}
                onClick={() => handleAccept(ride)}
                className="flex-[2] py-3 rounded-xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-transform shadow-lg shadow-primary/30 disabled:opacity-60"
              >
                <Check size={15} /> {accepting === ride.id ? "Accepting…" : "Confirm Ride"}
              </button>
            </div>
          </div>
        ))}

        <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-3">
          <Clock size={14} className="text-muted-foreground flex-shrink-0" />
          <p className="text-xs text-muted-foreground">You'll be matched to reserved rides 1 hour before pickup. Confirming locks the ride to your schedule.</p>
        </div>
      </div>
    </div>
  );
}
