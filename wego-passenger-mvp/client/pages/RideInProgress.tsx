import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { MapPin, CheckCircle, Clock, ChevronLeft, Star, Phone, MessageSquare, Send, X, TriangleAlert, Shield } from "lucide-react";
import ClientMap from "@/components/ClientMap";

import { listenToPassengerRide, listenToRideMessages, sendRideMessage, cancelRide, submitRating, disputeRide, logStop, type Ride, type ChatMessage } from "@/lib/db";
import { useAuth } from "@/context/AuthContext";
import { onSnapshot, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

type RidePhase = "matching" | "en_route" | "arrived" | "in_progress" | "complete";

interface RideData {
  destination: string;
  fare: number;
  driverTake: number;
  coopFee: number;
  isAdvanced?: boolean;
  estimatedMinutes?: number;
  fromCoords?: [number, number];
  toCoords?: [number, number];
}

const DEFAULT_RIDE: RideData = {
  destination: "SFO Airport",
  fare: 50.00,
  driverTake: 44.00,
  coopFee: 6.00,
};


const PHASE_SEQUENCE: RidePhase[] = ["matching", "en_route", "arrived", "in_progress", "complete"];

// Returns distance in metres between two lat/lng points (Haversine)
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Passenger is considered "in vehicle" when within this radius of the driver
const IN_VEHICLE_METERS = 200;

export default function RideInProgress() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const rideMock: RideData = (location.state as RideData) ?? DEFAULT_RIDE;
  const [liveRide, setLiveRide] = useState<Ride | null>(null);

  const [phase, setPhase] = useState<RidePhase>("matching");
  const [elapsed, setElapsed] = useState(0);
  const [rating, setRating] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const matchingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bookingTimeRef = useRef<number>(Date.now());
  const enRouteStartRef = useRef<number | null>(null);
  const enRouteElapsedRef = useRef(0);
  const enRouteFeeRef = useRef(5.00); // tracks distance tier earned before arrival

  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [calling, setCalling] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [waitElapsed, setWaitElapsed] = useState(0);
  const [waitFeeCharged, setWaitFeeCharged] = useState(0);
  const [stopCount, setStopCount] = useState(0);
  const [stopFeeTotal, setStopFeeTotal] = useState(0);
  const [stopModalOpen, setStopModalOpen] = useState(false);
  const [stopAddress, setStopAddress] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [cancelledFromDispute, setCancelledFromDispute] = useState(false);
  const [sosModalOpen, setSosModalOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeSubmitted, setDisputeSubmitted] = useState(false);
  const inProgressAtRef = useRef<number | null>(null);
  const [matchTimeout, setMatchTimeout] = useState(false);
  const [driverCoords, setDriverCoords] = useState<[number, number] | null>(null);
  const [passengerCoords, setPassengerCoords] = useState<[number, number] | null>(null);
  const [lastKnownRide, setLastKnownRide] = useState<Ride | null>(null);
  const [driverProfile, setDriverProfile] = useState<{ name: string; car: string; plate: string } | null>(null);
  const [completedRideData, setCompletedRideData] = useState<{
    driverName: string; driverCar: string; driverPlate: string;
    pickupAddress: string; dropoffAddress: string;
    fare: number; driverTake: number; coopFee: number;
  } | null>(null);
  const effectiveRideIdRef = useRef<string | null>(null);
  const [activeRideId, setActiveRideId] = useState<string | null>(null);
  const STOP_FEE = 2.00;
  const [toastError, setToastError] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showError = (msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastError(msg);
    toastTimerRef.current = setTimeout(() => setToastError(null), 3500);
  };

  // Track how long driver has been en route (proxy for distance)
  useEffect(() => {
    if (phase === "en_route") {
      enRouteStartRef.current = Date.now();
      const id = setInterval(() => {
        enRouteElapsedRef.current = Math.floor((Date.now() - (enRouteStartRef.current ?? Date.now())) / 1000);
      }, 1000);
      return () => clearInterval(id);
    }
  }, [phase]);

  // Listen to live ride from Firebase
  useEffect(() => {
    if (!user) return;
    const unsub = listenToPassengerRide(user.uid, (ride) => {
      setLiveRide(ride);
      if (ride?.id) {
        effectiveRideIdRef.current = ride.id;
        setActiveRideId(ride.id);   // kept in state so the doc listener survives liveRide→null
        setLastKnownRide(ride);
      }
      if (!ride) return;
      if (ride.status === "reserved") setPhase("matching");
      if (ride.status === "pending") setPhase("matching");
      if (ride.status === "accepted") setPhase("en_route");
      if (ride.status === "arrived") setPhase("arrived");
      if (ride.status === "inProgress") setPhase("in_progress");
      if (ride.status === "completed") setPhase("complete");
      if (ride.status === "cancelled") setCancelled(true);
    });
    return unsub;
  }, [user]);

  // Listen to live chat
  useEffect(() => {
    if (!liveRide?.id) return;
    const unsub = listenToRideMessages(liveRide.id, (msgs) => {
      setChatMessages(msgs);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });
    return unsub;
  }, [liveRide?.id]);

  // Direct ride doc listener — depends on activeRideId (state), NOT liveRide?.id (ref).
  // This means it stays subscribed even after liveRide goes null when the ride completes,
  // guaranteeing we receive the "completed" status and driver info regardless of ordering.
  useEffect(() => {
    if (!activeRideId) return;
    const unsub = onSnapshot(doc(db, "rides", activeRideId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const status = data.status as string;
      // Cache driver identity the moment it appears (driver accepted) — survives to complete screen
      const name  = (data.driverName  as string) || "";
      const car   = (data.driverCar   as string) || "";
      const plate = (data.driverPlate as string) || "";
      if (name || car || plate) {
        setDriverProfile(prev => ({
          name:  name  || prev?.name  || "",
          car:   car   || prev?.car   || "",
          plate: plate || prev?.plate || "",
        }));
      }
      if (status === "completed") setPhase("complete");
      if (status === "cancelled") setCancelled(true);
    });
    return unsub;
  }, [activeRideId]);

  // Track driver location + profile during en_route, arrived, and in_progress phases
  useEffect(() => {
    if (!liveRide?.driverId || (phase !== "en_route" && phase !== "arrived" && phase !== "in_progress")) return;
    const unsub = onSnapshot(doc(db, "drivers", liveRide.driverId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const loc = data.location;
      if (loc) setDriverCoords([loc.latitude, loc.longitude]);
      // Cache driver name/car/plate from the authoritative drivers doc so the
      // complete screen has it even if the ride doc's driverName was empty.
      const make = (data.vehicleMake as string) || "";
      setDriverProfile({
        name: (data.name as string) || "",
        car: make ? `${(data.vehicleYear as string) || ""} ${make} ${(data.vehicleModel as string) || ""}`.trim() : "",
        plate: (data.licensePlate as string) || "",
      });
    });
    return unsub;
  }, [liveRide?.driverId, phase]);

  // Watch passenger GPS during in_progress to verify proximity to driver
  useEffect(() => {
    if (phase !== "in_progress" || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setPassengerCoords([pos.coords.latitude, pos.coords.longitude]),
      () => setPassengerCoords(null), // if denied/unavailable, don't block the button
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [phase]);

  // Match timeout — show escalation UI after 5 min
  useEffect(() => {
    if (phase !== "matching") { setMatchTimeout(false); return; }
    const timer = setTimeout(() => setMatchTimeout(true), 5 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [phase]);

  // Commit wait meter charge when transitioning from arrived → in_progress
  const prevPhaseRef = useRef<RidePhase>(phase);
  useEffect(() => {
    if (prevPhaseRef.current === "arrived" && phase === "in_progress") {
      setWaitFeeCharged(waitMeterCharge);
    }
    prevPhaseRef.current = phase;
  });

  const getCancellationFee = (): { fee: number; label: string; driverNote: string } => {
    const bookingAge = (Date.now() - bookingTimeRef.current) / 1000;
    if (phase === "matching" || bookingAge < 300) {
      return { fee: 0, label: "Free cancellation", driverNote: "No charge — driver not yet dispatched." };
    }
    if (phase === "en_route") {
      const mins = enRouteElapsedRef.current / 60;
      if (mins < 3) { enRouteFeeRef.current = 5.00; return { fee: 5.00, label: "Driver nearby (< 5 miles)", driverNote: "Driver is close — short detour." }; }
      if (mins < 8) { enRouteFeeRef.current = 9.00; return { fee: 9.00, label: "Driver en route (5–10 miles)", driverNote: "Driver has traveled significant distance." }; }
      enRouteFeeRef.current = 14.00;
      return { fee: 14.00, label: "Driver far en route (10+ miles)", driverNote: "Driver drove 10+ miles including highway." };
    }
    if (phase === "arrived") {
      const distanceFee = enRouteFeeRef.current;
      const freeWait = isAdvanced ? 480 : 300;
      const waitMeterSecs = isAdvanced ? Math.max(0, waitElapsed - freeWait) : 0;
      const waitMeterCharge = parseFloat(Math.min((waitMeterSecs / 60) * 0.50, 1.00).toFixed(2));
      const fee = distanceFee + 3.00 + waitMeterCharge;
      const label = distanceFee >= 14
        ? "Driver arrived after 10+ miles"
        : distanceFee >= 9
        ? "Driver arrived after 5–10 miles"
        : "Driver has arrived";
      const meterNote = waitMeterCharge > 0 ? ` + $${waitMeterCharge.toFixed(2)} meter` : "";
      return { fee, label, driverNote: `Driver drove to your location and is waiting. $${distanceFee.toFixed(2)} distance + $3.00 waiting${meterNote}.` };
    }
    return { fee: 0, label: "Free", driverNote: "" };
  };

  const confirmCancel = async () => {
    if (liveRide?.id) {
      try {
        await cancelRide(liveRide.id);
      } catch {
        showError("Couldn't cancel — check your connection and try again");
        setCancelOpen(false);
        return;
      }
    }
    setCancelled(true);
    setCancelOpen(false);
  };

  const sendMessage = async () => {
    const text = chatInput.trim();
    if (!text || !user || !liveRide?.id) return;
    setChatInput("");
    await sendRideMessage(liveRide.id, user.uid, "passenger", text);
  };

  const handleCall = () => {
    setCalling(true);
    setTimeout(() => setCalling(false), 3000);
  };

  // Timer during in_progress phase
  useEffect(() => {
    if (phase !== "in_progress") return;
    inProgressAtRef.current = Date.now();
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  // Wait timer during arrived phase
  useEffect(() => {
    if (phase !== "arrived") return;
    const id = setInterval(() => setWaitElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  // When ride completes, fetch the ride doc once to guarantee driver info is available
  // regardless of whether intermediate state snapshots were received.
  useEffect(() => {
    if (phase !== "complete") return;
    const rideId = activeRideId || effectiveRideIdRef.current;
    if (!rideId) return;
    getDoc(doc(db, "rides", rideId)).then((snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      setCompletedRideData({
        driverName:    (d.driverName    as string) || "",
        driverCar:     (d.driverCar     as string) || "",
        driverPlate:   (d.driverPlate   as string) || "",
        pickupAddress: (d.pickupAddress as string) || "",
        dropoffAddress:(d.dropoffAddress as string) || "",
        fare:       (d.fare       as number) || 0,
        driverTake: (d.driverTake as number) || 0,
        coopFee:    (d.coopFee    as number) || 0,
      });
    }).catch(() => {
      // Falls back to displayRide / driverProfile already cached in state
    });
  }, [phase, activeRideId]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const isAdvanced = liveRide?.isAdvanced ?? rideMock.isAdvanced ?? false;
  const freeWaitSecs = isAdvanced ? 480 : 300;
  const waitRemaining = Math.max(0, freeWaitSecs - waitElapsed);
  const waitMeterSecs = isAdvanced ? Math.max(0, waitElapsed - freeWaitSecs) : 0;
  const waitMeterCharge = parseFloat(Math.min((waitMeterSecs / 60) * 0.50, 1.00).toFixed(2));
  const driverCanLeave = waitElapsed >= freeWaitSecs;

  const confirmStop = async () => {
    const addr = stopAddress.trim();
    setStopCount((c) => c + 1);
    setStopFeeTotal((t) => parseFloat((t + STOP_FEE).toFixed(2)));
    setStopModalOpen(false);
    setStopAddress("");
    if (liveRide?.id) {
      try {
        await logStop(liveRide.id, STOP_FEE);
      } catch {
        showError("Stop logged locally — will sync when connection restores");
      }
      // Notify driver of the stop address via chat
      if (addr && user) {
        try {
          await sendRideMessage(liveRide.id, user.uid, "passenger", `Stop requested at: ${addr}`);
        } catch {
          // chat message best-effort
        }
      }
    }
  };

  // On the complete screen liveRide is null (filtered out); fall back to lastKnownRide
  const displayRide = liveRide ?? lastKnownRide;
  const baseFare = completedRideData?.fare ?? displayRide?.fare ?? rideMock.fare;
  const baseDriverTake = completedRideData?.driverTake ?? displayRide?.driverTake ?? rideMock.driverTake;
  const totalFare = parseFloat((baseFare + waitFeeCharged + stopFeeTotal).toFixed(2));
  const totalDriverTake = parseFloat((baseDriverTake + waitFeeCharged + stopFeeTotal).toFixed(2));
  const totalCoopFee = completedRideData?.coopFee ?? displayRide?.coopFee ?? rideMock.coopFee;
  const hasPickupIssueReport =
    liveRide?.disputed === true && liveRide?.disputeReason === "passenger_not_picked_up";
  const driverAlertSeen = Boolean(liveRide?.driverAlertSeenAt);

  // True only when both GPSes are known AND passenger is within IN_VEHICLE_METERS of driver.
  // Falls back to false (button stays accessible) if either location is unavailable.
  const passengerNearDriver =
    passengerCoords !== null &&
    driverCoords !== null &&
    haversineMeters(passengerCoords[0], passengerCoords[1], driverCoords[0], driverCoords[1]) < IN_VEHICLE_METERS;

  // ── CANCELLED VIEW ─────────────────────────────────────────────────────────
  if (cancelled) {
    const { fee } = getCancellationFee();
    return (
      <div className="h-screen bg-background flex flex-col items-center justify-center px-4 py-10 overflow-y-auto">
        <div className="w-full space-y-5">
          <div className="flex flex-col items-center gap-3">
            <div className="w-20 h-20 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
              <CheckCircle size={36} className="text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              {cancelledFromDispute ? "Ride Ended" : "Ride Cancelled"}
            </h1>
            <p className="text-sm text-muted-foreground text-center">
              {cancelledFromDispute
                ? "Your report has been filed and your payment is blocked."
                : "Your ride has been cancelled."}
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {cancelledFromDispute ? "What happens next" : "Cancellation Summary"}
            </p>
            {cancelledFromDispute ? (
              <div className="space-y-2">
                <div className="flex items-start gap-2 text-sm">
                  <CheckCircle size={16} className="text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-foreground font-medium">You will not be charged for this trip</span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <CheckCircle size={16} className="text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-foreground">The driver's account has been flagged for review</span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <CheckCircle size={16} className="text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-foreground">WeGo support will contact you within 1 hour</span>
                </div>
              </div>
            ) : fee === 0 ? (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle size={16} className="text-primary" />
                <span className="text-foreground font-medium">No cancellation fee charged</span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cancellation fee</span>
                  <span className="font-bold text-destructive">${fee.toFixed(2)}</span>
                </div>
                <div className="text-xs text-muted-foreground bg-muted/20 rounded-lg px-3 py-2">
                  100% of this fee goes directly to your driver as compensation.
                </div>
              </div>
            )}
          </div>

          <button type="button" onClick={() => navigate("/")}
            className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-lg active:scale-95 transition-transform">
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // ── COMPLETE VIEW ──────────────────────────────────────────────────────────
  if (phase === "complete") {
    return (
      <div className="h-screen bg-background flex flex-col items-center px-4 py-10 overflow-y-auto">
        <div className="w-full space-y-5">

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
                <span className="text-muted-foreground">Base fare</span>
                <span className="text-foreground font-semibold">${baseFare.toFixed(2)}</span>
              </div>
              {waitFeeCharged > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Wait fee (meter)</span>
                  <span className="text-foreground font-semibold">+${waitFeeCharged.toFixed(2)}</span>
                </div>
              )}
              {stopFeeTotal > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Stop fee ({stopCount} stop{stopCount > 1 ? "s" : ""})</span>
                  <span className="text-foreground font-semibold">+${stopFeeTotal.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm border-t border-border/50 pt-2">
                <span className="text-muted-foreground font-semibold">Total charged</span>
                <span className="text-foreground font-bold">${totalFare.toFixed(2)}</span>
              </div>
              <div className="h-px bg-border/50 my-1" />
              <div className="flex justify-between text-sm">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Driver earned</span>
                  <span className="text-xs bg-primary/15 text-primary px-1.5 py-0.5 rounded font-semibold">88%+</span>
                </div>
                <span className="text-primary font-semibold">${totalDriverTake.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">WeGo Cooperative</span>
                  <span className="text-xs bg-muted/30 text-muted-foreground px-1.5 py-0.5 rounded font-semibold">12%</span>
                </div>
                <span className="text-muted-foreground font-medium">${totalCoopFee.toFixed(2)}</span>
              </div>
              <div className="h-px bg-border/50 my-1" />
              <p className="text-xs text-muted-foreground">
                Wait fees and stop fees go 100% to your driver. The 12% coop fee covers pensions, insurance, and the AV fleet.
              </p>
            </div>
          </div>

          {/* Trip Summary */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Trip Summary</p>
            <div className="space-y-2">
              <div className="flex gap-3 items-start">
                <MapPin size={16} className="text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Pickup</p>
                  <p className="text-sm text-foreground">{completedRideData?.pickupAddress || displayRide?.pickupAddress || "Your Location"}</p>
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <MapPin size={16} className="text-primary/60 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Dropoff</p>
                  <p className="text-sm text-foreground">{completedRideData?.dropoffAddress || displayRide?.dropoffAddress || rideMock.destination}</p>
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

          {/* Rate your driver */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                {(completedRideData?.driverName || displayRide?.driverName || driverProfile?.name || "?").charAt(0)}
              </div>
              <div>
                <p className="font-semibold text-foreground">{completedRideData?.driverName || displayRide?.driverName || driverProfile?.name || "Your Driver"}</p>
                <p className="text-xs text-muted-foreground">
                  {completedRideData?.driverCar || displayRide?.driverCar || driverProfile?.car || ""}
                  {(completedRideData?.driverPlate || displayRide?.driverPlate || driverProfile?.plate)
                    ? ` · ${completedRideData?.driverPlate || displayRide?.driverPlate || driverProfile?.plate}`
                    : ""}
                </p>
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
                      aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
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
                    onClick={async () => {
                      const rideId = displayRide?.id || activeRideId;
                      if (rideId) {
                        try {
                          await submitRating(rideId, rating, "passenger");
                        } catch {
                          showError("Couldn't save rating — please try again");
                          return;
                        }
                      }
                      setRatingSubmitted(true);
                    }}
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
  const pickupAddressDisplay = (() => {
    const raw = (liveRide?.pickupAddress ?? "").replace(/\s*\(\d+\.\d+,\s*-?\d+\.\d+\)$/, "").trim();
    return raw && raw !== "Current Location" ? raw : "Your Current Location";
  })();

  const pickupEtaMinutes = (() => {
    if (!driverCoords || !liveRide?.pickupLocation) return liveRide?.estimatedMinutes ?? rideMock.estimatedMinutes ?? 6;
    const dm = haversineMeters(driverCoords[0], driverCoords[1], liveRide.pickupLocation.latitude, liveRide.pickupLocation.longitude);
    return Math.max(1, Math.round((dm / 1609.34 / 30) * 60));
  })();

  return (
    <div className="max-w-[430px] mx-auto bg-background flex flex-col pb-6 page-dvh overflow-hidden">
      {/* Map — fills remaining space above the cards */}
      <div className="relative z-0 flex-1 min-h-[240px]">
        {(() => {
          const pickupCoords = liveRide?.pickupLocation
            ? [liveRide.pickupLocation.latitude, liveRide.pickupLocation.longitude] as [number, number]
            : rideMock.fromCoords;
          const dropoffCoords = liveRide?.dropoffLocation
            ? [liveRide.dropoffLocation.latitude, liveRide.dropoffLocation.longitude] as [number, number]
            : rideMock.toCoords;
          const mapFrom = phase === "in_progress" ? pickupCoords : (driverCoords ?? pickupCoords);
          const mapTo = phase === "in_progress" ? dropoffCoords : pickupCoords;
          const mapCenter = mapFrom ?? pickupCoords ?? [37.7749, -122.4194];
          return (
            <ClientMap
              from={mapFrom}
              to={mapTo}
              driverPos={driverCoords ?? undefined}
              center={mapCenter}
              className="absolute inset-0"
            />
          );
        })()}

        <button
          type="button"
          aria-label="Back to home"
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

        {/* SOS Button — visible in all active phases */}
        {(phase === "matching" || phase === "en_route" || phase === "arrived" || phase === "in_progress") && (
          <button
            type="button"
            aria-label="Emergency SOS"
            onClick={() => setSosModalOpen(true)}
            className="absolute top-4 right-4 z-10 flex items-center gap-1.5 px-3 h-10 rounded-full bg-destructive text-destructive-foreground shadow-lg active:scale-95 transition-transform"
          >
            <TriangleAlert size={16} />
            <span className="font-bold text-sm tracking-wide">SOS</span>
          </button>
        )}

        {/* Timer */}
        {phase === "in_progress" && (
          <div className="absolute bottom-4 right-4 z-10 bg-card/80 backdrop-blur-sm border border-border rounded-xl px-3 py-2 flex items-center gap-2">
            <Clock size={14} className="text-primary" />
            <span className="text-sm font-bold text-primary font-mono">{formatTime(elapsed)}</span>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-b from-transparent to-background pointer-events-none z-10" />
      </div>

      {/* Bottom Panel */}
      <div className="px-4 pt-2 space-y-3">

        {/* Matching state */}
        {phase === "matching" && (
          <div className="glass-card p-5 border border-border rounded-xl text-center space-y-2">
            {liveRide?.status === "reserved" ? (
              <>
                <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
                  <Clock size={20} className="text-primary" />
                </div>
                <p className="font-semibold text-foreground">Scheduled Ride Confirmed</p>
                {liveRide.scheduledDate && (
                  <p className="text-xs text-muted-foreground">
                    {liveRide.scheduledDate} at {String(liveRide.scheduledHour ?? 0).padStart(2, "0")}:{String(liveRide.scheduledMinute ?? 0).padStart(2, "0")}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">You'll be matched with a driver closer to your pickup time.</p>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin mx-auto" />
                <p className="font-semibold text-foreground">Finding your driver...</p>
                {matchTimeout ? (
                  <p className="text-xs text-destructive font-medium">Taking longer than expected. You can cancel for free.</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Usually takes 2–5 minutes in your area</p>
                )}
              </>
            )}
          </div>
        )}

        {/* Driver card — shown for en_route, arrived, in_progress */}
        {(phase === "en_route" || phase === "arrived" || phase === "in_progress") && (
          <div className="glass-card p-4 border border-border rounded-xl space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                {liveRide?.driverName?.charAt(0) || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground">{liveRide?.driverName || "Your Driver"}</p>
                <div className="flex items-center gap-1">
                  <Star size={11} fill="currentColor" className="text-yellow-400" />
                  <span className="text-xs text-muted-foreground">{(liveRide?.driverRating || 4.95).toFixed(2)}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" aria-label="Call driver" onClick={handleCall}
                  className={`w-9 h-9 rounded-full border flex items-center justify-center transition-colors ${calling ? "bg-primary border-primary" : "bg-primary/10 border-primary/20"}`}>
                  <Phone size={14} className={calling ? "text-white" : "text-primary"} />
                </button>
                <button type="button" aria-label="Message driver" onClick={() => setChatOpen(true)}
                  className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <MessageSquare size={14} className="text-primary" />
                </button>
              </div>
            </div>

            <div className="bg-background border border-border/50 rounded-lg px-3 py-2 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{liveRide?.driverCar || "Connecting…"}</p>
                <p className="text-sm font-bold text-foreground tracking-widest">{liveRide?.driverPlate || "—"}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">WeGo Driver</p>
                <p className="text-xs font-semibold text-primary">Verified</p>
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
                  {phase === "in_progress" ? "Dropoff" : phase === "arrived" ? "Pickup — Driver Here" : "Heading to Pickup"}
                </p>
                <p className="text-sm font-semibold text-foreground mt-0.5 truncate">
                  {phase === "in_progress" ? rideMock.destination : pickupAddressDisplay}
                </p>
                {phase === "en_route" && (
                  <p className="text-xs text-muted-foreground mt-1">{pickupEtaMinutes} min away</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Trip PIN — shown to passenger during en_route / arrived */}
        {(phase === "en_route" || phase === "arrived") && liveRide?.pinRequired && liveRide?.pin && (
          <div className="glass-card p-4 border border-primary/40 rounded-xl bg-primary/5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-primary" />
                <p className="text-xs font-semibold text-primary uppercase tracking-wide">Your Pickup PIN</p>
              </div>
              <p className="text-xs text-muted-foreground">Show to driver</p>
            </div>
            <p className="text-4xl font-bold text-primary tracking-[0.35em] text-center py-1">{liveRide.pin}</p>
            <p className="text-xs text-muted-foreground text-center">Driver must enter this code before the trip starts</p>
          </div>
        )}

        {/* Passive status — driver controls all phase transitions */}
        {phase === "en_route" && (
          <div className="glass-card p-4 border border-border rounded-xl flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse flex-shrink-0" />
            <p className="text-sm text-foreground font-medium">Your driver is on the way</p>
          </div>
        )}
        {phase === "arrived" && (
          <div className={`glass-card p-4 border rounded-xl space-y-2 ${driverCanLeave ? "border-destructive/30" : "border-primary/30"}`}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">
                {driverCanLeave ? "Please hurry — driver may leave" : "Head to your vehicle"}
              </p>
              <span className={`text-lg font-bold font-mono ${driverCanLeave ? "text-destructive" : "text-primary"}`}>
                {driverCanLeave ? `+${formatTime(waitElapsed - freeWaitSecs)}` : formatTime(waitRemaining)}
              </span>
            </div>
            {isAdvanced && waitMeterSecs > 0 && (
              <div className="flex items-center justify-between bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                <span className="text-xs text-muted-foreground">Wait meter</span>
                <span className="text-sm font-bold text-destructive">+${waitMeterCharge.toFixed(2)}</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {isAdvanced ? `Advance booking: 8 min free · ${formatTime(waitRemaining)} remaining` : `${formatTime(waitRemaining)} free wait remaining`}
            </p>
          </div>
        )}
        {phase === "in_progress" && (
          <>
            {hasPickupIssueReport && (
              <div className="glass-card p-4 border border-amber-500/35 rounded-xl bg-amber-500/5 space-y-2">
                <div className="flex items-center gap-2">
                  <TriangleAlert size={16} className="text-amber-500" />
                  <p className="text-sm font-semibold text-foreground">Pickup issue reported</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Your payment is on hold while this ride is reviewed. The driver has been alerted to verify the passenger in the vehicle.
                </p>
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  {driverAlertSeen ? "Driver alert acknowledged." : "Sending live alert to driver now."}
                </p>
              </div>
            )}
            {stopFeeTotal > 0 && (
              <div className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-2.5">
                <span className="text-xs text-muted-foreground">{stopCount} stop{stopCount > 1 ? "s" : ""} added</span>
                <span className="text-sm font-bold text-foreground">+${stopFeeTotal.toFixed(2)}</span>
              </div>
            )}
            <button type="button" onClick={() => setStopModalOpen(true)}
              className="w-full py-3 rounded-xl border border-border text-sm font-semibold text-foreground active:scale-95 transition-transform">
              Request a Stop (+${STOP_FEE.toFixed(2)})
            </button>
            {/* Show for first 5 min when PIN is disabled and passenger is not near driver */}
            {!liveRide?.pinRequired && elapsed < 300 && !hasPickupIssueReport && (
              passengerNearDriver ? (
                <div className="w-full py-3 rounded-xl border border-border bg-muted/10 text-muted-foreground text-sm font-semibold text-center select-none">
                  You're confirmed in the vehicle
                </div>
              ) : (
                <button type="button" onClick={() => setDisputeOpen(true)}
                  className="w-full py-3 rounded-xl border border-amber-500/40 text-amber-600 dark:text-amber-400 text-sm font-semibold active:scale-95 transition-transform bg-amber-500/5">
                  Wasn't picked up?
                </button>
              )
            )}
            {hasPickupIssueReport && (
              <button type="button" onClick={async () => {
                  setCancelledFromDispute(true);
                  if (liveRide?.id) { try { await cancelRide(liveRide.id); } catch { showError("Couldn't end ride — check your connection"); return; } }
                  navigate("/");
                }}
                className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-base flex flex-col items-center active:scale-95 transition-transform">
                <span>End Ride</span>
                <span className="text-xs font-normal opacity-80 mt-0.5">You won't be charged</span>
              </button>
            )}
          </>
        )}

        {/* Cancel — only available before ride starts */}
        {(phase === "matching" || phase === "en_route" || phase === "arrived") && (
          <button type="button" onClick={() => setCancelOpen(true)}
            className="w-full py-3 rounded-2xl border border-destructive/30 text-destructive text-sm font-semibold active:scale-95 transition-transform hover:bg-destructive/5">
            Cancel Ride
          </button>
        )}
      </div>

      {/* Stop request modal */}
      {stopModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setStopModalOpen(false); setStopAddress(""); }} />
          <div className="relative w-full max-w-[430px] bg-card border-t border-border rounded-t-2xl px-4 pt-4 pb-8 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-base font-bold text-foreground">Request a Stop</p>
              <button type="button" aria-label="Close" onClick={() => { setStopModalOpen(false); setStopAddress(""); }}
                className="w-8 h-8 rounded-full bg-muted/30 flex items-center justify-center">
                <X size={15} className="text-muted-foreground" />
              </button>
            </div>

            {/* Address input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Stop address or landmark</label>
              <div className="flex items-center gap-2 bg-background border border-border rounded-xl px-3 py-2.5 focus-within:border-primary transition-colors">
                <MapPin size={15} className="text-muted-foreground flex-shrink-0" />
                <input
                  type="text"
                  value={stopAddress}
                  onChange={(e) => setStopAddress(e.target.value)}
                  placeholder="e.g. 7-Eleven on Main St"
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
                  autoFocus
                />
              </div>
            </div>

            <div className="bg-background border border-border rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Stop fee</span>
                <span className="text-lg font-bold text-foreground">${STOP_FEE.toFixed(2)}</span>
              </div>
              {stopCount > 0 && (
                <p className="text-xs text-muted-foreground">You've already made {stopCount} stop{stopCount > 1 ? "s" : ""} (+${stopFeeTotal.toFixed(2)} total).</p>
              )}
              <p className="text-xs text-muted-foreground">100% of the stop fee goes directly to your driver for the extra wait time.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => { setStopModalOpen(false); setStopAddress(""); }}
                className="py-3 rounded-xl bg-muted/30 border border-border text-foreground font-semibold text-sm active:scale-95 transition-transform">
                Cancel
              </button>
              <button type="button" onClick={confirmStop} disabled={!stopAddress.trim()}
                className="py-3 rounded-xl bg-primary text-white font-semibold text-sm active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed">
                Confirm Stop
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel confirmation modal */}
      {cancelOpen && (() => {
        const { fee, label, driverNote } = getCancellationFee();
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => setCancelOpen(false)} />
            <div className="relative w-full max-w-[430px] bg-card border-t border-border rounded-t-2xl px-4 pt-4 pb-8 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-base font-bold text-foreground">Cancel Ride?</p>
                <button type="button" aria-label="Close" onClick={() => setCancelOpen(false)}
                  className="w-8 h-8 rounded-full bg-muted/30 flex items-center justify-center">
                  <X size={15} className="text-muted-foreground" />
                </button>
              </div>

              <div className="bg-background border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Cancellation fee</span>
                  <span className={`text-lg font-bold ${fee === 0 ? "text-primary" : "text-destructive"}`}>
                    {fee === 0 ? "Free" : `$${fee.toFixed(2)}`}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/20 rounded-lg px-3 py-2">
                  <MapPin size={11} className="flex-shrink-0" />
                  <span>{label}</span>
                </div>
                {fee > 0 && (
                  <p className="text-xs text-muted-foreground">{driverNote} 100% of this fee goes directly to your driver.</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setCancelOpen(false)}
                  className="py-3 rounded-xl bg-muted/30 border border-border text-foreground font-semibold text-sm active:scale-95 transition-transform">
                  Keep Ride
                </button>
                <button type="button" onClick={confirmCancel}
                  className="py-3 rounded-xl bg-destructive/10 border border-destructive/40 text-destructive font-semibold text-sm active:scale-95 transition-transform">
                  {fee === 0 ? "Cancel — Free" : `Cancel — Pay $${fee.toFixed(2)}`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Calling toast */}
      {calling && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-card border border-border rounded-2xl px-5 py-3 shadow-xl">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <p className="text-sm font-semibold text-foreground">Calling {liveRide?.driverName || "Driver"}…</p>
        </div>
      )}

      {/* Chat modal */}
      {chatOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setChatOpen(false)} />
          <div className="relative bg-card border-t border-border rounded-t-2xl flex flex-col max-h-[70vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm">
                  {liveRide?.driverName?.charAt(0) || "?"}
                </div>
                <p className="text-sm font-semibold text-foreground">{liveRide?.driverName || "Your Driver"}</p>
              </div>
              <button type="button" aria-label="Close chat" onClick={() => setChatOpen(false)}
                className="w-8 h-8 rounded-full bg-muted/30 flex items-center justify-center">
                <X size={15} className="text-muted-foreground" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-[120px]">
              {chatMessages.length === 0 && (
                <div className="space-y-2">
                  {["I'm on my way!", "Running 2 min late", "I'm outside"].map((t) => (
                    <button key={t} type="button" onClick={async () => {
                        if (!user || !liveRide?.id) return;
                        await sendRideMessage(liveRide.id, user.uid, "passenger", t);
                      }}
                      className="block w-full text-left px-3 py-2 rounded-xl bg-muted/30 border border-border text-sm text-foreground hover:border-primary/40 transition-colors">
                      {t}
                    </button>
                  ))}
                  <p className="text-xs text-muted-foreground text-center pt-1">Quick messages or type your own below</p>
                </div>
              )}
              {chatMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.senderType === "passenger" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${msg.senderType === "passenger" ? "bg-primary text-white" : "bg-muted/40 text-foreground border border-border"}`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="flex items-center gap-2 px-4 py-3 border-t border-border">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
                placeholder="Message driver…"
                className="flex-1 bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
              />
              <button type="button" aria-label="Send message" onClick={sendMessage} disabled={!chatInput.trim()}
                className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform">
                <Send size={16} className="text-white" />
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Wasn't picked up dispute modal */}
      {disputeOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4 bg-black/60">
          <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
                  <TriangleAlert size={22} className="text-amber-500" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">Weren't Picked Up?</h2>
                  <p className="text-sm text-muted-foreground">We'll flag this ride for review</p>
                </div>
              </div>
              <button type="button" aria-label="Close" onClick={() => setDisputeOpen(false)}
                className="w-8 h-8 rounded-full bg-muted/30 flex items-center justify-center">
                <X size={15} className="text-muted-foreground" />
              </button>
            </div>

            {!disputeSubmitted ? (
              <>
                <div className="bg-muted/20 border border-border rounded-xl p-4 space-y-2 text-sm text-muted-foreground">
                  <p>If the driver marked this trip started without you in the vehicle:</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>The charge will be blocked pending review</li>
                    <li>Your driver's account is flagged immediately</li>
                    <li>WeGo support will contact you within 1 hour</li>
                  </ul>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setDisputeOpen(false)}
                    className="py-3 rounded-xl bg-muted/30 border border-border text-foreground font-semibold text-sm active:scale-95 transition-transform">
                    I'm in the car
                  </button>
                  <button type="button"
                    onClick={async () => {
                      if (liveRide?.id) {
                        try {
                          await disputeRide(liveRide.id, "passenger_not_picked_up");
                        } catch {
                          showError("Report failed — check your connection and try again");
                          return;
                        }
                      }
                      setDisputeSubmitted(true);
                    }}
                    className="py-3 rounded-xl bg-amber-500 text-white font-semibold text-sm active:scale-95 transition-transform">
                    Report Issue
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-2 py-2">
                  <CheckCircle size={36} className="text-primary" />
                  <p className="font-semibold text-foreground text-center">Report submitted</p>
                  <p className="text-sm text-muted-foreground text-center">
                    Your payment is blocked. The driver has been alerted. WeGo support will contact you within 1 hour.
                  </p>
                </div>
                <button type="button" onClick={async () => {
                    setCancelledFromDispute(true);
                    if (liveRide?.id) { try { await cancelRide(liveRide.id); } catch { showError("Couldn't end ride — check your connection"); return; } }
                    setDisputeOpen(false);
                    navigate("/");
                  }}
                  className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-base flex flex-col items-center active:scale-95 transition-transform">
                  <span>End Ride</span>
                  <span className="text-xs font-normal opacity-80 mt-0.5">You won't be charged</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error toast */}
      {toastError && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[99999] flex items-center gap-2 bg-destructive text-destructive-foreground text-sm font-semibold px-4 py-3 rounded-2xl shadow-xl pointer-events-none max-w-[90vw] text-center">
          {toastError}
        </div>
      )}

      {/* SOS Modal */}
      {sosModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4 bg-black/60">
          <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-destructive/10 border border-destructive/30 flex items-center justify-center">
                  <TriangleAlert size={24} className="text-destructive" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">Emergency SOS</h2>
                  <p className="text-sm text-muted-foreground">Do you need immediate help?</p>
                </div>
              </div>
              <button type="button" aria-label="Close" onClick={() => setSosModalOpen(false)}
                className="w-8 h-8 rounded-full bg-muted/30 flex items-center justify-center">
                <X size={15} className="text-muted-foreground" />
              </button>
            </div>

            <div className="space-y-3">
              <a href="tel:911"
                onClick={() => setSosModalOpen(false)}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-destructive text-destructive-foreground hover:opacity-90 active:scale-95 transition-all">
                <Phone size={18} />
                <span className="font-bold">Call 911</span>
              </a>

              <button type="button" onClick={() => setSosModalOpen(false)}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:bg-muted/30 active:scale-95 transition-all text-foreground">
                <MessageSquare size={18} className="text-primary" />
                <span className="font-semibold">Text Emergency Contacts</span>
                <span className="ml-auto text-xs text-muted-foreground">Coming soon</span>
              </button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Your safety is our priority. Use these options to get immediate help.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
