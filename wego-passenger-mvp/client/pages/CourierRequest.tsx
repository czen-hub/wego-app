import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, MapPin, Package, Shield, Check, Info } from "lucide-react";
import ClientMap from "@/components/ClientMap";

const WEGO_FEE_PCT = 0.12;

const PACKAGE_TYPES = [
  { id: "envelope", label: "Letter / Envelope", desc: "Up to 1 lb", emoji: "✉️", fare: 8.00 },
  { id: "small",    label: "Small Box",         desc: "Up to 10 lbs", emoji: "📦", fare: 14.00 },
  { id: "large",    label: "Large Box",         desc: "Up to 30 lbs", emoji: "🗃️", fare: 20.00 },
  { id: "fragile",  label: "Fragile Item",      desc: "Special handling", emoji: "🫧", fare: 18.00 },
];

export default function CourierRequest() {
  const navigate = useNavigate();
  const [dropoff, setDropoff] = useState("");
  const [packageId, setPackageId] = useState("small");
  const [instructions, setInstructions] = useState("");

  const pkg = PACKAGE_TYPES.find((p) => p.id === packageId)!;
  const fare = pkg.fare;
  const driverTake = fare * (1 - WEGO_FEE_PCT);
  const coopFee = fare * WEGO_FEE_PCT;

  const handleConfirm = () => {
    navigate("/ride", {
      state: {
        destination: dropoff || "Dropoff Address",
        fare,
        driverTake,
        coopFee,
        serviceType: "courier",
        packageType: pkg.label,
      },
    });
  };

  return (
    <div className="min-h-full bg-background flex flex-col">
      {/* Map header */}
      <div className="relative h-36 flex-shrink-0">
        <ClientMap center={[37.7749, -122.4194]} zoom={13} className="absolute inset-0" />
        <button type="button" onClick={() => navigate("/")} aria-label="Back to home"
          className="absolute top-4 left-4 z-20 w-9 h-9 rounded-full bg-card/80 backdrop-blur-sm border border-border flex items-center justify-center">
          <ChevronLeft size={18} className="text-foreground" />
        </button>
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded-full bg-card/80 backdrop-blur-sm border border-border">
          <p className="text-xs font-bold text-foreground tracking-wide">Courier Delivery</p>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-b from-transparent to-background pointer-events-none z-10" />
      </div>

      <div className="flex-1 px-4 pt-2 pb-4 space-y-4">

        {/* Addresses */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex gap-3 items-start">
            <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-1">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <div className="w-px h-8 bg-border" />
              <div className="w-3 h-3 rounded-full border-2 border-foreground" />
            </div>
            <div className="space-y-3 flex-1 min-w-0">
              <div>
                <p className="text-xs text-muted-foreground">Pickup</p>
                <p className="text-sm font-semibold text-foreground">Current Location</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Dropoff</p>
                <input
                  type="text"
                  placeholder="Enter delivery address"
                  value={dropoff}
                  onChange={(e) => setDropoff(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Package type */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">Package Type</p>
          <div className="grid grid-cols-2 gap-2">
            {PACKAGE_TYPES.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPackageId(p.id)}
                className={`flex items-start gap-2 p-3 rounded-xl border text-left transition-colors active:scale-95 ${packageId === p.id ? "border-primary bg-primary/5" : "border-border bg-card"}`}
              >
                <span className="text-xl flex-shrink-0">{p.emoji}</span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground leading-tight">{p.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{p.desc}</p>
                  <p className="text-sm font-bold text-primary mt-1">${p.fare.toFixed(2)}</p>
                </div>
                {packageId === p.id && <Check size={13} className="text-primary ml-auto flex-shrink-0 mt-0.5" />}
              </button>
            ))}
          </div>
        </div>

        {/* Special instructions */}
        <div className="space-y-1.5">
          <label htmlFor="courier-instructions" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
            Special Instructions <span className="normal-case font-normal">(optional)</span>
          </label>
          <textarea
            id="courier-instructions"
            rows={2}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="e.g. Leave at front desk, handle with care..."
            className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary resize-none"
          />
        </div>

        {/* Fare card */}
        <div className="bg-card border border-primary/20 rounded-xl p-4 space-y-3 bg-primary/5">
          <div className="flex items-start justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Delivery Fee</p>
            <div className="flex items-center gap-1 text-xs text-primary">
              <Shield size={11} />
              <span className="font-semibold">No Surge</span>
            </div>
          </div>
          <p className="text-4xl font-bold text-foreground">${fare.toFixed(2)}</p>
          <div className="space-y-2 border-t border-border/40 pt-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Info size={10} /> Where your money goes
            </p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                  <span className="text-sm text-foreground font-medium">Driver earns</span>
                  <span className="text-xs text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded">88%</span>
                </div>
                <span className="text-sm font-bold text-primary">${driverTake.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-muted-foreground flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">WeGo Cooperative</span>
                  <span className="text-xs text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded">12%</span>
                </div>
                <span className="text-sm font-medium text-muted-foreground">${coopFee.toFixed(2)}</span>
              </div>
            </div>
            <div className="w-full h-2 bg-muted/30 rounded-full overflow-hidden mt-1">
              <div className="h-full w-[88%] bg-primary rounded-full" />
            </div>
          </div>
        </div>

        {/* Package summary */}
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
            <Package size={18} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{pkg.emoji} {pkg.label}</p>
            <p className="text-xs text-muted-foreground">{pkg.desc} · Driver ~6 min away</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleConfirm}
          className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-lg active:scale-95 transition-transform shadow-lg shadow-primary/30"
        >
          Confirm Pickup — ${fare.toFixed(2)}
        </button>
        <p className="text-xs text-center text-muted-foreground">No cancellation fee if cancelled within 2 minutes</p>
      </div>
    </div>
  );
}
