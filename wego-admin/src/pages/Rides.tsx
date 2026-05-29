import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "@/firebase";
import type { Ride } from "@/types";
import { RefreshCw } from "lucide-react";

const ACTIVE_STATUSES = ["pending", "accepted", "arrived", "inProgress"] as const;

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending", accepted: "Accepted", arrived: "Arrived", inProgress: "In Progress",
};
const STATUS_COLOR: Record<string, string> = {
  pending:    "bg-amber-500/15 text-amber-700",
  accepted:   "bg-blue-500/15 text-blue-700",
  arrived:    "bg-indigo-500/15 text-indigo-700",
  inProgress: "bg-green-500/15 text-green-700",
};
const TYPE_LABEL: Record<string, string> = { ride: "Ride", courier: "Courier", food: "Food" };

export default function Rides() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    const q = query(
      collection(db, "rides"),
      where("status", "in", [...ACTIVE_STATUSES]),
      orderBy("requestedAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setRides(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Ride)));
      setLastUpdated(new Date());
    });
    return unsub;
  }, []);

  const filtered = filter === "all" ? rides : rides.filter((r) => r.status === filter);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Active Rides</h1>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
            <RefreshCw size={11} className="text-green-500" />
            Live · Updated {lastUpdated.toLocaleTimeString()}
          </p>
        </div>
        <span className="text-2xl font-bold text-primary">{rides.length}</span>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {["all", ...ACTIVE_STATUSES].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              filter === s
                ? "bg-primary text-white"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {s === "all" ? `All (${rides.length})` : `${STATUS_LABEL[s]} (${rides.filter(r => r.status === s).length})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <p className="text-muted-foreground text-sm">No active rides{filter !== "all" ? ` with status "${STATUS_LABEL[filter]}"` : ""}.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-secondary/30">
                <tr>
                  {["Passenger", "Driver", "Type", "Pickup", "Dropoff", "Fare", "Status", "Advanced"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((ride) => (
                  <tr key={ride.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">{ride.passengerName || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{ride.driverName || <span className="text-amber-600 font-medium">Unassigned</span>}</td>
                    <td className="px-4 py-3 text-muted-foreground">{TYPE_LABEL[ride.type] ?? ride.type}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[180px] truncate">{ride.pickupAddress}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[180px] truncate">{ride.dropoffAddress}</td>
                    <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">${ride.fare?.toFixed(2)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[ride.status] ?? "bg-muted text-muted-foreground"}`}>
                        {STATUS_LABEL[ride.status] ?? ride.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {ride.isAdvanced && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary">Reserve</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
