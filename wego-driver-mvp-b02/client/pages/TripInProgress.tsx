import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { MapPin, CheckCircle, Clock, Navigation, Phone, MessageCircle, ChevronLeft, AlertTriangle, Send, X, DollarSign, CornerUpRight, Star } from "lucide-react";
import ClientMap from "@/components/ClientMap";
import { useCurrentLocation } from "@/hooks/useCurrentLocation";
import { updateRideStatus, sendRideMessage, listenToRideMessages, type ChatMessage } from "@/lib/db";
import { useAuth } from "@/context/AuthContext";
import { onSnapshot, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";

type TripPhase = "to-pickup" | "waiting" | "in-progress" | "complete";

interface TripData {
  riderName: string;
  pickupLocation: string;
  dropoffLocation: string;
  riderPayment: number;
  coopFee: number;
  driverTake: number;
  estimatedTime: number;
  type?: "ride" | "courier" | "food";
  isAdvanced?: boolean;
  pickupCoords?: [number, number];
  dropoffCoords?: [number, number];
  rideId?: string;
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
  const [waitElapsed, setWaitElapsed] = useState(0);
  const enRouteElapsed = useRef(0);
  const enRouteFeeRef = useRef(5.00);

  // Track en-route time and fee tier
  useEffect(() => {
    if (phase !== "to-pickup") return;
    const id = setInterval(() => {
      enRouteElapsed.current += 1;
      const mins = enRouteElapsed.current / 60;
      enRouteFeeRef.current = mins < 3 ? 5.00 : mins < 8 ? 9.00 : 14.00;
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  // Wait timer during waiting phase
  useEffect(() => {
    if (phase !== "waiting") return;
    const id = setInterval(() => setWaitElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  const [stopEarnings, setStopEarnings] = useState(0);
  const [passengerRating, setPassengerRating] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [navModalOpen, setNavModalOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const { user } = useAuth();
  const [calling, setCalling] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [passengerCancelled, setPassengerCancelled] = useState(false);
  const [cancellationFee, setCancellationFee] = useState(0);
  const { coords: driverCoords } = useCurrentLocation();

  const phaseRef = useRef(phase);
  const waitElapsedRef = useRef(waitElapsed);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    waitElapsedRef.current = waitElapsed;
  }, [waitElapsed]);

  // Listen for chat messages
  useEffect(() => {
    if (!trip.rideId) return;
    const unsub = listenToRideMessages(trip.rideId, (msgs) => {
      setChatMessages(msgs);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });
    return unsub;
  }, [trip.rideId]);

  // Listen for passenger cancellation
  useEffect(() => {
    if (!trip.rideId) {
      console.error("No trip.rideId available to listen for cancellation.");
      return;
    }
    console.log("Starting listener for ride cancellation on rideId:", trip.rideId);
    
    const unsub = onSnapshot(doc(db, "rides", trip.rideId), (docSnap) => {
      if (!docSnap.exists()) {
        console.log("Ride document does not exist anymore.");
        return;
      }
      
      const status = docSnap.data().status;
      console.log("Ride status update received in driver app:", status);
      
      if (status === "cancelled") {
        console.log("Passenger cancelled! Triggering cancellation flow.");
        // Calculate fee exactly like we do in simulatePassengerCancel
        let fee = 0;
        const currentPhase = phaseRef.current;
        const currentWaitElapsed = waitElapsedRef.current;
        
        if (currentPhase === "to-pickup") {
          fee = enRouteFeeRef.current;
        } else if (currentPhase === "waiting") {
          const freeWait = trip.isAdvanced ? 480 : 300;
          const meterSecs = trip.isAdvanced ? Math.max(0, currentWaitElapsed - freeWait) : 0;
          const meterFee = parseFloat(Math.min((meterSecs / 60) * 0.50, 1.00).toFixed(2));
          fee = enRouteFeeRef.current + 3.00 + meterFee;
        }
        setCancellationFee(fee);
        setPassengerCancelled(true);
      }
    }, (err) => {
      console.error("Error in driver ride cancellation listener:", err);
    });
    return unsub;
  }, [trip.rideId, trip.isAdvanced]);

  const sendMessage = async () => {
    const text = chatInput.trim();
    if (!text || !user || !trip.rideId) return;
    setChatInput("");
    await sendRideMessage(trip.rideId, user.uid, "driver", text);
  };

  const handleCall = () => {
    setCalling(true);
    setTimeout(() => setCalling(false), 3000);
  };

  const simulatePassengerCancel = () => {
    let fee = 0;
    if (phase === "to-pickup") {
      fee = enRouteFeeRef.current;
    } else if (phase === "waiting") {
      const freeWait = trip.isAdvanced ? 480 : 300;
      const meterSecs = trip.isAdvanced ? Math.max(0, waitElapsed - freeWait) : 0;
      const meterFee = parseFloat(Math.min((meterSecs / 60) * 0.50, 1.00).toFixed(2));
      fee = enRouteFeeRef.current + 3.00 + meterFee;
    }
    setCancellationFee(fee);
    setPassengerCancelled(true);
  };

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

  const freeWaitSecs = trip.isAdvanced ? 480 : 300;
  const waitRemaining = Math.max(0, freeWaitSecs - waitElapsed);
  const meterSecs = trip.isAdvanced ? Math.max(0, waitElapsed - freeWaitSecs) : 0;
  const meterCharge = parseFloat(Math.min((meterSecs / 60) * 0.50, 1.00).toFixed(2));
  const canLeave = waitElapsed >= freeWaitSecs;

  const isDelivery = trip.type === "courier" || trip.type === "food";
  const typeLabel = trip.type === "food" ? "Food Delivery" : trip.type === "courier" ? "Courier" : "Ride";
  const pickupLabel = trip.type === "food" ? "Restaurant" : "Pickup";
  const arrivedLabel = trip.type === "food" ? "Arrived at Restaurant" : "Arrived at Pickup";
  const completeLabel = isDelivery ? "Delivery Complete" : "Complete Trip";

  if (phase === "complete") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center px-4 py-12 overflow-y-auto">
        <div className="max-w-md w-full space-y-6">
          {/* Success Icon */}
          <div className="flex flex-col items-center gap-3 pt-8">
            <div className="w-20 h-20 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center">
              <CheckCircle size={40} className="text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">{isDelivery ? "Delivery Complete" : "Trip Complete"}</h1>
            <p className="text-muted-foreground text-center">
              {isDelivery ? `${typeLabel} delivered successfully.` : `Great ride, ${trip.riderName.split(" ")[0]} has been dropped off.`}
            </p>
          </div>

          {/* Earnings Card */}
          <div className="glass-card p-5 border border-primary/20 rounded-2xl space-y-4 bg-gradient-to-br from-primary/8 to-transparent">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Your Earnings</p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{isDelivery ? "Customer Paid" : "Rider Paid"}</span>
                <span className="text-foreground font-medium">${trip.riderPayment.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">WeGo Fee (12%)</span>
                <span className="text-destructive font-medium">-${trip.coopFee.toFixed(2)}</span>
              </div>
              {stopEarnings > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Stop fees (100% yours)</span>
                  <span className="text-primary font-medium">+${stopEarnings.toFixed(2)}</span>
                </div>
              )}
              <div className="h-px bg-border/50" />
              <div className="flex justify-between">
                <span className="text-primary font-semibold">Your Take</span>
                <span className="text-2xl font-bold text-primary">${(trip.driverTake + stopEarnings).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Trip Summary */}
          <div className="glass-card p-4 border border-border rounded-xl space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{isDelivery ? "Delivery Summary" : "Trip Summary"}</p>
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

          {/* Passenger Rating */}
          {!isDelivery && (
            <div className="glass-card p-4 border border-border rounded-xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                  {trip.riderName.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{trip.riderName}</p>
                  <p className="text-xs text-muted-foreground">Rate this passenger</p>
                </div>
              </div>
              {!ratingSubmitted ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground text-center">How was your passenger?</p>
                  <div className="flex justify-center gap-3">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                        onClick={() => setPassengerRating(star)}
                        className={`transition-transform active:scale-90 ${star <= passengerRating ? "text-yellow-400" : "text-muted-foreground/30"}`}
                      >
                        <Star size={32} fill={star <= passengerRating ? "currentColor" : "none"} />
                      </button>
                    ))}
                  </div>
                  {passengerRating > 0 && (
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
          )}

          <button
            type="button"
            onClick={() => navigate("/", { state: { tripCompleted: true } })}
            className="w-full py-4 rounded-2xl bg-primary text-foreground font-bold text-lg flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            Back to Command
          </button>
        </div>
      </div>
    );
  }

  const mapFrom = phase === "to-pickup"
    ? (driverCoords ?? trip.pickupCoords)
    : trip.pickupCoords;
  const mapTo = phase === "to-pickup"
    ? trip.pickupCoords
    : trip.dropoffCoords;
  const mapCenter: [number, number] = driverCoords ?? trip.pickupCoords ?? [37.3541, -121.9552];

  const handleNavigate = (app: "google" | "waze") => {
    const lat = mapTo?.[0] || mapCenter[0];
    const lng = mapTo?.[1] || mapCenter[1];
    if (app === "google") {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, "_blank");
    } else if (app === "waze") {
      window.open(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`, "_blank");
    }
    setNavModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col pb-6">
      {/* Live Map */}
      <div className="relative flex-1 min-h-64">
        <ClientMap
          from={mapFrom}
          to={mapTo}
          center={mapCenter}
          className="absolute inset-0"
          interactive={false}
        />

        {/* Back / Cancel button */}
        <button
          type="button"
          aria-label="Cancel Trip"
          onClick={async () => {
            const confirm = window.confirm("Are you sure you want to cancel this trip?");
            if (confirm) {
              if (trip.rideId) await updateRideStatus(trip.rideId, "cancelled");
              navigate("/");
            }
          }}
          className="absolute top-4 left-4 z-[1000] w-10 h-10 rounded-full bg-card/80 backdrop-blur-sm border border-border flex items-center justify-center shadow-lg active:scale-95"
        >
          <ChevronLeft size={20} className="text-foreground" />
        </button>

        {/* SOS button */}
        <button
          type="button"
          onClick={() => alert("Emergency services notified. Stay calm.")}
          aria-label="Emergency SOS"
          title="Emergency SOS"
          className="absolute top-4 right-4 z-[1000] flex items-center gap-1.5 px-3 py-2 bg-destructive/90 backdrop-blur-sm border border-destructive rounded-full shadow-lg active:scale-95 transition-transform"
        >
          <AlertTriangle size={14} className="text-white" />
          <span className="text-xs font-bold text-white">SOS</span>
        </button>

        {/* Phase badge */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000]">
          <div
            className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border backdrop-blur-sm ${
              phase === "to-pickup"
                ? "bg-primary/20 border-primary/40 text-primary"
                : "bg-primary/20 border-primary/40 text-primary"
            }`}
          >
            {phase === "to-pickup" ? `Heading to ${pickupLabel}` : phase === "waiting" ? "Waiting at Pickup" : `${typeLabel} in Progress`}
          </div>
        </div>

        {/* Timer — only during in-progress */}
        {phase === "in-progress" && (
          <div className="absolute bottom-4 left-4 bg-card/80 backdrop-blur-sm border border-border rounded-xl px-3 py-2 flex items-center gap-2">
            <Clock size={14} className="text-primary" />
            <span className="text-sm font-bold text-primary font-mono">{formatTime(elapsed)}</span>
          </div>
        )}

        {/* Wait timer — during waiting phase */}
        {phase === "waiting" && (
          <div className={`absolute bottom-4 left-4 bg-card/80 backdrop-blur-sm border rounded-xl px-3 py-2 flex items-center gap-2 ${canLeave ? "border-destructive/40" : "border-border"}`}>
            <Clock size={14} className={canLeave ? "text-destructive" : "text-primary"} />
            <span className={`text-sm font-bold font-mono ${canLeave ? "text-destructive" : "text-primary"}`}>
              {canLeave ? `+${formatTime(waitElapsed - freeWaitSecs)}` : formatTime(waitRemaining)}
            </span>
          </div>
        )}

        {/* External Navigation Button */}
        <button
          type="button"
          onClick={() => setNavModalOpen(true)}
          aria-label="Open Navigation"
          className="absolute bottom-4 right-4 z-[1000] w-14 h-14 bg-muted text-foreground rounded-2xl shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        >
          <CornerUpRight size={24} strokeWidth={2.5} className="text-foreground" />
        </button>

        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-b from-transparent to-background pointer-events-none" />
      </div>

      {/* Bottom Panel */}
      <div className="px-4 pt-2 space-y-4">
        {/* Rider / Delivery Info */}
        <div className="glass-card p-4 border border-border rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
            {trip.riderName.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground truncate">{trip.riderName}</p>
            <p className="text-xs text-muted-foreground">Your Take: <span className="text-primary font-semibold">${trip.driverTake.toFixed(2)}</span></p>
          </div>
          {!isDelivery && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <button type="button" aria-label="Message rider" title="Message rider"
                onClick={() => setChatOpen(true)}
                className="w-9 h-9 rounded-full bg-card border border-border flex items-center justify-center active:scale-95 transition-transform">
                <MessageCircle size={16} className="text-muted-foreground" />
              </button>
              <button type="button" aria-label="Call rider" title="Call rider"
                onClick={handleCall}
                className={`w-9 h-9 rounded-full border flex items-center justify-center active:scale-95 transition-transform ${calling ? "bg-primary border-primary" : "bg-primary/10 border-primary/20"}`}>
                <Phone size={16} className={calling ? "text-white" : "text-primary"} />
              </button>
            </div>
          )}
        </div>

        {/* Destination Card */}
        <div className="glass-card p-4 border border-border rounded-xl space-y-3">
          {phase === "to-pickup" ? (
            <div className="flex gap-3 items-start">
              <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Navigation size={14} className="text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">{pickupLabel} Location</p>
                <p className="text-base font-semibold text-foreground mt-0.5">{trip.pickupLocation}</p>
                <p className="text-xs text-muted-foreground mt-1">{trip.estimatedTime} min away</p>
              </div>
            </div>
          ) : phase === "waiting" ? (
            <div className="flex gap-3 items-start">
              <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <MapPin size={14} className="text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">At {pickupLabel} — Waiting</p>
                <p className="text-base font-semibold text-foreground mt-0.5">{trip.pickupLocation}</p>
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
        {phase === "to-pickup" && (
          <>
            <button type="button" onClick={() => {
                setPhase("waiting");
                if (trip.rideId) updateRideStatus(trip.rideId, "arrived");
              }}
              className="w-full py-4 rounded-2xl bg-primary text-foreground font-bold text-lg flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-xl shadow-primary/30">
              <CheckCircle size={22} />
              {arrivedLabel}
            </button>
          </>
        )}

        {phase === "waiting" && (
          <>
            {/* Wait timer card */}
            <div className={`glass-card p-4 border rounded-xl space-y-2 ${canLeave ? "border-destructive/30" : "border-border"}`}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {canLeave ? (meterSecs > 0 ? "On Meter" : "Free Window Ended") : "Free Wait Time"}
                </p>
                <span className={`text-2xl font-bold font-mono ${canLeave ? "text-destructive" : "text-primary"}`}>
                  {canLeave ? `+${formatTime(waitElapsed - freeWaitSecs)}` : formatTime(waitRemaining)}
                </span>
              </div>
              {trip.isAdvanced && meterSecs > 0 && (
                <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
                  <span className="text-xs text-muted-foreground">Meter charge (passenger owes)</span>
                  <span className="text-sm font-bold text-primary">${meterCharge.toFixed(2)}</span>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {trip.isAdvanced
                  ? "Advance booking: 8 min free · 2 min on meter ($0.50/min)"
                  : "Standard ride: 5 min free wait"}
              </p>
            </div>

            <button type="button" onClick={() => {
                setPhase("in-progress");
                if (trip.rideId) updateRideStatus(trip.rideId, "inProgress");
              }}
              className="w-full py-4 rounded-2xl bg-primary text-foreground font-bold text-lg flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-xl shadow-primary/30">
              <CheckCircle size={22} />
              Passenger is Here
            </button>

            <button type="button" onClick={simulatePassengerCancel}
              disabled={!canLeave}
              className={`w-full py-3 rounded-xl border text-sm font-semibold active:scale-95 transition-transform ${
                canLeave
                  ? "border-destructive/50 text-destructive hover:bg-destructive/5"
                  : "border-border text-muted-foreground opacity-40"
              }`}>
              {canLeave ? "Cancel — No Show" : `Cancel & Leave unlocks in ${formatTime(waitRemaining)}`}
            </button>
          </>
        )}

        {phase === "in-progress" && (
          <>
            {stopEarnings > 0 && (
              <div className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-2.5">
                <span className="text-xs text-muted-foreground">Stop fees earned</span>
                <span className="text-sm font-bold text-primary">+${stopEarnings.toFixed(2)}</span>
              </div>
            )}
            <button type="button" onClick={() => setStopEarnings((e) => parseFloat((e + 2.00).toFixed(2)))}
              className="w-full py-3 rounded-xl border border-border text-sm font-semibold text-muted-foreground active:scale-95 transition-transform">
              Log Passenger Stop (+$2.00)
            </button>
            <button type="button" onClick={() => {
                setPhase("complete");
                if (trip.rideId) updateRideStatus(trip.rideId, "completed");
              }}
              className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-lg flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-xl shadow-primary/30">
              <CheckCircle size={22} />
              {completeLabel}
            </button>
          </>
        )}
      </div>

      {/* Calling toast */}
      {calling && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-card border border-border rounded-2xl px-5 py-3 shadow-xl">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <p className="text-sm font-semibold text-foreground">Calling {trip.riderName.split(" ")[0]}…</p>
        </div>
      )}

      {/* Passenger cancelled overlay */}
      {passengerCancelled && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4 bg-black/60">
          <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 space-y-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <button type="button" onClick={() => navigate("/", { state: { tripCompleted: true } })} aria-label="Dismiss"
                className="w-16 h-16 rounded-full bg-destructive/10 border border-destructive/30 flex items-center justify-center active:scale-95 transition-transform hover:bg-destructive/20">
                <X size={28} className="text-destructive" />
              </button>
              <h2 className="text-lg font-bold text-foreground">Passenger Cancelled</h2>
              <p className="text-sm text-muted-foreground">{trip.riderName.split(" ")[0]} cancelled the ride.</p>
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <DollarSign size={16} className="text-primary" />
                <p className="text-sm font-semibold text-foreground">Cancellation fee earned</p>
              </div>
              {cancellationFee === 0 ? (
                <p className="text-sm text-muted-foreground">No fee — passenger cancelled within the free window.</p>
              ) : (
                <>
                  <p className="text-3xl font-bold text-primary">${cancellationFee.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">100% goes to you. This will appear in your earnings within 24 hours.</p>
                  <div className="text-xs text-muted-foreground bg-muted/20 rounded-lg px-3 py-2 mt-1">
                    {phase === "waiting"
                      ? `Passenger cancelled while you were waiting at pickup. Includes distance fee + $3.00 waiting${meterCharge > 0 ? ` + $${meterCharge.toFixed(2)} meter` : ""}.`
                      : cancellationFee === 5
                      ? "Passenger cancelled while you were nearby (< 5 miles)."
                      : cancellationFee === 9
                      ? "Passenger cancelled while you were 5–10 miles en route."
                      : "Passenger cancelled after you drove 10+ miles including highway."}
                  </div>
                </>
              )}
            </div>

            <button type="button" onClick={() => navigate("/", { state: { tripCompleted: true } })}
              className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm active:scale-95 transition-transform">
              Back to Command
            </button>
          </div>
        </div>
      )}

      {/* Chat modal */}
      {chatOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setChatOpen(false)} />
          <div className="relative bg-card border-t border-border rounded-t-2xl flex flex-col max-h-[70vh]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm">
                  {trip.riderName.charAt(0)}
                </div>
                <p className="text-sm font-semibold text-foreground">{trip.riderName}</p>
              </div>
              <button type="button" aria-label="Close chat" onClick={() => setChatOpen(false)}
                className="w-8 h-8 rounded-full bg-muted/30 flex items-center justify-center">
                <X size={15} className="text-muted-foreground" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-[120px]">
              {chatMessages.length === 0 && (
                <div className="space-y-2">
                  {["I'm on my way!", "I've arrived, look for my car", "Running 3 min late — apologies"].map((t) => (
                    <button key={t} type="button" onClick={async () => {
                        if (!user || !trip.rideId) return;
                        await sendRideMessage(trip.rideId, user.uid, "driver", t);
                      }}
                      className="block w-full text-left px-3 py-2 rounded-xl bg-muted/30 border border-border text-sm text-foreground hover:border-primary/40 transition-colors">
                      {t}
                    </button>
                  ))}
                  <p className="text-xs text-muted-foreground text-center pt-1">Quick messages or type your own</p>
                </div>
              )}
              {chatMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.senderType === "driver" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${msg.senderType === "driver" ? "bg-primary text-white" : "bg-muted/40 text-foreground border border-border"}`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="flex items-center gap-2 px-4 py-3 border-t border-border">
              <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
                placeholder="Message rider…"
                className="flex-1 bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary" />
              <button type="button" aria-label="Send message" onClick={sendMessage} disabled={!chatInput.trim()}
                className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform">
                <Send size={16} className="text-white" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* External Navigation Modal */}
      {navModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setNavModalOpen(false)} />
          <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl p-6 space-y-4 animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Open in Maps</h2>
              <button type="button" aria-label="Close" onClick={() => setNavModalOpen(false)} className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={() => handleNavigate("google")}
                className="w-full flex items-center justify-between p-4 rounded-xl border border-border bg-background hover:bg-muted/50 active:scale-95 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                    {/* Google Maps simple G logo simulation */}
                    <span className="text-blue-500 font-bold text-xl">G</span>
                  </div>
                  <span className="font-semibold text-foreground">Google Maps</span>
                </div>
                <CornerUpRight size={18} className="text-muted-foreground" />
              </button>

              <button
                type="button"
                onClick={() => handleNavigate("waze")}
                className="w-full flex items-center justify-between p-4 rounded-xl border border-border bg-background hover:bg-muted/50 active:scale-95 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center shadow-sm">
                    {/* Waze simple W logo simulation */}
                    <span className="text-sky-500 font-bold text-xl">W</span>
                  </div>
                  <span className="font-semibold text-foreground">Waze</span>
                </div>
                <CornerUpRight size={18} className="text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
