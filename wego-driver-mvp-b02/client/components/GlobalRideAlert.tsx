import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useDispatchContext } from "@/context/DispatchContext";
import { useAuth } from "@/context/AuthContext";
import { getDriverPreferences } from "@/lib/db";
import RideCard from "@/components/RideCard";
import { CourierCard, FoodCard } from "@/components/RideRequestCards";

export default function GlobalRideAlert() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { incomingRides, accept } = useDispatchContext();

  const [declinedRideId, setDeclinedRideId] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [prefs, setPrefs] = useState({ acceptRides: true, acceptCourier: false, acceptFood: false });
  const declineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) return;
    getDriverPreferences(user.uid).then((p) => {
      if (p) setPrefs({ acceptRides: p.acceptRides, acceptCourier: p.acceptCourier, acceptFood: p.acceptFood });
    });
  }, [user]);

  // Don't show on Command (has its own inline handling) or Trip
  if (pathname === "/" || pathname === "/trip") return null;

  const pendingRide = incomingRides.find((r) => {
    if (r.id === declinedRideId) return false;
    if (r.type === "ride" && !prefs.acceptRides) return false;
    if (r.type === "courier" && !prefs.acceptCourier) return false;
    if (r.type === "food" && !prefs.acceptFood) return false;
    return true;
  }) ?? null;

  if (!pendingRide) return null;

  const handleAccept = async () => {
    if (accepting) return;
    setAccepting(true);
    try {
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
    } catch {
      setAccepting(false);
      setAcceptError("Ride was already taken");
      setTimeout(() => setAcceptError(null), 3000);
    }
  };

  const handleDecline = () => {
    const id = pendingRide.id;
    setDeclinedRideId(id);
    if (declineTimerRef.current) clearTimeout(declineTimerRef.current);
    declineTimerRef.current = setTimeout(() => {
      setDeclinedRideId(null);
      declineTimerRef.current = null;
    }, 5000);
  };

  return (
    <div className="absolute inset-x-0 bottom-[64px] z-50 px-4 pb-3 pointer-events-none">
      <div className="pointer-events-auto bg-background/95 backdrop-blur-sm rounded-2xl p-3 border border-border shadow-2xl">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Incoming Request
        </p>
        {accepting && (
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[99999] bg-primary text-white text-sm font-semibold px-4 py-3 rounded-2xl shadow-xl pointer-events-none">
            Accepting…
          </div>
        )}
        {acceptError && (
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[99999] bg-destructive text-white text-sm font-semibold px-4 py-3 rounded-2xl shadow-xl pointer-events-none">
            {acceptError}
          </div>
        )}
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
        {pendingRide.type === "courier" && (
          <CourierCard ride={pendingRide} onAccept={handleAccept} onDecline={handleDecline} />
        )}
        {pendingRide.type === "food" && (
          <FoodCard ride={pendingRide} onAccept={handleAccept} onDecline={handleDecline} />
        )}
      </div>
    </div>
  );
}
