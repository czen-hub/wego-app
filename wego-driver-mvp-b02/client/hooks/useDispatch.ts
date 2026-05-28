import { useEffect, useState, useRef } from "react";
import {
  listenForPendingRides,
  listenToDriverRide,
  setDriverOnline,
  updateDriverLocation,
  acceptRide,
  startRide,
  completeRide,
  type Ride,
} from "@/lib/db";
import { useAuth } from "@/context/AuthContext";
import { onSnapshot, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface UseDispatchReturn {
  isOnline: boolean;
  setOnline: (online: boolean) => Promise<void>;
  incomingRides: Ride[];
  activeRide: Ride | null;
  accept: (rideId: string) => Promise<void>;
  start: () => Promise<void>;
  complete: () => Promise<void>;
  locationError: string | null;
  rideListenerError: string | null;
}

export function useDispatch(): UseDispatchReturn {
  const { user, profile } = useAuth();
  const [isOnline, setIsOnline] = useState(false);
  const [incomingRides, setIncomingRides] = useState<Ride[]>([]);
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [rideListenerError, setRideListenerError] = useState<string | null>(null);
  const locationWatchRef = useRef<number | null>(null);

  const setGeoError = (error?: GeolocationPositionError) => {
    if (!error) {
      setLocationError("Unable to access GPS. Check browser permissions.");
      return;
    }

    if (error.code === error.PERMISSION_DENIED) {
      setLocationError("Location access was denied. Allow GPS permission to go online.");
      return;
    }

    if (error.code === error.POSITION_UNAVAILABLE) {
      setLocationError("GPS position is unavailable right now. Try moving outdoors or retry.");
      return;
    }

    if (error.code === error.TIMEOUT) {
      setLocationError("GPS request timed out. Please try again.");
      return;
    }

    setLocationError("Unable to access GPS. Check browser permissions.");
  };

  // Sync isOnline from Firestore on mount so state survives navigation
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "drivers", user.uid), (snap) => {
      if (snap.exists()) {
        const online = snap.data().isOnline ?? false;
        setIsOnline(online);
      }
    });
    return unsub;
  }, [user]);

  // Listen for pending rides when online
  useEffect(() => {
    if (!isOnline || !user) { setRideListenerError(null); return; }
    const unsub = listenForPendingRides(setIncomingRides, (err) => {
      setRideListenerError("Ride feed error: " + (err.message ?? "permission denied"));
    });
    return () => {
      unsub();
      setIncomingRides([]);
      setRideListenerError(null);
    };
  }, [isOnline, user]);

  // Listen to the driver's active ride
  useEffect(() => {
    if (!user) return;
    const unsub = listenToDriverRide(user.uid, setActiveRide);
    return unsub;
  }, [user]);

  // GPS location tracking while online
  useEffect(() => {
    if (!isOnline || !user) {
      if (locationWatchRef.current !== null) {
        navigator.geolocation.clearWatch(locationWatchRef.current);
        locationWatchRef.current = null;
      }
      return;
    }

    if (!navigator.geolocation) {
      setLocationError("GPS not available on this device.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationError(null);
        updateDriverLocation(user.uid, pos.coords.latitude, pos.coords.longitude).catch((e) => console.warn("[useDispatch] location update failed:", e));
      },
      (error) => setGeoError(error),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    locationWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setLocationError(null);
        updateDriverLocation(user.uid, pos.coords.latitude, pos.coords.longitude).catch((e) => console.warn("[useDispatch] location update failed:", e));
      },
      (error) => setGeoError(error),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );

    return () => {
      if (locationWatchRef.current !== null) {
        navigator.geolocation.clearWatch(locationWatchRef.current);
        locationWatchRef.current = null;
      }
    };
  }, [isOnline, user]);

  const setOnline = async (online: boolean) => {
    if (!user) return;
    if (!online && activeRide) {
      setLocationError("Cannot go offline while on an active trip.");
      return;
    }
    await setDriverOnline(user.uid, online);
    setIsOnline(online);
    if (!online) setIncomingRides([]);
  };

  const accept = async (rideId: string) => {
    if (!user) return;
    await acceptRide(rideId, user.uid, {
      name: profile?.name || "",
      rating: profile?.rating || 5.0,
      car: profile?.vehicleMake ? `${profile.vehicleYear} ${profile.vehicleMake} ${profile.vehicleModel}` : "",
      plate: profile?.licensePlate || "",
    });
    setIncomingRides([]);
  };

  const start = async () => {
    if (!activeRide) return;
    await startRide(activeRide.id);
  };

  const complete = async () => {
    if (!activeRide) return;
    await completeRide(activeRide.id);
    setActiveRide(null);
  };

  return { isOnline, setOnline, incomingRides, activeRide, accept, start, complete, locationError, rideListenerError };
}
