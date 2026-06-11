import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, doc, updateDoc } from "firebase/firestore";
import { db } from "@/firebase";
import type { Driver } from "@/types";
import {
  Search, Star, CheckCircle, AlertCircle, X,
  ShieldCheck, ShieldOff, Car, CircleDot,
} from "lucide-react";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-border last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground text-right">{value}</span>
    </div>
  );
}

function DriverPanel({
  driver,
  onClose,
  onUpdated,
}: {
  driver: Driver;
  onClose: () => void;
  onUpdated: (d: Driver) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function verify() {
    setBusy(true);
    try {
      await updateDoc(doc(db, "drivers", driver.id), { verified: true });
      onUpdated({ ...driver, verified: true });
    } finally {
      setBusy(false);
    }
  }

  async function toggleSuspend() {
    setBusy(true);
    try {
      const suspended = !driver.suspended;
      await updateDoc(doc(db, "drivers", driver.id), { suspended });
      onUpdated({ ...driver, suspended });
    } finally {
      setBusy(false);
    }
  }

  const vehicleLabel = driver.vehicleMake
    ? `${driver.vehicleYear ?? ""} ${driver.vehicleMake} ${driver.vehicleModel ?? ""}`.trim()
    : "—";

  const memberSinceLabel = driver.memberSince
    ? new Date((driver.memberSince as unknown as { seconds: number }).seconds * 1000).toLocaleDateString(
        "en-US",
        { month: "long", day: "numeric", year: "numeric" }
      )
    : "—";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-[360px] bg-card border-l border-border shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg font-bold text-foreground">Driver Profile</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Avatar + name */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-2xl flex-shrink-0">
              {(driver.name || "?").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold text-foreground truncate">{driver.name || "—"}</p>
              <p className="text-sm text-muted-foreground truncate">{driver.email || "—"}</p>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                {driver.verified ? (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full">
                    <CheckCircle size={10} /> Verified
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full">
                    <AlertCircle size={10} /> Pending
                  </span>
                )}
                {driver.suspended && (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-red-600 bg-red-500/10 px-2 py-0.5 rounded-full">
                    <ShieldOff size={10} /> Suspended
                  </span>
                )}
                {driver.isOnline && (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 bg-blue-500/10 px-2 py-0.5 rounded-full">
                    <CircleDot size={10} /> Online
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-secondary/50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{driver.totalRides ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Total Rides</p>
            </div>
            <div className="bg-secondary/50 rounded-xl p-4 text-center">
              <div className="flex items-center justify-center gap-1">
                <Star size={16} className="text-amber-500 fill-amber-500" />
                <p className="text-2xl font-bold text-foreground">{driver.rating?.toFixed(2) ?? "—"}</p>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Rating</p>
            </div>
          </div>

          {/* Info table */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Details</p>
            <div className="bg-secondary/30 rounded-xl px-4">
              <InfoRow label="Phone" value={driver.phone || "—"} />
              <InfoRow label="Vehicle" value={vehicleLabel} />
              <InfoRow label="License Plate" value={driver.licensePlate || "—"} />
              <InfoRow label="Member Since" value={memberSinceLabel} />
            </div>
          </div>
        </div>

        {/* Action footer */}
        <div className="px-6 py-5 border-t border-border space-y-2 flex-shrink-0">
          {!driver.verified && !driver.suspended && (
            <button
              type="button"
              onClick={verify}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <ShieldCheck size={15} />
              Approve Driver
            </button>
          )}
          <button
            type="button"
            onClick={toggleSuspend}
            disabled={busy}
            className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50 ${
              driver.suspended
                ? "bg-green-500/10 text-green-700 hover:bg-green-500/20"
                : "bg-red-500/10 text-red-700 hover:bg-red-500/20"
            }`}
          >
            <ShieldOff size={15} />
            {driver.suspended ? "Reinstate Driver" : "Suspend Driver"}
          </button>
        </div>
      </div>
    </>
  );
}

export default function Drivers() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Driver | null>(null);

  useEffect(() => {
    getDocs(query(collection(db, "drivers"), orderBy("name", "asc")))
      .then((snap) => {
        setDrivers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Driver)));
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  function handleUpdated(updated: Driver) {
    setDrivers((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    setSelected(updated);
  }

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

  const verified   = drivers.filter((d) => d.verified && !d.suspended).length;
  const suspended  = drivers.filter((d) => d.suspended).length;
  const pending    = drivers.filter((d) => !d.verified && !d.suspended).length;

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Drivers</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {drivers.length} total · {verified} verified · {pending} pending
          {suspended > 0 ? ` · ${suspended} suspended` : ""}
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
            {filtered.length} driver{filtered.length !== 1 ? "s" : ""} · click a row to manage
          </div>
          {filtered.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-muted-foreground">No drivers found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-secondary/30">
                  <tr>
                    {["Driver", "Contact", "Vehicle", "Rating", "Rides", "Status"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((driver) => (
                    <tr
                      key={driver.id}
                      onClick={() => setSelected(driver)}
                      className="hover:bg-secondary/30 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm flex-shrink-0">
                            {(driver.name || "?").charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-foreground whitespace-nowrap">{driver.name || "—"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-muted-foreground text-xs">{driver.email || "—"}</p>
                        <p className="text-muted-foreground text-xs">{driver.phone || "—"}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {driver.vehicleMake
                          ? `${driver.vehicleYear ?? ""} ${driver.vehicleMake} ${driver.vehicleModel ?? ""}`.trim()
                          : <span className="flex items-center gap-1 text-muted-foreground/50"><Car size={13} /> None</span>}
                        {driver.licensePlate && (
                          <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 bg-secondary rounded-md text-muted-foreground">
                            {driver.licensePlate}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="flex items-center gap-1">
                          <Star size={11} className="text-amber-500 fill-amber-500" />
                          <span className="font-semibold text-foreground">{driver.rating?.toFixed(2) ?? "—"}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-foreground font-semibold">{driver.totalRides ?? 0}</td>
                      <td className="px-4 py-3">
                        {driver.suspended ? (
                          <span className="flex items-center gap-1 text-red-600">
                            <ShieldOff size={13} />
                            <span className="text-[10px] font-semibold">Suspended</span>
                          </span>
                        ) : driver.verified ? (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle size={13} />
                            <span className="text-[10px] font-semibold">Verified</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-amber-600">
                            <AlertCircle size={13} />
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

      {selected && (
        <DriverPanel
          driver={selected}
          onClose={() => setSelected(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}
