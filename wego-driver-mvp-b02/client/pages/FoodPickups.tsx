import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { UtensilsCrossed, MapPin, ChevronLeft, Clock, Check, X, ShoppingBag } from "lucide-react";

const MOCK_ORDERS = [
  {
    id: "f1",
    restaurant: "Pho Garden",
    restaurantAddr: "380 S Winchester Blvd, San Jose",
    items: ["Pho Bo (Large)", "Spring Rolls ×2", "Thai Iced Tea"],
    customerName: "Priya S.",
    dropoffAddr: "1200 Blossom Hill Rd, San Jose",
    deliveryFee: 2.99,
    driverPay: 2.63,
    coopFee: 0.36,
    distance: "3.1 mi",
    eta: "12 min",
  },
  {
    id: "f2",
    restaurant: "Tacos El Grullense",
    restaurantAddr: "3710 Story Rd, San Jose",
    items: ["Carne Asada Plate", "Al Pastor Tacos ×3", "Horchata"],
    customerName: "Carlos M.",
    dropoffAddr: "2580 Senter Rd, San Jose",
    deliveryFee: 1.99,
    driverPay: 1.75,
    coopFee: 0.24,
    distance: "1.8 mi",
    eta: "8 min",
  },
];

export default function FoodPickups() {
  const navigate = useNavigate();
  const [accepted, setAccepted] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);

  const visible = MOCK_ORDERS.filter((o) => !dismissed.includes(o.id));

  return (
    <div className="bg-background pt-4 px-4 pb-6 min-h-screen">
      <div className="max-w-2xl mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="w-9 h-9 rounded-full bg-card border border-border flex items-center justify-center"
          >
            <ChevronLeft size={18} className="text-foreground" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Food Pickups</h1>
            <p className="text-xs text-muted-foreground">Restaurant delivery orders near you</p>
          </div>
        </div>

        {accepted && (
          <div className="flex items-center gap-3 bg-primary/10 border border-primary/25 rounded-xl px-4 py-3">
            <Check size={16} className="text-primary flex-shrink-0" />
            <p className="text-sm font-semibold text-primary">Order accepted — head to the restaurant.</p>
          </div>
        )}

        {visible.length === 0 && !accepted && (
          <div className="text-center py-16 space-y-2">
            <UtensilsCrossed size={40} className="text-muted-foreground mx-auto" />
            <p className="text-sm font-semibold text-foreground">No food orders right now</p>
            <p className="text-xs text-muted-foreground">New orders will appear here automatically.</p>
          </div>
        )}

        {visible.map((order) => (
          <div key={order.id} className="glass-card border border-border rounded-xl p-4 space-y-4">
            {/* Restaurant */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                <UtensilsCrossed size={15} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">{order.restaurant}</p>
                <p className="text-xs text-muted-foreground">{order.distance} · ~{order.eta}</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-lg font-bold text-primary">${order.driverPay.toFixed(2)}</p>
                <p className="text-[10px] text-muted-foreground">your take (88%)</p>
              </div>
            </div>

            {/* Order items */}
            <div className="bg-background border border-border/50 rounded-xl px-3 py-3 space-y-1.5">
              <div className="flex items-center gap-1.5 mb-2">
                <ShoppingBag size={12} className="text-muted-foreground" />
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Order for {order.customerName}</p>
              </div>
              {order.items.map((item, i) => (
                <p key={i} className="text-xs text-foreground">• {item}</p>
              ))}
            </div>

            {/* Route */}
            <div className="space-y-2 bg-background border border-border/50 rounded-xl px-3 py-3">
              <div className="flex gap-2 items-start">
                <MapPin size={14} className="text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Pickup</p>
                  <p className="text-xs font-semibold text-foreground">{order.restaurant}</p>
                  <p className="text-xs text-muted-foreground">{order.restaurantAddr}</p>
                </div>
              </div>
              <div className="ml-3.5 h-4 border-l border-dashed border-border/60" />
              <div className="flex gap-2 items-start">
                <MapPin size={14} className="text-primary/60 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Dropoff</p>
                  <p className="text-xs font-semibold text-foreground">{order.customerName}</p>
                  <p className="text-xs text-muted-foreground">{order.dropoffAddr}</p>
                </div>
              </div>
            </div>

            {/* Fare breakdown */}
            <div className="flex justify-between text-xs text-muted-foreground px-1">
              <span>Delivery fee ${order.deliveryFee.toFixed(2)}</span>
              <span>WeGo ${order.coopFee.toFixed(2)}</span>
              <span className="text-primary font-semibold">You keep ${order.driverPay.toFixed(2)}</span>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDismissed((d) => [...d, order.id])}
                className="flex-1 py-3 rounded-xl bg-muted/20 border border-border text-muted-foreground font-semibold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
              >
                <X size={15} /> Decline
              </button>
              <button
                type="button"
                onClick={() => { setAccepted(order.id); setDismissed((d) => [...d, order.id]); }}
                className="flex-[2] py-3 rounded-xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-transform shadow-lg shadow-primary/30"
              >
                <Check size={15} /> Accept Order
              </button>
            </div>
          </div>
        ))}

        <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-3">
          <Clock size={14} className="text-muted-foreground flex-shrink-0" />
          <p className="text-xs text-muted-foreground">You earn 88% of every delivery fee — same cooperative split as rides.</p>
        </div>
      </div>
    </div>
  );
}
