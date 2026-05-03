import { Component, lazy, Suspense, useEffect, useState } from "react";
import type { ReactNode } from "react";

const RouteMap = lazy(() => import("./RouteMap"));

interface ClientMapProps {
  from?: [number, number];
  to?: [number, number];
  center?: [number, number];
  zoom?: number;
  className?: string;
}

// Catches any runtime errors from Leaflet so the rest of the app keeps working
class MapErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false };
  static getDerivedStateFromError() { return { crashed: true }; }
  render() {
    return this.state.crashed ? this.props.fallback : this.props.children;
  }
}

export default function ClientMap({ className = "", ...rest }: ClientMapProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const placeholder = <div className={`${className} map-placeholder`} />;

  if (!mounted) return placeholder;

  return (
    <MapErrorBoundary fallback={placeholder}>
      <Suspense fallback={placeholder}>
        <RouteMap className={className} {...rest} />
      </Suspense>
    </MapErrorBoundary>
  );
}
