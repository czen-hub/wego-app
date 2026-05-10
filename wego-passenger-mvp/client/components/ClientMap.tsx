import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type {
  LeafletMouseEvent,
  Map as LeafletMap,
  Marker as LeafletMarker,
  Polyline as LeafletPolyline,
} from "leaflet";

interface ClientMapProps {
  from?: [number, number];
  to?: [number, number];
  center?: [number, number];
  zoom?: number;
  className?: string;
  interactive?: boolean;
  zoomAdjust?: number;
  onCenterChange?: (coords: [number, number]) => void;
  onClickLocation?: (coords: [number, number]) => void;
}

export default function ClientMap({
  className = "",
  from,
  to,
  center = [37.7749, -122.4194],
  zoom = 13,
  interactive = false,
  zoomAdjust = 0,
  onCenterChange,
  onClickLocation,
}: ClientMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<any>(null);
  const fromMarkerRef = useRef<LeafletMarker | null>(null);
  const toMarkerRef = useRef<LeafletMarker | null>(null);
  const routeLineRef = useRef<LeafletPolyline | null>(null);
  const baseZoomRef = useRef<number>(zoom);
  const [mapReady, setMapReady] = useState(false);

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
      routeLineRef.current?.remove();
      fromMarkerRef.current?.remove();
      toMarkerRef.current?.remove();
      mapRef.current?.remove();
      routeLineRef.current = null;
      fromMarkerRef.current = null;
      toMarkerRef.current = null;
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

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !onCenterChange) return;

    const emitCenter = () => {
      const next = map.getCenter();
      onCenterChange([next.lat, next.lng]);
    };

    map.on("moveend", emitCenter);

    return () => {
      map.off("moveend", emitCenter);
    };
  }, [mapReady, onCenterChange]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !onClickLocation) return;

    const handleClick = (event: LeafletMouseEvent) => {
      onClickLocation([event.latlng.lat, event.latlng.lng]);
    };

    map.on("click", handleClick);

    return () => {
      map.off("click", handleClick);
    };
  }, [mapReady, onClickLocation]);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!mapReady || !map || !L) return;

    routeLineRef.current?.remove();
    fromMarkerRef.current?.remove();
    toMarkerRef.current?.remove();
    routeLineRef.current = null;
    fromMarkerRef.current = null;
    toMarkerRef.current = null;

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

    if (from && to) {
      routeLineRef.current = L.polyline([from, to], {
        color: "#0047ff",
        weight: 3,
        opacity: 0.75,
        dashArray: "8,6",
      }).addTo(map);

      const same =
        Math.abs(from[0] - to[0]) < 0.001 && Math.abs(from[1] - to[1]) < 0.001;

      if (same) {
        const current = map.getCenter();
        const needsMove =
          Math.abs(current.lat - from[0]) > 0.00001 ||
          Math.abs(current.lng - from[1]) > 0.00001 ||
          map.getZoom() !== zoom;

        if (needsMove) map.setView(from, zoom, { animate: false });
      } else {
        map.fitBounds([from, to], {
          padding: [48, 48],
          maxZoom: 14,
          animate: false,
        });
      }
    } else {
      const current = map.getCenter();
      const needsMove =
        Math.abs(current.lat - center[0]) > 0.00001 ||
        Math.abs(current.lng - center[1]) > 0.00001 ||
        map.getZoom() !== zoom;

      if (needsMove) map.setView(center, zoom, { animate: false });
    }

    // Store base zoom so scroll-driven adjustments can reference it
    baseZoomRef.current = map.getZoom();

    setTimeout(() => map.invalidateSize({ animate: false }), 0);
  }, [center, from, mapReady, to, zoom]);

  // Scroll-driven zoom: zoomAdjust 0 = full route view, positive = zoom in
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
