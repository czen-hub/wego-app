import { useEffect, useState } from "react";
import { collection, query, where, getDocs, orderBy, limit, Timestamp } from "firebase/firestore";
import { db } from "@/firebase";
import type { Ride, WithdrawalRequest } from "@/types";
import { Car, DollarSign, Users, AlertTriangle, Banknote, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

function StatCard({
  icon, label, value, sub, color = "primary",
}: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color?: string;
}) {
  const colors: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    green: "bg-green-500/10 text-green-600",
    amber: "bg-amber-500/10 text-amber-600",
    red: "bg-red-500/10 text-red-600",
  };
  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex items-start gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-sm font-medium text-foreground mt-0.5">{label}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function statusBadge(status: Ride["status"]) {
  const map: Record<string, string> = {
    pending:    "bg-amber-500/15 text-amber-700",
    accepted:   "bg-blue-500/15 text-blue-700",
    arrived:    "bg-indigo-500/15 text-indigo-700",
    inProgress: "bg-green-500/15 text-green-700",
    completed:  "bg-primary/15 text-primary",
    cancelled:  "bg-muted text-muted-foreground",
  };
  const labels: Record<string, string> = {
    pending: "Pending", accepted: "Accepted", arrived: "Arrived",
    inProgress: "In Progress", completed: "Completed", cancelled: "Cancelled",
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${map[status] ?? "bg-muted text-muted-foreground"}`}>
      {labels[status] ?? status}
    </span>
  );
}

function tsToDate(ts: Timestamp | null): Date | null {
  if (!ts) return null;
  return ts instanceof Timestamp ? ts.toDate() : new Date((ts as { seconds: number }).seconds * 1000);
}

export default function Overview() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [drivers, setDrivers] = useState<number>(0);
  const [pendingPayouts, setPendingPayouts] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [ridesSnap, driversSnap, payoutsSnap] = await Promise.all([
        getDocs(query(collection(db, "rides"), orderBy("requestedAt", "desc"), limit(200))),
        getDocs(collection(db, "drivers")),
        getDocs(query(collection(db, "withdrawalRequests"), where("status", "==", "pending"))),
      ]);

      const rideList = ridesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Ride));
      setRides(rideList);
      setDrivers(driversSnap.size);
      setPendingPayouts(payoutsSnap.docs.reduce((s, d) => s + ((d.data() as WithdrawalRequest).amount ?? 0), 0));
      setLoading(false);
    };
    load().catch(console.error);
  }, []);

  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const weekStart  = new Date(now); weekStart.setDate(now.getDate() - 7); weekStart.setHours(0, 0, 0, 0);

  const todayRides    = rides.filter((r) => { const d = tsToDate(r.requestedAt); return d && d >= todayStart; });
  const weekRides     = rides.filter((r) => { const d = tsToDate(r.requestedAt); return d && d >= weekStart; });
  const activeRides   = rides.filter((r) => ["pending","accepted","arrived","inProgress"].includes(r.status));
  const disputedRides = rides.filter((r) => r.disputed || r.chargeBlocked);
  const todayRevenue  = todayRides.filter((r) => r.status === "completed").reduce((s, r) => s + (r.fare ?? 0), 0);
  const weekRevenue   = weekRides.filter((r) => r.status === "completed").reduce((s, r) => s + (r.fare ?? 0), 0);

  // 7-day chart
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now); d.setDate(now.getDate() - (6 - i)); d.setHours(0, 0, 0, 0);
    const next = new Date(d); next.setDate(next.getDate() + 1);
    const dayRides = rides.filter((r) => {
      const t = tsToDate(r.requestedAt);
      return t && t >= d && t < next && r.status === "completed";
    });
    return {
      label: i === 6 ? "Today" : d.toLocaleDateString("en-US", { weekday: "short" }),
      revenue: parseFloat(dayRides.reduce((s, r) => s + (r.fare ?? 0), 0).toFixed(2)),
      isToday: i === 6,
    };
  });

  const recentActive = [...activeRides].slice(0, 10);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-96">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Overview</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard icon={<Car size={20} />}         label="Active Now"      value={activeRides.length}         color="primary" />
        <StatCard icon={<DollarSign size={20} />}  label="Today Revenue"   value={`$${todayRevenue.toFixed(2)}`} color="green" sub={`${todayRides.filter(r => r.status === "completed").length} rides`} />
        <StatCard icon={<TrendingUp size={20} />}  label="Week Revenue"    value={`$${weekRevenue.toFixed(2)}`}  color="green" sub={`${weekRides.filter(r => r.status === "completed").length} rides`} />
        <StatCard icon={<Users size={20} />}       label="Drivers"         value={drivers}                    color="primary" />
        <StatCard icon={<AlertTriangle size={20} />} label="Open Disputes" value={disputedRides.length}       color="red" />
        <StatCard icon={<Banknote size={20} />}    label="Payout Queue"    value={`$${pendingPayouts.toFixed(2)}`} color="amber" />
      </div>

      {/* Revenue chart */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">Daily Revenue — Last 7 Days</h2>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} barSize={28}>
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
            <Tooltip
              formatter={(v: number) => [`$${v.toFixed(2)}`, "Revenue"]}
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
            />
            <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.isToday ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.35)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Active rides table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Active Rides ({activeRides.length})</h2>
        </div>
        {recentActive.length === 0 ? (
          <p className="px-6 py-8 text-sm text-muted-foreground text-center">No active rides right now.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr className="text-left">
                  {["Passenger", "Driver", "Pickup", "Fare", "Status"].map((h) => (
                    <th key={h} className="px-5 py-3 text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentActive.map((ride) => (
                  <tr key={ride.id} className="hover:bg-secondary/40 transition-colors">
                    <td className="px-5 py-3 font-medium text-foreground">{ride.passengerName || "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">{ride.driverName || "Unassigned"}</td>
                    <td className="px-5 py-3 text-muted-foreground max-w-[200px] truncate">{ride.pickupAddress}</td>
                    <td className="px-5 py-3 text-foreground font-semibold">${ride.fare?.toFixed(2)}</td>
                    <td className="px-5 py-3">{statusBadge(ride.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
