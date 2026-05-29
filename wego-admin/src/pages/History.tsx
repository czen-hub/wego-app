import { useEffect, useState } from "react";
import { collection, query, where, getDocs, orderBy, limit, Timestamp } from "firebase/firestore";
import { db } from "@/firebase";
import type { Ride } from "@/types";
import { Search } from "lucide-react";

function tsToDate(ts: Timestamp | null): Date | null {
  if (!ts) return null;
  return ts instanceof Timestamp ? ts.toDate() : new Date((ts as { seconds: number }).seconds * 1000);
}

const STATUS_COLOR: Record<string, string> = {
  completed: "bg-primary/15 text-primary",
  cancelled: "bg-muted text-muted-foreground",
};

export default function History() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "cancelled">("all");

  useEffect(() => {
    const load = async () => {
      const q = query(
        collection(db, "rides"),
        where("status", "in", ["completed", "cancelled"]),
        orderBy("requestedAt", "desc"),
        limit(500)
      );
      const snap = await getDocs(q);
      setRides(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Ride)));
      setLoading(false);
    };
    load().catch(console.error);
  }, []);

  const filtered = rides.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        r.passengerName?.toLowerCase().includes(q) ||
        r.driverName?.toLowerCase().includes(q) ||
        r.pickupAddress?.toLowerCase().includes(q) ||
        r.dropoffAddress?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const completedCount = rides.filter((r) => r.status === "completed").length;
  const cancelledCount = rides.filter((r) => r.status === "cancelled").length;
  const totalRevenue   = rides.filter((r) => r.status === "completed").reduce((s, r) => s + (r.fare ?? 0), 0);

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Ride History</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {completedCount} completed · {cancelledCount} cancelled · ${totalRevenue.toFixed(2)} total revenue
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-48 max-w-80">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search passenger, driver, address…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-xl text-sm focus:outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "completed", "cancelled"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors capitalize ${
                statusFilter === s ? "bg-primary text-white" : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border text-xs text-muted-foreground font-medium">
            Showing {filtered.length} of {rides.length} rides
          </div>
          {filtered.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-muted-foreground">No rides match your filter.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-secondary/30">
                  <tr>
                    {["Date", "Passenger", "Driver", "Pickup", "Dropoff", "Fare", "Driver Take", "Status"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((ride) => {
                    const date = tsToDate(ride.requestedAt);
                    return (
                      <tr key={ride.id} className="hover:bg-secondary/30 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                          {date?.toLocaleDateString("en-US", { month: "short", day: "numeric" }) ?? "—"}
                          <br />
                          <span className="text-[10px]">{date?.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
                        </td>
                        <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">{ride.passengerName || "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{ride.driverName || "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground max-w-[150px] truncate">{ride.pickupAddress}</td>
                        <td className="px-4 py-3 text-muted-foreground max-w-[150px] truncate">{ride.dropoffAddress}</td>
                        <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">${ride.fare?.toFixed(2)}</td>
                        <td className="px-4 py-3 text-foreground whitespace-nowrap">${ride.driverTake?.toFixed(2)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[ride.status] ?? "bg-muted text-muted-foreground"}`}>
                            {ride.status.charAt(0).toUpperCase() + ride.status.slice(1)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
