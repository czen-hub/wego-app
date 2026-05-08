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

interface UseDispatchReturn {
  isOnline: boolean;
  setOnline: (online: boolean) => Promise<void>;
  incomingRides: Ride[];
  activeRide: Ride | null;
  accept: (rideId: string) => Promise<void>;
  start: () => Promise<void>;
  complete: () => Promise<void>;
  locationError: string | null;
}

export function useDispatch(): UseDispatchReturn {
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(false);
  const [incomingRides, setIncomingRides] = useState<Ride[]>([]);
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const locationWatchRef = useRef<number | null>(null);

  // Listen for pending rides when online
  useEffect(() => {
    if (!isOnline || !user) return;
    const unsub = listenForPendingRides(setIncomingRides);
    return () => {
      unsub();
      setIncomingRides([]);
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

    locationWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setLocationError(null);
        updateDriverLocation(user.uid, pos.coords.latitude, pos.coords.longitude).catch(() => {});
      },
      () => {
        setLocationError("Unable to access GPS. Check browser permissions.");
      },
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
    await setDriverOnline(user.uid, online);
    setIsOnline(online);
    if (!online) setIncomingRides([]);
  };

  const accept = async (rideId: string) => {
    if (!user) return;
    await acceptRide(rideId, user.uid);
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

  return { isOnline, setOnline, incomingRides, activeRide, accept, start, complete, locationError };
}
