import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;
const REFETCH_M = 150;

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

function navArrowEl(bearing: number): { wrapper: HTMLDivElement; inner: HTMLDivElement } {
  const wrapper = document.createElement("div");
  wrapper.style.cssText = `width:22px;height:22px;`;
  const inner = document.createElement("div");
  inner.style.cssText = `width:22px;height:22px;display:flex;align-items:center;justify-content:center;transform:rotate(${bearing}deg);transition:transform 0.4s ease;`;
  inner.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 36 36" style="filter:drop-shadow(0 3px 8px rgba(245,158,11,0.55))"><polygon points="18,3 26,30 18,23 10,30" fill="#F59E0B" stroke="white" stroke-width="2" stroke-linejoin="round"/></svg>`;
  wrapper.appendChild(inner);
  return { wrapper, inner };
}

interface ClientMapProps {
  from?: [number, number];
  to?: [number, number];
  via?: [number, number];
  viaPoints?: [number, number][];
  driverPos?: [number, number];
  accuracy?: number;
  center?: [number, number];
  zoom?: number;
  className?: string;
  interactive?: boolean;
  zoomAdjust?: number;
  forceResetToken?: number;
  followBearing?: boolean;
  onCenterChange?: (coords: [number, number]) => void;
  onClickLocation?: (coords: [number, number]) => void;
}

export default function ClientMap({
  className = "",
  from,
  to,
  via,
  viaPoints,
  driverPos,
  accuracy,
  center = [37.7749, -122.4194],
  zoom = 13,
  interactive = false,
  zoomAdjust = 0,
  forceResetToken,
  followBearing = false,
  onCenterChange,
  onClickLocation,
}: ClientMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const mbRef = useRef<any>(null);
  const fromMkRef = useRef<any>(null);
  const toMkRef = useRef<any>(null);
  const viaMksRef = useRef<any[]>([]);
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
  const storedHeading = parseFloat(localStorage.getItem("wego_heading") ?? "0") || 0;
  const bearingRef = useRef<number>(storedHeading);
  const compassHeadingRef = useRef<number | null>(null);
  const lastGpsMovedRef = useRef<number>(0);
  const followBearingRef = useRef(followBearing);
  const [mapReady, setMapReady] = useState(false);
  const centerRef = useRef<[number, number]>(center);
  const zoomRef = useRef<number>(zoom);
  const onCenterChangeRef = useRef(onCenterChange);
  const onClickRef = useRef(onClickLocation);
  const accuracyRef = useRef<number | null>(accuracy ?? null);
  const posBufferRef = useRef<[number, number][]>([]);
  const snapAbortRef = useRef<AbortController | null>(null);
  const lastSnapRef = useRef<{ pos: [number, number]; time: number } | null>(null);

  const isInteractingRef = useRef(false);
  const isTrackingRef = useRef(true);
  const lastCameraUpdateRef = useRef<number>(0);
  const lastProgrammaticRef = useRef(0);

  useEffect(() => { onCenterChangeRef.current = onCenterChange; }, [onCenterChange]);
  useEffect(() => { onClickRef.current = onClickLocation; }, [onClickLocation]);
  useEffect(() => { accuracyRef.current = accuracy ?? null; }, [accuracy]);
  useEffect(() => { centerRef.current = center; }, [center]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  // Smoothly ease/animate the camera to the new driver position and bearing
  const animateCamera = (targetCenter: [number, number] | null, targetBearing: number | null) => {
    const map = mapRef.current;
    if (!map) return;
    if (isInteractingRef.current || !isTrackingRef.current) return;

    const options: any = {
      pitch: 0,
      duration: 1000,
      essential: true,
    };

    if (targetCenter) {
      options.center = [targetCenter[1], targetCenter[0]];
    }

    if (targetBearing !== null) {
      options.bearing = targetBearing;
    }

    const now = Date.now();
    if (now - lastCameraUpdateRef.current > 100) {
      lastCameraUpdateRef.current = now;
      lastProgrammaticRef.current = now + 200;
      map.easeTo(options);
    }
  };

  // Track map interaction to pause programmatic transitions when user is touching/panning
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    const startInteract = () => {
      if (Date.now() < lastProgrammaticRef.current) return;
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
      map.easeTo({ bearing: 0, pitch: 0, duration: 600 });
    }
  }, [followBearing, mapReady]);

  // — device compass — always listen to both events; absolute takes priority over relative
  useEffect(() => {
    let lastAbsTime = 0;

    function processHeading(heading: number) {
      compassHeadingRef.current = heading;
      localStorage.setItem("wego_heading", String(Math.round(heading)));
      
      if (followBearingRef.current) {
        bearingRef.current = heading;
        if (driverElRef.current) driverElRef.current.style.transform = "rotate(0deg)";
        isTrackingRef.current = true;
        animateCamera(null, heading);
      } else {
        if (Date.now() - lastGpsMovedRef.current > 3000) {
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
      for (const m of viaMksRef.current) m.remove();
      driverMkRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
      mbRef.current = null;
      fromMkRef.current = null;
      toMkRef.current = null;
      viaMksRef.current = [];
      driverMkRef.current = null;
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
      zoom: zoomRef.current,
      bearing: followBearingRef.current ? bearingRef.current : 0,
      pitch: 0,
      duration: 2000,
      essential: true,
    });
  }, [forceResetToken, mapReady]);

  // — zoomAdjust —
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    map.setZoom(baseZoomRef.current + zoomAdjust);
  }, [zoomAdjust, mapReady]);

  const effectiveVia = (viaPoints && viaPoints.length > 0) ? viaPoints : via ? [via] : [];
  const fromKey = from ? `${from[0].toFixed(5)},${from[1].toFixed(5)}` : "";
  const toKey = to ? `${to[0].toFixed(5)},${to[1].toFixed(5)}` : "";
  const viaKey = effectiveVia.map((p) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`).join("|");
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

    // destination marker
    toMkRef.current?.remove();
    toMkRef.current = null;
    if (to) {
      toMkRef.current = new mb.Marker({ element: dotEl("white", "#1e293b") })
        .setLngLat([to[1], to[0]])
        .addTo(map);
    }

    // via markers (supports multiple)
    for (const m of viaMksRef.current) m.remove();
    viaMksRef.current = [];
    for (const pt of effectiveVia) {
      viaMksRef.current.push(
        new mb.Marker({ element: dotEl("#f59e0b", "white", "rgba(245,158,11,0.6)") })
          .setLngLat([pt[1], pt[0]])
          .addTo(map),
      );
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

        // dashed placeholder through all waypoints
        const allPts = [from, ...effectiveVia, to];
        const ptsLngLat = allPts.map(([lat, lng]) => [lng, lat]);
        setSource("route", []);
        setSource("route-dash", ptsLngLat);

        const same = Math.abs(from[0] - to[0]) < 0.001 && Math.abs(from[1] - to[1]) < 0.001;
        if (same) {
          map.flyTo({ center: [from[1], from[0]], zoom, animate: false });
        } else {
          const bounds = new mb.LngLatBounds();
          ptsLngLat.forEach(([lng, lat]) => bounds.extend([lng, lat]));
          lastProgrammaticRef.current = Date.now() + 500;
          map.fitBounds(bounds, { padding: 48, maxZoom: 14, animate: false });
        }

        routeAbortRef.current?.abort();
        const ctrl = new AbortController();
        routeAbortRef.current = ctrl;
        const tid = setTimeout(() => { if (!hasSolidRef.current) ctrl.abort(); }, 8000);

        const wpts = allPts.map(([lat, lng]) => `${lng},${lat}`).join(";");

        fetch(
          `https://api.mapbox.com/directions/v5/mapbox/driving/${wpts}?geometries=geojson&overview=full&access_token=${TOKEN}`,
          { signal: ctrl.signal },
        )
          .then((r) => r.json())
          .then((data) => {
            fetchingRef.current = false;
            const route = data.routes?.[0];
            if (!route || !mapRef.current) return;

            setSource("route", route.geometry.coordinates);
            setSource("route-dash", []);

            const bounds = new mb.LngLatBounds();
            (route.geometry.coordinates as [number, number][]).forEach((c) => bounds.extend(c));
            lastProgrammaticRef.current = Date.now() + 500;
            mapRef.current.fitBounds(bounds, { padding: 48, maxZoom: 14, animate: false });
            hasSolidRef.current = true;
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
      hasSolidRef.current = false;
      fetchingRef.current = false;
      lastFromRef.current = null;
      lastViaRef.current = "";
      lastToRef.current = "";
      // Only snap to GPS on the very first fix; subsequent drift updates don't re-center
      if (!hasInitCenteredRef.current) {
        hasInitCenteredRef.current = true;
        map.flyTo({ center: [center[1], center[0]], zoom, animate: false });
      }
    }

    baseZoomRef.current = map.getZoom();
    return () => { routeAbortRef.current?.abort(); };
  }, [centerKey, fromKey, mapReady, toKey, viaKey, zoom]);

  // — driver arrow marker + bearing —
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

    // Update bearing from GPS movement direction; compass takes over when stationary or heading-up is on
    let currentBearing = bearingRef.current;
    if (prevPosRef.current) {
      const dist = haversineM(prevPosRef.current[0], prevPosRef.current[1], driverPos[0], driverPos[1]);
      if (dist > 2) {
        lastGpsMovedRef.current = Date.now();
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

    // Smoothly ease/animate the camera to the new driver position and bearing
    if (followBearingRef.current) {
      if (driverElRef.current) driverElRef.current.style.transform = "rotate(0deg)";
      animateCamera(driverPos, currentBearing);
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
          // Discard stale snap if position has moved far since request was sent
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

  return (
    <div
      ref={containerRef}
      className={`map-fill ${interactive ? "cursor-grab active:cursor-grabbing" : ""}`}
    />
  );
}
