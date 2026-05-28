import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { UtensilsCrossed, ChevronLeft, MapPin, Clock, Check, X, User } from "lucide-react";
import { listenToPendingJobsByType, acceptRide, type Ride } from "@/lib/db";
import { useAuth } from "@/context/AuthContext";

export default function FoodPickups() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [jobs, setJobs] = useState<Ride[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [accepted, setAccepted] = useState<string[]>([]);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = listenToPendingJobsByType("food", (rides) => {
      setJobs(rides);
      setLoaded(true);
    });
    return unsub;
  }, []);

  const visible = jobs.filter(j => !dismissed.includes(j.id) && !accepted.includes(j.id));

  const handleAccept = async (job: Ride) => {
    if (!user || accepting) return;
    setAccepting(job.id);
    setAcceptError(null);
    try {
      await acceptRide(job.id, user.uid, {
        name: profile?.name || "Driver",
        rating: profile?.rating || 5.0,
        car: profile?.vehicleMake
          ? `${profile.vehicleYear} ${profile.vehicleMake} ${profile.vehicleModel}`
          : "Standard Vehicle",
        plate: profile?.licensePlate || "WEGO-1",
      });
      setAccepted(a => [...a, job.id]);
      navigate("/trip", {
        state: {
          riderName: job.passengerName,
          pickupLocation: job.pickupAddress,
          dropoffLocation: job.dropoffAddress,
          riderPayment: job.fare,
          coopFee: job.coopFee,
          driverTake: job.driverTake,
          estimatedTime: job.estimatedMinutes,
          type: job.type,
          rideId: job.id,
          isAdvanced: false,
          pickupCoords: job.pickupLocation
            ? [job.pickupLocation.latitude, job.pickupLocation.longitude] as [number, number]
            : undefined,
          dropoffCoords: job.dropoffLocation
            ? [job.dropoffLocation.latitude, job.dropoffLocation.longitude] as [number, number]
            : undefined,
        },
      });
    } catch {
      setAccepting(null);
      setAcceptError("Failed to accept job. Please try again.");
    }
  };

  return (
    <div className="bg-background pt-4 px-4 pb-6 min-h-screen">
      <div className="max-w-2xl mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Back"
            onClick={() => navigate("/")}
            className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center shadow-sm active:scale-95 transition-transform"
          >
            <ChevronLeft size={20} className="text-foreground" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Food Pickups</h1>
            <p className="text-xs text-muted-foreground">Restaurant delivery orders</p>
          </div>
        </div>

        {/* Accepted banner */}
        {accepted.length > 0 && (
          <div className="flex items-center gap-3 bg-primary/10 border border-primary/25 rounded-xl px-4 py-3">
            <Check size={16} className="text-primary flex-shrink-0" />
            <p className="text-sm font-semibold text-primary">
              {accepted.length} job{accepted.length > 1 ? "s" : ""} confirmed in your queue.
            </p>
          </div>
        )}
        {acceptError && (
          <div className="flex items-center gap-3 bg-destructive/10 border border-destructive/25 rounded-xl px-4 py-3">
            <X size={16} className="text-destructive flex-shrink-0" />
            <p className="text-sm font-semibold text-destructive">{acceptError}</p>
          </div>
        )}

        {/* Loading */}
        {!loaded && (
          <div className="space-y-3">
            {[0, 1].map(i => (
              <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-3">
                <span className="skeleton h-3 w-32 block" />
                <span className="skeleton h-3 w-48 block" />
                <span className="skeleton h-3 w-40 block" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {loaded && visible.length === 0 && accepted.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <UtensilsCrossed size={28} className="text-primary" />
            </div>
            <div className="space-y-1.5">
              <p className="text-lg font-semibold text-foreground">No food orders right now</p>
              <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                Open delivery orders will appear here. Make sure Food Delivery is enabled in your preferences.
              </p>
            </div>
          </div>
        )}

        {/* Job cards */}
        {visible.map(job => (
          <div key={job.id} className="glass-card border border-border rounded-xl p-4 space-y-4">

            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <UtensilsCrossed size={15} className="text-primary" />
                </div>
                <div>
                  <p className="text-xs font-bold text-primary">Food Delivery</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock size={10} /> ~{job.estimatedMinutes} min delivery
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-primary">${job.driverTake.toFixed(2)}</p>
                <p className="text-[10px] text-muted-foreground">your take (88%)</p>
              </div>
            </div>

            {/* Customer */}
            <div className="flex items-center gap-2 bg-background border border-border/50 rounded-xl px-3 py-2.5">
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {job.passengerName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{job.passengerName}</p>
                <p className="text-[10px] text-muted-foreground">Ref: {job.id.slice(0, 8).toUpperCase()}</p>
              </div>
              <User size={14} className="text-muted-foreground" />
            </div>

            {/* Route */}
            <div className="space-y-2 bg-background border border-border/50 rounded-xl px-3 py-3">
              <div className="flex gap-2 items-start">
                <MapPin size={14} className="text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Restaurant Pickup</p>
                  <p className="text-xs font-semibold text-foreground">{job.pickupAddress}</p>
                </div>
              </div>
              <div className="ml-3.5 h-4 border-l border-dashed border-border/60" />
              <div className="flex gap-2 items-start">
                <MapPin size={14} className="text-primary/60 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Deliver To</p>
                  <p className="text-xs font-semibold text-foreground">{job.dropoffAddress}</p>
                </div>
              </div>
            </div>

            {/* Fare breakdown */}
            <div className="flex justify-between text-xs text-muted-foreground px-1">
              <span>Customer pays ${job.fare.toFixed(2)}</span>
              <span>WeGo fee ${job.coopFee.toFixed(2)}</span>
              <span className="text-primary font-semibold">You keep ${job.driverTake.toFixed(2)}</span>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDismissed(d => [...d, job.id])}
                className="flex-1 py-3 rounded-xl bg-muted/20 border border-border text-muted-foreground font-semibold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
              >
                <X size={15} /> Decline
              </button>
              <button
                type="button"
                disabled={accepting === job.id}
                onClick={() => handleAccept(job)}
                className="flex-[2] py-3 rounded-xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-transform shadow-lg shadow-primary/30 disabled:opacity-60"
              >
                <Check size={15} /> {accepting === job.id ? "Accepting…" : "Accept Order"}
              </button>
            </div>
          </div>
        ))}

        <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-3">
          <Clock size={14} className="text-muted-foreground flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            Enable Food Delivery in Preferences to receive these orders on the home screen automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
