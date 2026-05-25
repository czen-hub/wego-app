import { useEffect, useState } from "react";

const DEFAULT_COORDS: [number, number] = [37.3541, -121.9552]; // Santa Clara

interface UseCurrentLocationResult {
  coords: [number, number] | null;
  accuracy: number | null;
  error: string | null;
  loading: boolean;
}

export function useCurrentLocation(): UseCurrentLocationResult {
  const [coords, setCoords] = useState<[number, number] | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!navigator.geolocation) {
      setCoords(DEFAULT_COORDS);
      setError("Geolocation is not supported on this device.");
      setLoading(false);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setCoords([position.coords.latitude, position.coords.longitude]);
        setAccuracy(position.coords.accuracy);
        setError(null);
        setLoading(false);
      },
      (geoError) => {
        const message =
          geoError.code === geoError.PERMISSION_DENIED
            ? "Location access was denied. Using the default map center."
            : geoError.code === geoError.POSITION_UNAVAILABLE
              ? "Current location is unavailable right now. Using the default map center."
              : "Location request timed out. Using the default map center.";

        setCoords(DEFAULT_COORDS);
        setError(message);
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 3000,
      },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  return { coords, accuracy, error, loading };
}
