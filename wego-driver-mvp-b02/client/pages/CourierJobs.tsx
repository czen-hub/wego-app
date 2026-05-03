import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Package, MapPin, ChevronLeft, Clock, Check, X } from "lucide-react";

const MOCK_JOBS = [
  {
    id: "c1",
    type: "Small Box",
    pickupName: "UPS Store - Santa Clara",
    pickupAddr: "2150 El Camino Real, Santa Clara",
    dropoffName: "Recipient: James R.",
    dropoffAddr: "456 University Ave, Palo Alto",
    payout: 12.32,
    coopFee: 1.68,
    riderPaid: 14.00,
    distance: "8.4 mi",
    eta: "22 min",
  },
  {
    id: "c2",
    type: "Letter / Envelope",
    pickupName: "FedEx Office - San Jose",
    pickupAddr: "240 Blossom Hill Rd, San Jose",
    dropoffName: "Recipient: Maria L.",
    dropoffAddr: "900 Market St, San Francisco",
    payout: 7.04,
    coopFee: 0.96,
    riderPaid: 8.00,
    distance: "46.2 mi",
    eta: "55 min",
  },
];

export default function CourierJobs() {
  const navigate = useNavigate();
  const [accepted, setAccepted] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);

  const visible = MOCK_JOBS.filter((j) => !dismissed.includes(j.id));

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
            <h1 className="text-2xl font-bold text-foreground">Courier Jobs</h1>
            <p className="text-xs text-muted-foreground">Package delivery requests near you</p>
          </div>
        </div>

        {accepted && (
          <div className="flex items-center gap-3 bg-primary/10 border border-primary/25 rounded-xl px-4 py-3">
            <Check size={16} className="text-primary flex-shrink-0" />
            <p className="text-sm font-semibold text-primary">Job accepted — navigate to pickup.</p>
          </div>
        )}

        {visible.length === 0 && !accepted && (
          <div className="text-center py-16 space-y-2">
            <Package size={40} className="text-muted-foreground mx-auto" />
            <p className="text-sm font-semibold text-foreground">No courier jobs right now</p>
            <p className="text-xs text-muted-foreground">New requests will appear here automatically.</p>
          </div>
        )}

        {visible.map((job) => (
          <div key={job.id} className="glass-card border border-border rounded-xl p-4 space-y-4">
            {/* Package type */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Package size={15} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">{job.type}</p>
                <p className="text-xs text-muted-foreground">{job.distance} · ~{job.eta}</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-lg font-bold text-primary">${job.payout.toFixed(2)}</p>
                <p className="text-[10px] text-muted-foreground">your take (88%)</p>
              </div>
            </div>

            {/* Route */}
            <div className="space-y-2 bg-background border border-border/50 rounded-xl px-3 py-3">
              <div className="flex gap-2 items-start">
                <MapPin size={14} className="text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Pickup</p>
                  <p className="text-xs font-semibold text-foreground">{job.pickupName}</p>
                  <p className="text-xs text-muted-foreground">{job.pickupAddr}</p>
                </div>
              </div>
              <div className="ml-3.5 h-4 border-l border-dashed border-border/60" />
              <div className="flex gap-2 items-start">
                <MapPin size={14} className="text-primary/60 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Dropoff</p>
                  <p className="text-xs font-semibold text-foreground">{job.dropoffName}</p>
                  <p className="text-xs text-muted-foreground">{job.dropoffAddr}</p>
                </div>
              </div>
            </div>

            {/* Fare breakdown */}
            <div className="flex justify-between text-xs text-muted-foreground px-1">
              <span>Customer paid ${job.riderPaid.toFixed(2)}</span>
              <span>WeGo fee ${job.coopFee.toFixed(2)}</span>
              <span className="text-primary font-semibold">You keep ${job.payout.toFixed(2)}</span>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDismissed((d) => [...d, job.id])}
                className="flex-1 py-3 rounded-xl bg-muted/20 border border-border text-muted-foreground font-semibold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
              >
                <X size={15} /> Decline
              </button>
              <button
                type="button"
                onClick={() => { setAccepted(job.id); setDismissed((d) => [...d, job.id]); }}
                className="flex-[2] py-3 rounded-xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-transform shadow-lg shadow-primary/30"
              >
                <Check size={15} /> Accept Job
              </button>
            </div>
          </div>
        ))}

        <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-3">
          <Clock size={14} className="text-muted-foreground flex-shrink-0" />
          <p className="text-xs text-muted-foreground">Courier jobs pay 88% of the delivery fee — same split as rides.</p>
        </div>
      </div>
    </div>
  );
}
