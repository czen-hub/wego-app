import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/firebase";
import type { Driver } from "@/types";
import { Search, Star, CheckCircle, AlertCircle } from "lucide-react";

export default function Drivers() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    getDocs(query(collection(db, "drivers"), orderBy("name", "asc")))
      .then((snap) => {
        setDrivers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Driver)));
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  const filtered = drivers.filter((d) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      d.name?.toLowerCase().includes(q) ||
      d.email?.toLowerCase().includes(q) ||
      d.phone?.includes(q) ||
      d.licensePlate?.toLowerCase().includes(q)
    );
  });

  const verified   = drivers.filter((d) => d.verified).length;
  const unverified = drivers.length - verified;

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Drivers</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {drivers.length} total · {verified} verified · {unverified} pending verification
        </p>
      </div>

      <div className="relative max-w-80">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by name, email, plate…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-xl text-sm focus:outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border text-xs text-muted-foreground font-medium">
            {filtered.length} driver{filtered.length !== 1 ? "s" : ""}
          </div>
          {filtered.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-muted-foreground">No drivers found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-secondary/30">
                  <tr>
                    {["Driver", "Email", "Phone", "Vehicle", "Rating", "Rides", "Verified"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((driver) => (
                    <tr key={driver.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm flex-shrink-0">
                            {(driver.name || "?").charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-foreground">{driver.name || "—"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{driver.email || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{driver.phone || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {driver.vehicleMake
                          ? `${driver.vehicleYear ?? ""} ${driver.vehicleMake} ${driver.vehicleModel ?? ""}`
                          : "—"}
                        {driver.licensePlate && (
                          <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 bg-secondary rounded-md text-muted-foreground">{driver.licensePlate}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="flex items-center gap-1">
                          <Star size={12} className="text-amber-500 fill-amber-500" />
                          <span className="font-semibold text-foreground">{driver.rating?.toFixed(2) ?? "—"}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-foreground font-semibold">{driver.totalRides ?? 0}</td>
                      <td className="px-4 py-3">
                        {driver.verified ? (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle size={14} />
                            <span className="text-[10px] font-semibold">Verified</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-amber-600">
                            <AlertCircle size={14} />
                            <span className="text-[10px] font-semibold">Pending</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
