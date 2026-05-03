import { MapPin, Clock, Star, CheckCircle, X } from "lucide-react";

interface RideCardProps {
  riderName?: string;
  riderRating?: number;
  pickupLocation?: string;
  dropoffLocation?: string;
  riderPayment?: number;
  coopFee?: number;
  driverTake?: number;
  estimatedTime?: number;
  onAccept?: () => void;
  onDecline?: () => void;
}

const RideCard = ({
  riderName = "Sarah M.",
  riderRating = 4.87,
  pickupLocation = "123 Market St, SF",
  dropoffLocation = "456 Valencia St, SF",
  riderPayment = 40,
  coopFee = 4.8,
  driverTake = 35.2,
  estimatedTime = 8,
  onAccept,
  onDecline,
}: RideCardProps) => {
  return (
    <div className="glass-card p-5 space-y-4 border border-primary/20">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-sm font-bold text-foreground">
            {riderName.charAt(0)}
          </div>
          <div>
            <p className="font-semibold text-foreground">{riderName}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock size={12} />
              {estimatedTime} min away
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-card border border-border rounded-full px-2.5 py-1">
          <Star size={12} className="text-yellow-400 fill-yellow-400" />
          <span className="text-xs font-semibold text-foreground">{riderRating.toFixed(2)}</span>
        </div>
      </div>

      {/* Route */}
      <div className="space-y-3">
        <div className="flex gap-3">
          <MapPin size={18} className="text-primary flex-shrink-0 mt-1" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Pickup</p>
            <p className="text-sm font-medium text-foreground truncate">
              {pickupLocation}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <MapPin size={18} className="text-primary/60 flex-shrink-0 mt-1" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Dropoff</p>
            <p className="text-sm font-medium text-foreground truncate">
              {dropoffLocation}
            </p>
          </div>
        </div>
      </div>

      {/* Earnings Breakdown */}
      <div className="bg-card/50 p-3 rounded-lg space-y-2 border border-border/50">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Rider Pays:</span>
          <span className="font-semibold text-foreground">${riderPayment.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">WeGo Fee (12%):</span>
          <span className="font-semibold text-destructive">-${coopFee.toFixed(2)}</span>
        </div>
        <div className="border-t border-border/50 pt-2 flex justify-between text-sm">
          <span className="text-primary font-semibold">Your Take:</span>
          <span className="text-lg font-bold text-primary">${driverTake.toFixed(2)}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <button
          type="button"
          onClick={onDecline}
          className="py-3 px-4 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-destructive transition-all flex items-center justify-center gap-2"
        >
          <X size={18} />
          <span className="font-semibold">Decline</span>
        </button>
        <button
          type="button"
          onClick={onAccept}
          className="py-3 px-4 rounded-lg bg-gradient-to-r from-primary to-blue-600 text-foreground font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2"
        >
          <CheckCircle size={18} />
          <span>Accept</span>
        </button>
      </div>
    </div>
  );
};

export default RideCard;
