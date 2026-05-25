import { Clock, MapPin, Package, UtensilsCrossed, CheckCircle, X } from "lucide-react";
import type { Ride } from "@/lib/db";

export function CourierCard({ ride, onAccept, onDecline }: { ride: Ride; onAccept: () => void; onDecline: () => void }) {
  return (
    <div className="glass-card p-5 space-y-4 border border-primary/20">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Package size={18} className="text-primary" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Package Delivery</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock size={12} /> {ride.estimatedMinutes} min to pickup</p>
          </div>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary uppercase tracking-wide">Courier</span>
      </div>
      <div className="space-y-3">
        <div className="flex gap-3">
          <MapPin size={16} className="text-primary flex-shrink-0 mt-1" />
          <div className="flex-1 min-w-0"><p className="text-xs text-muted-foreground">Pickup</p><p className="text-sm font-medium text-foreground truncate">{ride.pickupAddress}</p></div>
        </div>
        <div className="flex gap-3">
          <MapPin size={16} className="text-primary/60 flex-shrink-0 mt-1" />
          <div className="flex-1 min-w-0"><p className="text-xs text-muted-foreground">Dropoff</p><p className="text-sm font-medium text-foreground truncate">{ride.dropoffAddress}</p></div>
        </div>
      </div>
      <div className="bg-card/50 p-3 rounded-lg space-y-2 border border-border/50">
        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Customer Pays:</span><span className="font-semibold text-foreground">${ride.fare.toFixed(2)}</span></div>
        <div className="flex justify-between text-sm"><span className="text-muted-foreground">WeGo Fee (12%):</span><span className="font-semibold text-destructive">-${ride.coopFee.toFixed(2)}</span></div>
        <div className="border-t border-border/50 pt-2 flex justify-between text-sm"><span className="text-primary font-semibold">Your Take:</span><span className="text-lg font-bold text-primary">${ride.driverTake.toFixed(2)}</span></div>
      </div>
      <div className="grid grid-cols-2 gap-3 pt-2">
        <button type="button" onClick={onDecline} className="py-3 px-4 rounded-lg border border-border text-muted-foreground hover:border-destructive transition-all flex items-center justify-center gap-2"><X size={18} /><span className="font-semibold">Decline</span></button>
        <button type="button" onClick={onAccept} className="py-3 px-4 rounded-lg bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2"><CheckCircle size={18} /><span>Accept</span></button>
      </div>
    </div>
  );
}

export function FoodCard({ ride, onAccept, onDecline }: { ride: Ride; onAccept: () => void; onDecline: () => void }) {
  return (
    <div className="glass-card p-5 space-y-4 border border-primary/20">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
            <UtensilsCrossed size={18} className="text-primary" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Food Delivery</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock size={12} /> {ride.estimatedMinutes} min to restaurant</p>
          </div>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary uppercase tracking-wide">Food</span>
      </div>
      <div className="space-y-3">
        <div className="flex gap-3">
          <MapPin size={16} className="text-primary flex-shrink-0 mt-1" />
          <div className="flex-1 min-w-0"><p className="text-xs text-muted-foreground">Pickup</p><p className="text-sm font-medium text-foreground truncate">{ride.pickupAddress}</p></div>
        </div>
        <div className="flex gap-3">
          <MapPin size={16} className="text-primary/60 flex-shrink-0 mt-1" />
          <div className="flex-1 min-w-0"><p className="text-xs text-muted-foreground">Dropoff — {ride.passengerName}</p><p className="text-sm font-medium text-foreground truncate">{ride.dropoffAddress}</p></div>
        </div>
      </div>
      <div className="bg-card/50 p-3 rounded-lg space-y-2 border border-border/50">
        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Delivery Fee:</span><span className="font-semibold text-foreground">${ride.fare.toFixed(2)}</span></div>
        <div className="flex justify-between text-sm"><span className="text-muted-foreground">WeGo Fee (12%):</span><span className="font-semibold text-destructive">-${ride.coopFee.toFixed(2)}</span></div>
        <div className="border-t border-border/50 pt-2 flex justify-between text-sm"><span className="text-primary font-semibold">Your Take:</span><span className="text-lg font-bold text-primary">${ride.driverTake.toFixed(2)}</span></div>
      </div>
      <div className="grid grid-cols-2 gap-3 pt-2">
        <button type="button" onClick={onDecline} className="py-3 px-4 rounded-lg border border-border text-muted-foreground hover:border-destructive transition-all flex items-center justify-center gap-2"><X size={18} /><span className="font-semibold">Decline</span></button>
        <button type="button" onClick={onAccept} className="py-3 px-4 rounded-lg bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2"><CheckCircle size={18} /><span>Accept</span></button>
      </div>
    </div>
  );
}
