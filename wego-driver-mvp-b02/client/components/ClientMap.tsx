import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;
const REFETCH_M = 150;
const ADVANCE_M = 40;

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(lat2 - lat1);
  const dLng = r(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const dLng = r(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(r(lat2));
  const x =
    Math.cos(r(lat1)) * Math.sin(r(lat2)) -
    Math.sin(r(lat1)) * Math.cos(r(lat2)) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function circlePolygon(lat: number, lng: number, radiusM: number, steps = 64): [number, number][] {
  const coords: [number, number][] = [];
  const dLat = (radiusM / 6_371_000) * (180 / Math.PI);
  const dLng = dLat / Math.cos((lat * Math.PI) / 180);
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    coords.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return coords;
}

function dotEl(color: string, border = "white", glow = "rgba(0,0,0,0.4)") {
  const el = document.createElement("div");
  el.style.cssText = `width:14px;height:14px;border-radius:50%;background:${color};border:3px solid ${border};box-shadow:0 2px 8px ${glow};flex-shrink:0;`;
  return el;
}

function draggablePinEl(): HTMLElement {
  const el = document.createElement("div");
  el.style.cssText = "width:26px;height:34px;cursor:grab;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.45));";
  el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="34" viewBox="0 0 26 34"><path d="M13 0C5.82 0 0 5.82 0 13c0 8.67 13 21 13 21s13-12.33 13-21C26 5.82 20.18 0 13 0z" fill="white" stroke="#1e293b" stroke-width="1.5"/><circle cx="13" cy="13" r="5" fill="#1e293b"/></svg>`;
  return el;
}

function navArrowEl(bearing: number): { wrapper: HTMLDivElement; inner: HTMLDivElement } {
  // Mapbox sets translate(...) on the wrapper — we must not touch wrapper's transform.
  // We apply rotate(...) only to the inner element to avoid fighting Mapbox's positioning.
  const wrapper = document.createElement("div");
  wrapper.style.cssText = `width:22px;height:22px;`;
  const inner = document.createElement("div");
  inner.style.cssText = `width:22px;height:22px;display:flex;align-items:center;justify-content:center;transform:rotate(${bearing}deg);transition:transform 0.4s ease;`;
  inner.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 36 36" style="filter:drop-shadow(0 3px 8px rgba(245,158,11,0.55))"><polygon points="18,3 26,30 18,23 10,30" fill="#F59E0B" stroke="white" stroke-width="2" stroke-linejoin="round"/></svg>`;
  wrapper.appendChild(inner);
  return { wrapper, inner };
}

export interface RouteStep {
  instruction: string;
  type: string;
  modifier?: string;
  distance: number;
  duration: number;
  name: string;
  nextStep?: { instruction: string; type: string; modifier?: string; name: string };
}

function buildStep(s: any, nextS?: any): RouteStep {
  return {
    instruction: s.maneuver.instruction,
    type: s.maneuver.type,
    modifier: s.maneuver.modifier,
    distance: s.distance,
    duration: s.duration,
    name: s.name ?? "",
    nextStep: nextS
      ? { instruction: nextS.maneuver.instruction, type: nextS.maneuver.type, modifier: nextS.maneuver.modifier, name: nextS.name ?? "" }
      : undefined,
  };
}

interface ClientMapProps {
  from?: [number, number];
  to?: [number, number];
  via?: [number, number];
  driverPos?: [number, number];
  accuracy?: number;
  center?: [number, number];
  zoom?: number;
  className?: string;
  interactive?: boolean;
  zoomAdjust?: number;
  forceResetToken?: number;
  fitRouteToken?: number;
  followBearing?: boolean;
  navMode?: boolean;
  onCenterChange?: (coords: [number, number]) => void;
  onClickLocation?: (coords: [number, number]) => void;
  onStepChange?: (step: RouteStep | null) => void;
  onAllStepsChange?: (steps: RouteStep[]) => void;
  onDistanceChange?: (meters: number) => void;
  onSpeedLimitChange?: (mph: number | null) => void;
  onCameraApproach?: () => void;
  onSpeedChange?: (mph: number) => void;
  onRerouting?: () => void;
  onRouteInfoChange?: (info: { remainingM: number; remainingSecs: number }) => void;
  surgeZones?: Array<{ lat: number; lng: number; radiusM: number; label: string }>;
  onToDrag?: (coords: [number, number]) => void;
}

export default function ClientMap({
  className = "",
  from,
  to,
  via,
  driverPos,
  accuracy,
  center = [37.7749, -122.4194],
  zoom = 13,
  interactive = false,
  zoomAdjust = 0,
  forceResetToken,
  fitRouteToken,
  followBearing = false,
  navMode = false,
  onCenterChange,
  onClickLocation,
  onStepChange,
  onAllStepsChange,
  onDistanceChange,
  onSpeedLimitChange,
  onCameraApproach,
  onSpeedChange,
  onRerouting,
  onRouteInfoChange,
  surgeZones,
  onToDrag,
}: ClientMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const mbRef = useRef<any>(null);
  const fromMkRef = useRef<any>(null);
  const toMkRef = useRef<any>(null);
  const viaMkRef = useRef<any>(null);
  const driverMkRef = useRef<any>(null);
  const driverElRef = useRef<HTMLDivElement | null>(null);
  const prevPosRef = useRef<[number, number] | null>(null);
  const routeAbortRef = useRef<AbortController | null>(null);
  const lastFromRef = useRef<[number, number] | null>(null);
  const lastViaRef = useRef<string>("");
  const lastToRef = useRef<string>("");
  const hasSolidRef = useRef(false);
  const fetchingRef = useRef(false);
  const hasInitCenteredRef = useRef(false);
  const baseZoomRef = useRef<number>(zoom);
  const stepsRef = useRef<any[]>([]);
  const stepIdxRef = useRef(-1);
  const storedHeading = parseFloat(localStorage.getItem("wego_heading") ?? "0") || 0;
  const bearingRef = useRef<number>(storedHeading);
  const compassHeadingRef = useRef<number | null>(null);
  const lastGpsMovedRef = useRef<number>(0);
  const followBearingRef = useRef(followBearing);
  const navModeRef = useRef(navMode);
  const [mapReady, setMapReady] = useState(false);
  const centerRef = useRef<[number, number]>(center);
  const zoomRef = useRef<number>(zoom);
  const onCenterChangeRef = useRef(onCenterChange);
  const onClickRef = useRef(onClickLocation);
  const onStepRef = useRef(onStepChange);
  const onAllStepsRef = useRef(onAllStepsChange);
  const onDistanceChangeRef = useRef(onDistanceChange);
  const accuracyRef = useRef<number | null>(accuracy ?? null);
  const posBufferRef = useRef<[number, number][]>([]);
  const snapAbortRef = useRef<AbortController | null>(null);
  const lastSnapRef = useRef<{ pos: [number, number]; time: number } | null>(null);
  const routeCoordsRef = useRef<[number, number][]>([]);
  const maxspeedsRef = useRef<Array<number | null>>([]);
  const cameraMarkersRef = useRef<Array<{ marker: any; lat: number; lng: number }>>([]);
  const alertedCamerasRef = useRef<Set<string>>(new Set());
  const lastSpeedLimitRef = useRef<number | null>(null);
  const nearestCoordIdxRef = useRef(0);
  const cameraFetchGenRef = useRef(0);
  const onSpeedLimitRef = useRef(onSpeedLimitChange);
  const lastTileSpeedLimitQueryRef = useRef(0);
  const onCameraApproachRef = useRef(onCameraApproach);
  const prevTimeRef = useRef<number | null>(null);
  const lastRerouteRef = useRef<number>(0);
  const cumDistRef = useRef<number[]>([]);
  const cumDurRef = useRef<number[]>([]);
  const fuelMarkersRef = useRef<any[]>([]);
  const onSpeedRef = useRef(onSpeedChange);
  const onReroutingRef = useRef(onRerouting);
  const onRouteInfoRef = useRef(onRouteInfoChange);
  const onToDragRef = useRef(onToDrag);

  const isInteractingRef = useRef(false);
  const isTrackingRef = useRef(true);
  const lastCameraUpdateRef = useRef<number>(0);
  const lastProgrammaticRef = useRef(0);

  useEffect(() => { accuracyRef.current = accuracy ?? null; }, [accuracy]);
  useEffect(() => { navModeRef.current = navMode; }, [navMode]);

  useEffect(() => { onCenterChangeRef.current = onCenterChange; }, [onCenterChange]);
  useEffect(() => { onClickRef.current = onClickLocation; }, [onClickLocation]);
  useEffect(() => { onStepRef.current = onStepChange; }, [onStepChange]);
  useEffect(() => { onAllStepsRef.current = onAllStepsChange; }, [onAllStepsChange]);
  useEffect(() => { onDistanceChangeRef.current = onDistanceChange; }, [onDistanceChange]);
  useEffect(() => { onSpeedLimitRef.current = onSpeedLimitChange; }, [onSpeedLimitChange]);
  useEffect(() => { onCameraApproachRef.current = onCameraApproach; }, [onCameraApproach]);
  useEffect(() => { onSpeedRef.current = onSpeedChange; }, [onSpeedChange]);
  useEffect(() => { onReroutingRef.current = onRerouting; }, [onRerouting]);
  useEffect(() => { onRouteInfoRef.current = onRouteInfoChange; }, [onRouteInfoChange]);
  useEffect(() => { onToDragRef.current = onToDrag; }, [onToDrag]);
  useEffect(() => { centerRef.current = center; }, [center]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  // Smoothly ease/animate the camera to the new driver position and bearing
  const animateCamera = (targetCenter: [number, number] | null, targetBearing: number | null) => {
    const map = mapRef.current;
    if (!map) return; // use ref — avoids stale mapReady closure when called from compass useEffect
    if (isInteractingRef.current || !isTrackingRef.current) return;

    const options: any = {
      pitch: navModeRef.current ? 50 : 0,
      duration: 1000,
      essential: true,
    };

    // Maintain street-level zoom on every GPS tick so nothing can silently override it
    if (navModeRef.current) options.zoom = 18;

    if (targetCenter) {
      options.center = [targetCenter[1], targetCenter[0]];
    }

    if (targetBearing !== null) {
      options.bearing = targetBearing;
    }

    const now = Date.now();
    if (now - lastCameraUpdateRef.current > 100) {
      lastCameraUpdateRef.current = now;
      lastProgrammaticRef.current = now + 200; // guard window: zoomstart fires synchronously inside easeTo
      map.easeTo(options);
    }
  };

  // Track map interaction to pause programmatic transitions when user is touching/panning
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    const startInteract = () => {
      if (Date.now() < lastProgrammaticRef.current) return; // programmatic camera move in progress
      isInteractingRef.current = true;
      isTrackingRef.current = false;
    };
    const endInteract = () => {
      isInteractingRef.current = false;
    };

    map.on("dragstart", startInteract);
    map.on("zoomstart", startInteract);
    map.on("rotatestart", startInteract);
    map.on("pitchstart", startInteract);

    map.on("dragend", endInteract);
    map.on("zoomend", endInteract);
    map.on("rotateend", endInteract);
    map.on("pitchend", endInteract);

    return () => {
      map.off("dragstart", startInteract);
      map.off("zoomstart", startInteract);
      map.off("rotatestart", startInteract);
      map.off("pitchstart", startInteract);

      map.off("dragend", endInteract);
      map.off("zoomend", endInteract);
      map.off("rotateend", endInteract);
      map.off("pitchend", endInteract);
    };
  }, [mapReady]);

  // Handle follow bearing changes
  useEffect(() => {
    followBearingRef.current = followBearing;
    const map = mapRef.current;
    if (!mapReady || !map) return;

    isTrackingRef.current = true;

    if (followBearing) {
      if (driverElRef.current) driverElRef.current.style.transform = "rotate(0deg)";
      animateCamera(driverPos ?? centerRef.current, bearingRef.current);
    } else {
      if (driverElRef.current) driverElRef.current.style.transform = `rotate(${bearingRef.current}deg)`;
      map.easeTo({ bearing: 0, pitch: navModeRef.current ? 50 : 0, duration: 600 });
    }
  }, [followBearing, mapReady]);

  // — navMode: transition from route overview to street-level driver view —
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    if (navMode) {
      isTrackingRef.current = true;
      lastProgrammaticRef.current = Date.now() + 2500;
      map.easeTo({
        center: [centerRef.current[1], centerRef.current[0]],
        zoom: 18,
        pitch: 50,
        bearing: followBearingRef.current ? bearingRef.current : map.getBearing(),
        duration: 1500,
        essential: true,
      });
    } else {
      isTrackingRef.current = false;
      const routeCoords = routeCoordsRef.current;
      if (routeCoords.length > 1 && mbRef.current) {
        // Zoom out to show full route so driver can see and drag the destination pin
        const bounds = new mbRef.current.LngLatBounds();
        routeCoords.forEach(([lng, lat]: [number, number]) => bounds.extend([lng, lat]));
        lastProgrammaticRef.current = Date.now() + 1500;
        map.easeTo({ pitch: 0, duration: 400, essential: true });
        setTimeout(() => {
          map.fitBounds(bounds, { padding: 64, maxZoom: 14, duration: 800, essential: true });
        }, 420);
      } else {
        map.easeTo({ pitch: 0, duration: 600 });
      }
    }
  }, [navMode, mapReady]);

  // — device compass — always listen to both events; absolute takes priority over relative
  useEffect(() => {
    let lastAbsTime = 0;

    function processHeading(heading: number) {
      compassHeadingRef.current = heading;
      localStorage.setItem("wego_heading", String(Math.round(heading)));

      // Only use compass when truly stationary — 8s prevents fighting GPS on variable update intervals
      const isStationary = Date.now() - lastGpsMovedRef.current > 8000;

      if (followBearingRef.current) {
        if (isStationary) {
          // Require >5° change to suppress noisy micro-rotations
          const delta = Math.abs(((heading - bearingRef.current) + 540) % 360 - 180);
          if (delta > 5) {
            bearingRef.current = heading;
            if (driverElRef.current) driverElRef.current.style.transform = "rotate(0deg)";
            isTrackingRef.current = true;
            animateCamera(null, heading);
          }
        }
      } else {
        if (isStationary) {
          bearingRef.current = heading;
          if (driverElRef.current) driverElRef.current.style.transform = `rotate(${heading}deg)`;
        }
      }
    }

    function handleAbsolute(e: DeviceOrientationEvent) {
      if (typeof e.alpha !== "number") return;
      lastAbsTime = Date.now();
      processHeading((360 - e.alpha) % 360);
    }

    function handleRelative(e: DeviceOrientationEvent & { webkitCompassHeading?: number }) {
      if (Date.now() - lastAbsTime < 200) return;
      let heading: number | null = null;
      if (typeof e.webkitCompassHeading === "number") heading = e.webkitCompassHeading;
      else if (typeof e.alpha === "number") heading = (360 - e.alpha) % 360;
      if (heading === null) return;
      processHeading(heading);
    }

    window.addEventListener("deviceorientationabsolute", handleAbsolute as any);
    window.addEventListener("deviceorientation", handleRelative as any);
    return () => {
      window.removeEventListener("deviceorientationabsolute", handleAbsolute as any);
      window.removeEventListener("deviceorientation", handleRelative as any);
    };
  }, []);

  // — init map —
  useEffect(() => {
    let dead = false;
    if (!containerRef.current || mapRef.current) return;

    if (!TOKEN) {
      console.error("[Map] VITE_MAPBOX_TOKEN is not set");
      return;
    }

    const mb = mapboxgl;

    if (!mb.supported()) {
      console.error("[Map] WebGL not supported in this browser");
      return;
    }

    mbRef.current = mb;
    mb.accessToken = TOKEN;

    const initCenter: [number, number] = from && to
      ? [(from[1] + to[1]) / 2, (from[0] + to[0]) / 2]
      : [center[1], center[0]];

    const map = new mb.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/navigation-night-v1",
      center: initCenter,
      zoom,
      pitch: 0,
      maxPitch: 60,
      attributionControl: false,
      accessToken: TOKEN,
      fadeDuration: 0,
    });
    mapRef.current = map;

    map.on("error", (e) => {
      console.error("[Map] runtime error:", e.error?.message ?? JSON.stringify(e));
    });

    setTimeout(() => map.resize(), 100);

    // Request compass permission on first tap anywhere on the map (iOS 13+)
    containerRef.current?.addEventListener("pointerdown", () => {
      const oe = (window as any).DeviceOrientationEvent;
      if (typeof oe?.requestPermission === "function") oe.requestPermission().catch(() => {});
    }, { once: true });

    map.once("load", () => {
      if (dead) return;

      map.addSource("route-alt", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "route-alt",
        type: "line",
        source: "route-alt",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#64748b", "line-width": 3, "line-opacity": 0.45 },
      });

      map.addSource("route", {
        type: "geojson",
        data: { type: "Feature", geometry: { type: "LineString", coordinates: [] }, properties: {} },
      });
      map.addLayer({
        id: "route",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#F59E0B", "line-width": 4, "line-opacity": 0.9 },
      });

      map.addSource("route-dash", {
        type: "geojson",
        data: { type: "Feature", geometry: { type: "LineString", coordinates: [] }, properties: {} },
      });
      map.addLayer({
        id: "route-dash",
        type: "line",
        source: "route-dash",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#F59E0B",
          "line-width": 3,
          "line-opacity": 0.35,
          "line-dasharray": [2, 2],
        },
      });

      map.addSource("accuracy-circle", {
        type: "geojson",
        data: { type: "Feature", geometry: { type: "Polygon", coordinates: [[]] }, properties: {} },
      });
      map.addLayer({
        id: "accuracy-circle-fill",
        type: "fill",
        source: "accuracy-circle",
        paint: { "fill-color": "#3B82F6", "fill-opacity": 0.18 },
      });
      map.addLayer({
        id: "accuracy-circle-border",
        type: "line",
        source: "accuracy-circle",
        paint: { "line-color": "#3B82F6", "line-width": 2, "line-opacity": 0.8 },
      });

      map.addSource("surge-zones", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "surge-zones-fill",
        type: "fill",
        source: "surge-zones",
        paint: { "fill-color": "#F59E0B", "fill-opacity": 0.10 },
      });
      map.addLayer({
        id: "surge-zones-border",
        type: "line",
        source: "surge-zones",
        paint: { "line-color": "#F59E0B", "line-width": 1.5, "line-opacity": 0.55, "line-dasharray": [3, 2] },
      });

      setMapReady(true);
    });

    map.on("moveend", () => {
      const c = map.getCenter();
      onCenterChangeRef.current?.([c.lat, c.lng]);
    });

    map.on("click", (e: any) => {
      onClickRef.current?.([e.lngLat.lat, e.lngLat.lng]);
    });

    return () => {
      dead = true;
      routeAbortRef.current?.abort();
      snapAbortRef.current?.abort();
      fromMkRef.current?.remove();
      toMkRef.current?.remove();
      viaMkRef.current?.remove();
      driverMkRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
      mbRef.current = null;
      fromMkRef.current = null;
      toMkRef.current = null;
      viaMkRef.current = null;
      driverMkRef.current = null;
      for (const cm of cameraMarkersRef.current) cm.marker.remove();
      cameraMarkersRef.current = [];
      for (const mk of fuelMarkersRef.current) mk.remove();
      fuelMarkersRef.current = [];
    };
  }, []);

  // — interactive toggle —
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    const fn = interactive ? "enable" : "disable";
    map.dragPan[fn]();
    map.scrollZoom[fn]();
    map.touchZoomRotate[fn]();
    map.doubleClickZoom[fn]();
    map.keyboard[fn]();
  }, [interactive, mapReady]);

  // — forceReset —
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !forceResetToken) return;
    
    isTrackingRef.current = true;
    lastProgrammaticRef.current = Date.now() + 2500;

    map.flyTo({
      center: [centerRef.current[1], centerRef.current[0]],
      zoom: navModeRef.current ? 18 : zoomRef.current,
      bearing: followBearingRef.current ? map.getBearing() : 0,
      pitch: navModeRef.current ? 50 : 0,
      duration: 2000,
      essential: true,
    });
  }, [forceResetToken, mapReady]);

  // — fitRoute —
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !fitRouteToken) return;
    const coords = routeCoordsRef.current;
    if (coords.length < 2) return;
    isTrackingRef.current = false;
    lastProgrammaticRef.current = Date.now() + 2000;
    const mb = mbRef.current;
    if (!mb) return;
    const bounds = new mb.LngLatBounds();
    coords.forEach(([lng, lat]: [number, number]) => bounds.extend([lng, lat]));
    map.easeTo({ pitch: 0, bearing: 0, duration: 300, essential: true });
    setTimeout(() => {
      map.fitBounds(bounds, { padding: 64, maxZoom: 14, duration: 800, essential: true });
    }, 320);
  }, [fitRouteToken, mapReady]);

  // — zoomAdjust —
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    // navMode controls its own zoom — don't override with the base zoom
    if (navModeRef.current) return;
    map.setZoom(baseZoomRef.current + zoomAdjust);
  }, [zoomAdjust, mapReady]);

  const fromKey = from ? `${from[0].toFixed(5)},${from[1].toFixed(5)}` : "";
  const toKey = to ? `${to[0].toFixed(5)},${to[1].toFixed(5)}` : "";
  const viaKey = via ? `${via[0].toFixed(5)},${via[1].toFixed(5)}` : "";
  const centerKey = `${center[0].toFixed(5)},${center[1].toFixed(5)}`;
  const driverPosKey = driverPos ? `${driverPos[0].toFixed(5)},${driverPos[1].toFixed(5)}` : "";

  // — route + static markers —
  useEffect(() => {
    const map = mapRef.current;
    const mb = mbRef.current;
    if (!mapReady || !map || !mb) return;

    const movedFar = !!(from && lastFromRef.current &&
      haversineM(from[0], from[1], lastFromRef.current[0], lastFromRef.current[1]) > REFETCH_M);
    const needsRefetch =
      toKey !== lastToRef.current ||
      viaKey !== lastViaRef.current ||
      movedFar ||
      (!hasSolidRef.current && !fetchingRef.current);

    const setSource = (id: string, coords: number[][]) =>
      (mapRef.current?.getSource(id) as any)?.setData({
        type: "Feature",
        geometry: { type: "LineString", coordinates: coords },
        properties: {},
      });

    const setAltRoutes = (coordsArr: [number, number][][]) =>
      (mapRef.current?.getSource("route-alt") as any)?.setData({
        type: "FeatureCollection",
        features: coordsArr.map((c) => ({
          type: "Feature" as const,
          geometry: { type: "LineString" as const, coordinates: c },
          properties: {},
        })),
      });

    // destination marker
    toMkRef.current?.remove();
    toMkRef.current = null;
    if (to) {
      const mk = new mb.Marker({
        element: onToDragRef.current ? draggablePinEl() : dotEl("white", "#1e293b"),
        draggable: !!onToDragRef.current,
        anchor: onToDragRef.current ? "bottom" : "center",
      })
        .setLngLat([to[1], to[0]])
        .addTo(map);
      if (onToDragRef.current) {
        mk.on("dragend", () => {
          const ll = mk.getLngLat();
          onToDragRef.current?.([ll.lat, ll.lng]);
        });
      }
      toMkRef.current = mk;
    }

    // via marker
    viaMkRef.current?.remove();
    viaMkRef.current = null;
    if (via) {
      viaMkRef.current = new mb.Marker({ element: dotEl("#f59e0b", "white", "rgba(245,158,11,0.6)") })
        .setLngLat([via[1], via[0]])
        .addTo(map);
    }

    // from marker (hidden when driverPos is separate)
    if (!driverPos) {
      fromMkRef.current?.remove();
      fromMkRef.current = null;
      if (from) {
        fromMkRef.current = new mb.Marker({ element: dotEl("#F59E0B", "white", "rgba(245,158,11,0.6)") })
          .setLngLat([from[1], from[0]])
          .addTo(map);
      }
    }

    if (from && to) {
      if (needsRefetch) {
        lastFromRef.current = from;
        lastViaRef.current = viaKey;
        lastToRef.current = toKey;
        hasSolidRef.current = false;
        fetchingRef.current = true;
        stepsRef.current = [];
        stepIdxRef.current = -1;
        onStepRef.current?.(null);
        for (const cm of cameraMarkersRef.current) cm.marker.remove();
        cameraMarkersRef.current = [];
        alertedCamerasRef.current = new Set();
        routeCoordsRef.current = [];
        maxspeedsRef.current = [];
        nearestCoordIdxRef.current = 0;
        cameraFetchGenRef.current++;
        onSpeedLimitRef.current?.(null);
        lastSpeedLimitRef.current = null;
        for (const mk of fuelMarkersRef.current) mk.remove();
        fuelMarkersRef.current = [];
        cumDistRef.current = [];
        cumDurRef.current = [];

        // dashed placeholder
        const pts = via
          ? [[from[1], from[0]], [via[1], via[0]], [to[1], to[0]]]
          : [[from[1], from[0]], [to[1], to[0]]];
        setSource("route", []);
        setSource("route-dash", pts);
        setAltRoutes([]);

        const same = Math.abs(from[0] - to[0]) < 0.001 && Math.abs(from[1] - to[1]) < 0.001;
        lastProgrammaticRef.current = Date.now() + 500;
        if (same) {
          map.flyTo({ center: [from[1], from[0]], zoom, animate: false });
        } else if (!navModeRef.current) {
          // In nav mode the camera already follows the driver; don't zoom out to show full route
          const bounds = new mb.LngLatBounds();
          pts.forEach(([lng, lat]) => bounds.extend([lng, lat]));
          map.fitBounds(bounds, { padding: 48, maxZoom: 14, animate: false });
        }

        routeAbortRef.current?.abort();
        const ctrl = new AbortController();
        routeAbortRef.current = ctrl;
        const tid = setTimeout(() => { if (!hasSolidRef.current) ctrl.abort(); }, 8000);

        const wpts = via
          ? `${from[1]},${from[0]};${via[1]},${via[0]};${to[1]},${to[0]}`
          : `${from[1]},${from[0]};${to[1]},${to[0]}`;

        fetch(
          `https://api.mapbox.com/directions/v5/mapbox/driving/${wpts}?steps=true&geometries=geojson&overview=full&annotations=maxspeed&alternatives=true&access_token=${TOKEN}`,
          { signal: ctrl.signal },
        )
          .then((r) => r.json())
          .then((data) => {
            fetchingRef.current = false;
            const route = data.routes?.[0];
            if (!route || !mapRef.current) return;

            setSource("route", route.geometry.coordinates);
            setSource("route-dash", []);

            if (!navModeRef.current) {
              const bounds = new mb.LngLatBounds();
              (route.geometry.coordinates as [number, number][]).forEach((c) => bounds.extend(c));
              lastProgrammaticRef.current = Date.now() + 500;
              mapRef.current.fitBounds(bounds, { padding: 48, maxZoom: 14, animate: false });
            }

            const steps: any[] = [];
            for (const leg of route.legs ?? []) steps.push(...(leg.steps ?? []));
            stepsRef.current = steps;
            hasSolidRef.current = true;
            setAltRoutes((data.routes ?? []).slice(1).map((r: any) => r.geometry.coordinates));

            if (steps.length > 0) {
              stepIdxRef.current = 0;
              onStepRef.current?.(buildStep(steps[0], steps[1]));
              onAllStepsRef.current?.(steps.map((s: any, i: number) => buildStep(s, steps[i + 1])));
            }

            // Cumulative remaining distance + duration from each step to end
            const cumDist: number[] = new Array(steps.length).fill(0);
            const cumDur: number[] = new Array(steps.length).fill(0);
            for (let i = steps.length - 1; i >= 0; i--) {
              cumDist[i] = steps[i].distance + (i < steps.length - 1 ? cumDist[i + 1] : 0);
              cumDur[i] = steps[i].duration + (i < steps.length - 1 ? cumDur[i + 1] : 0);
            }
            cumDistRef.current = cumDist;
            cumDurRef.current = cumDur;
            if (cumDist.length > 0) onRouteInfoRef.current?.({ remainingM: cumDist[0], remainingSecs: cumDur[0] });

            // Store route coordinates and maxspeed annotations
            routeCoordsRef.current = route.geometry.coordinates as [number, number][];
            nearestCoordIdxRef.current = 0;
            lastSpeedLimitRef.current = null;
            const allMaxspeeds: Array<number | null> = [];
            for (const leg of route.legs ?? []) {
              for (const s of (leg.annotation?.maxspeed ?? []) as any[]) {
                if (s && typeof s.speed === "number") {
                  allMaxspeeds.push(s.unit === "mph" ? Math.round(s.speed) : Math.round(s.speed * 0.621371));
                } else {
                  allMaxspeeds.push(null);
                }
              }
            }
            maxspeedsRef.current = allMaxspeeds;

            // Fetch speed cameras along route from OpenStreetMap via Overpass API
            const allCoords = route.geometry.coordinates as [number, number][];
            let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
            for (const [lng, lat] of allCoords) {
              if (lat < minLat) minLat = lat;
              if (lat > maxLat) maxLat = lat;
              if (lng < minLng) minLng = lng;
              if (lng > maxLng) maxLng = lng;
            }
            const gen = ++cameraFetchGenRef.current;
            const south = (minLat - 0.01).toFixed(6);
            const north = (maxLat + 0.01).toFixed(6);
            const west = (minLng - 0.01).toFixed(6);
            const east = (maxLng + 0.01).toFixed(6);
            fetch(`https://overpass-api.de/api/interpreter?data=[out:json][timeout:10];node["highway"="speed_camera"](${south},${west},${north},${east});out;`)
              .then((r) => r.json())
              .then((camData) => {
                if (gen !== cameraFetchGenRef.current || !mapRef.current || !mbRef.current) return;
                for (const node of (camData.elements ?? []) as any[]) {
                  const el = document.createElement("div");
                  el.style.cssText = "width:18px;height:18px;background:#ef4444;border:2px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(239,68,68,0.7);";
                  el.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m22 8-6 4 6 4V8z"/><rect width="14" height="12" x="2" y="6" rx="2"/></svg>';
                  const mk = new mbRef.current.Marker({ element: el, anchor: "center" })
                    .setLngLat([node.lon, node.lat])
                    .addTo(mapRef.current);
                  cameraMarkersRef.current.push({ marker: mk, lat: node.lat, lng: node.lon });
                }
              })
              .catch(() => {});

            // Fuel stations along route
            for (const mk of fuelMarkersRef.current) mk.remove();
            fuelMarkersRef.current = [];
            fetch(`https://overpass-api.de/api/interpreter?data=[out:json][timeout:10];node["amenity"="fuel"](${south},${west},${north},${east});out;`)
              .then((r) => r.json())
              .then((fuelData) => {
                if (gen !== cameraFetchGenRef.current || !mapRef.current || !mbRef.current) return;
                for (const node of (fuelData.elements ?? []) as any[]) {
                  const el = document.createElement("div");
                  el.style.cssText = "width:16px;height:16px;background:#22c55e;border:2px solid white;border-radius:3px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 5px rgba(34,197,94,0.7);";
                  el.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 22V4a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v18"/><path d="M3 22h11"/><path d="M12 7h4"/><path d="M18 7v4"/><circle cx="18" cy="11" r="2"/></svg>';
                  const mk = new mbRef.current.Marker({ element: el, anchor: "center" })
                    .setLngLat([node.lon, node.lat])
                    .addTo(mapRef.current);
                  fuelMarkersRef.current.push(mk);
                }
              })
              .catch(() => {});
          })
          .catch((e) => {
            fetchingRef.current = false;
            if (e.name !== "AbortError") console.warn("[Map] Directions unavailable, showing estimated route");
          })
          .finally(() => clearTimeout(tid));
      }
    } else {
      setSource("route", []);
      setSource("route-dash", []);
      setAltRoutes([]);
      hasSolidRef.current = false;
      fetchingRef.current = false;
      lastFromRef.current = null;
      lastViaRef.current = "";
      lastToRef.current = "";
      stepsRef.current = [];
      stepIdxRef.current = -1;
      for (const cm of cameraMarkersRef.current) cm.marker.remove();
      cameraMarkersRef.current = [];
      routeCoordsRef.current = [];
      maxspeedsRef.current = [];
      cameraFetchGenRef.current++;
      onSpeedLimitRef.current?.(null);
      lastSpeedLimitRef.current = null;
      for (const mk of fuelMarkersRef.current) mk.remove();
      fuelMarkersRef.current = [];
      cumDistRef.current = [];
      cumDurRef.current = [];
      onRouteInfoRef.current?.(null as any);
      if (!hasInitCenteredRef.current) {
        hasInitCenteredRef.current = true;
        lastProgrammaticRef.current = Date.now() + 500;
        map.flyTo({ center: [center[1], center[0]], zoom, animate: false });
      }
    }

    baseZoomRef.current = map.getZoom();
    return () => { routeAbortRef.current?.abort(); };
  }, [centerKey, fromKey, mapReady, toKey, viaKey, zoom]);

  // — driver arrow marker + bearing + step advance —
  useEffect(() => {
    const map = mapRef.current;
    const mb = mbRef.current;
    if (!mapReady || !map || !mb) return;

    if (!driverPos) {
      driverMkRef.current?.remove();
      driverMkRef.current = null;
      driverElRef.current = null;
      prevPosRef.current = null;
      return;
    }

    // GPS supplies travel-direction bearing when moving; compass owns bearing in heading-up mode
    let currentBearing = bearingRef.current;
    let gpsMoved = false;
    if (prevPosRef.current) {
      const dist = haversineM(prevPosRef.current[0], prevPosRef.current[1], driverPos[0], driverPos[1]);
      if (dist > 2) {
        lastGpsMovedRef.current = Date.now();
        gpsMoved = true;
        currentBearing = calcBearing(prevPosRef.current[0], prevPosRef.current[1], driverPos[0], driverPos[1]);
        bearingRef.current = currentBearing;
      }
    }
    prevPosRef.current = driverPos;

    if (driverMkRef.current) {
      driverMkRef.current.setLngLat([driverPos[1], driverPos[0]]);
    } else {
      const { wrapper, inner } = navArrowEl(currentBearing);
      driverElRef.current = inner;
      driverMkRef.current = new mb.Marker({ element: wrapper, anchor: "center" })
        .setLngLat([driverPos[1], driverPos[0]])
        .addTo(map);
    }

    // Keep camera following driver position; when moving, GPS bearing is authoritative in heading-up mode
    if (followBearingRef.current) {
      if (driverElRef.current) driverElRef.current.style.transform = "rotate(0deg)";
      animateCamera(driverPos, gpsMoved ? currentBearing : null);
    } else {
      if (driverElRef.current) driverElRef.current.style.transform = `rotate(${currentBearing}deg)`;
      animateCamera(driverPos, 0);
    }

    const r = accuracyRef.current;
    const src = mapRef.current?.getSource("accuracy-circle") as any;
    if (src) {
      const radius = r && r > 0 ? Math.max(r, 60) : 60;
      src.setData({
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [circlePolygon(driverPos[0], driverPos[1], radius)],
        },
        properties: {},
      });
    }

    // GPS speed calculation
    const nowMs = Date.now();
    if (prevPosRef.current && prevTimeRef.current) {
      const timeSec = (nowMs - prevTimeRef.current) / 1000;
      if (timeSec > 0.4 && timeSec < 12) {
        const moveDist = haversineM(prevPosRef.current[0], prevPosRef.current[1], driverPos[0], driverPos[1]);
        if (moveDist > 0.5) onSpeedRef.current?.(Math.round((moveDist / timeSec) * 2.23694));
      }
    }
    prevTimeRef.current = nowMs;

    const steps = stepsRef.current;
    const idx = stepIdxRef.current;
    const next = idx + 1;
    if (steps.length > 0 && idx >= 0 && next < steps.length) {
      const [lng, lat] = steps[next].maneuver.location;
      const dist = haversineM(driverPos[0], driverPos[1], lat, lng);
      onDistanceChangeRef.current?.(dist);
      if (dist < ADVANCE_M) {
        stepIdxRef.current = next;
        onStepRef.current?.(buildStep(steps[next], steps[next + 1]));
        if (cumDistRef.current.length > next) {
          onRouteInfoRef.current?.({ remainingM: cumDistRef.current[next], remainingSecs: cumDurRef.current[next] });
        }
      }
    }

    // Find nearest route coord — shared by speed limit AND off-route detection
    const routeCoords = routeCoordsRef.current;
    let nearestRouteDist = Infinity;
    if (routeCoords.length > 0) {
      const base = Math.max(0, nearestCoordIdxRef.current - 5);
      const end = Math.min(routeCoords.length - 1, nearestCoordIdxRef.current + 30);
      let best = nearestCoordIdxRef.current;
      nearestRouteDist = haversineM(driverPos[0], driverPos[1], routeCoords[best][1], routeCoords[best][0]);
      for (let i = base; i <= end; i++) {
        const d = haversineM(driverPos[0], driverPos[1], routeCoords[i][1], routeCoords[i][0]);
        if (d < nearestRouteDist) { nearestRouteDist = d; best = i; }
      }
      nearestCoordIdxRef.current = best;
      // Try route annotation first; fall through to tile query if null
      let annotationSl: number | null = null;
      if (maxspeedsRef.current.length > 0) {
        annotationSl = maxspeedsRef.current[Math.min(best, maxspeedsRef.current.length - 1)] ?? null;
      }
      if (annotationSl !== null) {
        if (annotationSl !== lastSpeedLimitRef.current) {
          lastSpeedLimitRef.current = annotationSl;
          onSpeedLimitRef.current?.(annotationSl);
        }
      } else {
        // Annotation missing for this segment — query map tiles (throttled 5s)
        const now = Date.now();
        if (now - lastTileSpeedLimitQueryRef.current > 5000 && mapRef.current) {
          lastTileSpeedLimitQueryRef.current = now;
          try {
            const pt = mapRef.current.project([driverPos[1], driverPos[0]]);
            const features = mapRef.current.queryRenderedFeatures([pt.x, pt.y]) as any[];
            let sl: number | null = null;
            for (const f of features) {
              const ms = f.properties?.maxspeed;
              if (ms && typeof ms === "number" && ms > 0) {
                sl = Math.round(ms * 0.621371);
                break;
              }
            }
            if (sl !== lastSpeedLimitRef.current) {
              lastSpeedLimitRef.current = sl;
              onSpeedLimitRef.current?.(sl);
            }
          } catch {}
        }
      }
    } else {
      // No active route — query map tiles for speed limit at current position (throttled to 5s)
      const now = Date.now();
      if (now - lastTileSpeedLimitQueryRef.current > 5000 && mapRef.current) {
        lastTileSpeedLimitQueryRef.current = now;
        try {
          const pt = mapRef.current.project([driverPos[1], driverPos[0]]);
          const features = mapRef.current.queryRenderedFeatures([pt.x, pt.y]) as any[];
          let sl: number | null = null;
          for (const f of features) {
            const ms = f.properties?.maxspeed;
            if (ms && typeof ms === "number" && ms > 0) {
              sl = Math.round(ms * 0.621371);
              break;
            }
          }
          if (sl !== lastSpeedLimitRef.current) {
            lastSpeedLimitRef.current = sl;
            onSpeedLimitRef.current?.(sl);
          }
        } catch {}
      }
    }

    // Off-route detection: reroute if driver strays >80m from route
    if (hasSolidRef.current && !fetchingRef.current && nearestRouteDist > 80) {
      const now = Date.now();
      if (now - lastRerouteRef.current > 15_000) {
        lastRerouteRef.current = now;
        onReroutingRef.current?.();
        hasSolidRef.current = false;
        lastFromRef.current = null;
        lastToRef.current = "";
        lastViaRef.current = "";
      }
    }

    // Camera proximity warning — fire once per camera per 60s
    for (const cam of cameraMarkersRef.current) {
      const camDist = haversineM(driverPos[0], driverPos[1], cam.lat, cam.lng);
      const camKey = `${cam.lat.toFixed(4)},${cam.lng.toFixed(4)}`;
      if (camDist < 400 && !alertedCamerasRef.current.has(camKey)) {
        alertedCamerasRef.current.add(camKey);
        onCameraApproachRef.current?.();
        setTimeout(() => alertedCamerasRef.current.delete(camKey), 60_000);
      }
    }

    // Road snapping — snap marker to nearest road via Map Matching API
    posBufferRef.current = [...posBufferRef.current.slice(-4), driverPos];
    const snapNow = Date.now();
    const lastSnap = lastSnapRef.current;
    const movedSinceSnap = lastSnap
      ? haversineM(driverPos[0], driverPos[1], lastSnap.pos[0], lastSnap.pos[1])
      : 999;

    if (posBufferRef.current.length >= 2 && movedSinceSnap > 10 && (!lastSnap || snapNow - lastSnap.time > 3000)) {
      lastSnapRef.current = { pos: driverPos, time: snapNow };
      snapAbortRef.current?.abort();
      const ctrl = new AbortController();
      snapAbortRef.current = ctrl;
      const snapPos = driverPos;
      const pts = posBufferRef.current.map(([lat, lng]) => `${lng},${lat}`).join(";");

      fetch(
        `https://api.mapbox.com/matching/v5/mapbox/driving/${pts}?access_token=${TOKEN}`,
        { signal: ctrl.signal },
      )
        .then((r) => r.json())
        .then((data) => {
          if (!driverMkRef.current || data.code !== "Ok") return;
          // Discard stale snap if driver has moved far since request was sent
          if (prevPosRef.current && haversineM(snapPos[0], snapPos[1], prevPosRef.current[0], prevPosRef.current[1]) > 30) return;
          const tracepoints = data.tracepoints as Array<{ location: [number, number] } | null> | undefined;
          if (!tracepoints?.length) return;
          for (let i = tracepoints.length - 1; i >= 0; i--) {
            if (tracepoints[i]) { driverMkRef.current.setLngLat(tracepoints[i]!.location); break; }
          }
        })
        .catch(() => {});
    }
  }, [driverPosKey, mapReady]);

  // Redraw accuracy circle whenever accuracy value changes (independent of driverPos updates)
  useEffect(() => {
    if (!mapReady || !driverPos) return;
    const src = mapRef.current?.getSource("accuracy-circle") as any;
    if (!src) return;
    const r = accuracy ?? null;
    const radius = r && r > 0 ? Math.max(r, 60) : 60;
    src.setData({
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [circlePolygon(driverPos[0], driverPos[1], radius)],
      },
      properties: {},
    });
  }, [accuracy, driverPosKey, mapReady]);

  // Surge zone polygons
  useEffect(() => {
    if (!mapReady) return;
    const src = mapRef.current?.getSource("surge-zones") as any;
    if (!src) return;
    const features = (surgeZones ?? []).map((z) => ({
      type: "Feature" as const,
      geometry: { type: "Polygon" as const, coordinates: [circlePolygon(z.lat, z.lng, z.radiusM)] },
      properties: { label: z.label },
    }));
    src.setData({ type: "FeatureCollection", features });
  }, [surgeZones, mapReady]);

  return (
    <div
      ref={containerRef}
      className={`map-fill ${interactive ? "cursor-grab active:cursor-grabbing" : ""}`}
    />
  );
}
