import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const pickupIcon = L.divIcon({
  className: "",
  html: '<div style="width:14px;height:14px;border-radius:50%;background:#0047ff;border:3px solid white;box-shadow:0 2px 8px rgba(0,71,255,0.6)"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const dropoffIcon = L.divIcon({
  className: "",
  html: '<div style="width:14px;height:14px;border-radius:50%;background:white;border:3px solid #1e293b;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function InvalidateSize() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize({ animate: false }), 100);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

function FitRoute({ from, to }: { from: [number, number]; to: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    const same = Math.abs(from[0] - to[0]) < 0.001 && Math.abs(from[1] - to[1]) < 0.001;
    if (same) {
      map.setView(from, 13, { animate: false });
    } else {
      map.fitBounds([from, to], { padding: [48, 48], maxZoom: 14, animate: false });
    }
  }, [map, from[0], from[1], to[0], to[1]]);
  return null;
}

interface RouteMapProps {
  from?: [number, number];
  to?: [number, number];
  center?: [number, number];
  zoom?: number;
  className?: string;
}

export default function RouteMap({
  from,
  to,
  center = [37.7749, -122.4194],
  zoom = 13,
  className = "",
}: RouteMapProps) {
  const hasRoute = !!from && !!to;
  const initialCenter = hasRoute
    ? ([(from[0] + to[0]) / 2, (from[1] + to[1]) / 2] as [number, number])
    : center;

  return (
    <div className={className}>
      <MapContainer
        center={initialCenter}
        zoom={zoom}
        className="leaflet-fill"
        zoomControl={false}
        attributionControl={false}
        scrollWheelZoom={false}
        dragging={false}
        touchZoom={false}
        doubleClickZoom={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          subdomains="abc"
          maxZoom={19}
        />
        <InvalidateSize />
        {from && <Marker position={from} icon={pickupIcon} />}
        {to && <Marker position={to} icon={dropoffIcon} />}
        {hasRoute && (
          <>
            <Polyline
              positions={[from, to]}
              pathOptions={{ color: "#0047ff", weight: 3, opacity: 0.75, dashArray: "8,6" }}
            />
            <FitRoute from={from} to={to} />
          </>
        )}
      </MapContainer>
    </div>
  );
}
