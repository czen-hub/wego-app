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
    <div className="glass-card px-4 py-3 space-y-2.5 border border-primary/20">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
            {riderName.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-bold text-foreground leading-tight">{riderName}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock size={11} />
              {estimatedTime} min away
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-card border border-border rounded-full px-2 py-0.5">
          <Star size={11} className="text-yellow-400 fill-yellow-400" />
          <span className="text-xs font-semibold text-foreground">{riderRating.toFixed(2)}</span>
        </div>
      </div>

      {/* Route — compact two-line */}
      <div className="space-y-1.5">
        <div className="flex gap-2 items-start">
          <MapPin size={14} className="text-primary flex-shrink-0 mt-0.5" />
          <p className="text-xs text-foreground truncate flex-1">
            <span className="text-muted-foreground mr-1">Pickup</span>{pickupLocation}
          </p>
        </div>
        <div className="flex gap-2 items-start">
          <MapPin size={14} className="text-primary/60 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-foreground truncate flex-1">
            <span className="text-muted-foreground mr-1">Drop</span>{dropoffLocation}
          </p>
        </div>
      </div>

      {/* Earnings — single row */}
      <div className="flex items-center justify-between bg-card/50 px-3 py-2 rounded-lg border border-border/50">
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground">Pays</p>
          <p className="text-sm font-bold text-foreground">${riderPayment.toFixed(2)}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground">Fee</p>
          <p className="text-sm font-bold text-destructive">-${coopFee.toFixed(2)}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground">Your Take</p>
          <p className="text-base font-black text-primary">${driverTake.toFixed(2)}</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onDecline}
          className="py-2.5 px-3 rounded-xl border border-border text-muted-foreground active:scale-95 transition-all flex items-center justify-center gap-1.5"
        >
          <X size={15} />
          <span className="text-sm font-semibold">Decline</span>
        </button>
        <button
          type="button"
          onClick={onAccept}
          className="py-2.5 px-3 rounded-xl bg-primary text-white font-bold active:scale-95 transition-all flex items-center justify-center gap-1.5"
        >
          <CheckCircle size={15} />
          <span className="text-sm">Accept</span>
        </button>
      </div>
    </div>
  );
};

export default RideCard;
