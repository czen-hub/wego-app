import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type {
  LeafletMouseEvent,
  Map as LeafletMap,
  Marker as LeafletMarker,
  Polyline as LeafletPolyline,
} from "leaflet";

const ROUTE_REFETCH_METERS = 150;

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface ClientMapProps {
  from?: [number, number];
  to?: [number, number];
  via?: [number, number];
  driverPos?: [number, number];
  center?: [number, number];
  zoom?: number;
  className?: string;
  interactive?: boolean;
  zoomAdjust?: number;
  forceResetToken?: number;
  onCenterChange?: (coords: [number, number]) => void;
  onClickLocation?: (coords: [number, number]) => void;
}

export default function ClientMap({
  className = "",
  from,
  to,
  via,
  driverPos,
  center = [37.7749, -122.4194],
  zoom = 13,
  interactive = false,
  zoomAdjust = 0,
  forceResetToken,
  onCenterChange,
  onClickLocation,
}: ClientMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<any>(null);
  const fromMarkerRef = useRef<LeafletMarker | null>(null);
  const toMarkerRef = useRef<LeafletMarker | null>(null);
  const viaMarkerRef = useRef<LeafletMarker | null>(null);
  const driverPosMarkerRef = useRef<LeafletMarker | null>(null);
  const routeLineRef = useRef<LeafletPolyline | null>(null);
  const routeFetchAbortRef = useRef<AbortController | null>(null);
  const lastFetchFromRef = useRef<[number, number] | null>(null);
  const lastFetchViaRef = useRef<string>("");
  const lastFetchToRef = useRef<string>("");
  const hasSolidRouteRef = useRef(false);
  const fetchInProgressRef = useRef(false);
  const baseZoomRef = useRef<number>(zoom);
  const [mapReady, setMapReady] = useState(false);
  const centerRef = useRef<[number, number]>(center);
  const zoomRef = useRef<number>(zoom);

  useEffect(() => {
    let cancelled = false;

    if (!containerRef.current || mapRef.current) return undefined;

    import("leaflet")
      .then(({ default: L }) => {
        if (!containerRef.current || mapRef.current || cancelled) return;

        leafletRef.current = L;

        const hasRoute = !!from && !!to;
        const mapCenter: [number, number] = hasRoute
          ? [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2]
          : center;

        const map = L.map(containerRef.current, {
          center: mapCenter,
          zoom,
          zoomControl: false,
          attributionControl: false,
          scrollWheelZoom: interactive,
          dragging: interactive,
          touchZoom: interactive,
          doubleClickZoom: interactive,
        });

        mapRef.current = map;
        setMapReady(true);

        L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png", {
          subdomains: "abcd",
          maxZoom: 19,
        }).addTo(map);

        setTimeout(() => map.invalidateSize({ animate: false }), 100);
      })
      .catch((e) => console.error("[Map]", e));

    return () => {
      cancelled = true;
      routeFetchAbortRef.current?.abort();
      routeLineRef.current?.remove();
      fromMarkerRef.current?.remove();
      toMarkerRef.current?.remove();
      viaMarkerRef.current?.remove();
      driverPosMarkerRef.current?.remove();
      mapRef.current?.remove();
      routeLineRef.current = null;
      fromMarkerRef.current = null;
      toMarkerRef.current = null;
      viaMarkerRef.current = null;
      driverPosMarkerRef.current = null;
      mapRef.current = null;
      leafletRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    if (interactive) {
      map.dragging.enable();
      map.touchZoom.enable();
      map.doubleClickZoom.enable();
      map.scrollWheelZoom.enable();
    } else {
      map.dragging.disable();
      map.touchZoom.disable();
      map.doubleClickZoom.disable();
      map.scrollWheelZoom.disable();
    }
  }, [interactive, mapReady]);

  const onCenterChangeRef = useRef(onCenterChange);
  useEffect(() => {
    onCenterChangeRef.current = onCenterChange;
  }, [onCenterChange]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    const emitCenter = () => {
      if (!onCenterChangeRef.current) return;
      const next = map.getCenter();
      const dist = Math.abs(next.lat - centerRef.current[0]) + Math.abs(next.lng - centerRef.current[1]);
      const zoomDiff = Math.abs(map.getZoom() - zoomRef.current);
      if (dist > 0.0001 || zoomDiff > 0) {
        onCenterChangeRef.current([next.lat, next.lng]);
      }
    };

    map.on("moveend", emitCenter);
    return () => { map.off("moveend", emitCenter); };
  }, [mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !onClickLocation) return;

    const handleClick = (event: LeafletMouseEvent) => {
      onClickLocation([event.latlng.lat, event.latlng.lng]);
    };

    map.on("click", handleClick);
    return () => { map.off("click", handleClick); };
  }, [mapReady, onClickLocation]);

  useEffect(() => { centerRef.current = center; }, [center]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !forceResetToken) return;
    map.flyTo(centerRef.current, zoomRef.current, { animate: true, duration: 3.0 });
  }, [forceResetToken, mapReady]);

  const fromKey = from ? `${from[0].toFixed(5)},${from[1].toFixed(5)}` : "";
  const toKey = to ? `${to[0].toFixed(5)},${to[1].toFixed(5)}` : "";
  const viaKey = via ? `${via[0].toFixed(5)},${via[1].toFixed(5)}` : "";
  const centerKey = `${center[0].toFixed(5)},${center[1].toFixed(5)}`;
  const driverPosKey = driverPos ? `${driverPos[0].toFixed(5)},${driverPos[1].toFixed(5)}` : "";

  // Route + static markers — only re-fetches OSRM when driver moves >150 m or via changes
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!mapReady || !map || !L) return;

    const movedFarEnough = !!(from && lastFetchFromRef.current &&
      haversineM(from[0], from[1], lastFetchFromRef.current[0], lastFetchFromRef.current[1]) > ROUTE_REFETCH_METERS);
    const viaChanged = viaKey !== lastFetchViaRef.current;
    const toChanged = toKey !== lastFetchToRef.current;
    const needsRefetch =
      toChanged ||
      viaChanged ||
      movedFarEnough ||
      (!hasSolidRouteRef.current && !fetchInProgressRef.current);

    toMarkerRef.current?.remove();
    toMarkerRef.current = null;
    if (to) {
      toMarkerRef.current = L.marker(to, {
        icon: L.divIcon({
          className: "",
          html: '<div style="width:14px;height:14px;border-radius:50%;background:white;border:3px solid #1e293b;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>',
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        }),
      }).addTo(map);
    }

    // Via (stop) marker
    viaMarkerRef.current?.remove();
    viaMarkerRef.current = null;
    if (via) {
      viaMarkerRef.current = L.marker(via, {
        icon: L.divIcon({
          className: "",
          html: '<div style="width:14px;height:14px;border-radius:50%;background:#f59e0b;border:3px solid white;box-shadow:0 2px 8px rgba(245,158,11,0.6)"></div>',
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        }),
      }).addTo(map);
    }

    if (!driverPos) {
      fromMarkerRef.current?.remove();
      fromMarkerRef.current = null;
      if (from) {
        fromMarkerRef.current = L.marker(from, {
          icon: L.divIcon({
            className: "",
            html: '<div style="width:14px;height:14px;border-radius:50%;background:#0047ff;border:3px solid white;box-shadow:0 2px 8px rgba(0,71,255,0.6)"></div>',
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          }),
        }).addTo(map);
      }
    }

    if (from && to) {
      if (needsRefetch) {
        lastFetchFromRef.current = [from[0], from[1]];
        lastFetchViaRef.current = viaKey;
        lastFetchToRef.current = toKey;
        hasSolidRouteRef.current = false;
        fetchInProgressRef.current = true;

        routeLineRef.current?.remove();
        routeLineRef.current = null;

        const same =
          Math.abs(from[0] - to[0]) < 0.001 && Math.abs(from[1] - to[1]) < 0.001;

        const placeholderPoints: [number, number][] = via ? [from, via, to] : [from, to];
        routeLineRef.current = L.polyline(placeholderPoints, {
          color: "#0047ff",
          weight: 3,
          opacity: 0.35,
          dashArray: "8,6",
        }).addTo(map);

        if (same) {
          const cur = map.getCenter();
          const needsMove =
            Math.abs(cur.lat - from[0]) > 0.00001 ||
            Math.abs(cur.lng - from[1]) > 0.00001 ||
            map.getZoom() !== zoom;
          if (needsMove) map.setView(from, zoom, { animate: false });
        } else {
          const boundsPoints: [number, number][] = via ? [from, via, to] : [from, to];
          map.fitBounds(boundsPoints, { padding: [48, 48], maxZoom: 14, animate: false });
        }

        routeFetchAbortRef.current?.abort();
        const controller = new AbortController();
        routeFetchAbortRef.current = controller;

        // Abort automatically after 8 s — public OSRM can be slow/down
        const timeoutId = setTimeout(() => {
          if (!hasSolidRouteRef.current) controller.abort();
        }, 8000);

        const waypoints = via
          ? `${from[1]},${from[0]};${via[1]},${via[0]};${to[1]},${to[0]}`
          : `${from[1]},${from[0]};${to[1]},${to[0]}`;

        fetch(
          `https://router.project-osrm.org/route/v1/driving/${waypoints}?overview=full&geometries=geojson`,
          { signal: controller.signal }
        )
          .then((r) => r.json())
          .then((data) => {
            fetchInProgressRef.current = false;
            const coords = data.routes?.[0]?.geometry?.coordinates as [number, number][] | undefined;
            if (!coords || !mapRef.current || !leafletRef.current) return;
            routeLineRef.current?.remove();
            const LL = leafletRef.current;
            const latLngs: [number, number][] = coords.map(([lng, lat]) => [lat, lng]);
            routeLineRef.current = LL.polyline(latLngs, {
              color: "#0047ff",
              weight: 4,
              opacity: 0.9,
            }).addTo(mapRef.current);
            mapRef.current.fitBounds(routeLineRef.current.getBounds(), {
              padding: [48, 48],
              maxZoom: 14,
              animate: false,
            });
            hasSolidRouteRef.current = true;
          })
          .catch((err) => {
            fetchInProgressRef.current = false;
            if (err.name !== "AbortError") console.warn("[Map] OSRM unavailable, showing estimated route");
          })
          .finally(() => clearTimeout(timeoutId));
      }
    } else {
      routeLineRef.current?.remove();
      routeLineRef.current = null;
      hasSolidRouteRef.current = false;
      fetchInProgressRef.current = false;
      lastFetchFromRef.current = null;
      lastFetchViaRef.current = "";
      lastFetchToRef.current = "";

      const cur = map.getCenter();
      const needsMove =
        Math.abs(cur.lat - center[0]) > 0.0001 ||
        Math.abs(cur.lng - center[1]) > 0.0001 ||
        map.getZoom() !== zoom;
      if (needsMove) map.setView(center, zoom, { animate: true });
    }

    baseZoomRef.current = map.getZoom();
    setTimeout(() => map.invalidateSize({ animate: false }), 0);

    return () => { routeFetchAbortRef.current?.abort(); };
  }, [centerKey, fromKey, mapReady, toKey, viaKey, zoom]);

  // Driver dot — smooth movement via setLatLng, no route redraw
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!mapReady || !map || !L) return;

    if (!driverPos) {
      driverPosMarkerRef.current?.remove();
      driverPosMarkerRef.current = null;
      return;
    }

    if (driverPosMarkerRef.current) {
      driverPosMarkerRef.current.setLatLng(driverPos);
    } else {
      driverPosMarkerRef.current = L.marker(driverPos, {
        icon: L.divIcon({
          className: "",
          html: '<div style="width:14px;height:14px;border-radius:50%;background:#0047ff;border:3px solid white;box-shadow:0 2px 8px rgba(0,71,255,0.6)"></div>',
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        }),
      }).addTo(map);
    }
  }, [driverPosKey, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    map.setZoom(baseZoomRef.current + zoomAdjust, { animate: true });
  }, [zoomAdjust, mapReady]);

  return (
    <div
      ref={containerRef}
      className={`${className} leaflet-fill ${interactive ? "cursor-grab active:cursor-grabbing" : ""}`}
    />
  );
}
